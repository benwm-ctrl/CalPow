import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { sendMessageToMike } from '../services/groq'
import { Send } from 'lucide-react'
import mikeImg from '../assets/images/Salm_Miles-Clark-1.jpg'

const TOPIC_CHIPS = [
  'Avalanche Safety',
  'Trip Planning',
  'Gear',
  'Reading Forecasts',
  'Snow Science',
  'Route Selection',
]

const STARTER_PROMPTS = [
  'What should I know before my first Sierra tour?',
  'How do I read an avalanche forecast?',
  'What avy gear do I need?',
  'How do I assess slope angle in the field?',
]

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function MikePage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (content) => {
    const trimmed = (typeof content === 'string' ? content : input).trim()
    if (!trimmed || loading) return

    const userMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const reply = await sendMessageToMike(history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, timestamp: new Date() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Having trouble connecting. Check your connection and try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    sendMessage(input)
  }

  return (
    <div
      className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)]"
      style={{ backgroundColor: '#0F1923' }}
    >
      {/* Left column - Mike's profile (hidden on mobile) */}
      <aside className="hidden md:block md:w-[30%] md:max-w-sm p-4 shrink-0">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="sticky top-4 rounded-xl p-6 border border-border"
          style={{ backgroundColor: '#1E2D3D' }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center overflow-hidden mb-4"
            style={{ backgroundColor: '#1E2D3D' }}
          >
            <img src={mikeImg} alt="Mike" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center">Mike</h1>
          <p className="text-center text-text-secondary text-sm mt-1">
            Backcountry Guide · Sierra Nevada
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <span className="px-2 py-1 rounded-full text-xs font-medium text-text-secondary bg-background-elevated">
              Sierra & Shasta
            </span>
          </div>
          <p className="text-text-primary text-sm mt-4 leading-relaxed">
            I've skied the Sierra for 20 years and guided in the Cascades and Eastern Sierra.
            I'm here to give you direct, safety-focused advice. Ask me anything.
          </p>
          <p
            className="mt-3 italic"
            style={{ fontSize: '11px', color: '#4A5568', lineHeight: 1.4 }}
          >
            Mike is an AI assistant, not a real guide or certified instructor.
            Always consult official avalanche forecasts and consider taking a
            real AIARE course before heading into the backcountry.
          </p>
          <hr className="border-border my-4" />
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Topics I can help with:
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_CHIPS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => sendMessage(topic)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full text-sm text-text-primary border border-accent-blue hover:bg-accent-blue/20 transition-colors disabled:opacity-50"
              >
                {topic}
              </button>
            ))}
          </div>
        </motion.div>
      </aside>

      {/* Right column - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
            <img src={mikeImg} alt="Mike" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-semibold text-white">Mike</span>
            <span className="text-text-secondary text-sm block">
              Backcountry Guide · Sierra Nevada
            </span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.length === 0 && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="text-left p-4 rounded-xl border-2 border-accent-blue text-white hover:bg-accent-blue/10 transition-colors"
                  style={{ backgroundColor: '#1E2D3D' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.timestamp?.getTime?.() ?? Math.random()}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <span className="text-sm text-text-secondary mb-1 flex items-center gap-1">
                  Mike
                </span>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-white ${
                  msg.role === 'user'
                    ? 'rounded-br-sm'
                    : 'rounded-bl-sm'
                }`}
                style={{
                  backgroundColor:
                    msg.role === 'user' ? '#3B8BEB' : '#1E2D3D',
                }}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-xs text-text-muted mt-1">
                {msg.timestamp && formatTime(msg.timestamp)}
              </span>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-start"
            >
              <span className="text-sm text-text-secondary mb-1 flex items-center gap-1">
                Mike
              </span>
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1"
                style={{ backgroundColor: '#1E2D3D' }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-text-muted"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-border shrink-0"
        >
          <div
            className="flex gap-2 rounded-xl border overflow-hidden"
            style={{
              backgroundColor: '#1E2D3D',
              borderColor: '#2D3748',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask Mike anything..."
              disabled={loading}
              className="flex-1 bg-transparent px-4 py-3 text-white placeholder-text-muted focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              style={{ backgroundColor: '#3B8BEB' }}
              aria-label="Send"
            >
              <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Send className="w-5 h-5" />
              </motion.span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
