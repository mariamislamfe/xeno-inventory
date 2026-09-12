export default function CustomersLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-32 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
      <div className="card overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-base)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-[var(--bg-base)] rounded" />
              <div className="h-3 w-24 bg-[var(--bg-base)] rounded" />
            </div>
            <div className="h-4 w-16 bg-[var(--bg-base)] rounded" />
            <div className="h-4 w-12 bg-[var(--bg-base)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
