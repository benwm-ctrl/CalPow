export default function LayerTogglePanel({
  currentStyle,
  onStyleChange,
  satelliteStyleUrl,
  topoStyleUrl,
  activeLayers = [],
  onLayerToggle,
}) {
  const styleOptions = [
    { id: 'satellite', label: 'Satellite', styleUrl: satelliteStyleUrl },
    { id: 'topo', label: 'Topo/Map', styleUrl: topoStyleUrl },
  ]

  const terrainLayers = [
    { id: 'slope', label: 'Slope' },
    { id: 'aspect', label: 'Aspect' },
    { id: 'tri', label: 'TRI' },
    { id: 'composite', label: 'Composite Risk' },
  ]

  const toggleTerrainLayer = (layerId) => {
    if (!onLayerToggle) return
    const next = activeLayers.includes(layerId)
      ? activeLayers.filter((l) => l !== layerId)
      : [...activeLayers, layerId]
    onLayerToggle(next)
  }

  return (
    <div
      className="absolute top-4 right-4 z-10 p-3 rounded-lg shadow-lg flex flex-col gap-1 min-w-[160px]"
      style={{
        background: 'rgba(30, 45, 61, 0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
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
      {onLayerToggle && (
        <>
          <div className="border-t border-white/10 mt-2 pt-2">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1 mb-1 block">
              Terrain layers
            </span>
            {terrainLayers.map(({ id, label }) => {
              const isActive = activeLayers.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTerrainLayer(id)}
                  className={`text-left px-3 py-2 rounded text-sm font-medium transition-colors w-full ${
                    isActive
                      ? 'text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
                  }`}
                  style={isActive ? { backgroundColor: '#3B8BEB' } : {}}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </>
      )}
      <p className="text-[11px] text-white italic px-1 mt-2 pt-1 border-t border-white/10">
        Right-click anywhere on the map for terrain analysis
      </p>
    </div>
  )
}
