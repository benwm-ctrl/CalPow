import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import FadeIn from '../components/FadeIn'

import tahoeYellow from '../assets/images/GoTahoeNorth-2016-Winter-Bartkowski-3-1.jpg'
import tahoeJump from '../assets/images/Salm_Miles-Clark-1.jpg'
import skierSummit from '../assets/images/ZachH_McGee-10-1536x1016.jpg'

// ── SVG terrain icons — no emojis ──────────────────────────────────────────
const IconRoute = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22 L10 10 L16 16 L22 6" />
    <circle cx="4" cy="22" r="2" fill="currentColor" stroke="none"/>
    <circle cx="22" cy="6" r="2" fill="currentColor" stroke="none"/>
    <path d="M18 8 L24 8 L24 14" strokeWidth="1.4"/>
  </svg>
)

const IconAvalanche = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M14 3 L26 24 L2 24 Z" />
    <path d="M14 3 L14 14" strokeWidth="1.4" strokeDasharray="2 2"/>
    <path d="M9 18 L19 18" strokeWidth="1.4"/>
    <path d="M7 21 L21 21" strokeWidth="1.4"/>
  </svg>
)

const IconLibrary = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="22" height="18" rx="1"/>
    <path d="M3 10 L25 10"/>
    <path d="M9 5 L9 10"/>
    <path d="M8 14 L15 14"/>
    <path d="M8 18 L20 18"/>
  </svg>
)

const IconWind = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 7 Q8 7 10 5 Q12 3 14 5 Q16 7 14 9 Q12 11 2 11"/>
    <path d="M2 13 Q6 13 8 15 Q10 17 12 15"/>
  </svg>
)

const IconSnow = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M10 2 L10 18M2 10 L18 10M4.6 4.6 L15.4 15.4M15.4 4.6 L4.6 15.4"/>
    <circle cx="10" cy="10" r="2"/>
  </svg>
)

const FEATURES = [
  {
    icon: <IconRoute />,
    tag: '01 / TERRAIN',
    title: 'Smart Route Planning',
    text: 'Build tours on a 3D terrain map with satellite, topo, slope, and aspect overlays. Danger zones color-coded by severity. Download or upload GPX files.',
  },
  {
    icon: <IconAvalanche />,
    tag: '02 / FORECAST',
    title: 'Avalanche Intelligence',
    text: "Real-time forecasts from all four California avalanche centers. Automatic danger zone detection on your route with segment-by-segment risk scoring.",
  },
  {
    icon: <IconLibrary />,
    tag: '03 / HISTORY',
    title: 'Touring Library',
    text: 'Save every tour with notes, photos, difficulty ratings, and safety assessments. Your complete backcountry record.',
  },
]

const AVALANCHE_CENTERS = [
  { abbr: 'SAC', name: 'Sierra Avalanche Center', region: 'Carson Pass · Tahoe · Mammoth', url: 'https://www.sierraavalanchecenter.org/forecasts/' },
  { abbr: 'MSAC', name: 'Mt. Shasta Avalanche Center', region: 'Mt. Shasta · Trinity Alps', url: 'https://www.shastaavalanche.org/avalanche-forecast' },
  { abbr: 'BAC', name: 'Bridgeport Avalanche Center', region: 'Bridgeport Valley', url: 'https://bridgeportavalanchecenter.org/' },
  { abbr: 'ESAC', name: 'Eastern Sierra Avalanche Center', region: 'Bishop · Inyo · Mono', url: 'https://www.esavalanche.org/' },
]

const LIVE_LAYERS = [
  { icon: <IconWind />, label: 'Wind vectors', detail: 'Open-Meteo · 10m & 80m' },
  { icon: <IconSnow />, label: 'Snow depth', detail: 'NOAA NOHRSC · 4x daily' },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="7"/>
        <path d="M3.5 7 Q7 9 10 7 Q13 5 16.5 7"/>
        <path d="M3.5 13 Q7 11 10 13 Q13 15 16.5 13"/>
      </svg>
    ),
    label: 'Precip radar',
    detail: 'RainViewer · live',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 17 L8 8 L13 13 L17 5"/>
        <path d="M15 5 L17 5 L17 7"/>
      </svg>
    ),
    label: 'Slope & aspect',
    detail: 'Custom DEM · 10m',
  },
]

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'Barlow', sans-serif", backgroundColor: '#0A0F14', color: '#F0EDE8' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <img
          src={tahoeYellow}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%',
            filter: 'saturate(0.7) brightness(0.55)',
          }}
        />
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, opacity: 0.18,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
        }}/>
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', zIndex: 2,
          background: 'linear-gradient(to bottom, transparent, #0A0F14)',
        }}/>

        {/* Snow particles */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 1 + (i % 2),
              height: 1 + (i % 2),
              left: `${(i * 5.1 + (i % 7) * 2.3) % 98}%`,
              top: '-4px',
              borderRadius: '50%',
              backgroundColor: 'white',
              opacity: 0.2 + (i % 4) * 0.07,
              animation: `heroSnow ${10 + (i % 14)}s linear ${(i * 0.7) % 12}s infinite`,
            }}/>
          ))}
        </div>

        {/* Hero content */}
        <div style={{
          position: 'relative', zIndex: 3,
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '0 32px 80px',
          maxWidth: 1200, margin: '0 auto', width: '100%', alignSelf: 'center',
        }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(240,237,232,0.5)',
          }}>
            <span style={{ width: 32, height: 1, background: 'currentColor', display: 'inline-block' }}/>
            California Backcountry Intelligence
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(80px, 14vw, 160px)',
              fontWeight: 800,
              lineHeight: 0.88,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: '#F0EDE8',
              margin: 0,
            }}
          >
            Cal<br/>Pow
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 28,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(240,237,232,0.55)',
              margin: 0,
            }}>
              Plan Smart.&nbsp; Ski California.
            </p>
            <div style={{ width: 1, height: 18, background: 'rgba(240,237,232,0.2)' }}/>
            <div style={{ display: 'flex', gap: 12 }}>
              {LIVE_LAYERS.slice(0, 2).map(l => (
                <span key={l.label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.4)',
                }}>
                  <span style={{ color: 'rgba(240,237,232,0.3)' }}>{l.icon}</span>
                  {l.label}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.38 }}
            style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <Link
              to="/map"
              onClick={() => window.dispatchEvent(new CustomEvent('showNavbar'))}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px',
                border: '1px solid rgba(240,237,232,0.9)',
                color: '#0A0F14',
                backgroundColor: '#F0EDE8',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'background 0.18s, color 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#F0EDE8'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F0EDE8'; e.currentTarget.style.color = '#0A0F14'; }}
            >
              Open Map
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 7 L12 7 M8 3 L12 7 L8 11"/>
              </svg>
            </Link>
            <a
              href="#features"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(240,237,232,0.4)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.8)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.4)'}
            >
              See Features ↓
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── LIVE DATA TICKER ────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(240,237,232,0.08)',
        borderBottom: '1px solid rgba(240,237,232,0.08)',
        backgroundColor: '#0D1219',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', gap: 40,
        overflowX: 'auto',
      }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(240,237,232,0.3)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>Live Layers</span>
        <div style={{ width: 1, height: 16, background: 'rgba(240,237,232,0.1)', flexShrink: 0 }}/>
        {LIVE_LAYERS.map(l => (
          <div key={l.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ color: 'rgba(240,237,232,0.35)' }}>{l.icon}</span>
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(240,237,232,0.7)',
              }}>{l.label}</div>
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 10, color: 'rgba(240,237,232,0.3)',
              }}>{l.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn delay={0}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 56,
            borderBottom: '1px solid rgba(240,237,232,0.1)',
            paddingBottom: 20,
          }}>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: '#F0EDE8',
              margin: 0,
            }}>
              Everything you need
            </h2>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'rgba(240,237,232,0.3)',
            }}>
              for California backcountry
            </span>
          </div>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, border: '1px solid rgba(240,237,232,0.08)', backgroundColor: 'rgba(240,237,232,0.08)' }}>
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={0.08 * i}>
              <motion.div
                whileHover={{ backgroundColor: 'rgba(240,237,232,0.04)' }}
                style={{
                  backgroundColor: '#0A0F14',
                  padding: '40px 32px',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.3)',
                  marginBottom: 24,
                }}>
                  {f.tag}
                </div>
                <div style={{
                  width: 40, height: 40,
                  border: '1px solid rgba(240,237,232,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(240,237,232,0.6)',
                  marginBottom: 20,
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 22, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#F0EDE8',
                  margin: '0 0 12px',
                }}>
                  {f.title}
                </h3>
                <p style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 14, lineHeight: 1.65,
                  color: 'rgba(240,237,232,0.5)',
                  margin: 0,
                }}>
                  {f.text}
                </p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── AVALANCHE CENTERS ───────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={tahoeJump}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            filter: 'saturate(0.4) brightness(0.35)',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, rgba(10,15,20,0.95) 40%, rgba(10,15,20,0.6) 100%)',
        }}/>
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '80px 32px',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <FadeIn delay={0}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(240,237,232,0.35)',
              marginBottom: 12,
            }}>
              Data Sources
            </div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              fontWeight: 800, textTransform: 'uppercase',
              color: '#F0EDE8', margin: '0 0 48px',
            }}>
              Powered by California's Avalanche Centers
            </h2>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, backgroundColor: 'rgba(240,237,232,0.06)' }}>
            {AVALANCHE_CENTERS.map((c, i) => (
              <FadeIn key={c.name} delay={0.07 * i}>
                <motion.a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ backgroundColor: 'rgba(240,237,232,0.06)' }}
                  style={{
                    display: 'block',
                    backgroundColor: 'rgba(10,15,20,0.7)',
                    padding: '28px 24px',
                    textDecoration: 'none',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 28, fontWeight: 800,
                    color: 'rgba(240,237,232,0.15)',
                    marginBottom: 12,
                    letterSpacing: '-0.02em',
                  }}>
                    {c.abbr}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 15, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: '#F0EDE8',
                    marginBottom: 4,
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 11, color: 'rgba(240,237,232,0.35)',
                    marginBottom: 16,
                  }}>
                    {c.region}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.4)',
                  }}>
                    View Forecast
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 5 L9 5 M6 2 L9 5 L6 8"/>
                    </svg>
                  </div>
                </motion.a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── MIKE SECTION ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={skierSummit}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            filter: 'saturate(0.3) brightness(0.3)',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(10,15,20,0.97) 50%, rgba(10,15,20,0.5) 100%)',
        }}/>
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '96px 32px',
          maxWidth: 1200, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 64, alignItems: 'center',
        }}>
          <FadeIn delay={0}>
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'rgba(240,237,232,0.3)',
                marginBottom: 16,
              }}>
                AI Guide
              </div>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                color: '#F0EDE8', margin: '0 0 16px',
              }}>
                Meet Mike
              </h2>
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 15, lineHeight: 1.7,
                color: 'rgba(240,237,232,0.55)',
                margin: '0 0 32px',
                maxWidth: 420,
              }}>
                Mike has the current Sierra Avalanche Center forecast, live NOAA weather, and California terrain data loaded before you ask your first question. Tell him your route and he'll tell you what to watch for.
              </p>
              <Link
                to="/mike"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '13px 24px',
                  border: '1px solid rgba(240,237,232,0.3)',
                  color: '#F0EDE8',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  textDecoration: 'none',
                  transition: 'border-color 0.18s, color 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.8)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.3)'; }}
              >
                Chat with Mike
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 6 L11 6 M7 2 L11 6 L7 10"/>
                </svg>
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            {/* Mock chat card — no emoji, no AI aesthetic */}
            <div style={{
              border: '1px solid rgba(240,237,232,0.1)',
              backgroundColor: 'rgba(240,237,232,0.03)',
              padding: '24px',
              maxWidth: 420,
            }}>
              {/* Header bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 20, paddingBottom: 16,
                borderBottom: '1px solid rgba(240,237,232,0.08)',
              }}>
                <div style={{
                  width: 28, height: 28,
                  border: '1px solid rgba(240,237,232,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M7 1 L13 12 L1 12 Z"/>
                    <path d="M7 5 L7 9M7 10 L7 11" strokeWidth="1.8"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#F0EDE8' }}>Mike</div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'rgba(240,237,232,0.3)' }}>Sierra · Carson Pass · SAC forecast loaded</div>
                </div>
              </div>
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13, lineHeight: 1.7,
                color: 'rgba(240,237,232,0.6)',
                margin: 0,
              }}>
                Before you leave the trailhead — what's the SAC saying about wind slab on northwest aspects above 9,000 feet? That's your primary problem today, and it doesn't announce itself.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(240,237,232,0.08)',
        backgroundColor: '#070C10',
        padding: '48px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 32, marginBottom: 40,
          }}>
            <div>
              <Link to="/" style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 24, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.02em',
                color: '#F0EDE8', textDecoration: 'none',
              }}>CalPow</Link>
              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'rgba(240,237,232,0.3)',
                margin: '4px 0 0',
              }}>Plan Smart. Ski California.</p>
            </div>
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
              {['Map', 'Library', 'Education', 'Before You Go', 'Mike'].map(l => (
                <Link key={l} to={`/${l.toLowerCase().replace(/ /g, '-')}`} style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.35)', textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.8)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.35)'}
                >{l}</Link>
              ))}
            </nav>
          </div>

          <div style={{
            paddingTop: 24,
            borderTop: '1px solid rgba(240,237,232,0.06)',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
            gap: 12,
          }}>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: 'rgba(240,237,232,0.2)', margin: 0 }}>
              CalPow is a class project. Always check official avalanche forecasts before heading out.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {[
                ['SAC', 'https://sierraavalanchecenter.org'],
                ['MSAC', 'https://shastaavalanche.org'],
                ['BAC', 'https://bridgeportavalanchecenter.org'],
                ['ESAC', 'https://esavalanche.org'],
              ].map(([abbr, url]) => (
                <a key={abbr} href={url} target="_blank" rel="noopener noreferrer" style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.25)', textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.6)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.25)'}
                >{abbr}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── GLOBAL STYLES ───────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@400;600;700;800&display=swap');

        @keyframes heroSnow {
          0%   { transform: translateY(-10px); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 0.8; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
