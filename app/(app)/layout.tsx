'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { useAuth, useData } from '@/components/providers'
import { PageLoader } from '@/components/ui/kit'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const { loading, error } = useData()
  const router = useRouter()

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  if (!ready || !user) return <PageLoader />

  return (
    <AppShell loading={loading} error={error}>
      {children}
    </AppShell>
  )
}
