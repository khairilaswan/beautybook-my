// Stand-in for a missing photo: a plain head-and-shoulders outline that
// fills its (positioned) parent. Decorative, so screen readers skip it.
export function Silhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
      className={`absolute inset-0 h-full w-full bg-brand-50 text-brand-200 ${className}`}
    >
      <circle cx="32" cy="24" r="12" fill="currentColor" />
      <path d="M8 64c0-14 10.7-23 24-23s24 9 24 23z" fill="currentColor" />
    </svg>
  );
}
