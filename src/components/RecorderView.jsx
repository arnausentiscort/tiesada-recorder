import { useState, useEffect, useCallback } from 'react'
import {
  Circle, Square, Upload, Wifi, WifiOff, CheckCircle,
  AlertCircle, BatteryLow, Pencil, LogOut, ExternalLink, HardDrive, Download
} from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { useBattery } from '../hooks/useBattery'
import { useStorage } from '../hooks/useStorage'
import { useSync } from '../hooks/useSync'
import {
  initGoogleAuth, requestDriveAuth, requestAccountChange,
  isDriveAuthed, getAccountInfo, uploadToDrive, ensureModelsFolder
} from '../drive'
import CameraPreview from './CameraPreview'

const COLAB_ID = import.meta.env.VITE_COLAB_NOTEBOOK_ID

function fmt(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

function fmtMB(bytes) {
  return bytes > 1e8 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`
}

function StatsRow({ videoInfo, battery, connected, isLocal }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono">
      <span className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
        {connected ? 'OK' : 'OFF'}
      </span>
      {battery ? (
        <span className={battery.level < 20 ? 'text-red-400' : battery.level < 40 ? 'text-yellow-400' : 'text-gray-400'}>
          {battery.charging ? '⚡' : '🔋'}{battery.level}%
        </span>
      ) : (
        <span className="text-gray-700">🔋—</span>
      )}
      {videoInfo?.width
        ? <span className="text-gray-400">{videoInfo.width}×{videoInfo.height} {videoInfo.frameRate}fps</span>
        : isLocal ? <span className="text-gray-700">—×—</span> : null}
    </div>
  )
}

function DeviceCard({ label, role, isRecording, elapsed, battery, connected, videoInfo, isLocal }) {
  return (
    <div className={`bg-[#1E1E1E] rounded-2xl p-3 border ${connected ? 'border-gray-700' : 'border-red-900/40'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 text-xs font-medium">{label}</span>
          <span className="text-gray-600 text-xs">({role === 'master' ? 'ESQ' : 'DRETA'})</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
      </div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="font-mono text-2xl font-bold tabular-nums">{fmt(elapsed)}</span>
        {isRecording && <span className="text-red-400 text-xs font-semibold tracking-wider">REC</span>}
      </div>
      <StatsRow videoInfo={videoInfo} battery={battery} connected={connected} isLocal={isLocal} />
    </div>
  )
}

function AccountBadge({ info, onChangeAccount }) {
  const lastEmail = localStorage.getItem('lastDriveEmail')
  const email = info?.email || lastEmail

  if (!isDriveAuthed()) {
    return (
      <button
        onClick={requestDriveAuth}
        className="flex items-center gap-2 bg-[#1E1E1E] border border-[#E5C07B]/40 text-[#E5C07B] text-xs px-3 py-2 rounded-xl"
      >
        <HardDrive size={14} />
        Connecta Drive
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-[#1E1E1E] border border-gray-700 rounded-xl px-3 py-2">
      {info?.picture && (
        <img src={info.picture} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
      )}
      <span className="text-gray-400 text-xs truncate max-w-[140px]">{email || 'Drive OK'}</span>
      <button onClick={onChangeAccount} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
        <LogOut size={12} />
      </button>
    </div>
  )
}

function RecordingSummary({ blob, elapsed, videoInfo, partNum, sideLabel, matchName, onNewPart, isMaster }) {
  const colabUrl = COLAB_ID ? `https://colab.research.google.com/drive/${COLAB_ID}` : null
  const ext = blob?.type.includes('mp4') ? 'mp4' : 'webm'
  const filename = `${sideLabel}_part${partNum}.${ext}`

  return (
    <div className="w-full max-w-xs space-y-3">
      {/* Summary card */}
      <div className="bg-[#1E1E1E] border border-gray-700 rounded-xl p-4 space-y-2">
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Resum gravació</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
          <span className="text-gray-600">Fitxer</span>
          <span className="text-white truncate">{filename}</span>
          <span className="text-gray-600">Durada</span>
          <span className="text-white">{fmt(elapsed)}</span>
          <span className="text-gray-600">Pes</span>
          <span className="text-white">{blob ? fmtMB(blob.size) : '—'}</span>
          {videoInfo?.width && <>
            <span className="text-gray-600">Resolució</span>
            <span className="text-white">{videoInfo.width}×{videoInfo.height}</span>
            <span className="text-gray-600">FPS</span>
            <span className="text-white">{videoInfo.frameRate}</span>
          </>}
          <span className="text-gray-600">Carpeta</span>
          <span className="text-gray-500 truncate">tiesada_partits/{matchName}/</span>
        </div>
      </div>

      {colabUrl && (
        <a
          href={colabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#1E1E1E] border border-gray-600 text-gray-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 active:opacity-80 text-sm"
        >
          <ExternalLink size={16} />
          Processar a Google Colab
        </a>
      )}

      {isMaster && (
        <button
          onClick={onNewPart}
          className="w-full text-[#E5C07B]/60 text-sm py-2 border border-[#E5C07B]/20 rounded-xl"
        >
          + Gravar part {partNum + 1}
        </button>
      )}
    </div>
  )
}

export default function RecorderView({ role, matchName: initialMatchName, roomCode, onDisconnect }) {
  const { stream, isRecording, elapsed, blob, error, videoInfo, partNum, initStream, start, stop, release, resetBlob } = useRecorder()
  const battery = useBattery()
  const storage = useStorage()
  const [remote, setRemote] = useState({ connected: false, isRecording: false, elapsed: 0, battery: null, videoInfo: null })
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [uploadError, setUploadError] = useState(null)
  const [driveAuthed, setDriveAuthed] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [accountInfo, setAccountInfo] = useState(null)
  const [modelsWarning, setModelsWarning] = useState(false)
  const [autostopMsg, setAutostopMsg] = useState(false)
  const [matchName, setMatchName] = useState(initialMatchName)
  const [editingName, setEditingName] = useState(false)
  const [downloadInfo, setDownloadInfo] = useState(null) // { url, filename }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  const isMaster = role === 'master'
  const sideLabel = isMaster ? 'esquerra' : 'dreta'

  // Open camera on mount, release on unmount
  useEffect(() => {
    initStream()
    return () => release()
  }, [])

  // Init Google Drive auth
  useEffect(() => {
    const tryInit = () => {
      if (window.google?.accounts) {
        initGoogleAuth(
          (info) => { setDriveAuthed(true); setAccountInfo(info); setAuthError(null) },
          (msg) => setAuthError(msg)
        )
      } else {
        setTimeout(tryInit, 500)
      }
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

  // Auto-download when blob is ready, keep URL alive for manual button
  useEffect(() => {
    if (!blob) {
      setDownloadInfo(null)
      return
    }
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const filename = `${sideLabel}_part${partNum}.${ext}`
    const url = URL.createObjectURL(blob)
    setDownloadInfo({ url, filename })

    // Auto-trigger (works on Android; opens new tab on iOS)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    return () => URL.revokeObjectURL(url)
  }, [blob])

  // Auto-stop recording at battery <= 5%
  useEffect(() => {
    if (!isRecording || !battery || battery.charging) return
    if (battery.level <= 5) {
      stop()
      sendCommand('stop')
      setAutostopMsg(true)
    }
  }, [battery?.level, isRecording])

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

  // Broadcast status every 2s
  useEffect(() => {
    const id = setInterval(() => sendStatus({ isRecording, elapsed, battery, videoInfo }), 2000)
    return () => clearInterval(id)
  }, [isRecording, elapsed, battery, videoInfo, sendStatus])

  async function handleStart() {
    resetBlob()
    setUploadStatus('idle')
    setAutostopMsg(false)
    await start()
    sendCommand('start')
  }

  function handleStop() {
    stop()
    sendCommand('stop')
  }

  async function handleUpload() {
    if (!blob) return
    if (!isDriveAuthed()) { requestDriveAuth(); return }
    setUploadStatus('uploading')
    setUploadError(null)
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const filename = `${sideLabel}_part${partNum}.${ext}`
      await uploadToDrive(blob, filename, matchName)
      setUploadStatus('done')
      // Check models folder after first upload
      const { hasBestPt } = await ensureModelsFolder()
      if (hasBestPt === false) setModelsWarning(true)
    } catch (err) {
      setUploadError(err.message)
      setUploadStatus('error')
    }
  }

  function handleNewPart() {
    resetBlob()
    setUploadStatus('idle')
    if (isMaster) handleStart()
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 gap-3 pb-8">

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
            <button onClick={() => setEditingName(true)} className="flex items-center gap-2 group">
              <span className="text-[#E5C07B] font-bold text-lg leading-tight truncate">{matchName}</span>
              <Pencil size={12} className="text-gray-600 flex-shrink-0" />
            </button>
          )}
          <p className="text-gray-600 text-xs mt-0.5">
            <span className="font-mono">{roomCode}</span>
            {' · '}<span className="uppercase">{role}</span>
            {' · '}part {partNum || '—'}
          </p>
        </div>
        <button
          onClick={onDisconnect}
          className="border border-gray-700 text-gray-500 text-xs rounded-lg px-3 py-1.5 active:opacity-70 flex-shrink-0"
        >
          Sortir
        </button>
      </div>

      {/* Google account */}
      <AccountBadge info={accountInfo} onChangeAccount={() => {
        requestAccountChange()
      }} />

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

      {/* Camera preview (shown when not recording or before recording) */}
      {!isRecording && !blob && (
        <CameraPreview stream={stream} videoInfo={videoInfo} />
      )}

      {/* Main control / post-recording */}
      <div className="flex flex-col items-center gap-5">
        {blob && !isRecording ? (
          <>
            {/* Local save — always visible while blob exists */}
            {downloadInfo && (
              <div className="w-full max-w-xs space-y-1.5">
                <a
                  href={downloadInfo.url}
                  download={downloadInfo.filename}
                  className="w-full bg-[#1E1E1E] border border-gray-600 text-gray-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 text-sm active:opacity-70"
                >
                  <Download size={16} />
                  Guardar al mòbil
                  {isIOS && <span className="text-gray-600 text-xs ml-1">(mantén premut)</span>}
                </a>
                {isIOS && (
                  <p className="text-gray-700 text-xs text-center">
                    A iOS: mantén premut → "Descarregar fitxer vinculat"
                  </p>
                )}
              </div>
            )}

            {uploadStatus === 'idle' && (
              <button
                onClick={handleUpload}
                className="w-full max-w-xs bg-[#1E1E1E] border border-[#E5C07B] text-[#E5C07B] font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:opacity-80"
              >
                <Upload size={20} />
                {isDriveAuthed() ? 'Puja a Drive' : 'Connecta Drive i puja'}
              </button>
            )}
            {uploadStatus === 'uploading' && (
              <div className="w-full max-w-xs bg-[#1E1E1E] border border-gray-700 text-gray-400 py-4 rounded-xl flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-[#E5C07B] border-t-transparent rounded-full animate-spin" />
                Pujant a Drive...
              </div>
            )}
            {uploadStatus === 'done' && (
              <RecordingSummary
                blob={blob}
                elapsed={elapsed}
                videoInfo={videoInfo}
                partNum={partNum}
                sideLabel={sideLabel}
                matchName={matchName}
                onNewPart={handleNewPart}
                isMaster={isMaster}
              />
            )}
            {uploadStatus === 'error' && (
              <div className="w-full max-w-xs space-y-2">
                <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {uploadError}
                </div>
                <button onClick={() => setUploadStatus('idle')} className="w-full text-gray-500 text-sm py-2">
                  Torna-ho a intentar
                </button>
              </div>
            )}
            {/* Show summary before upload too */}
            {uploadStatus === 'idle' && (
              <p className="text-gray-600 text-xs font-mono text-center">
                {sideLabel}_part{partNum} · {blob ? fmtMB(blob.size) : ''} · {fmt(elapsed)}
              </p>
            )}
          </>
        ) : isMaster ? (
          !isRecording ? (
            <button
              onClick={handleStart}
              className="w-40 h-40 bg-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform recording-pulse"
            >
              <Circle size={32} fill="white" color="white" />
              <span className="font-bold text-xl tracking-wider">GRAVAR</span>
              {partNum > 0 && <span className="text-white/60 text-xs">part {partNum + 1}</span>}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-40 h-40 bg-[#1E1E1E] border-4 border-red-600 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform"
            >
              <Square size={28} fill="#ef4444" color="#ef4444" />
              <span className="font-bold text-xl text-red-400 tracking-wider">PARAR</span>
              <span className="text-red-400/70 text-xs font-mono">{fmt(elapsed)}</span>
            </button>
          )
        ) : (
          <div className="text-center">
            {!remote.connected ? (
              <>
                <div className="w-20 h-20 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-3">
                  <WifiOff size={28} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm">Esperant connexió del master...</p>
              </>
            ) : isRecording ? (
              <>
                <div className="w-20 h-20 rounded-full bg-red-600 recording-pulse mx-auto flex items-center justify-center mb-3">
                  <Circle size={28} fill="white" color="white" />
                </div>
                <p className="text-red-400 font-bold text-lg tracking-wider">GRAVANT</p>
                <p className="font-mono text-2xl font-bold mt-1">{fmt(elapsed)}</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-[#1E1E1E] border border-gray-700 mx-auto flex items-center justify-center mb-3">
                  <Wifi size={28} className="text-green-400" />
                </div>
                <p className="text-green-400 font-medium text-sm">Connectat · esperant master</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Warnings */}
      {autostopMsg && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
          <BatteryLow size={16} />
          Gravació aturada automàticament — bateria al 5%
        </div>
      )}

      {battery && battery.level <= 15 && battery.level > 5 && !battery.charging && (
        <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-400 p-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
          <BatteryLow size={16} />
          Bateria baixa ({battery.level}%) — connecta el carregador
        </div>
      )}

      {modelsWarning && (
        <div className="bg-orange-900/20 border border-orange-700 text-orange-400 p-3 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>No s'ha trobat <code className="font-mono">best.pt</code> a <code className="font-mono">tiesada_partits/models/</code> del Drive. Puja el model abans de processar.</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl text-sm text-center">
          Error càmera: {error}
        </div>
      )}

      {authError && (
        <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      {/* Storage estimate */}
      {storage && (
        <p className="text-center text-gray-700 text-xs font-mono">
          Espai lliure al dispositiu: ~{storage.freeGB} GB
        </p>
      )}
    </div>
  )
}
