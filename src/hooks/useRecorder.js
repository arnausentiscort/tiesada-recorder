import { useState, useRef, useCallback } from 'react'

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState(null)
  const [error, setError] = useState(null)
  const [videoInfo, setVideoInfo] = useState(null) // { width, height, frameRate }
  const [partNum, setPartNum] = useState(0)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const partNumRef = useRef(0)

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      })
      streamRef.current = stream

      // Read actual camera settings
      const settings = stream.getVideoTracks()[0]?.getSettings() || {}
      setVideoInfo({
        width: settings.width || null,
        height: settings.height || null,
        frameRate: settings.frameRate ? Math.round(settings.frameRate) : null
      })

      const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm', '']
      const mimeType = candidates.find(t => t === '' || MediaRecorder.isTypeSupported(t))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setBlob(new Blob(chunksRef.current, { type: mimeType || 'video/mp4' }))
      }

      // Increment part number on each new recording
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
  }, [])

  const stop = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return
    recorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const reset = useCallback(() => {
    setBlob(null)
    setElapsed(0)
    setError(null)
  }, [])

  return { isRecording, elapsed, blob, error, videoInfo, partNum, start, stop, reset }
}
