import { useState, useRef, useCallback } from 'react'

const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 3840 },
  height: { ideal: 2160 },
  frameRate: { ideal: 30 }
}

export function useRecorder() {
  const [stream, setStream] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState(null)
  const [videoInfo, setVideoInfo] = useState(null)
  const [partNum, setPartNum] = useState(0)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const partNumRef = useRef(0)

  // Opens camera for preview without starting recording
  const initStream = useCallback(async () => {
    if (streamRef.current?.active) return
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: true
      })
      streamRef.current = s
      setStream(s)
      const settings = s.getVideoTracks()[0]?.getSettings() || {}
      setVideoInfo({
        width: settings.width || null,
        height: settings.height || null,
        frameRate: settings.frameRate ? Math.round(settings.frameRate) : null
      })
    } catch (err) {
      setError(err.message)
    }
  }, [])

  // Starts recording on the existing stream (or opens it if needed)
  const start = useCallback(async () => {
    setError(null)
    setBlob(null)

    try {
      if (!streamRef.current?.active) await initStream()
      const s = streamRef.current
      if (!s) return

      const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm', '']
      const mimeType = candidates.find(t => t === '' || MediaRecorder.isTypeSupported(t))
      const recorder = new MediaRecorder(s, mimeType ? { mimeType } : {})
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setBlob(new Blob(chunksRef.current, { type: mimeType || 'video/mp4' }))
      }

      partNumRef.current += 1
      setPartNum(partNumRef.current)

      recorder.start(1000)
      setIsRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err) {
      setError(err.message)
    }
  }, [initStream])

  // Stops recording but keeps stream alive for preview
  const stop = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return
    recorderRef.current.stop()
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  // Closes camera completely (call on unmount)
  const release = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStream(null)
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const resetBlob = useCallback(() => {
    setBlob(null)
    setElapsed(0)
    setError(null)
  }, [])

  return { stream, isRecording, elapsed, blob, error, videoInfo, partNum, initStream, start, stop, release, resetBlob }
}
