'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, Field, Head } from '@/components/ui/kit'
import { useAuth, useData, useToast } from '@/components/providers'
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/derive'

type Section = 'negocio' | 'preferencias' | 'metodos'

export default function SettingsView() {
  const { settings, updateSettings } = useData()
  const { user } = useAuth()
  const notify = useToast()
  const [section, setSection] = useState<Section>('negocio')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    business_name: '',
    phone: '',
    address: '',
    city: '',
    currency: 'COP',
    allow_partial_payments: true,
    due_reminders: true,
    collection_message: '',
  })

  useEffect(() => {
    if (!settings) return
    setForm({
      business_name: settings.business_name || '',
      phone: settings.phone || '',
      address: settings.address || '',
      city: settings.city || '',
      currency: settings.currency || 'COP',
      allow_partial_payments: Boolean(settings.allow_partial_payments),
      due_reminders: Boolean(settings.due_reminders),
      collection_message: settings.collection_message || '',
    })
  }, [settings])

  const isAdmin = user?.role === 'admin'

  async function onSave() {
    if (!settings) return
    setSaving(true)
    try {
      await updateSettings(settings.id, form)
      notify('Cambios guardados correctamente')
    } catch {
      notify('No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <>
        <Head title="Configuración" desc="Personaliza las preferencias de tu operación." />
        <div className="card">
          <Empty title="Sin configuración" desc="No se encontró el registro de configuración del negocio." />
        </div>
      </>
    )
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <Head
        title="Configuración"
        desc="Personaliza las preferencias de tu operación."
        action={
          <Button onClick={onSave} disabled={saving || !isAdmin}>
            <Check data-icon="inline-start" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        }
      />

      {!isAdmin && <div className="alert-warn">Solo los administradores pueden modificar la configuración.</div>}

      <div className="settings-grid">
        <div className="settings-nav">
          <button className={section === 'negocio' ? 'active' : ''} onClick={() => setSection('negocio')}>
            Información del negocio
          </button>
          <button className={section === 'preferencias' ? 'active' : ''} onClick={() => setSection('preferencias')}>
            Preferencias
          </button>
          <button className={section === 'metodos' ? 'active' : ''} onClick={() => setSection('metodos')}>
            Métodos de pago
          </button>
        </div>

        <div className="card settings-form">
          {section === 'negocio' && (
            <>
              <h2>Información del negocio</h2>
              <p>Estos datos se mostrarán en tus comprobantes y reportes.</p>
              <div className="form-grid">
                <Field label="Nombre del negocio">
                  <input value={form.business_name} onChange={(event) => set('business_name', event.target.value)} />
                </Field>
                <Field label="Teléfono">
                  <input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
                </Field>
                <Field label="Dirección">
                  <input value={form.address} onChange={(event) => set('address', event.target.value)} />
                </Field>
                <Field label="Ciudad">
                  <input value={form.city} onChange={(event) => set('city', event.target.value)} />
                </Field>
                <Field label="Moneda">
                  <select value={form.currency} onChange={(event) => set('currency', event.target.value)}>
                    <option value="COP">COP — Peso colombiano</option>
                    <option value="USD">USD — Dólar</option>
                    <option value="DOP">DOP — Peso dominicano</option>
                    <option value="HTG">HTG — Gourde</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {section === 'preferencias' && (
            <>
              <h2>Preferencias</h2>
              <p>Define cómo se comporta el sistema al registrar pagos y cuotas.</p>
              <div className="setting-row">
                <div>
                  <b>Permitir pagos parciales</b>
                  <span>Registra abonos menores al valor de la cuota.</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.allow_partial_payments}
                  onChange={(event) => set('allow_partial_payments', event.target.checked)}
                />
              </div>
              <div className="setting-row">
                <div>
                  <b>Recordatorios de vencimiento</b>
                  <span>Mostrar alertas para cuotas próximas a vencer.</span>
                </div>
                <input type="checkbox" checked={form.due_reminders} onChange={(event) => set('due_reminders', event.target.checked)} />
              </div>

              <Field label="Mensaje de cobro (WhatsApp)">
                <textarea
                  value={form.collection_message}
                  onChange={(event) => set('collection_message', event.target.value)}
                  rows={4}
                  placeholder="Hola {nombre}, le escribimos de {negocio}..."
                />
              </Field>
              <p className="center-note">
                Variables disponibles: {'{nombre}'}, {'{negocio}'}, {'{cuotas}'}, {'{monto}'}, {'{credito}'}, {'{fecha}'}. Si lo dejas
                vacío se usa el mensaje por defecto.
              </p>
            </>
          )}

          {section === 'metodos' && (
            <>
              <h2>Métodos de pago</h2>
              <p>Métodos habilitados para registrar recaudos.</p>
              <div className="method-list">
                {PAYMENT_METHODS.map((method) => (
                  <div className="setting-row" key={method}>
                    <div>
                      <b>{METHOD_LABEL[method]}</b>
                      <span>Disponible al registrar pagos.</span>
                    </div>
                    <span className="badge good">
                      <i />
                      Activo
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
