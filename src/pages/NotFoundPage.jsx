import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 bg-background-primary">
      <h1 className="text-3xl font-bold text-white text-center">
        Lost on the skin track?
      </h1>
      <p className="text-text-secondary mt-2 text-center">
        This page doesn't exist.
      </p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#3B8BEB' }}
      >
        Back to Home
      </Link>
    </div>
  )
}
