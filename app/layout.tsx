import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Damián | Gestión de cartera',
  description: 'Gestiona clientes, préstamos, cuotas y pagos de Damián en un solo lugar.',
  generator: 'Damián',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f7fb',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
