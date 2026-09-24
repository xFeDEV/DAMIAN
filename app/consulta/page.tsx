import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import { PublicConsulta } from '@/components/public-consulta'

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Consulta tu crédito | Damián',
  description: 'Consulta el estado de tu crédito con tu cédula o tu número de teléfono.',
}

export default function ConsultaPage() {
  return (
    <div className={plex.className}>
      <PublicConsulta />
    </div>
  )
}
