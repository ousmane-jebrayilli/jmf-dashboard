import { LabResult, LabStatus, FlagSeverity } from '@/types'

export function computeLabStatus(
  value: number,
  refLow: number | null,
  refHigh: number | null
): LabStatus {
  if (refLow === null && refHigh === null) return 'unknown'

  if (refLow !== null && value < refLow) {
    const deviation = (refLow - value) / refLow
    return deviation >= 1 ? 'critical' : 'low'
  }

  if (refHigh !== null && value > refHigh) {
    const deviation = (value - refHigh) / refHigh
    return deviation >= 1 ? 'critical' : 'high'
  }

  return 'normal'
}

export function computeFlagSeverity(
  value: number,
  refLow: number | null,
  refHigh: number | null
): FlagSeverity {
  let deviation = 0

  if (refLow !== null && value < refLow) {
    deviation = (refLow - value) / refLow
  } else if (refHigh !== null && value > refHigh) {
    deviation = (value - refHigh) / refHigh
  }

  if (deviation >= 0.5) return 'high'
  if (deviation >= 0.2) return 'medium'
  return 'low'
}

export function shouldCreateFlag(status: LabStatus): boolean {
  return status === 'low' || status === 'high' || status === 'critical'
}

export function buildRiskFlagPayload(lab: LabResult) {
  const severity = computeFlagSeverity(lab.result_value, lab.reference_low, lab.reference_high)
  return {
    member_id: lab.member_id,
    lab_result_id: lab.id,
    severity,
    category: lab.test_category,
    message: `${lab.test_name} is outside the reference range.`,
    recommendation:
      'Consider discussing this result with a licensed healthcare professional.',
    status: 'open' as const,
  }
}
