export default function GlossaryLoading() {
  return (
    <div className="flex-1 mx-auto max-w-[1200px] px-4 sm:px-6 py-6 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-32 bg-[var(--bg-card)] rounded mb-2" />
        <div className="h-4 w-64 bg-[var(--bg-card)] rounded" />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-80 bg-[var(--bg-card)] rounded-lg" />
        <div className="h-9 w-32 bg-[var(--bg-card)] rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-color)] p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-40 bg-[var(--bg-card)] rounded" />
              <div className="h-4 w-16 bg-[var(--bg-card)] rounded-full ml-auto" />
            </div>
            <div className="h-3 w-full bg-[var(--bg-card)] rounded" />
            <div className="h-3 w-2/3 bg-[var(--bg-card)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
