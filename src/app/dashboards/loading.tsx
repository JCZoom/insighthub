export default function DashboardsLoading() {
  return (
    <div className="flex-1 mx-auto max-w-[1600px] px-4 sm:px-6 py-6 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-40 bg-[var(--bg-card)] rounded mb-2" />
        <div className="h-4 w-72 bg-[var(--bg-card)] rounded" />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-96 bg-[var(--bg-card)] rounded-lg" />
        <div className="h-9 w-56 bg-[var(--bg-card)] rounded-lg ml-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div className="h-32 bg-[var(--bg-card)]" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 bg-[var(--bg-card)] rounded" />
              <div className="h-3 w-full bg-[var(--bg-card)] rounded" />
              <div className="h-3 w-1/2 bg-[var(--bg-card)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
