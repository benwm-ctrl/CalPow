import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import FadeIn from '../components/FadeIn'

import inclineSunrise from '../assets/images/TQ-ski-and-ride-1.jpg'

const BG_DARK = '#0F1923'
const CARD_BG = '#1E2D3D'
const ACCENT_BLUE = '#3B8BEB'
const BORDER = '#2D3748'

const DANGER_LEVELS = [
  {
    level: 1,
    label: 'Low',
    color: '#38A169',
    summary: 'Natural avalanches very unlikely. Human-triggered avalanches possible in isolated terrain.',
    detail:
      'Travel is generally safe. Use normal caution. Focus on terrain traps and obstacles. Good conditions for learning and practicing skills.',
  },
  {
    level: 2,
    label: 'Moderate',
    color: '#D69E2E',
    summary: 'Natural avalanches unlikely. Human-triggered avalanches possible, especially on steep slopes.',
    detail:
      'Be selective with terrain. Avoid large, steep, consequential slopes. Stick to low-angle or well-supported lines. Watch for unstable snow in wind-loaded or recently loaded areas.',
  },
  {
    level: 3,
    label: 'Considerable',
    color: '#DD6B20',
    summary: 'Natural avalanches possible. Human-triggered avalanches likely on many slopes.',
    detail:
      'Dangerous conditions. Limit travel to low-angle terrain. Avoid avalanche runouts, convexities, and lee slopes. One at a time in exposed zones. Consider turning around.',
  },
  {
    level: 4,
    label: 'High',
    color: '#E53E3E',
    summary: 'Natural avalanches likely. Human-triggered avalanches very likely on many slopes.',
    detail:
      'Travel in avalanche terrain not recommended. Stay on low-angle slopes well away from runouts. Large natural avalanches may run to the valley floor. Wait for conditions to improve.',
  },
  {
    level: 5,
    label: 'Extreme',
    color: '#9B2335',
    summary: 'Widespread natural and human-triggered avalanches certain.',
    detail:
      'Avoid all avalanche terrain. Large to massive avalanches may run long distances. Stay out of the backcountry or stick to flat, forested, or otherwise safe zones. Conditions are life-threatening.',
  },
]

const AVALANCHE_PROBLEMS = [
  {
    name: 'Storm Slab',
    emoji: '🌨️',
    description:
      'New snow has not yet bonded to the layer below. The slab can fracture and slide as a cohesive unit. Most common during and right after storms.',
    terrain: 'Steep slopes with recent snowfall; watch for convexities and wind-stiffened surfaces.',
  },
  {
    name: 'Wind Slab',
    emoji: '💨',
    description:
      'Wind has transported snow and deposited it in dense slabs on lee slopes and in gullies. Often feels hollow or drum-like underfoot.',
    terrain: 'Lee sides of ridges, cross-loaded gullies, and below ridge crests.',
  },
  {
    name: 'Persistent Slab',
    emoji: '📐',
    description:
      'A weak layer buried in the snowpack (often facets or surface hoar) can persist for days or weeks. Hard to trigger but produces large, dangerous avalanches.',
    terrain: 'Any slope angle that holds the weak layer; often widespread. Steeper slopes and trigger points are most dangerous.',
  },
  {
    name: 'Deep Slab',
    emoji: '⬇️',
    description:
      'A deeply buried weak layer fails and takes the entire seasonal snowpack with it. Very large, unpredictable, and often fatal. Difficult to assess.',
    terrain: 'Steep, open slopes; can be triggered from low-angle terrain. Often associated with early-season weak layers.',
  },
  {
    name: 'Wet Avalanche',
    emoji: '💧',
    description:
      'Liquid water weakens bonds in the snowpack. Loose wet (sluffs) or wet slab avalanches occur during warming, rain, or solar radiation.',
    terrain: 'Sun-exposed slopes, low elevations, and during afternoon warming. Avoid during rain or rapid melt.',
  },
  {
    name: 'Cornice',
    emoji: '🏔️',
    description:
      'Overhanging masses of wind-deposited snow on ridge crests. Can break off under a skier or collapse and trigger slabs below.',
    terrain: 'Ridge tops and lee sides of ridges. Never travel on or directly under cornices. Give them a wide berth.',
  },
]

const RED_FLAGS = [
  {
    icon: '🔊',
    title: 'Whumpfing sounds',
    text: 'The snowpack is collapsing under your weight. A weak layer is failing. Treat this as a serious warning and avoid steep terrain.',
  },
  {
    icon: '💥',
    title: 'Shooting cracks',
    text: 'Cracks propagating from your skis or feet mean the slab is fracturing. You are standing on unstable snow. Back off immediately.',
  },
  {
    icon: '🏔️',
    title: 'Recent avalanche activity',
    text: 'If you see recent slides, similar slopes can go. Same aspect, elevation, and terrain type are suspect. Conditions are active.',
  },
  {
    icon: '❄️',
    title: 'Heavy recent snowfall (>30cm in 24hrs)',
    text: 'New snow needs time to bond. Storm slab danger is high. Allow 24–48 hours for settlement before committing to steep terrain.',
  },
  {
    icon: '💨',
    title: 'Significant wind loading',
    text: 'Wind moves snow from windward to lee slopes, building slabs. Avoid lee sides of ridges and cross-loaded terrain after wind events.',
  },
  {
    icon: '🌡️',
    title: 'Rapid warming or rain',
    text: 'Liquid water weakens the snowpack. Wet avalanches become likely. Get off steep slopes early in the day or during rain.',
  },
]

const FORECAST_STEPS = [
  {
    step: 1,
    title: 'Check the danger level for your elevation band',
    text: 'Forecasts break danger into elevation bands (e.g. below treeline, near treeline, alpine). Your route may cross more than one. Plan for the highest danger you will encounter.',
  },
  {
    step: 2,
    title: 'Identify the avalanche problems listed',
    text: 'Each problem type (storm slab, wind slab, persistent slab, etc.) has different implications. Know which problems are present and where they are most likely to exist.',
  },
  {
    step: 3,
    title: 'Note the dangerous aspects and elevations',
    text: 'Forecasts often say which slope aspects (N, NE, E, etc.) and elevation bands are most dangerous. Match this to your planned route.',
  },
  {
    step: 4,
    title: 'Read the bottom line summary',
    text: 'The avalanche center distills the message into a short "bottom line." This is the key takeaway for the day. Read it first, then dig into details.',
  },
  {
    step: 5,
    title: 'Check the forecast trend for coming days',
    text: 'Is danger rising or falling? Planning a multi-day trip? The trend helps you decide when to go and when to wait.',
  },
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

export default function EducationPage() {
  const [expandedLevel, setExpandedLevel] = useState(null)

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)]"
      style={{ backgroundColor: BG_DARK }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:flex lg:gap-12">
          {/* Sticky side nav - desktop only */}
          <nav className="hidden lg:block shrink-0 w-48 top-24 self-start sticky">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              On this page
            </p>
            <ul className="space-y-1">
              {NAV_SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block py-1.5 text-sm text-text-secondary hover:text-accent-blue transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="flex-1 min-w-0">
            {/* 1. Hero */}
            <section className="relative mb-16 lg:mb-24 rounded-2xl overflow-hidden min-h-[200px] flex flex-col justify-end p-6 sm:p-8">
              <img
                src={inclineSunrise}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ backgroundColor: '#1E2D3D', objectPosition: 'center center' }}
                loading="lazy"
              />
              <div
                className="absolute inset-0 z-0"
                style={{ backgroundColor: 'rgba(15, 25, 35, 0.55)' }}
              />
              <div className="relative z-10">
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 drop-shadow-md">
                  Know Before You Go
                </h1>
                <p className="text-lg text-text-secondary mb-8 max-w-xl drop-shadow-sm">
                  Avalanche education for California backcountry skiers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <a
                  href="https://www.sierraavalanchecenter.org/forecasts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white border border-border hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD_BG }}
                >
                  Sierra Avalanche Center
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://www.shastaavalanche.org/avalanche-forecast"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white border border-border hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD_BG }}
                >
                  Mt. Shasta Avalanche Center
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://bridgeportavalanchecenter.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white border border-border hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD_BG }}
                >
                  Bridgeport Avalanche Center
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://www.esavalanche.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white border border-border hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: CARD_BG }}
                >
                  Eastern Sierra Avalanche Center
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              </div>
            </section>

            {/* 2. Danger Scale */}
            <section id="danger-scale" className="scroll-mt-24 mb-16 lg:mb-24">
              <h2 className="text-2xl font-bold text-white mb-6">
                The Danger Scale
              </h2>
              <div className="space-y-2">
                {DANGER_LEVELS.map((item, index) => {
                  const isExpanded = expandedLevel === item.level
                  return (
                    <FadeIn key={item.level} delay={index * 0.08}>
                      <motion.div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setExpandedLevel(isExpanded ? null : item.level)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setExpandedLevel(isExpanded ? null : item.level)
                          }
                        }}
                        className="rounded-xl border overflow-hidden text-left cursor-pointer"
                        style={{
                          backgroundColor: CARD_BG,
                          borderColor: BORDER,
                        }}
                        whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                      >
                        <div
                          className="flex items-center gap-4 p-4"
                          style={{
                            borderLeft: `4px solid ${item.color}`,
                          }}
                        >
                          <span
                            className="text-2xl font-bold text-white w-8"
                            aria-hidden
                          >
                            {item.level}
                          </span>
                          <span
                            className="font-semibold text-white capitalize"
                            style={{ color: item.color }}
                          >
                            {item.label}
                          </span>
                          <p className="flex-1 text-sm text-text-secondary">
                            {item.summary}
                          </p>
                        </div>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="px-4 pb-4 pt-0 border-t border-border overflow-hidden"
                              style={{ borderColor: BORDER }}
                            >
                              <p className="text-sm text-text-primary leading-relaxed pt-3">
                                {item.detail}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </FadeIn>
                  )
                })}
              </div>
            </section>

            {/* 3. Avalanche Problems */}
            <section
              id="avalanche-problems"
              className="scroll-mt-24 mb-16 lg:mb-24"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                Avalanche Problems
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVALANCHE_PROBLEMS.map((problem, i) => (
                  <FadeIn key={problem.name} delay={i * 0.06}>
                    <motion.div
                      className="rounded-xl border p-5"
                      style={{
                        backgroundColor: CARD_BG,
                        borderColor: BORDER,
                      }}
                      whileHover={{ y: -4, boxShadow: '0 0 0 1px rgba(59, 139, 235, 0.25), 0 8px 32px rgba(0,0,0,0.3)', transition: { duration: 0.2 } }}
                    >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl" aria-hidden>
                        {problem.emoji}
                      </span>
                      <h3 className="text-lg font-semibold text-white">
                        {problem.name}
                      </h3>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-3">
                      {problem.description}
                    </p>
                    <p className="text-sm text-text-primary">
                      <span className="font-medium text-text-secondary">
                        Terrain to watch:{' '}
                      </span>
                      {problem.terrain}
                    </p>
                  </motion.div>
                </FadeIn>
                ))}
              </div>
            </section>

            {/* 4. Red Flags */}
            <section id="red-flags" className="scroll-mt-24 mb-16 lg:mb-24">
              <h2 className="text-2xl font-bold text-white mb-6">
                Red Flags — Turn Around Signs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {RED_FLAGS.map((flag) => (
                  <div
                    key={flag.title}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: CARD_BG,
                      border: `1px solid ${BORDER}`,
                      borderLeft: '4px solid #E53E3E',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl" aria-hidden>
                        {flag.icon}
                      </span>
                      <h3 className="font-semibold text-white">
                        {flag.title}
                      </h3>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {flag.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Reading the Forecast */}
            <section
              id="reading-forecast"
              className="scroll-mt-24 mb-16 lg:mb-24"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                Reading the Forecast
              </h2>
              <div className="space-y-4">
                {FORECAST_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-4 rounded-xl border p-5"
                    style={{
                      backgroundColor: CARD_BG,
                      borderColor: BORDER,
                    }}
                  >
                    <div
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: ACCENT_BLUE }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Decision Framework */}
            <section
              id="decision-framework"
              className="scroll-mt-24 mb-16 lg:mb-24"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                Making Go/No-Go Decisions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className="rounded-xl border p-5"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: BORDER,
                  }}
                >
                  <h3 className="font-semibold text-white mb-2">Terrain</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Choose terrain that matches the danger level. At
                    Considerable or higher, avoid avalanche paths, convexities,
                    and lee slopes.
                  </p>
                </div>
                <div
                  className="rounded-xl border p-5"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: BORDER,
                  }}
                >
                  <h3 className="font-semibold text-white mb-2">Snowpack</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Look for recent avalanche activity, whumpfing, and shooting
                    cracks. These are your most reliable red flags.
                  </p>
                </div>
                <div
                  className="rounded-xl border p-5"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: BORDER,
                  }}
                >
                  <h3 className="font-semibold text-white mb-2">
                    Human factors
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Summit fever, peer pressure, and familiarity bias kill
                    people. Build a culture of speaking up in your group.
                  </p>
                </div>
              </div>
            </section>

            {/* 7. Watch & Learn */}
            <section
              id="watch-learn"
              className="scroll-mt-24 mb-16 lg:mb-24"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                Watch & Learn
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
                >
                  <div className="aspect-video bg-black">
                    <iframe
                      src="https://www.youtube.com/embed/V5Xl-XYq6AQ"
                      title="Avalanche Awareness"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full rounded-t-xl"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white">
                      Avalanche Awareness
                    </h3>
                  </div>
                </div>
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
                >
                  <div className="aspect-video bg-black">
                    <iframe
                      src="https://www.youtube.com/embed/r46IPOfeso8"
                      title="Understanding Avalanche Terrain"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full rounded-t-xl"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white">
                      Understanding Avalanche Terrain
                    </h3>
                  </div>
                </div>
              </div>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <div className="aspect-video bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/ZFWII5bAlQI"
                    title="Backcountry Safety"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full rounded-t-xl"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white">
                    Backcountry Safety
                  </h3>
                </div>
              </div>
              <div
                className="mt-6 rounded-xl p-6"
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `4px solid ${ACCENT_BLUE}`,
                }}
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  Cody Townsend — The Fifty
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">
                  Follow California ski legend Cody Townsend as he attempts to
                  ski the 50 classic ski descents of North America. Essential
                  watching for any aspiring backcountry skier.
                </p>
                <a
                  href="https://www.youtube.com/c/CodyTownsend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white w-fit hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: ACCENT_BLUE }}
                >
                  Visit Channel
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </section>

            {/* 8. AIARE Certification */}
            <section id="get-certified" className="scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-6">
                Get Certified
              </h2>
              <div
                className="rounded-xl border-2 p-6 md:p-8"
                style={{
                  backgroundColor: CARD_BG,
                  borderColor: ACCENT_BLUE,
                }}
              >
                <h3 className="text-xl font-semibold text-white mb-3">
                  Take an AIARE Avalanche Course
                </h3>
                <p className="text-text-secondary leading-relaxed mb-6 max-w-2xl">
                  The best thing you can do for your safety and your crew's
                  safety is take a formal avalanche course. AIARE Level 1 teaches
                  you to read forecasts, assess terrain, and make decisions as
                  a group.
                </p>
                <a
                  href="https://aiare.net/find-a-course/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: ACCENT_BLUE }}
                >
                  Find a Course Near You
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
