import Link from 'next/link'
import { FamilyMember, RiskFlag, Reminder } from '@/types'

interface Props {
  member: FamilyMember
  openFlagsCount?: number
  upcomingRemindersCount?: number
}

export default function MemberCard({ member, openFlagsCount = 0, upcomingRemindersCount = 0 }: Props) {
  const initials = member.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const age = member.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(member.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  return (
    <Link href={`/dashboard/members/${member.id}`} className="card p-5 hover:border-brand-300 hover:shadow-md transition-all block">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center">
          <span className="text-brand-700 font-semibold text-sm">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{member.full_name}</h3>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
            {age !== null && <span>{age} yrs</span>}
            {member.sex && <span className="capitalize">{member.sex}</span>}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {openFlagsCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                {openFlagsCount} flag{openFlagsCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                No open flags
              </span>
            )}
            {upcomingRemindersCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                {upcomingRemindersCount} reminder{upcomingRemindersCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <span className="text-gray-300 text-lg">→</span>
      </div>
    </Link>
  )
}
