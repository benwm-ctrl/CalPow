function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div
        className="w-10 h-10 border-2 border-accent-blue border-t-transparent rounded-full animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}

export default LoadingSpinner
