export default function LayerTogglePanel({
  currentStyle,
  onStyleChange,
  satelliteStyleUrl,
  topoStyleUrl,
}) {
  const styleOptions = [
    { id: 'satellite', label: 'Satellite', styleUrl: satelliteStyleUrl },
    { id: 'topo', label: 'Topo/Map', styleUrl: topoStyleUrl },
  ]

  return (
    <div
      className="absolute top-4 right-4 z-10 p-3 rounded-lg shadow-lg flex flex-col gap-1 min-w-[160px]"
      style={{ backgroundColor: '#1E2D3D' }}
    >
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1 mb-1">
        Layers
      </span>
      {styleOptions.map((opt) => {
        const isActive = currentStyle === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onStyleChange(opt.styleUrl, opt.id)}
            className={`text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
              isActive
                ? 'text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
            }`}
            style={isActive ? { backgroundColor: '#3B8BEB' } : {}}
          >
            {opt.label}
          </button>
        )
      })}
      <p className="text-[11px] text-text-muted italic px-1 mt-2 pt-1 border-t border-white/10">
        Right-click anywhere on the map for terrain analysis
      </p>
    </div>
  )
}
