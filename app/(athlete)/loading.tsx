export default function AthleteLoading() {
  return (
    <div className="flex min-h-screen flex-col gap-6 px-4 py-6">
      {/* Header skeleton */}
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />

      {/* Hero card skeleton */}
      <div className="h-36 w-full animate-pulse rounded-3xl bg-muted" />

      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-muted" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        {[1, 2].map((i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
