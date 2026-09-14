'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { Avatar, Head } from '@/components/ui/kit'
import { useData } from '@/components/providers'
import { normalize } from '@/lib/format'

export default function SearchView() {
  const { clients } = useData()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!query.trim()) return []
    return clients
      .filter((client) =>
        normalize(`${client.code} ${client.name} ${client.doc} ${client.phone} ${client.city}`).includes(normalize(query)),
      )
      .slice(0, 6)
  }, [clients, query])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    router.push(results[0] ? `/clientes/${results[0].id}` : '/clientes')
  }

  return (
    <>
      <Head title="Buscador" desc="Encuentra clientes y consulta rápidamente su información." />
      <section className="google-search-section">
        <div className="google-wordmark" aria-label="Buscar en Damián">
          <span>D</span>
          <span>a</span>
          <span>m</span>
          <span>i</span>
          <span>á</span>
          <span>n</span>
        </div>
        <p className="google-search-caption">Encuentra rápidamente clientes y su información</p>

        <form id="google-search-form" className="google-search-form" onSubmit={submit}>
          <Search aria-hidden="true" />
          <input
            aria-label="Buscar clientes"
            placeholder="Busca por nombre, cédula, teléfono o ciudad"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="google-clear" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
              <X />
            </button>
          )}
          <button className="google-submit-icon" type="submit" aria-label="Buscar">
            <Search />
          </button>
        </form>

        <div className="google-search-actions">
          <button type="submit" form="google-search-form">
            Buscar
          </button>
          <button type="button" onClick={() => router.push('/clientes')}>
            Ver todos los clientes
          </button>
        </div>

        {query.trim() && (
          <div className="google-results">
            {results.length > 0 ? (
              results.map((client) => (
                <button key={client.id} onClick={() => router.push(`/clientes/${client.id}`)}>
                  <Avatar name={client.name} size="small" />
                  <div>
                    <b>{client.name}</b>
                    <span>
                      {client.doc || client.code} · {client.phone || 'Sin teléfono'} · {client.city || '—'}
                    </span>
                  </div>
                  <small>{client.code}</small>
                  <ArrowUpRight />
                </button>
              ))
            ) : (
              <p>
                No encontramos clientes con “{query}”.{' '}
                <button onClick={() => router.push('/clientes')}>Ver clientes</button>
              </p>
            )}
          </div>
        )}
      </section>
    </>
  )
}
