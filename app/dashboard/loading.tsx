export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-48 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 flex flex-col gap-3">
            <div className="h-3 w-32 bg-[var(--bg-base)] rounded" />
            <div className="h-8 w-24 bg-[var(--bg-base)] rounded" />
            <div className="h-3 w-20 bg-[var(--bg-base)] rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="card p-5 h-40 bg-[var(--bg-base)] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="card p-5 h-56 bg-[var(--bg-base)] rounded-[var(--radius-lg)]" />
    </div>
  );
}
