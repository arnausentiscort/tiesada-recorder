import { useEffect, useRef } from 'react'
import { Camera } from 'lucide-react'

function estimateFOV(videoInfo) {
  if (!videoInfo?.width || !videoInfo?.height) return null
  // Rough estimate based on typical smartphone main camera (~26mm equiv focal length)
  const sensorW = 18 // mm equivalent half-width approximation
  const focalLen = 26 // mm equivalent, typical main camera
  const fov = Math.round(2 * Math.atan(sensorW / focalLen) * (180 / Math.PI))
  // Scale by aspect compared to 16:9
  return fov
}

function FOVArc({ degrees }) {
  const half = (degrees * Math.PI) / 180 / 2
  const r = 28
  const cx = 32, cy = 8
  const x1 = cx - r * Math.sin(half)
  const y1 = cy + r * Math.cos(half)
  const x2 = cx + r * Math.sin(half)
  const y2 = cy + r * Math.cos(half)
  const large = degrees > 180 ? 1 : 0
  return (
    <svg viewBox="0 0 64 44" className="w-10 h-7" fill="none">
      <path
        d={`M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
        fill="rgba(229,192,123,0.15)"
        stroke="#E5C07B"
        strokeWidth="1"
      />
      <circle cx={cx} cy={cy} r="2" fill="#E5C07B" />
    </svg>
  )
}

export default function CameraPreview({ stream, videoInfo }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (stream) {
      el.srcObject = stream
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [stream])

  const fov = estimateFOV(videoInfo)

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <Camera size={28} className="text-gray-600" />
          <span className="text-gray-600 text-xs">Iniciant càmera...</span>
        </div>
      )}

      {/* Stats overlay */}
      {stream && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex justify-between items-end">
          <div className="text-xs font-mono text-white/70 space-y-0.5">
            {videoInfo?.width ? (
              <div>{videoInfo.width}×{videoInfo.height} · {videoInfo.frameRate}fps</div>
            ) : (
              <div className="text-white/30">detectant resolució...</div>
            )}
          </div>
          {fov && (
            <div className="flex items-center gap-1.5">
              <FOVArc degrees={fov} />
              <span className="text-xs text-[#E5C07B]/70">~{fov}° est.</span>
            </div>
          )}
        </div>
      )}

      {/* Recording indicator overlay */}
    </div>
  )
}
