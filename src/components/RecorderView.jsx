import { useState, useEffect, useCallback } from 'react'
import { Circle, Square, Upload, Wifi, WifiOff, CheckCircle, AlertCircle, BatteryLow, Pencil } from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { useBattery } from '../hooks/useBattery'
import { useSync } from '../hooks/useSync'
import { initGoogleAuth, requestDriveAuth, isDriveAuthed, uploadToDrive } from '../drive'

function fmt(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

function StatsRow({ videoInfo, battery, isRecording, elapsed, connected, isLocal }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono">
      {/* Connexió */}
      <span className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
        {connected ? 'OK' : 'OFF'}
      </span>

      {/* Bateria */}
      {battery ? (
        <span className={battery.level < 20 ? 'text-red-400' : battery.level < 40 ? 'text-yellow-400' : 'text-gray-400'}>
          {battery.charging ? '⚡' : '🔋'}{battery.level}%
        </span>
      ) : (
        <span className="text-gray-700">🔋—</span>
      )}

      {/* Resolució i fps (només si disponible) */}
      {videoInfo?.width ? (
        <span className="text-gray-400">{videoInfo.width}×{videoInfo.height}</span>
      ) : isLocal ? (
        <span className="text-gray-700">—×—</span>
      ) : null}

      {videoInfo?.frameRate ? (
        <span className="text-gray-400">{videoInfo.frameRate}fps</span>
      ) : isLocal && videoInfo ? (
        <span className="text-gray-700">—fps</span>
      ) : null}
    </div>
  )
}

function DeviceCard({ label, role, isRecording, elapsed, battery, connected, videoInfo, isLocal }) {
  const sideLabel = role === 'master' ? 'ESQUERRA' : 'DRETA'
  return (
    <div className={`bg-[#1E1E1E] rounded-2xl p-3 border ${connected ? 'border-gray-700' : 'border-red-900/40'}`}>
      <div className="flex justify-between items-center mb-2">
        <div>
          <span className="text-gray-400 text-xs font-medium">{label}</span>
          <span className="text-gray-600 text-xs ml-1.5">({sideLabel})</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-2xl font-bold tabular-nums">{fmt(elapsed)}</span>
        {isRecording && <span className="text-red-400 text-xs font-semibold tracking-wider">REC</span>}
      </div>

      <StatsRow
        videoInfo={videoInfo}
        battery={battery}
        isRecording={isRecording}
        elapsed={elapsed}
        connected={connected}
        isLocal={isLocal}
      />
    </div>
  )
}

export default function RecorderView({ role, matchName: initialMatchName, roomCode, onDisconnect }) {
  const { isRecording, elapsed, blob, error, videoInfo, partNum, start, stop, reset } = useRecorder()
  const battery = useBattery()
  const [remote, setRemote] = useState({ connected: false, isRecording: false, elapsed: 0, battery: null, videoInfo: null })
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [uploadError, setUploadError] = useState(null)
  const [driveReady, setDriveReady] = useState(false)

  // Editable match name (used as Drive folder)
  const [matchName, setMatchName] = useState(initialMatchName)
  const [editingName, setEditingName] = useState(false)

  const isMaster = role === 'master'
  const sideLabel = isMaster ? 'esquerra' : 'dreta'

  // Init Google Drive auth
  useEffect(() => {
    const tryInit = () => {
      if (window.google?.accounts) initGoogleAuth(() => setDriveReady(true))
      else setTimeout(tryInit, 500)
    }
    tryInit()
  }, [])

  // Screen Wake Lock during recording
  useEffect(() => {
    if (!isRecording || !navigator.wakeLock) return
    let wl
    navigator.wakeLock.request('screen').then(l => { wl = l }).catch(() => {})
    return () => { wl?.release() }
  }, [isRecording])

  const handleCommand = useCallback(async ({ type }) => {
    if (isMaster) return
    if (type === 'start') await start()
    if (type === 'stop') stop()
  }, [isMaster, start, stop])

  const handleRemoteStatus = useCallback((payload) => {
    setRemote(prev => ({ ...prev, ...payload, connected: true }))
  }, [])

  const handlePeerJoin = useCallback(() => {
    setRemote(prev => ({ ...prev, connected: true }))
  }, [])

  const { sendCommand, sendStatus } = useSync({
    roomCode, role,
    onCommand: handleCommand,
    onRemoteStatus: handleRemoteStatus,
    onPeerJoin: handlePeerJoin,
  })

  // Broadcast own status every 2 seconds
  useEffect(() => {
    const id = setInterval(() => sendStatus({ isRecording, elapsed, battery, videoInfo }), 2000)
    return () => clearInterval(id)
  }, [isRecording, elapsed, battery, videoInfo, sendStatus])

  async function handleStart() {
    reset()
    setUploadStatus('idle')
    await start()
    sendCommand('start')
  }

  function handleStop() {
    stop()
    sendCommand('stop')
  }

  async function handleUpload() {
    if (!blob) return
    if (!isDriveAuthed()) {
      requestDriveAuth()
      return
    }
    setUploadStatus('uploading')
    setUploadError(null)
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const filename = `${sideLabel}_part${partNum}.${ext}`
      await uploadToDrive(blob, filename, matchName)
      setUploadStatus('done')
    } catch (err) {
      setUploadError(err.message)
      setUploadStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 gap-4 pb-8">

      {/* Header */}
      <div className="flex justify-between items-start pt-2">
        <div className="flex-1 min-w-0 mr-3">
          {editingName ? (
            <input
              autoFocus
              value={matchName}
              onChange={e => setMatchName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              className="bg-transparent border-b border-[#E5C07B] text-[#E5C07B] font-bold text-lg w-full focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-2 group"
            >
              <span className="text-[#E5C07B] font-bold text-lg leading-tight truncate">{matchName}</span>
              <Pencil size={12} className="text-gray-600 group-active:text-[#E5C07B] flex-shrink-0" />
            </button>
          )}
          <p className="text-gray-600 text-xs mt-0.5">
            Sala: <span className="font-mono">{roomCode}</span>
            {' · '}<span className="uppercase">{role}</span>
            {' · '}<span className="text-gray-500">part {partNum || '—'}</span>
          </p>
        </div>
        <button
          onClick={onDisconnect}
          className="border border-gray-700 text-gray-500 text-xs rounded-lg px-3 py-1.5 active:opacity-70 flex-shrink-0"
        >
          Sortir
        </button>
      </div>

      {/* Device cards */}
      <div className="grid grid-cols-2 gap-3">
        <DeviceCard
          label={isMaster ? 'Master (tu)' : 'Master'}
          role="master"
          isRecording={isMaster ? isRecording : remote.isRecording}
          elapsed={isMaster ? elapsed : remote.elapsed}
          battery={isMaster ? battery : remote.battery}
          videoInfo={isMaster ? videoInfo : remote.videoInfo}
          connected={true}
          isLocal={isMaster}
        />
        <DeviceCard
          label={isMaster ? 'Slave' : 'Slave (tu)'}
          role="slave"
          isRecording={isMaster ? remote.isRecording : isRecording}
          elapsed={isMaster ? remote.elapsed : elapsed}
          battery={isMaster ? remote.battery : battery}
          videoInfo={isMaster ? remote.videoInfo : videoInfo}
          connected={remote.connected}
          isLocal={!isMaster}
        />
      </div>

      {/* Main control */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
        {isMaster ? (
          !isRecording ? (
            <button
              onClick={handleStart}
              className="w-44 h-44 bg-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform recording-pulse"
            >
              <Circle size={36} fill="white" color="white" />
              <span className="font-bold text-xl tracking-wider">GRAVAR</span>
              {partNum > 0 && <span className="text-white/60 text-xs">part {partNum + 1}</span>}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-44 h-44 bg-[#1E1E1E] border-4 border-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform"
            >
              <Square size={32} fill="#ef4444" color="#ef4444" />
              <span className="font-bold text-xl text-red-400 tracking-wider">PARAR</span>
              <span className="text-red-400/60 text-xs font-mono">{fmt(elapsed)}</span>
            </button>
          )
        ) : (
          <div className="text-center">
            {!remote.connected ? (
              <>
                <div className="w-24 h-24 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-4">
                  <WifiOff size={36} className="text-gray-600" />
                </div>
                <p className="text-gray-500">Esperant connexió del master...</p>
                <p className="text-gray-700 text-sm mt-1 font-mono">{roomCode}</p>
              </>
            ) : isRecording ? (
              <>
                <div className="w-24 h-24 rounded-full bg-red-600 recording-pulse mx-auto flex items-center justify-center mb-4">
                  <Circle size={36} fill="white" color="white" />
                </div>
                <p className="text-red-400 font-bold text-xl tracking-wider">GRAVANT</p>
                <p className="font-mono text-3xl font-bold mt-2">{fmt(elapsed)}</p>
                <p className="text-gray-600 text-xs mt-1">dreta_part{partNum}</p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-4">
                  <Wifi size={36} className="text-green-400" />
                </div>
                <p className="text-green-400 font-medium">Connectat</p>
                <p className="text-gray-500 text-sm mt-1">Esperant senyal del master...</p>
              </>
            )}
          </div>
        )}

        {/* Post-recording: upload section */}
        {blob && !isRecording && (
          <div className="w-full max-w-xs space-y-3">
            <div className="text-center space-y-0.5">
              <p className="text-gray-400 text-sm font-medium">
                {sideLabel}_part{partNum}.{blob.type.includes('mp4') ? 'mp4' : 'webm'}
              </p>
              <p className="text-gray-600 text-xs">{(blob.size / 1024 / 1024).toFixed(1)} MB · {fmt(elapsed)}</p>
              <p className="text-gray-700 text-xs">→ Drive: tiesada_partits/{matchName}/</p>
            </div>

            {uploadStatus === 'idle' && (
              <button
                onClick={handleUpload}
                className="w-full bg-[#1E1E1E] border border-[#E5C07B] text-[#E5C07B] font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:opacity-80"
              >
                <Upload size={20} />
                {isDriveAuthed() ? 'Puja a Drive' : 'Connecta Drive i puja'}
              </button>
            )}

            {uploadStatus === 'uploading' && (
              <div className="w-full bg-[#1E1E1E] border border-gray-700 text-gray-400 py-4 rounded-xl flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-[#E5C07B] border-t-transparent rounded-full animate-spin" />
                Pujant a Drive...
              </div>
            )}

            {uploadStatus === 'done' && (
              <div className="space-y-3">
                <div className="w-full bg-green-900/20 border border-green-700 text-green-400 py-4 rounded-xl flex items-center justify-center gap-2 font-bold">
                  <CheckCircle size={20} />
                  Pujat a Drive!
                </div>
                <button
                  onClick={isMaster ? handleStart : undefined}
                  disabled={!isMaster}
                  className="w-full text-gray-500 text-sm py-2 disabled:opacity-0"
                >
                  + Gravar part {partNum + 1}
                </button>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="space-y-2">
                <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {uploadError}
                </div>
                <button onClick={() => setUploadStatus('idle')} className="w-full text-gray-500 text-sm py-2">
                  Torna-ho a intentar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl text-sm text-center">
          Error càmera: {error}
        </div>
      )}

      {/* Battery warning */}
      {battery && battery.level < 15 && !battery.charging && (
        <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-400 p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
          <BatteryLow size={16} />
          Bateria baixa ({battery.level}%) — connecta el carregador
        </div>
      )}
    </div>
  )
}
