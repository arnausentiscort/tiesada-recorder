import { useState, useEffect, useCallback, useRef } from 'react'
import { Circle, Square, Upload, Wifi, WifiOff, CheckCircle, AlertCircle, BatteryLow } from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { useBattery } from '../hooks/useBattery'
import { useSync } from '../hooks/useSync'
import { initGoogleAuth, requestDriveAuth, isDriveAuthed, uploadToDrive } from '../drive'

function fmt(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

function BatteryBadge({ battery }) {
  if (!battery) return <span className="text-gray-600 text-xs">🔋 —</span>
  const color = battery.level < 20 ? 'text-red-400' : battery.level < 40 ? 'text-yellow-400' : 'text-green-400'
  return <span className={`text-xs ${color}`}>{battery.charging ? '⚡' : '🔋'} {battery.level}%</span>
}

function DeviceCard({ label, isRecording, elapsed, battery, connected }) {
  return (
    <div className={`bg-[#1E1E1E] rounded-2xl p-4 border ${connected ? 'border-gray-700' : 'border-red-900/50'}`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
          <BatteryBadge battery={battery} />
          {connected
            ? <Wifi size={12} className="text-green-400" />
            : <WifiOff size={12} className="text-red-400" />
          }
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
        <span className="font-mono text-3xl font-bold tabular-nums">{fmt(elapsed)}</span>
        {isRecording && <span className="text-red-400 text-xs font-semibold tracking-wider">REC</span>}
      </div>
    </div>
  )
}

export default function RecorderView({ role, matchName, roomCode, onDisconnect }) {
  const { isRecording, elapsed, blob, error, start, stop, reset } = useRecorder()
  const battery = useBattery()
  const [remote, setRemote] = useState({ connected: false, isRecording: false, elapsed: 0, battery: null })
  const [driveReady, setDriveReady] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [uploadError, setUploadError] = useState(null)
  const statusRef = useRef(null)

  const isMaster = role === 'master'

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
    const id = setInterval(() => sendStatus({ isRecording, elapsed, battery }), 2000)
    return () => clearInterval(id)
  }, [isRecording, elapsed, battery, sendStatus])

  async function handleStart() {
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
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      const filename = `${matchName}_${role}_${ts}.${ext}`
      await uploadToDrive(blob, filename, matchName)
      setUploadStatus('done')
    } catch (err) {
      setUploadError(err.message)
      setUploadStatus('error')
    }
  }

  function handleNewRecording() {
    reset()
    setUploadStatus('idle')
    setUploadError(null)
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 gap-4 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start pt-2">
        <div>
          <p className="text-[#E5C07B] font-bold text-lg leading-tight">{matchName}</p>
          <p className="text-gray-600 text-xs">Sala: <span className="font-mono">{roomCode}</span> · <span className="uppercase">{role}</span></p>
        </div>
        <button
          onClick={onDisconnect}
          className="border border-gray-700 text-gray-500 text-xs rounded-lg px-3 py-1.5 active:opacity-70"
        >
          Sortir
        </button>
      </div>

      {/* Device cards */}
      <div className="grid grid-cols-2 gap-3">
        <DeviceCard
          label={isMaster ? 'Master (tu)' : 'Master'}
          isRecording={isMaster ? isRecording : remote.isRecording}
          elapsed={isMaster ? elapsed : remote.elapsed}
          battery={isMaster ? battery : remote.battery}
          connected={true}
        />
        <DeviceCard
          label={isMaster ? 'Slave' : 'Slave (tu)'}
          isRecording={isMaster ? remote.isRecording : isRecording}
          elapsed={isMaster ? remote.elapsed : elapsed}
          battery={isMaster ? remote.battery : battery}
          connected={remote.connected}
        />
      </div>

      {/* Main control */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-6">
        {isMaster ? (
          !isRecording ? (
            <button
              onClick={handleStart}
              className="w-44 h-44 bg-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform recording-pulse"
            >
              <Circle size={36} fill="white" color="white" />
              <span className="font-bold text-xl tracking-wider">GRAVAR</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-44 h-44 bg-[#1E1E1E] border-4 border-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform"
            >
              <Square size={32} fill="#ef4444" color="#ef4444" />
              <span className="font-bold text-xl text-red-400 tracking-wider">PARAR</span>
            </button>
          )
        ) : (
          <div className="text-center">
            {!remote.connected ? (
              <div>
                <div className="w-24 h-24 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-4">
                  <WifiOff size={36} className="text-gray-600" />
                </div>
                <p className="text-gray-500">Esperant connexió del master...</p>
                <p className="text-gray-700 text-sm mt-1 font-mono">{roomCode}</p>
              </div>
            ) : isRecording ? (
              <div>
                <div className="w-24 h-24 rounded-full bg-red-600 recording-pulse mx-auto flex items-center justify-center mb-4">
                  <Circle size={36} fill="white" color="white" />
                </div>
                <p className="text-red-400 font-bold text-xl tracking-wider">GRAVANT</p>
                <p className="font-mono text-3xl font-bold mt-2">{fmt(elapsed)}</p>
              </div>
            ) : (
              <div>
                <div className="w-24 h-24 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-4">
                  <Wifi size={36} className="text-green-400" />
                </div>
                <p className="text-green-400 font-medium">Connectat</p>
                <p className="text-gray-500 text-sm mt-1">Esperant senyal del master...</p>
              </div>
            )}
          </div>
        )}

        {/* Post-recording: upload section */}
        {blob && !isRecording && (
          <div className="w-full max-w-xs space-y-3">
            <p className="text-center text-gray-500 text-sm">
              Vídeo llest · {(blob.size / 1024 / 1024).toFixed(1)} MB
            </p>

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
                <button onClick={handleNewRecording} className="w-full text-gray-600 text-sm py-2">
                  Nova gravació
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
