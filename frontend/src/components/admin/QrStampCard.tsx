import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, RefreshCw } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import toast from 'react-hot-toast'

const QR_LIFETIME_SECONDS = 30

type QrStampCardProps = {
  onSessionStart?: () => void
}

export function QrStampCard({ onSessionStart }: QrStampCardProps) {
  const [token, setToken] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isExpired, setIsExpired] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isActive = token !== null && secondsLeft > 0

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function startSession() {
    if (isActive || isLoading) return

    setIsLoading(true)
    const toastId = toast.loading('Generating active loyalty token...')

    try {
      const response = await apiRequest<{ success: boolean; data: { token: string; expiresInSeconds: number } }>(
        '/api/admin/generate-qr',
        { method: 'POST' }
      )

      if (response.success && response.data?.token) {
        setToken(response.data.token)
        setSecondsLeft(response.data.expiresInSeconds || QR_LIFETIME_SECONDS)
        setIsExpired(false)
        toast.success('Loyalty token generated successfully!', { id: toastId })

        onSessionStart?.()

        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
          setSecondsLeft(prev => {
            if (prev <= 1) {
              if (intervalRef.current) clearInterval(intervalRef.current)
              setToken(null) // Clear active token from UI state on expiration
              setIsExpired(true)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        throw new Error('Invalid response data from server.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate stamp token.', { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-5 py-4">
      {/* QR Code display box */}
      <div
        className="flex w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] aspect-square items-center justify-center border border-[#2D2D2D] bg-white rounded-[24px] sm:rounded-[40px] overflow-hidden p-6 sm:p-8 shrink-0 relative shadow-inner"
      >
        {isActive && token ? (
          <div className="w-full h-full">
            <QRCodeSVG value={token} size={undefined} className="w-full h-full" bgColor="#ffffff" fgColor="#000000" level="M" title="Loyalty stamp QR code" />
          </div>
        ) : isExpired ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <RefreshCw className="size-12 sm:size-16 text-[#A3A3A3]" aria-hidden="true" />
            <p className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#A3A3A3]">QR expired</p>
            <p className="text-xs sm:text-sm text-[#A3A3A3]/70">
              Generate a fresh code to continue.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <QrCode className="size-12 sm:size-16 text-[#A3A3A3]/25" aria-hidden="true" />
            <p className="text-sm sm:text-base text-[#A3A3A3]">
              Your stamp QR will appear here
            </p>
          </div>
        )}
      </div>

      {isActive && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#EBE6DF] font-mono font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
          </span>
          <span>Token Active · {secondsLeft}s remaining</span>
        </div>
      )}

      {/* Button beneath it, same width as the QR display box */}
      <button
        type="button"
        onClick={startSession}
        disabled={isLoading || isActive}
        className="w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] bg-[#EBE6DF] px-6 py-4 sm:py-5 text-xs sm:text-sm md:text-base font-bold tracking-wider text-black uppercase transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none rounded-full border border-[#EBE6DF] truncate"
      >
        {isLoading ? 'Generating...' : isActive ? 'Token Active' : 'Generate New Stamp Token'}
      </button>
    </div>
  )
}
