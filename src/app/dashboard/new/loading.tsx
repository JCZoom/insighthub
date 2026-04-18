export default function NewDashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-pulse">
      {/* Chat panel skeleton */}
      <div className="w-80 border-r border-[var(--border-color)] p-4 space-y-4 hidden lg:block">
        <div className="h-6 w-40 bg-[var(--bg-card)] rounded" />
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 bg-[var(--bg-card)] rounded-full mx-auto" />
            <div className="h-4 w-48 bg-[var(--bg-card)] rounded mx-auto" />
            <div className="h-3 w-36 bg-[var(--bg-card)] rounded mx-auto" />
          </div>
        </div>
        <div className="h-10 w-full bg-[var(--bg-card)] rounded-lg" />
      </div>
      {/* Empty canvas skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-[var(--bg-card)] rounded-2xl mx-auto" />
          <div className="h-5 w-56 bg-[var(--bg-card)] rounded mx-auto" />
          <div className="h-4 w-72 bg-[var(--bg-card)] rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
