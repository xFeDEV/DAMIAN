'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, FileText, X } from 'lucide-react'
import { badgeTone } from '@/lib/derive'
import { formatAmountInput, initials, parseAmount } from '@/lib/format'

export function Avatar({ name, size }: { name: string; size?: 'small' | 'large' }) {
  const className = ['avatar', size].filter(Boolean).join(' ')
  return <div className={className}>{initials(name)}</div>
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${badgeTone(status)}`}>
      <i />
      {status}
    </span>
  )
}

export function Stat({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  change,
  href,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'blue' | 'amber' | 'red' | 'green'
  change?: string
  href?: string
}) {
  const content = (
    <>
      <div className={`stat-icon ${tone}`}>
        <Icon />
      </div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {change && (
          <em>
            <ArrowUpRight /> {change}
          </em>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link className="stat clickable" href={href}>
        {content}
      </Link>
    )
  }

  return <div className="stat">{content}</div>
}

export function Head({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  )
}

export function Section({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string
  close: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      value={formatAmountInput(parseAmount(value))}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  )
}

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  )
}

export function Empty({ title = 'No hay información', desc = 'Los registros aparecerán aquí cuando los crees.' }) {
  return (
    <div className="empty">
      <FileText />
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading-inline">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <span className="spinner" />
      <p>Cargando información…</p>
    </div>
  )
}
