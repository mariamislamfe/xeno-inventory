export default function ProductsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
        <div className="h-8 w-28 bg-[var(--bg-base)] rounded-[var(--radius-md)]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="h-40 bg-[var(--bg-base)]" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-full bg-[var(--bg-base)] rounded" />
              <div className="h-3 w-16 bg-[var(--bg-base)] rounded" />
              <div className="h-5 w-20 bg-[var(--bg-base)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
