'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (blob: Blob) => void
  onCancel:  () => void
  onSkip?:   () => void  // lanjut tanpa foto (misal kamera error)
}

export function SelfieCamera({ onCapture, onCancel, onSkip }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [preview,  setPreview]  = useState<string | null>(null)  // data URL preview
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStarting(false)
      } catch (e) {
        if (cancelled) return
        const err = e as { name?: string }
        if (err.name === 'NotAllowedError')
          setCamError('Izin kamera ditolak. Aktifkan izin kamera di browser.')
        else if (err.name === 'NotFoundError')
          setCamError('Kamera tidak ditemukan di perangkat ini.')
        else
          setCamError('Tidak bisa membuka kamera. Coba lagi.')
        setStarting(false)
      }
    }

    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      setCapturedBlob(blob)
      setPreview(canvas.toDataURL('image/jpeg', 0.85))
      // Stop stream setelah capture
      streamRef.current?.getTracks().forEach(t => t.stop())
    }, 'image/jpeg', 0.85)
  }

  function retake() {
    setPreview(null)
    setCapturedBlob(null)
    // Restart stream
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    }).catch(() => setCamError('Gagal membuka ulang kamera.'))
  }

  function confirm() {
    if (capturedBlob) onCapture(capturedBlob)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink-900">Selfie Absensi</p>
          <button onClick={onCancel} className="text-ink-400 hover:text-ink-700 text-lg leading-none">✕</button>
        </div>

        {/* Camera / preview area */}
        <div className="relative bg-black aspect-[4/3] overflow-hidden">
          {camError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-white text-sm">{camError}</p>
            </div>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white text-sm">Membuka kamera…</p>
                </div>
              )}
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"  // mirror untuk selfie
              />
            </>
          )}
          {/* Overlay guide circle */}
          {!preview && !camError && !starting && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-40 rounded-full border-2 border-white/50" />
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
        <div className="p-4 space-y-2">
          {camError ? (
            <div className="space-y-2">
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="w-full h-11 rounded-xl bg-pine text-white text-sm font-semibold"
                >
                  Lanjut Tanpa Foto
                </button>
              )}
              <button
                onClick={onCancel}
                className="w-full h-11 rounded-xl bg-sand-100 text-ink-700 text-sm font-medium"
              >
                Batal
              </button>
            </div>
          ) : preview ? (
            <div className="flex gap-2">
              <button
                onClick={retake}
                className="flex-1 h-11 rounded-xl border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors"
              >
                Ulangi
              </button>
              <button
                onClick={confirm}
                className="flex-1 h-11 rounded-xl bg-pine text-white text-sm font-semibold hover:bg-pine-700 transition-colors"
              >
                Gunakan Foto
              </button>
            </div>
          ) : (
            <button
              onClick={capture}
              disabled={starting}
              className="w-full h-11 rounded-xl bg-pine text-white text-sm font-semibold hover:bg-pine-700 disabled:opacity-50 transition-colors"
            >
              Ambil Foto
            </button>
          )}
          {!preview && !camError && (
            <button
              onClick={onCancel}
              className="w-full h-9 rounded-xl text-sm text-ink-400 hover:text-ink-700 transition-colors"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
