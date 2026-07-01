import { Link } from 'react-router-dom'

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 3.5rem)',
      backgroundColor: '#0A0F14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{
        ...LABEL, fontSize: 9, fontWeight: 700,
        color: 'rgba(240,237,232,0.2)',
        marginBottom: 16,
      }}>
        404 — Page Not Found
      </div>
      <h1 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 'clamp(32px, 6vw, 56px)',
        fontWeight: 800,
        letterSpacing: '0.01em',
        textTransform: 'uppercase',
        color: '#F0EDE8',
        textAlign: 'center',
        margin: '0 0 10px',
        lineHeight: 1,
      }}>
        Lost on the skin track
      </h1>
      <p style={{
        fontFamily: "'Barlow', sans-serif",
        fontSize: 13, color: 'rgba(240,237,232,0.4)',
        textAlign: 'center', margin: '0 0 36px',
      }}>
        This page doesn't exist.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          padding: '10px 24px',
          border: '1px solid rgba(240,237,232,0.35)',
          backgroundColor: 'rgba(240,237,232,0.07)',
          color: '#F0EDE8',
          ...LABEL, fontSize: 11, fontWeight: 700,
          textDecoration: 'none',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#F0EDE8'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.12)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.35)'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.07)' }}
      >
        Back to Home
      </Link>
    </div>
  )
}
