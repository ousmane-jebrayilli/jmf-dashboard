export default function HealthDisclaimerBanner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 flex items-start gap-3">
      <span className="text-blue-500 text-lg leading-tight">ℹ</span>
      <p className="text-sm text-blue-800">
        <strong>Informational use only.</strong> This dashboard organizes and summarizes health
        records. It does not diagnose, prescribe, or replace professional medical advice. Always
        follow up with a licensed healthcare professional for any health concerns.
      </p>
    </div>
  )
}
