import { useEffect, useRef, useState } from 'react'
import { Camera, Check, RotateCcw, ScanFace } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/primitives'

/**
 * ON-05 liveness: taken live from the camera, never from a saved photo. The person follows three prompts while a
 * short clip records; a frame from the start is used for face matching. A real provider's liveness SDK can
 * replace this widget later without changing the page around it.
 */
export interface LiveCapture { frame: File; clip: File }

const STEPS = ['Look straight at the camera', 'Turn your head slowly to the left', 'Now slowly to the right']
const STEP_MS = 1600

function recorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
}

export function LiveCheck({ value, onChange }: { value?: LiveCapture; onChange: (v: LiveCapture | undefined) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<'idle' | 'starting' | 'ready' | 'recording'>('idle')
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string>()
  const [preview, setPreview] = useState<string>()

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  useEffect(() => stop, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const open = async () => {
    setError(undefined)
    if (!navigator.mediaDevices?.getUserMedia || !recorderType()) {
      setError('This browser can’t open a camera here. Use your phone, or a browser such as Chrome or Safari.')
      return
    }
    setPhase('starting')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false })
      if (video.current) { video.current.srcObject = stream.current; await video.current.play() }
      setPhase('ready')
    } catch {
      setPhase('idle')
      setError('We couldn’t use your camera. Allow camera access for this site and try again.')
    }
  }

  const grabFrame = () => new Promise<File>((resolve, reject) => {
    const v = video.current!
    if (!v.videoWidth) { reject(new Error('camera not ready')); return }
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    canvas.toBlob((b) => (b ? resolve(new File([b], 'live-frame.jpg', { type: 'image/jpeg' })) : reject(new Error('frame'))), 'image/jpeg', 0.9)
  })

  const record = async () => {
    try { await recordSteps() } catch {
      // A camera unplugged or a recorder failing mid-way: start over cleanly instead of hanging.
      stop(); setPhase('idle'); setStep(0)
      setError('The live check didn’t finish. Open the camera and try again.')
    }
  }

  const recordSteps = async () => {
    const type = recorderType()!
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream.current!, { mimeType: type })
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
    setPhase('recording'); setStep(0)
    recorder.start()
    await new Promise((r) => setTimeout(r, 700))
    const frame = await grabFrame()
    for (let n = 1; n < STEPS.length; n++) { await new Promise((r) => setTimeout(r, STEP_MS)); setStep(n) }
    await new Promise((r) => setTimeout(r, STEP_MS))
    recorder.stop()
    await done
    const base = type.startsWith('video/mp4') ? 'video/mp4' : 'video/webm'
    if (!chunks.length) throw new Error('nothing recorded')
    const clip = new File(chunks, base === 'video/mp4' ? 'live-check.mp4' : 'live-check.webm', { type: base })
    setPreview(URL.createObjectURL(frame))
    stop()
    setPhase('idle')
    onChange({ frame, clip })
  }

  if (value && preview) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-teal bg-teal-soft p-4 text-[13px] text-teal">
        <img src={preview} alt="Your live check" className="size-20 rounded-full object-cover" />
        <span className="flex items-center gap-1 font-semibold"><Check className="size-4" />Live check recorded</span>
        <button className="flex items-center gap-1 text-[12px] font-semibold underline-offset-2 hover:underline" onClick={() => { onChange(undefined); setPreview(undefined) }}><RotateCcw className="size-3.5" />Retake</button>
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center text-[13px]', phase === 'idle' ? 'border-line-strong text-ink-2' : 'border-brand text-ink')}>
      <div className={cn('relative overflow-hidden rounded-full bg-wash', phase === 'idle' ? 'hidden' : 'size-40')}>
        <video ref={video} muted playsInline className="size-full -scale-x-100 object-cover" />
      </div>
      {phase === 'idle' && <><ScanFace className="size-5" /><span className="font-semibold text-ink">Live check</span><span className="text-[11.5px] opacity-80">Uses your camera. Good light, face uncovered.</span></>}
      {phase === 'recording' && <span className="text-[14px] font-bold text-ink">{STEPS[step]}</span>}
      {phase === 'ready' && <span className="text-[12.5px]">Centre your face, then start. It takes about 5 seconds.</span>}
      {error && <span className="text-[12.5px] font-semibold text-danger">{error}</span>}
      {phase === 'idle' && <Button size="sm" icon={<Camera className="size-3.5" />} onClick={open}>Open camera</Button>}
      {phase === 'starting' && <span className="text-[12.5px]">Opening camera…</span>}
      {phase === 'ready' && <Button size="sm" onClick={record}>Start</Button>}
    </div>
  )
}
