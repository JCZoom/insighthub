export default function AuditLogLoading() {
  return (
    <div className="flex-1 mx-auto max-w-[1400px] px-4 sm:px-6 py-6 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-28 bg-[var(--bg-card)] rounded mb-2" />
        <div className="h-4 w-56 bg-[var(--bg-card)] rounded" />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-48 bg-[var(--bg-card)] rounded-lg" />
        <div className="h-9 w-36 bg-[var(--bg-card)] rounded-lg" />
        <div className="h-9 w-36 bg-[var(--bg-card)] rounded-lg" />
      </div>
      <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
        {/* Table header */}
        <div className="bg-[var(--bg-card)] px-4 py-3 flex gap-4">
          <div className="h-4 w-32 bg-[var(--bg-surface)] rounded" />
          <div className="h-4 w-24 bg-[var(--bg-surface)] rounded" />
          <div className="h-4 w-28 bg-[var(--bg-surface)] rounded" />
          <div className="h-4 w-20 bg-[var(--bg-surface)] rounded" />
          <div className="h-4 w-36 bg-[var(--bg-surface)] rounded ml-auto" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 flex gap-4 border-t border-[var(--border-color)]"
          >
            <div className="h-4 w-32 bg-[var(--bg-card)] rounded" />
            <div className="h-4 w-24 bg-[var(--bg-card)] rounded" />
            <div className="h-4 w-28 bg-[var(--bg-card)] rounded" />
            <div className="h-4 w-20 bg-[var(--bg-card)] rounded" />
            <div className="h-4 w-36 bg-[var(--bg-card)] rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
