export default function DashboardEditorLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-pulse">
      {/* Chat panel skeleton */}
      <div className="w-80 border-r border-[var(--border-color)] p-4 space-y-4 hidden lg:block">
        <div className="h-6 w-32 bg-[var(--bg-card)] rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 bg-[var(--bg-card)] rounded" />
              <div className="h-4 w-full bg-[var(--bg-card)] rounded" />
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <div className="h-10 w-full bg-[var(--bg-card)] rounded-lg" />
        </div>
      </div>
      {/* Canvas skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
          <div className="h-8 w-24 bg-[var(--bg-card)] rounded ml-auto" />
          <div className="h-8 w-24 bg-[var(--bg-card)] rounded" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
              style={{ height: i < 3 ? '120px' : '200px' }}
            >
              <div className="h-4 w-1/2 bg-[var(--bg-surface)] rounded mb-3" />
              <div className="h-full w-full bg-[var(--bg-surface)] rounded opacity-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
