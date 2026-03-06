import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, ChevronDown } from 'lucide-react'
import FadeIn from '../components/FadeIn'

import tahoeYellow from '../assets/images/GoTahoeNorth-2016-Winter-Bartkowski-3-1.jpg'
import tahoeJump from '../assets/images/Salm_Miles-Clark-1.jpg'
import skierSummit from '../assets/images/ZachH_McGee-10-1536x1016.jpg'

const ACCENT_BLUE = '#3B8BEB'
const CARD_BG = '#1E2D3D'
const BORDER = '#2D3748'

const FEATURES = [
  { icon: '🗺️', title: 'Smart Route Planning', text: 'Build tours on a 3D terrain map with satellite, topo, slope, and aspect overlays. Download or upload GPX files.' },
  { icon: '⚠️', title: 'Avalanche Intelligence', text: "Real-time forecasts from all four California avalanche centers. Automatic danger zone detection on your route." },
  { icon: '📚', title: 'Touring Library', text: 'Save every tour with notes, photos, difficulty ratings, and safety assessments. Your complete backcountry history.' },
]

const AVALANCHE_CENTERS = [
  { name: 'Sierra Avalanche Center', url: 'https://www.sierraavalanchecenter.org/forecasts/' },
  { name: 'Mt. Shasta Avalanche Center', url: 'https://www.shastaavalanche.org/avalanche-forecast' },
  { name: 'Bridgeport Avalanche Center', url: 'https://bridgeportavalanchecenter.org/' },
  { name: 'Eastern Sierra Avalanche Center (ESAC)', url: 'https://www.esavalanche.org/' },
]

export default function HomePage() {
  return (
    <div className="bg-background-primary">
      {/* Hero: tahoeYellow + overlay */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-0 pb-24 text-center overflow-hidden">
        <img
          src={tahoeYellow}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ backgroundColor: '#1E2D3D', objectPosition: 'center top' }}
          loading="lazy"
        />
        <div
          className="absolute inset-0 z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(15, 25, 35, 0.2) 0%, rgba(15, 25, 35, 0.55) 50%, rgba(15, 25, 35, 0.97) 100%)',
          }}
        />
        {/* Hero snow: 25 particles, behind text, in front of background */}
        <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden" aria-hidden>
          {Array.from({ length: 25 }).map((_, i) => {
            const fallDuration = 8 + (i % 18); // 8s to 25s
            const swayDuration = 3 + (i % 4); // 3s to 6s, different from fall
            const leftPct = (i * 4.2 + (i % 5) * 3.1) % 97; // wider spread
            return (
              <div
                key={i}
                className="absolute animate-hero-snow"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${leftPct}%`,
                  top: '-4px',
                  opacity: 0.15 + (i % 5) * 0.05, // 0.15 to 0.35
                  animationDelay: `${(i * 0.5) % 14}s`,
                  animationDuration: `${fallDuration}s`,
                }}
              >
                <div
                  className="w-full h-full rounded-full bg-white"
                  style={{
                    animation: i % 2 === 0
                      ? `hero-snow-sway ${swayDuration}s ease-in-out infinite`
                      : `hero-snow-sway-rev ${swayDuration}s ease-in-out infinite`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="relative z-10 max-w-4xl mx-auto" style={{ transform: 'translateY(-144px)', marginBottom: '48px' }}>
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[96px] font-bold text-white tracking-tight">
            CalPow
          </h1>
          <p className="mt-4 text-xl sm:text-2xl font-medium" style={{ color: ACCENT_BLUE }}>
            Plan Smart. Ski California.
          </p>
          <p className="mt-4 text-text-secondary text-lg max-w-2xl mx-auto">
            Route planning, avalanche intelligence, and backcountry wisdom for California skiers.
          </p>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/map"
              onClick={() => window.dispatchEvent(new CustomEvent('showNavbar'))}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-lg font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: ACCENT_BLUE }}
            >
              Start Planning
            </Link>
          </motion.div>
          <a href="#features" className="text-text-muted hover:text-white transition-colors" aria-label="Scroll to features">
            <ChevronDown className="w-8 h-8 animate-bounce" />
          </a>
        </div>
      </section>

      {/* Features: tahoeYellow parallax bg */}
      <section id="features" className="relative z-10 py-20 px-4 overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${tahoeYellow})`,
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#1E2D3D',
          }}
        />
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: 'rgba(15, 25, 35, 0.88)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <FadeIn delay={0}>
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Everything you need for the California backcountry
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={0.1 * (i + 1)}>
                <motion.div
                  className="rounded-xl border p-6 cursor-default"
                  style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
                  whileHover={{ y: -4, transition: { duration: 0.2 }, boxShadow: '0 0 0 1px rgba(59, 139, 235, 0.25), 0 8px 32px rgba(0,0,0,0.3)' }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: 'rgba(59, 139, 235, 0.2)' }}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.text}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Avalanche Centers: tahoeJump bg */}
      <section className="relative z-10 py-16 px-4 overflow-hidden">
        <img
          src={tahoeJump}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ backgroundColor: '#1E2D3D' }}
          loading="lazy"
        />
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: 'rgba(15, 25, 35, 0.75)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <FadeIn delay={0}>
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              Powered by California's Avalanche Centers
            </h2>
            <p className="text-text-secondary text-center text-sm mb-10 max-w-2xl mx-auto">
              CalPow pulls live forecast data directly from these centers to keep your routes up to date.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AVALANCHE_CENTERS.map((c, i) => (
              <FadeIn key={c.name} delay={0.1 * i}>
                <motion.a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border p-4 text-center block"
                  style={{ borderColor: BORDER, backgroundColor: 'rgba(15, 25, 35, 0.5)' }}
                  whileHover={{ y: -4, boxShadow: '0 0 0 1px rgba(59, 139, 235, 0.25), 0 8px 32px rgba(0,0,0,0.3)' }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="font-medium text-white text-sm">{c.name}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium mt-2" style={{ color: ACCENT_BLUE }}>
                    View Forecast <ExternalLink className="w-3 h-3" />
                  </span>
                </motion.a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Mike: skierSummit bg */}
      <section className="relative z-10 py-20 px-4 overflow-hidden">
        <img
          src={skierSummit}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ backgroundColor: '#1E2D3D' }}
          loading="lazy"
        />
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: 'rgba(15, 25, 35, 0.82)' }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn delay={0}>
              <div>
                <h2 className="text-4xl font-bold text-white">Meet Mike</h2>
                <p className="text-lg font-medium text-text-secondary mt-2">Your AI backcountry guide</p>
                <p className="text-text-primary mt-4 leading-relaxed">
                  Mike knows California snow. Ask him about avalanche safety, trip planning, gear, or reading forecasts. He's stoked to help — and he'll always tell you to check the forecast first.
                </p>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/mike" className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: ACCENT_BLUE }}>
                    Chat with Mike <span aria-hidden>→</span>
                  </Link>
                </motion.div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <motion.div className="rounded-2xl rounded-bl-sm border p-5 max-w-md" style={{ backgroundColor: CARD_BG, borderColor: BORDER }} whileHover={{ boxShadow: '0 0 0 1px rgba(59, 139, 235, 0.25), 0 8px 32px rgba(0,0,0,0.3)' }}>
                <p className="text-xs text-text-muted mb-2 flex items-center gap-1"><span aria-hidden>🎿</span> Mike</p>
                <p className="text-text-primary text-sm leading-relaxed">
                  Stoked you're planning a Sierra tour! Before anything else — what's the current SAC forecast saying? That's your starting point for every decision today.
                </p>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t py-10 px-4" style={{ borderColor: BORDER, backgroundColor: '#0F1923' }}>
        <FadeIn delay={0}>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-8">
              <div>
                <Link to="/" className="text-xl font-bold text-white hover:text-accent-blue transition-colors">CalPow</Link>
                <p className="text-sm text-text-secondary mt-1">Plan Smart. Ski California.</p>
              </div>
              <nav className="flex flex-wrap gap-6">
                <Link to="/map" className="text-sm text-text-secondary hover:text-accent-blue transition-colors">Map</Link>
                <Link to="/library" className="text-sm text-text-secondary hover:text-accent-blue transition-colors">Library</Link>
                <Link to="/education" className="text-sm text-text-secondary hover:text-accent-blue transition-colors">Education</Link>
                <Link to="/before-you-go" className="text-sm text-text-secondary hover:text-accent-blue transition-colors">Before You Go</Link>
                <Link to="/mike" className="text-sm text-text-secondary hover:text-accent-blue transition-colors">Mike</Link>
              </nav>
              <p className="text-sm text-text-muted">Built for California backcountry skiers</p>
            </div>
            <div className="pt-6 border-t text-center text-xs text-text-muted" style={{ borderColor: BORDER }}>
              <p>CalPow is a class project. Always check official avalanche forecasts before heading out.</p>
              <p className="mt-2">
                <a href="https://sierraavalanchecenter.org" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">sierraavalanchecenter.org</a>
                {' | '}
                <a href="https://shastaavalanche.org" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">shastaavalanche.org</a>
                {' | '}
                <a href="https://bridgeportavalanchecenter.org" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">bridgeportavalanchecenter.org</a>
                {' | '}
                <a href="https://esavalanche.org" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">esavalanche.org</a>
              </p>
            </div>
          </div>
        </FadeIn>
      </footer>
    </div>
  )
}
