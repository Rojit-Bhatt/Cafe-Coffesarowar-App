import { useEffect, useRef, useState } from 'react'
import { TopBar } from '@/components/admin/TopBar'
import { QrStampCard } from '@/components/admin/QrStampCard'
import { CustomersSection } from '@/components/admin/CustomersSection'
import { type CounterScan } from '@/components/admin/LiveScansTable'
import { apiRequest } from '@/lib/api'

export default function AdminConsole() {
  const [scans, setScans] = useState<CounterScan[]>([])
  const [activeTab, setActiveTab] = useState<'qr' | 'customers'>('qr')
  const fetchScansRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    document.title = "Barista Workspace | Coffesarowar Cafe"
  }, [])

  useEffect(() => {
    const fetchRecentScans = async () => {
      try {
        const response = await apiRequest<{ success: boolean; data: any[] }>(
          '/api/admin/recent-scans'
        )
        if (response.success && Array.isArray(response.data)) {
          const parsedScans = response.data.map(scan => ({
            ...scan,
            timestamp: new Date(scan.timestamp)
          }))
          setScans(parsedScans)
        }
      } catch (err) {
        console.error('Failed to fetch recent scans:', err)
      }
    }
    fetchScansRef.current = fetchRecentScans

    fetchRecentScans()
    const interval = setInterval(fetchRecentScans, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSessionStart = () => {
    fetchScansRef.current()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#121212] text-[#EBE6DF]">
      <TopBar />

      {/* Pill-Style Centered Top Navigation Bar */}
      <div className="flex justify-center mt-6 px-4">
        <div className="inline-flex rounded-full bg-[#1A1A1A] border border-[#2D2D2D] p-1.5 gap-1.5 shadow-md">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-6 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full transition-all duration-200 ${
              activeTab === 'qr'
                ? 'bg-[#EBE6DF] text-black shadow-sm font-semibold'
                : 'text-[#A3A3A3] hover:text-[#EBE6DF]'
            }`}
          >
            QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-6 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full transition-all duration-200 ${
              activeTab === 'customers'
                ? 'bg-[#EBE6DF] text-black shadow-sm font-semibold'
                : 'text-[#A3A3A3] hover:text-[#EBE6DF]'
            }`}
          >
            Customers
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:px-10">
        <div className="mb-8 text-center sm:text-left">
          <h1 className="font-serif text-3xl font-semibold text-[#EBE6DF] text-balance">
            {activeTab === 'qr' ? 'Barista Workspace' : 'Customer Directory'}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[#A3A3A3]">
            {activeTab === 'qr' 
              ? 'Issue loyalty stamps dynamically to customer devices.' 
              : 'Search customer accounts, check active rewards, and redeem vouchers.'
            }
          </p>
        </div>

        {activeTab === 'qr' ? (
          <div className="flex flex-col items-center justify-center max-w-lg mx-auto w-full bg-[#1A1A1A] border border-[#2D2D2D] p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] shadow-lg">
            <h2 className="font-serif text-xl font-normal text-[#EBE6DF] mb-2 text-center">
              Counter Scan Generator
            </h2>
            <p className="text-xs text-[#A3A3A3] mb-6 text-center max-w-xs">
              Generate a secure stamp token QR code for customer scan authorization.
            </p>
            <QrStampCard onSessionStart={handleSessionStart} />
          </div>
        ) : (
          <CustomersSection scans={scans} />
        )}
      </main>

      <footer className="border-t border-[#2D2D2D] py-4 mt-8">
        <p className="text-center text-xs text-[#A3A3A3]">
          Cafe Coffesarowar — Internal staff system. Authorized baristas only.
        </p>
      </footer>
    </div>
  )
}
