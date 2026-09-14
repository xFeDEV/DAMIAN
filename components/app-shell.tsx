'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  FileBarChart,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useAuth, useData } from '@/components/providers'
import { Avatar, PageLoader } from '@/components/ui/kit'
import { normalize } from '@/lib/format'
import type { Client } from '@/lib/types'

const NAV = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/buscador', 'Buscador', Search],
  ['/clientes', 'Clientes', Users],
  ['/prestamos', 'Préstamos', WalletCards],
  ['/cuotas', 'Cuotas', CalendarClock],
  ['/pagos', 'Pagos', Receipt],
  ['/cartera', 'Cartera', Landmark],
  ['/reportes', 'Reportes', FileBarChart],
] as const

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', cobrador: 'Cobrador' }

function matches(client: Client, query: string) {
  return normalize(`${client.code} ${client.name} ${client.doc} ${client.phone} ${client.city}`).includes(
    normalize(query),
  )
}

export function AppShell({
  children,
  loading,
  error,
}: {
  children: React.ReactNode
  loading?: boolean
  error?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { clients } = useData()
  const [drawer, setDrawer] = useState(false)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDrawer(false)
    setQuery('')
    setShowResults(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(
    () => (query.trim() ? clients.filter((client) => matches(client, query)).slice(0, 8) : []),
    [clients, query],
  )

  const go = (href: string) => {
    router.push(href)
    setDrawer(false)
  }

  const crumb = pathname === '/' ? 'Dashboard' : pathname.split('/').filter(Boolean)[0]?.replace(/-/g, ' ') ?? ''

  const displayName = user?.name || user?.email || 'Operador'
  const roleLabel = user?.role ? ROLE_LABEL[user.role] ?? user.role : ''

  return (
    <div className="app">
      <aside className={drawer ? 'open' : ''}>
        <div className="brand">
          <div className="brand-icon">
            <WalletCards />
          </div>
          <b>Cartera</b>
          <button className="mobile-close" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
            <X />
          </button>
        </div>

        <div className="workspace">
          <i />
          Operación principal
        </div>

        <nav>
          {NAV.map(([href, label, Icon]) => {
            const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <button className={active ? 'active' : ''} onClick={() => go(href)} key={href}>
                <Icon />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="nav-label">ADMINISTRACIÓN</div>
        <button className={pathname === '/configuracion' ? 'active' : ''} onClick={() => go('/configuracion')}>
          <Settings />
          Configuración
        </button>

        <div className="user">
          <Avatar name={displayName} />
          <div>
            <b>{displayName}</b>
            <span>{roleLabel}</span>
          </div>
          <button className="icon-btn logout-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut />
          </button>
        </div>
      </aside>

      <main>
        <header>
          <button className="mobile-menu" onClick={() => setDrawer(true)} aria-label="Abrir menú">
            <Menu />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <ChevronLeft />
            <b>{crumb}</b>
          </div>
          <div className="top-right">
            <div className="global-search-wrap">
              <div className="global-search">
                <Search />
                <input
                  ref={searchRef}
                  placeholder="Buscar..."
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                />
                <kbd>⌘ K</kbd>
              </div>
              {showResults && query.trim() && (
                <div className="global-results">
                  {results.length > 0 ? (
                    results.map((client) => (
                      <button
                        key={client.id}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          go(`/clientes/${client.id}`)
                        }}
                      >
                        <Avatar name={client.name} size="small" />
                        <div>
                          <b>{client.name}</b>
                          <span>
                            {client.doc || client.code} · {client.phone || 'Sin teléfono'} · {client.city || '—'}
                          </span>
                        </div>
                        <small>{client.code}</small>
                      </button>
                    ))
                  ) : (
                    <div className="global-no-results">No encontramos clientes con “{query}”.</div>
                  )}
                </div>
              )}
            </div>
            <button className="icon-btn" title="Notificaciones" aria-label="Notificaciones">
              <Bell />
              <i />
            </button>
            <Avatar name={displayName} />
          </div>
        </header>

        <div className="content">
          {error && <div className="alert-error">{error}</div>}
          {loading ? <PageLoader /> : children}
        </div>
      </main>
    </div>
  )
}
