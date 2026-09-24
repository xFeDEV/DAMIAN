'use client'

import { useData, useLookups, useToday } from '@/components/providers'
import { dayKey, installmentOutstanding, overdueInstallments } from '@/lib/derive'
import { buildCollectionMessage, formatDate, money, whatsappUrl } from '@/lib/format'

export function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  )
}

export function WhatsAppButton({ clientId, loanId, className }: { clientId: string; loanId?: string; className?: string }) {
  const { installments, settings } = useData()
  const { clientById, loanById } = useLookups()
  const today = useToday()

  const client = clientById.get(clientId)
  const loan = loanId ? loanById.get(loanId) : undefined

  const overdue = overdueInstallments(
    installments.filter((item) => (loanId ? item.loan === loanId : item.client === clientId)),
    today,
  )
  const total = overdue.reduce((sum, item) => sum + installmentOutstanding(item), 0)
  const oldest = [...overdue].sort((a, b) => dayKey(a.due_date).localeCompare(dayKey(b.due_date)))[0]

  const message = buildCollectionMessage(settings?.collection_message, {
    nombre: client?.name ?? '',
    negocio: settings?.business_name || 'Damián',
    cuotas: overdue.length,
    monto: money(total),
    credito: loan?.code ?? 'sus créditos',
    fecha: oldest ? formatDate(oldest.due_date) : '',
  })

  const url = whatsappUrl(client?.whatsapp || client?.phone, message)
  const icon = <WhatsAppIcon />
  const classes = ['icon-btn', 'whatsapp', className].filter(Boolean).join(' ')

  if (!url) {
    return (
      <button className={classes} type="button" disabled title="Sin teléfono" aria-label="Sin teléfono">
        {icon}
      </button>
    )
  }

  return (
    <a className={classes} href={url} target="_blank" rel="noopener noreferrer" title="Cobrar por WhatsApp" aria-label="Cobrar por WhatsApp">
      {icon}
    </a>
  )
}
