// Shown instantly while a page's code is loading (Next.js route-level Suspense boundary).
export default function Loading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
      <div className="sk sk-block" />
    </div>
  );
}
