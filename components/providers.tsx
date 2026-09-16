'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { pb } from '@/lib/pocketbase'
import type {
  ActivityItem,
  Client,
  DataSnapshot,
  Installment,
  InstallmentStatus,
  Loan,
  LoanStatus,
  Operator,
  Payment,
  Settings,
} from '@/lib/types'

/* ----------------------------- Toasts ----------------------------- */

const ToastContext = createContext<(message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((value: string) => {
    setMessage(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 2600)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 />
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/* ------------------------------ Auth ------------------------------ */

interface AuthContextValue {
  user: Operator | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Operator | null>((pb.authStore.record as Operator | null) ?? null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser((record as Operator | null) ?? null)
    })

    async function bootstrap() {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('operators').authRefresh()
        } catch {
          pb.authStore.clear()
        }
      } else {
        pb.authStore.clear()
      }
      setReady(true)
    }

    bootstrap()
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      pb.collection('operators')
        .authRefresh()
        .catch(() => pb.authStore.clear())
    }, 25 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection('operators').authWithPassword(email, password)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [])

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}

/* ------------------------------ Data ------------------------------ */

export interface ClientInput {
  name: string
  doc?: string
  phone?: string
  whatsapp?: string
  address?: string
  city?: string
  notes?: string
  active?: boolean
}

export interface LoanInput {
  client: string
  amount: number
  total: number
  installments_count: number
  installment_amount: number
  frequency: string
  disbursed_at: string
  start_at: string
  end_at: string
  interest_rate?: number
  notes?: string
  paid_installments?: number
  status?: LoanStatus
}

export interface InstallmentInput {
  number: number
  due_date: string
  amount: number
  paid?: number
  status?: InstallmentStatus
}

export interface PaymentInput {
  loan: string
  client: string
  installment?: string
  amount: number
  paid_at: string
  method: string
  reference?: string
  notes?: string
}

interface DataContextValue extends DataSnapshot {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createClient: (input: ClientInput) => Promise<Client>
  updateClient: (id: string, input: ClientInput) => Promise<Client>
  createLoan: (loan: LoanInput, installments: InstallmentInput[]) => Promise<Loan>
  registerPayment: (input: PaymentInput) => Promise<Payment>
  deletePayment: (id: string) => Promise<void>
  updateSettings: (id: string, input: Partial<Settings>) => Promise<Settings>
  nextCode: (prefix: 'CL' | 'PR') => string
}

const DataContext = createContext<DataContextValue | null>(null)

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within DataProvider')
  return context
}

const emptySnapshot: DataSnapshot = {
  clients: [],
  loans: [],
  installments: [],
  payments: [],
  settings: null,
  activity: [],
}

function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const [data, setData] = useState<DataSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)

  const fetchAll = useCallback(async () => {
    const [clients, loans, installments, payments, settings, activity] = await Promise.all([
      pb.collection('clients').getFullList<Client>({ sort: 'name' }),
      pb.collection('loans').getFullList<Loan>({ sort: '-created' }),
      pb.collection('installments').getFullList<Installment>({ sort: 'due_date' }),
      pb.collection('payments').getFullList<Payment>({ sort: '-paid_at' }),
      pb.collection('settings').getFullList<Settings>(),
      pb.collection('activity_log').getList<ActivityItem>(1, 25, { sort: '-created' }).then((result) => result.items),
    ])
    setData({ clients, loans, installments, payments, settings: settings[0] ?? null, activity })
  }, [])

  const refresh = useCallback(async () => {
    await fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!ready) return
    if (!user) {
      setData(emptySnapshot)
      setLoading(false)
      return
    }

    let active = true
    if (!hasLoaded.current) setLoading(true)
    setError(null)

    fetchAll()
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          hasLoaded.current = true
        }
      })

    return () => {
      active = false
    }
  }, [ready, user, fetchAll])

  const createClient = useCallback(
    async (input: ClientInput) => {
      const code = computeNextCode('CL', data.clients.map((item) => item.code))
      const record = await pb.collection('clients').create<Client>({ code, active: true, ...input })
      await refresh()
      return record
    },
    [data.clients, refresh],
  )

  const updateClient = useCallback(
    async (id: string, input: ClientInput) => {
      const record = await pb.collection('clients').update<Client>(id, input)
      await refresh()
      return record
    },
    [refresh],
  )

  const createLoan = useCallback(
    async (loan: LoanInput, installments: InstallmentInput[]) => {
      const code = computeNextCode('PR', data.loans.map((item) => item.code))
      const { paid_installments: paidInstallmentsInput, status: statusInput, ...loanFields } = loan
      const paidCount = Math.max(0, Math.min(paidInstallmentsInput ?? 0, loan.installments_count))
      const paidTotal = paidCount * loan.installment_amount
      const balance = Math.max(0, loan.total - paidTotal)
      const status: LoanStatus = balance <= 0 ? 'finalizado' : statusInput || 'activo'
      const record = await pb.collection('loans').create<Loan>({
        code,
        opening_balance: loan.total,
        balance,
        paid_total: paidTotal,
        status,
        ...loanFields,
      })

      if (installments.length > 0) {
        const today = Date.now()
        await Promise.all(
          installments.map((item) => {
            const done = item.number <= paidCount
            const overdue = !done && new Date(item.due_date.replace(' ', 'T')).getTime() < today
            return pb.collection('installments').create({
              loan: record.id,
              client: record.client,
              number: item.number,
              due_date: item.due_date,
              amount: item.amount,
              paid: done ? item.amount : 0,
              status: item.status ?? (done ? 'pagada' : overdue ? 'vencida' : 'pendiente'),
            })
          }),
        )
      }

      await refresh()
      return record
    },
    [data.loans, refresh],
  )

  const registerPayment = useCallback(
    async (input: PaymentInput) => {
      const code = `PG-${Date.now().toString().slice(-6)}`
      const record = await pb.collection('payments').create<Payment>({
        code,
        created_by: user?.id ?? '',
        reference: '',
        notes: '',
        ...input,
      })
      await refresh()
      return record
    },
    [refresh, user],
  )

  const deletePayment = useCallback(
    async (id: string) => {
      await pb.collection('payments').delete(id)
      await refresh()
    },
    [refresh],
  )

  const updateSettings = useCallback(
    async (id: string, input: Partial<Settings>) => {
      const record = await pb.collection('settings').update<Settings>(id, input)
      await refresh()
      return record
    },
    [refresh],
  )

  const nextCode = useCallback(
    (prefix: 'CL' | 'PR') => computeNextCode(prefix, prefix === 'CL' ? data.clients.map((item) => item.code) : data.loans.map((item) => item.code)),
    [data.clients, data.loans],
  )

  return (
    <DataContext.Provider
      value={{
        ...data,
        loading,
        error,
        refresh,
        createClient,
        updateClient,
        createLoan,
        registerPayment,
        deletePayment,
        updateSettings,
        nextCode,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useLookups() {
  const { clients, loans } = useData()
  return useMemo(
    () => ({
      clientById: new Map(clients.map((client) => [client.id, client])),
      loanById: new Map(loans.map((loan) => [loan.id, loan])),
    }),
    [clients, loans],
  )
}

function computeNextCode(prefix: 'CL' | 'PR', codes: string[]) {
  const numbers = codes
    .map((code) => Number(String(code).replace(/\D/g, '')))
    .filter((value) => Number.isFinite(value))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}-${next}`
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>{children}</DataProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
