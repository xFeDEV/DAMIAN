import type { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'

export const metadata: Metadata = {
  title: 'Ingresar | 4x4',
}

export default function LoginPage() {
  return <LoginForm />
}
