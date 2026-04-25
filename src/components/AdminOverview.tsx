import Link from 'next/link'
import { FamilyMember, RiskFlag, Reminder, HealthDocument } from '@/types'
import { isOverdue, isDueSoon, formatDueDate } from '@/lib/reminders'

interface Props {
  members: FamilyMember[]
  openFlags: (RiskFlag & { family_members: { full_name: string } })[]
  upcomingReminders: (Reminder & { family_members: { full_name: string } })[]
  recentDocuments: (HealthDocument & { family_members: { full_name: string } })[]
}

const severityBadge: Record<string, string> = {
  low: 'bg-amber-100 text-amber-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
}

export default function AdminOverview({ members, openFlags, upcomingReminders, recentDocuments }: Props) {
  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Family members" value={members.length} />
        <StatCard label="Open risk flags" value={openFlags.length} highlight={openFlags.length > 0} />
        <StatCard label="Upcoming reminders" value={upcomingReminders.length} />
        <StatCard label="Recent uploads" value={recentDocuments.length} />
      </div>

      {/* Open risk flags */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Open Risk Flags</h2>
        {openFlags.length === 0 ? (
          <p className="text-sm text-gray-500">No open flags across all members.</p>
        ) : (
          <div className="space-y-2">
            {openFlags.slice(0, 10).map(flag => (
              <div key={flag.id} className="card px-4 py-3 flex items-center gap-4">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${severityBadge[flag.severity]}`}>
                  {flag.severity.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{flag.message}</p>
                  <p className="text-xs text-gray-500">{flag.family_members.full_name} · {flag.category}</p>
                </div>
                <Link
                  href={`/dashboard/members/${flag.member_id}`}
                  className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                >
                  View member →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming reminders */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Upcoming Reminders</h2>
        {upcomingReminders.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming reminders in the next 30 days.</p>
        ) : (
          <div className="space-y-2">
            {upcomingReminders.slice(0, 10).map(r => (
              <div key={r.id} className="card px-4 py-3 flex items-center gap-4">
                {isOverdue(r.due_date) ? (
                  <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">Overdue</span>
                ) : (
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Due soon</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500">{r.family_members.full_name} · {formatDueDate(r.due_date)}</p>
                </div>
                <Link
                  href={`/dashboard/members/${r.member_id}/reminders`}
                  className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent documents */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Uploads</h2>
        {recentDocuments.length === 0 ? (
          <p className="text-sm text-gray-500">No recent uploads.</p>
        ) : (
          <div className="space-y-2">
            {recentDocuments.slice(0, 8).map(doc => (
              <div key={doc.id} className="card px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500">
                    {doc.family_members.full_name} · {doc.document_type.replace('_', ' ')} ·{' '}
                    {new Date(doc.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </p>
                </div>
                <Link
                  href={`/dashboard/members/${doc.member_id}/documents`}
                  className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? 'border-red-200 bg-red-50' : ''}`}>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
