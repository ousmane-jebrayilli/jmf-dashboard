'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface Props {
  profile: Profile
}

export default function NavBar({ profile }: Props) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-base font-bold text-gray-900 hover:text-brand-600">
              JMF Health
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
              Dashboard
            </Link>
            {profile.role === 'admin' && (
              <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {profile.full_name}
              <span className="ml-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {profile.role}
              </span>
            </span>
            <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
