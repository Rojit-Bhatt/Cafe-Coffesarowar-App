import { useState, useEffect } from 'react'
import { Search, User, Calendar, Award, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { LiveScansTable, type CounterScan } from './LiveScansTable'
import { VoucherVerify } from './VoucherVerify'

interface Customer {
  id: string
  name: string
  email: string
  customerNo: string
  stampsEarned: number
  lastStampedAt: string | null
  validVoucherCount: number
  scanHistory: Array<{
    id: string
    timestamp: string
  }>
}

interface CustomersSectionProps {
  scans: CounterScan[]
}

export function CustomersSection({ scans }: CustomersSectionProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  const fetchCustomers = async () => {
    try {
      const response = await apiRequest<{ success: boolean; data: Customer[] }>('/api/admin/customers')
      if (response.success && Array.isArray(response.data)) {
        setCustomers(response.data)
        setError(null)
      } else {
        setError('Failed to load customers list.')
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err)
      setError(err.message || 'Error loading customers.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    // Poll customers list every 10 seconds to keep counts and activity synchronized
    const interval = setInterval(fetchCustomers, 10000)
    return () => clearInterval(interval)
  }, [])

  // Filter customers based on search query
  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.customerNo.toLowerCase().includes(query) ||
      customer.id.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const toggleExpand = (customerId: string) => {
    setExpandedCustomer(prev => (prev === customerId ? null : customerId))
  }

  return (
    <div className="space-y-8">
      {/* Top Section: Customer Search & List */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Customer Search Panel (occupies 2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or customer ID (e.g. NO. 00421)..."
              className="w-full rounded-[20px] border border-[#2D2D2D] bg-[#1A1A1A] py-3.5 pl-12 pr-4 text-sm text-[#EBE6DF] placeholder:text-[#A3A3A3]/65 focus:border-[#EBE6DF] focus:outline-none transition-colors"
            />
          </div>

          <div className="border border-[#2D2D2D] bg-[#1A1A1A] rounded-[24px] overflow-hidden p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-normal text-[#EBE6DF]">
                {searchQuery ? 'Search Results' : 'Active Customers'}
              </h3>
              <span className="text-xs font-mono text-[#A3A3A3] bg-[#121212] border border-[#2D2D2D] px-2.5 py-1 rounded-[12px]">
                {filteredCustomers.length} found
              </span>
            </div>

            {isLoading && customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#A3A3A3]">
                <div className="h-6 w-6 animate-spin rounded-full border border-[#EBE6DF] border-t-transparent mb-2" />
                <p className="text-xs">Loading customer records...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-red-500">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm font-bold">{error}</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[#A3A3A3]">
                <User className="size-10 text-[#A3A3A3]/25 mb-3" />
                <p className="text-sm font-medium">No matching customers found</p>
                <p className="text-xs mt-1 text-[#A3A3A3]/70">Try modifying your search query.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredCustomers.map(customer => {
                  const isExpanded = expandedCustomer === customer.id
                  const hasReward = customer.validVoucherCount > 0 || customer.stampsEarned >= 5

                  return (
                    <div
                      key={customer.id}
                      className="border border-[#2D2D2D] bg-[#121212] rounded-[18px] overflow-hidden transition-all duration-200"
                    >
                      {/* Customer Card Header */}
                      <div
                        onClick={() => toggleExpand(customer.id)}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#1A1A1A]/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#2D2D2D] bg-[#1A1A1A]">
                            <User className="size-5 text-[#EBE6DF]/80" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-serif text-sm font-normal text-[#EBE6DF] truncate">
                              {customer.name}
                            </h4>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-[#A3A3A3] mt-0.5">
                              {customer.customerNo}
                            </p>
                          </div>
                        </div>

                        {/* Status elements */}
                        <div className="flex items-center gap-2 sm:self-center ml-13 sm:ml-0">
                          {/* Stamp Count Badge */}
                          <span className="inline-flex items-center gap-1 border border-[#2D2D2D] bg-[#1A1A1A] px-2.5 py-1 text-[11px] font-medium text-[#EBE6DF] rounded-[12px]">
                            <Award className="size-3.5 text-amber-400" />
                            <span>{customer.stampsEarned} / 5 stamps</span>
                          </span>

                          {/* Reward Status Badge */}
                          {hasReward ? (
                            <span className="inline-flex items-center gap-1 bg-[#2E3A2E] border border-green-800 text-green-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[12px]">
                              Reward Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-[#202020] border border-[#2D2D2D] text-[#A3A3A3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[12px]">
                              Active
                            </span>
                          )}

                          {isExpanded ? (
                            <ChevronUp className="size-4 text-[#A3A3A3] shrink-0 ml-1" />
                          ) : (
                            <ChevronDown className="size-4 text-[#A3A3A3] shrink-0 ml-1" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Section (Customer Detail View) */}
                      {isExpanded && (
                        <div className="border-t border-[#2D2D2D] bg-[#161616] p-4 text-xs space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <p className="text-[#A3A3A3] font-bold uppercase tracking-wider text-[9px]">Contact Info</p>
                              <p className="text-[#EBE6DF] text-sm">{customer.email}</p>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[#A3A3A3] font-bold uppercase tracking-wider text-[9px]">Last Activity Date</p>
                              <div className="flex items-center gap-1.5 text-[#EBE6DF]">
                                <Clock className="size-3.5 text-[#A3A3A3]" />
                                <span>{formatDate(customer.lastStampedAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Stamp Scan History */}
                          <div className="space-y-2">
                            <p className="text-[#A3A3A3] font-bold uppercase tracking-wider text-[9px]">Stamp Scan History (Recent 10)</p>
                            {customer.scanHistory.length === 0 ? (
                              <p className="text-[#A3A3A3] italic py-1 pl-1">No stamp credits recorded yet.</p>
                            ) : (
                              <div className="border border-[#2D2D2D] bg-[#121212] rounded-xl overflow-hidden divide-y divide-[#2D2D2D]">
                                {customer.scanHistory.map((scan, idx) => (
                                  <div key={scan.id} className="p-2.5 flex items-center justify-between text-[11px]">
                                    <span className="text-[#A3A3A3] font-mono">#{customer.scanHistory.length - idx} Stamp Claim</span>
                                    <div className="flex items-center gap-1.5 text-[#EBE6DF]">
                                      <Calendar className="size-3 text-[#A3A3A3]" />
                                      <span>{formatDate(scan.timestamp)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Verify Voucher Panel */}
        <div className="space-y-6">
          <VoucherVerify />
        </div>
      </div>

      {/* Live Counter Scans Table (Full width or fits beautifully here) */}
      <div className="border-t border-[#2D2D2D] pt-6">
        <LiveScansTable scans={scans} />
      </div>
    </div>
  )
}
