export default function CreditsFooter() {
  return (
    <footer
      className="mt-auto flex-shrink-0 border-t border-white/[0.08] bg-[#070C10] py-5 px-4"
      style={{ borderTopColor: 'rgba(240,237,232,0.1)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <p
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
            color: 'rgba(240,237,232,0.55)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Created by Ben Manning for Stanford EARTHSYS 245. For questions reach out to{' '}
          <a
            href="mailto:bw.manning321@gmail.com"
            className="hover:underline"
            style={{
              color: 'rgba(240,237,232,0.8)',
              textDecoration: 'none',
            }}
          >
            bw.manning321@gmail.com
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
