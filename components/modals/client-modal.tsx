'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Field, Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast } from '@/components/providers'
import type { Client } from '@/lib/types'

interface FormState {
  name: string
  doc: string
  phone: string
  whatsapp: string
  address: string
  city: string
  notes: string
}

const EMPTY: FormState = { name: '', doc: '', phone: '', whatsapp: '', address: '', city: '', notes: '' }

export function ClientModal({ client, close }: { client?: Client | null; close: () => void }) {
  const { createClient, updateClient } = useData()
  const notify = useToast()
  const [form, setForm] = useState<FormState>(
    client
      ? {
          name: client.name,
          doc: client.doc,
          phone: client.phone,
          whatsapp: client.whatsapp,
          address: client.address,
          city: client.city,
          notes: client.notes,
        }
      : EMPTY,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  async function onSave() {
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (client) {
        await updateClient(client.id, { ...form, active: client.active })
        notify('Cliente actualizado correctamente')
      } else {
        await createClient(form)
        notify('Cliente creado correctamente')
      }
      close()
    } catch {
      setError('No se pudo guardar el cliente. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={client ? 'Editar cliente' : 'Nuevo cliente'} close={close}>
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Nombre completo *">
            <input value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Carlos Ramírez" />
          </Field>
          <Field label="Documento">
            <input value={form.doc} onChange={(event) => set('doc', event.target.value)} placeholder="Número de documento" />
          </Field>
          <Field label="Teléfono">
            <input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="WhatsApp">
            <input value={form.whatsapp} onChange={(event) => set('whatsapp', event.target.value)} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="Dirección">
            <input value={form.address} onChange={(event) => set('address', event.target.value)} placeholder="Dirección de residencia" />
          </Field>
          <Field label="Ciudad">
            <input value={form.city} onChange={(event) => set('city', event.target.value)} placeholder="Bogotá" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Información adicional del cliente" />
        </Field>
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving}>
          <Check data-icon="inline-start" />
          {saving ? 'Guardando…' : client ? 'Guardar cambios' : 'Guardar cliente'}
        </Button>
      </div>
    </Modal>
  )
}
