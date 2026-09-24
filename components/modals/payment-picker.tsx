'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Avatar, Modal } from '@/components/ui/kit'
import { PaymentModal } from '@/components/modals/payment-modal'
import { useData, useLookups, useToday } from '@/components/providers'
import { installmentOutstanding, isOverdue } from '@/lib/derive'
import { formatDate, money, normalize } from '@/lib/format'

export function PaymentPicker({ close }: { close: () => void }) {
  const { loans, installments } = useData()
  const { clientById } = useLookups()
  const today = useToday()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')

  const options = useMemo(() => {
    const term = normalize(query.trim())
    return loans
      .filter((loan) => (Number(loan.balance) || 0) > 0)
      .map((loan) => {
        const pending = installments
          .filter((item) => item.loan === loan.id && installmentOutstanding(item) > 0)
          .sort((a, b) => a.number - b.number)
        return {
          loan,
          next: pending[0],
          mora: installments.some((item) => item.loan === loan.id && isOverdue(item, today)),
        }
      })
      .filter(({ loan }) => {
        if (!term) return true
        return normalize(`${loan.code} ${clientById.get(loan.client)?.name ?? ''}`).includes(term)
      })
      .sort((a, b) => (b.mora ? 1 : 0) - (a.mora ? 1 : 0) || String(a.loan.code).localeCompare(String(b.loan.code)))
  }, [loans, installments, today, query, clientById])

  if (selected) {
    return <PaymentModal loanId={selected} close={close} />
  }

  return (
    <Modal title="Registrar pago" close={close}>
      <div className="modal-body">
        <p>Selecciona el crédito al que corresponde el pago.</p>
        <div className="search-field">
          <Search />
          <input
            placeholder="Buscar cliente o préstamo..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>
        <div className="client-picker">
          {options.length > 0 ? (
            options.map(({ loan, next, mora }) => {
              const client = clientById.get(loan.client)
              return (
                <button key={loan.id} onClick={() => setSelected(loan.id)}>
                  <Avatar name={client?.name ?? loan.code} size="small" />
                  <div>
                    <b>{client?.name ?? '—'}</b>
                    <span>
                      {loan.code} · {money(loan.balance)}
                      {next ? ` · Próx. ${formatDate(next.due_date)}` : ''}
                    </span>
                  </div>
                  {mora && <em className="red-count">En mora</em>}
                </button>
              )
            })
          ) : (
            <p className="center-note">No hay créditos con saldo pendiente.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
