'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { nextReminderDate, REMINDER_DEFAULTS } from '@/lib/reminders'
import { ReminderType } from '@/types'

export async function createReminder(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const memberId = formData.get('member_id') as string
  const reminderType = formData.get('reminder_type') as ReminderType
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const dueDate = formData.get('due_date') as string
  const intervalMonthsRaw = formData.get('interval_months')
  const intervalMonths = intervalMonthsRaw ? parseInt(intervalMonthsRaw as string, 10) : null

  const { data: reminder, error } = await supabase
    .from('reminders')
    .insert({
      member_id: memberId,
      title,
      description,
      reminder_type: reminderType,
      due_date: dueDate,
      interval_months: intervalMonths,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error

  await logAudit(supabase, {
    action: 'create',
    entity_type: 'reminder',
    entity_id: reminder.id,
    details: { title, reminder_type: reminderType, due_date: dueDate },
  })

  revalidatePath(`/dashboard/members/${memberId}/reminders`)
  revalidatePath('/dashboard/admin')
}

export async function completeReminder(
  reminderId: string,
  memberId: string,
  currentDueDate: string,
  intervalMonths: number | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'completed' })
    .eq('id', reminderId)

  if (error) throw error

  // Auto-create next reminder if recurring
  if (intervalMonths) {
    const nextDue = nextReminderDate(currentDueDate, intervalMonths)
    const { data: original } = await supabase
      .from('reminders')
      .select('title, description, reminder_type')
      .eq('id', reminderId)
      .single()

    if (original) {
      await supabase.from('reminders').insert({
        member_id: memberId,
        title: original.title,
        description: original.description,
        reminder_type: original.reminder_type,
        due_date: nextDue,
        interval_months: intervalMonths,
        status: 'pending',
        created_by: user.id,
      })
    }
  }

  await logAudit(supabase, {
    action: 'complete',
    entity_type: 'reminder',
    entity_id: reminderId,
  })

  revalidatePath(`/dashboard/members/${memberId}/reminders`)
  revalidatePath('/dashboard/admin')
}

export async function snoozeReminder(reminderId: string, memberId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'snoozed' })
    .eq('id', reminderId)

  if (error) throw error

  revalidatePath(`/dashboard/members/${memberId}/reminders`)
}
