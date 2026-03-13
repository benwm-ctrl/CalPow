import { useState } from 'react'

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

export default function LayerTogglePanel({
  currentStyle,
  onStyleChange,
  satelliteStyleUrl,
  topoStyleUrl,
  activeLayers = [],
  onLayerToggle,
  windEnabled = false,
  onWindToggle,
  windLoading = false,
  windZoomBlocked = false,
  precipRadarEnabled = false,
  onPrecipRadarToggle,
  precipRadarLoading = false,
  snowDepthEnabled = false,
  onSnowDepthToggle,
}) {
  const STORAGE_KEY = 'calpow_layers_collapsed'
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch (_) {}
  }

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

  const SectionLabel = ({ children }) => (
    <div style={{
      ...LABEL,
      fontSize: 9, fontWeight: 700,
      color: 'rgba(240,237,232,0.3)',
      padding: '8px 0 4px',
      borderTop: '1px solid rgba(240,237,232,0.07)',
      marginTop: 2,
    }}>
      {children}
    </div>
  )

  const LayerBtn = ({ active, onClick, disabled, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block', width: '100%',
        textAlign: 'left',
        padding: '7px 10px',
        border: `1px solid ${active ? 'rgba(240,237,232,0.45)' : 'rgba(240,237,232,0.08)'}`,
        backgroundColor: active ? 'rgba(240,237,232,0.1)' : 'transparent',
        color: active ? '#F0EDE8' : 'rgba(240,237,232,0.4)',
        ...LABEL,
        fontSize: 11, fontWeight: active ? 700 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        marginBottom: 3,
        transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !active) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.25)'; e.currentTarget.style.color = 'rgba(240,237,232,0.75)' }}}
      onMouseLeave={e => { if (!disabled && !active) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.08)'; e.currentTarget.style.color = 'rgba(240,237,232,0.4)' }}}
    >
      {children}
    </button>
  )

  return (
    <div style={{
      backgroundColor: 'rgba(7,12,16,0.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(240,237,232,0.1)',
      minWidth: 168,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(240,237,232,0.07)',
      }}>
        <span style={{
          ...LABEL, fontSize: 9, fontWeight: 700,
          color: 'rgba(240,237,232,0.4)',
        }}>
          Layers
        </span>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          style={{
            border: 'none', background: 'transparent',
            color: 'rgba(240,237,232,0.3)', cursor: 'pointer',
            fontSize: 9, padding: '2px 4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.3)'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 12px 10px' }}>

          {/* Map style */}
          {styleOptions.map((opt) => {
            const active = currentStyle === opt.id
            return (
              <LayerBtn key={opt.id} active={active} onClick={() => onStyleChange(opt.styleUrl, opt.id)}>
                {opt.label}
              </LayerBtn>
            )
          })}

          {/* Terrain layers */}
          {onLayerToggle && (
            <>
              <SectionLabel>Terrain Layers</SectionLabel>
              {terrainLayers.map(({ id, label }) => (
                <LayerBtn
                  key={id}
                  active={activeLayers.includes(id)}
                  onClick={() => toggleTerrainLayer(id)}
                >
                  {label}
                </LayerBtn>
              ))}
            </>
          )}

          {/* Wind */}
          {onWindToggle && (
            <>
              <SectionLabel>Wind</SectionLabel>
              <LayerBtn
                active={windEnabled}
                onClick={() => onWindToggle(!windEnabled)}
                disabled={windLoading}
              >
                {windLoading ? 'Loading…' : 'Wind'}
              </LayerBtn>
              {windZoomBlocked && (
                <div style={{
                  ...LABEL, fontSize: 9,
                  color: 'rgba(251,191,36,0.8)',
                  padding: '2px 2px 4px',
                }}>
                  Zoom in to view
                </div>
              )}
            </>
          )}

          {/* Precip */}
          {onPrecipRadarToggle && (
            <>
              <SectionLabel>Precip</SectionLabel>
              <LayerBtn
                active={precipRadarEnabled}
                onClick={() => onPrecipRadarToggle(!precipRadarEnabled)}
                disabled={precipRadarLoading}
              >
                {precipRadarLoading ? 'Loading…' : 'Precip Radar'}
              </LayerBtn>
              {onSnowDepthToggle && (
                <LayerBtn
                  active={snowDepthEnabled}
                  onClick={() => onSnowDepthToggle(!snowDepthEnabled)}
                >
                  Snow Depth
                </LayerBtn>
              )}
            </>
          )}

          {/* Footer hint */}
          <div style={{
            marginTop: 10, paddingTop: 8,
            borderTop: '1px solid rgba(240,237,232,0.07)',
            fontFamily: "'Barlow', sans-serif",
            fontSize: 9, fontStyle: 'italic',
            color: 'rgba(240,237,232,0.2)',
            lineHeight: 1.5,
          }}>
            Right-click anywhere on the map for terrain analysis
          </div>
        </div>
      )}
    </div>
  )
}
