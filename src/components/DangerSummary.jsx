import { useRouteStore } from '../store/routeStore'

export default function DangerSummary() {
  const dangerSegments = useRouteStore((s) => s.dangerSegments)
  const forecast = useRouteStore((s) => s.forecast)

  const dangerousCount = dangerSegments.filter((s) => s.isDangerous).length
  if (dangerousCount === 0) return null

  const reasonCounts = {}
  dangerSegments.forEach((seg) => {
    seg.reasons.forEach((r) => {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
    })
  })
  const reasonEntries = Object.entries(reasonCounts)

  return (
    <div
      className="absolute left-4 z-10 w-72 rounded-lg border-l-4 p-3 shadow-lg"
      style={{
        top: 200,
        backgroundColor: '#1E2D3D',
        borderLeftColor: '#E53E3E',
      }}
    >
      <p className="text-sm font-semibold text-text-primary">
        ⚠️ {dangerousCount} dangerous segment{dangerousCount !== 1 ? 's' : ''} detected
      </p>

      {forecast && (
        <div className="mt-2">
          <span className="text-xs text-text-secondary">Avalanche danger</span>
          <div className="mt-1">
            <span
              className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: forecast.color || '#4A5568' }}
            >
              {forecast.danger_label}
            </span>
          </div>
        </div>
      )}

      {reasonEntries.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2">
          {reasonEntries.map(([reason, count]) => (
            <li key={reason} className="text-xs text-text-secondary">
              <span className="font-medium text-text-primary">{count}×</span> {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
