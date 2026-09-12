export default function OrdersLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
        <div className="h-8 w-28 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
      </div>
      <div className="card overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="h-4 w-16 bg-[var(--bg-base)] rounded" />
            <div className="h-4 w-28 bg-[var(--bg-base)] rounded flex-1" />
            <div className="h-4 w-20 bg-[var(--bg-base)] rounded" />
            <div className="h-6 w-16 bg-[var(--bg-base)] rounded-full" />
            <div className="h-4 w-16 bg-[var(--bg-base)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
