import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '../components/FadeIn'
import inclineSunrise from '../assets/images/TQ-ski-and-ride-1.jpg'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F14',
  panel: '#070C10',
  panelAlpha: 'rgba(7,12,16,0.92)',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.22)',
  ghost: 'rgba(240,237,232,0.04)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

// ── Inline SVG ────────────────────────────────────────────────────────────────
const IconExternal = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M4.5 2H2.5A1.5 1.5 0 001 3.5v5A1.5 1.5 0 002.5 10h5A1.5 1.5 0 009 8.5V6.5"/>
    <path d="M6.5 1H10M10 1v3.5M10 1L5 6"/>
  </svg>
)

// ── Data ──────────────────────────────────────────────────────────────────────
const DANGER_LEVELS = [
  { level: 1, label: 'Low', color: '#38A169', summary: 'Natural avalanches very unlikely. Human-triggered avalanches possible in isolated terrain.', detail: 'Travel is generally safe. Use normal caution. Focus on terrain traps and obstacles. Good conditions for learning and practicing skills.' },
  { level: 2, label: 'Moderate', color: '#D69E2E', summary: 'Natural avalanches unlikely. Human-triggered avalanches possible on steep slopes.', detail: 'Be selective with terrain. Avoid large, steep, consequential slopes. Stick to low-angle or well-supported lines. Watch for unstable snow in wind-loaded or recently loaded areas.' },
  { level: 3, label: 'Considerable', color: '#DD6B20', summary: 'Natural avalanches possible. Human-triggered avalanches likely on many slopes.', detail: 'Dangerous conditions. Limit travel to low-angle terrain. Avoid avalanche runouts, convexities, and lee slopes. One at a time in exposed zones. Consider turning around.' },
  { level: 4, label: 'High', color: '#E53E3E', summary: 'Natural avalanches likely. Human-triggered avalanches very likely on many slopes.', detail: 'Travel in avalanche terrain not recommended. Stay on low-angle slopes well away from runouts. Large natural avalanches may run to the valley floor. Wait for conditions to improve.' },
  { level: 5, label: 'Extreme', color: '#9B2335', summary: 'Widespread natural and human-triggered avalanches certain.', detail: 'Avoid all avalanche terrain. Large to massive avalanches may run long distances. Stay out of the backcountry. Conditions are life-threatening.' },
]

const AVALANCHE_PROBLEMS = [
  { name: 'Storm Slab', tag: 'SS', description: 'New snow has not yet bonded to the layer below. The slab can fracture and slide as a cohesive unit. Most common during and right after storms.', terrain: 'Steep slopes with recent snowfall; watch for convexities and wind-stiffened surfaces.' },
  { name: 'Wind Slab', tag: 'WS', description: 'Wind has transported snow and deposited it in dense slabs on lee slopes and in gullies. Often feels hollow or drum-like underfoot.', terrain: 'Lee sides of ridges, cross-loaded gullies, and below ridge crests.' },
  { name: 'Persistent Slab', tag: 'PS', description: 'A weak layer buried in the snowpack (often facets or surface hoar) can persist for days or weeks. Hard to trigger but produces large, dangerous avalanches.', terrain: 'Any slope angle that holds the weak layer; often widespread. Steeper slopes and trigger points are most dangerous.' },
  { name: 'Deep Slab', tag: 'DS', description: 'A deeply buried weak layer fails and takes the entire seasonal snowpack with it. Very large, unpredictable, and often fatal. Difficult to assess.', terrain: 'Steep, open slopes; can be triggered from low-angle terrain. Often associated with early-season weak layers.' },
  { name: 'Wet Avalanche', tag: 'WA', description: 'Liquid water weakens bonds in the snowpack. Loose wet (sluffs) or wet slab avalanches occur during warming, rain, or solar radiation.', terrain: 'Sun-exposed slopes, low elevations, and during afternoon warming. Avoid during rain or rapid melt.' },
  { name: 'Cornice', tag: 'CO', description: 'Overhanging masses of wind-deposited snow on ridge crests. Can break off under a skier or collapse and trigger slabs below.', terrain: 'Ridge tops and lee sides of ridges. Never travel on or directly under cornices. Give them a wide berth.' },
]

const RED_FLAGS = [
  { code: 'RF-1', title: 'Whumpfing sounds', text: 'The snowpack is collapsing under your weight. A weak layer is failing. Treat this as a serious warning and avoid steep terrain.' },
  { code: 'RF-2', title: 'Shooting cracks', text: 'Cracks propagating from your skis or feet mean the slab is fracturing. You are standing on unstable snow. Back off immediately.' },
  { code: 'RF-3', title: 'Recent avalanche activity', text: 'If you see recent slides, similar slopes can go. Same aspect, elevation, and terrain type are suspect. Conditions are active.' },
  { code: 'RF-4', title: 'Heavy recent snowfall (>30cm)', text: 'New snow needs time to bond. Storm slab danger is high. Allow 24–48 hours for settlement before committing to steep terrain.' },
  { code: 'RF-5', title: 'Significant wind loading', text: 'Wind moves snow from windward to lee slopes, building slabs. Avoid lee sides of ridges and cross-loaded terrain after wind events.' },
  { code: 'RF-6', title: 'Rapid warming or rain', text: 'Liquid water weakens the snowpack. Wet avalanches become likely. Get off steep slopes early in the day or during rain.' },
]

const FORECAST_STEPS = [
  { step: 1, title: 'Check the danger level for your elevation band', text: 'Forecasts break danger into elevation bands (below treeline, near treeline, alpine). Your route may cross more than one. Plan for the highest danger you will encounter.' },
  { step: 2, title: 'Identify the avalanche problems listed', text: 'Each problem type (storm slab, wind slab, persistent slab, etc.) has different implications. Know which problems are present and where they are most likely to exist.' },
  { step: 3, title: 'Note the dangerous aspects and elevations', text: 'Forecasts often say which slope aspects (N, NE, E, etc.) and elevation bands are most dangerous. Match this to your planned route.' },
  { step: 4, title: 'Read the bottom line summary', text: 'The avalanche center distills the message into a short "bottom line." This is the key takeaway for the day. Read it first, then dig into details.' },
  { step: 5, title: 'Check the forecast trend for coming days', text: 'Is danger rising or falling? Planning a multi-day trip? The trend helps you decide when to go and when to wait.' },
]

const NAV_SECTIONS = [
  { id: 'danger-scale', label: 'Danger Scale' },
  { id: 'avalanche-problems', label: 'Avalanche Problems' },
  { id: 'red-flags', label: 'Red Flags' },
  { id: 'reading-forecast', label: 'Reading the Forecast' },
  { id: 'decision-framework', label: 'Go/No-Go Decisions' },
  { id: 'watch-learn', label: 'Watch & Learn' },
  { id: 'get-certified', label: 'Get Certified' },
]

const AVAL_CENTERS = [
  { label: 'SAC', name: 'Sierra Avalanche Center', url: 'https://www.sierraavalanchecenter.org/forecasts/' },
  { label: 'MSAC', name: 'Mt. Shasta Avalanche Center', url: 'https://www.shastaavalanche.org/avalanche-forecast' },
  { label: 'BAC', name: 'Bridgeport Avalanche Center', url: 'https://bridgeportavalanchecenter.org/' },
  { label: 'ESAC', name: 'Eastern Sierra Avalanche Center', url: 'https://www.esavalanche.org/' },
]

// ── Sub-components ────────────────────────────────────────────────────────────
const SectionHeading = ({ children }) => (
  <h2 style={{
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 'clamp(20px, 3vw, 26px)',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: C.text,
    marginBottom: 20,
    marginTop: 0,
  }}>
    {children}
  </h2>
)

const ExtLink = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px',
      border: `1px solid ${C.border}`,
      backgroundColor: C.ghost,
      color: C.muted,
      ...LABEL, fontSize: 10, fontWeight: 700,
      textDecoration: 'none',
      transition: 'border-color 0.15s, color 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
  >
    {children}
    <IconExternal />
  </a>
)

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EducationPage() {
  const [expandedLevel, setExpandedLevel] = useState(null)

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 56, paddingTop: 0 }}>

          {/* ── Sticky side nav ── */}
          <nav className="hidden lg:block" style={{ flexShrink: 0, width: 160, position: 'sticky', top: 80, alignSelf: 'flex-start', paddingTop: 48 }}>
            <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 12 }}>
              On this page
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {NAV_SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    style={{
                      display: 'block',
                      padding: '6px 0',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11, letterSpacing: '0.06em',
                      color: C.muted,
                      textDecoration: 'none',
                      borderLeft: `1px solid ${C.border}`,
                      paddingLeft: 12,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderLeftColor = C.text }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderLeftColor = C.border }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Main content ── */}
          <main style={{ flex: 1, minWidth: 0 }}>

            {/* Hero */}
            <section style={{ position: 'relative', marginBottom: 64, marginTop: 32, overflow: 'hidden', minHeight: 220 }}>
              <img
                src={inclineSunrise}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', backgroundColor: C.panel }}
                loading="lazy"
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.35) 0%, rgba(10,15,20,0.9) 100%)' }}/>
              <div style={{ position: 'relative', zIndex: 2, padding: '48px 32px 32px' }}>
                <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 8 }}>
                  Avalanche Education · California Backcountry
                </div>
                <h1 style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 'clamp(32px, 6vw, 52px)',
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  color: C.text,
                  margin: '0 0 12px',
                  lineHeight: 1,
                }}>
                  Snow & Avalanche Field Guide
                </h1>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: C.muted, margin: '0 0 24px', maxWidth: 480 }}>
                  Danger scale, avalanche problems, red flags, and decision frameworks for the Sierra, Shasta, and Eastern Sierra.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {AVAL_CENTERS.map(({ label, name, url }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 12px',
                        border: `1px solid ${C.border}`,
                        backgroundColor: 'rgba(7,12,16,0.7)',
                        color: C.muted,
                        ...LABEL, fontSize: 10,
                        textDecoration: 'none',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
                    >
                      <span style={{ color: C.faint, fontSize: 9 }}>{label}</span>
                      {name}
                      <IconExternal />
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Danger Scale ── */}
            <section id="danger-scale" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>The Danger Scale</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {DANGER_LEVELS.map((item, index) => {
                  const isExpanded = expandedLevel === item.level
                  return (
                    <FadeIn key={item.level} delay={index * 0.06}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedLevel(isExpanded ? null : item.level)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedLevel(isExpanded ? null : item.level) }}}
                        style={{
                          border: `1px solid ${isExpanded ? 'rgba(240,237,232,0.15)' : C.border}`,
                          backgroundColor: isExpanded ? C.ghost : 'transparent',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background-color 0.15s',
                          borderLeft: `3px solid ${item.color}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px' }}>
                          <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 22, fontWeight: 800,
                            color: item.color, width: 24, flexShrink: 0,
                          }}>{item.level}</span>
                          <span style={{
                            ...LABEL, fontSize: 11, fontWeight: 700,
                            color: item.color, width: 96, flexShrink: 0,
                          }}>{item.label}</span>
                          <p style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: 12, color: C.muted,
                            margin: 0, flex: 1, lineHeight: 1.5,
                          }}>{item.summary}</p>
                          <span style={{
                            color: C.faint, fontSize: 10, flexShrink: 0,
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                          }}>▶</span>
                        </div>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden', borderTop: `1px solid ${C.border}` }}
                            >
                              <p style={{
                                fontFamily: "'Barlow', sans-serif",
                                fontSize: 12, color: C.muted,
                                margin: 0, padding: '12px 16px 14px 56px',
                                lineHeight: 1.7,
                              }}>{item.detail}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )
                })}
              </div>
            </section>

            {/* ── Avalanche Problems ── */}
            <section id="avalanche-problems" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Avalanche Problems</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                {AVALANCHE_PROBLEMS.map((problem, i) => (
                  <FadeIn key={problem.name} delay={i * 0.05}>
                    <div style={{
                      border: `1px solid ${C.border}`,
                      padding: '16px',
                      backgroundColor: C.ghost,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{
                          ...LABEL, fontSize: 9, fontWeight: 700,
                          color: C.faint,
                          border: `1px solid ${C.border}`,
                          padding: '2px 6px',
                          flexShrink: 0,
                        }}>{problem.tag}</span>
                        <h3 style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 14, fontWeight: 700,
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                          color: C.text, margin: 0,
                        }}>{problem.name}</h3>
                      </div>
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.65, margin: '0 0 10px' }}>
                        {problem.description}
                      </p>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                        <span style={{ ...LABEL, fontSize: 9, color: C.faint }}>Terrain: </span>
                        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted }}>
                          {problem.terrain}
                        </span>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </section>

            {/* ── Red Flags ── */}
            <section id="red-flags" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Red Flags — Turn Around Signs</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
                {RED_FLAGS.map((flag) => (
                  <div
                    key={flag.code}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderLeft: '3px solid #E53E3E',
                      padding: '14px 16px',
                      backgroundColor: C.ghost,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ ...LABEL, fontSize: 8, color: 'rgba(229,62,62,0.5)', flexShrink: 0 }}>{flag.code}</span>
                      <h3 style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 13, fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: C.text, margin: 0,
                      }}>{flag.title}</h3>
                    </div>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.65, margin: 0 }}>
                      {flag.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Reading the Forecast ── */}
            <section id="reading-forecast" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Reading the Forecast</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {FORECAST_STEPS.map((item) => (
                  <div
                    key={item.step}
                    style={{
                      display: 'flex', gap: 20,
                      border: `1px solid ${C.border}`,
                      padding: '16px',
                      backgroundColor: C.ghost,
                    }}
                  >
                    <div style={{
                      flexShrink: 0, width: 32, height: 32,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid rgba(240,237,232,0.2)`,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 14, fontWeight: 800,
                      color: C.text,
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <h3 style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 13, fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: C.text, margin: '0 0 6px',
                      }}>{item.title}</h3>
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.65 }}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Decision Framework ── */}
            <section id="decision-framework" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Making Go/No-Go Decisions</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                {[
                  { title: 'Terrain', body: 'Choose terrain that matches the danger level. At Considerable or higher, avoid avalanche paths, convexities, and lee slopes.' },
                  { title: 'Snowpack', body: 'Look for recent avalanche activity, whumpfing, and shooting cracks. These are your most reliable red flags.' },
                  { title: 'Human Factors', body: 'Summit fever, peer pressure, and familiarity bias kill people. Build a culture of speaking up in your group.' },
                ].map(({ title, body }) => (
                  <div key={title} style={{ border: `1px solid ${C.border}`, padding: '16px', backgroundColor: C.ghost }}>
                    <h3 style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 13, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: C.text, margin: '0 0 8px',
                    }}>{title}</h3>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.65 }}>{body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Watch & Learn ── */}
            <section id="watch-learn" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Watch & Learn</SectionHeading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2, marginBottom: 2 }}>
                {[
                  { src: 'https://www.youtube.com/embed/V5Xl-XYq6AQ', title: 'Avalanche Awareness' },
                  { src: 'https://www.youtube.com/embed/r46IPOfeso8', title: 'Understanding Avalanche Terrain' },
                ].map(({ src, title }) => (
                  <div key={title} style={{ border: `1px solid ${C.border}`, overflow: 'hidden', backgroundColor: C.ghost }}>
                    <div style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
                      <iframe src={src} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
                    </div>
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>{title}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ border: `1px solid ${C.border}`, overflow: 'hidden', backgroundColor: C.ghost, marginBottom: 2 }}>
                <div style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
                  <iframe src="https://www.youtube.com/embed/ZFWII5bAlQI" title="Backcountry Safety" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
                </div>
                <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>Backcountry Safety</span>
                </div>
              </div>
              <div style={{ border: `1px solid ${C.border}`, padding: '18px 20px', backgroundColor: C.ghost, borderLeft: '3px solid rgba(59,139,235,0.6)' }}>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text, margin: '0 0 8px' }}>
                  Cody Townsend — The Fifty
                </h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.65, margin: '0 0 14px' }}>
                  Follow California ski legend Cody Townsend as he attempts to ski the 50 classic ski descents of North America. Essential watching for any aspiring backcountry skier.
                </p>
                <ExtLink href="https://www.youtube.com/c/CodyTownsend">Visit Channel</ExtLink>
              </div>
            </section>

            {/* ── Get Certified ── */}
            <section id="get-certified" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <SectionHeading>Get Certified</SectionHeading>
              <div style={{
                border: `1px solid rgba(59,139,235,0.3)`,
                borderLeft: '3px solid #3B8BEB',
                padding: '24px',
                backgroundColor: 'rgba(59,139,235,0.04)',
              }}>
                <h3 style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 18, fontWeight: 800,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: C.text, margin: '0 0 10px',
                }}>Take an AIARE Avalanche Course</h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: C.muted, lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
                  The best thing you can do for your safety and your crew's is take a formal avalanche course. AIARE Level 1 teaches you to read forecasts, assess terrain, and make decisions as a group.
                </p>
                <ExtLink href="https://aiare.net/find-a-course/">Find a Course Near You</ExtLink>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}
