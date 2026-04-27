// A solid filled pear, tight bounding box so it renders at letter-width with
// no left/right padding. Body + visible stem + leaf so the silhouette reads
// unambiguously as a pear, not a teardrop or avocado. Uses currentColor so
// consumers control the green via text-* classes.
export function PearLetter({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 40"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="o"
      style={{
        height: "0.85em",
        width: "auto",
        display: "inline-block",
        verticalAlign: "-0.08em",
      }}
    >
      {/* stem — short vertical bar, slightly off-center to give the pear character */}
      <rect x="12" y="3" width="3.2" height="7" rx="1.4" />
      {/* leaf — small drop attached to upper right of the stem */}
      <path d="M 15.2 4.5 C 19.5 1.5 24 3 23 7.5 C 19.5 7.5 17 6.2 15.2 4.5 Z" />
      {/* body — narrow neck at top that flares into a wide bulbous bottom */}
      <path d="M 10 10
               C 7 11 5.5 13 4.5 15
               C 1.5 18.5 0 23 0 28.5
               C 0 34.5 5.2 39 14 39
               C 22.8 39 28 34.5 28 28.5
               C 28 23 26.5 18.5 23.5 15
               C 22.5 13 21 11 18 10
               L 10 10 Z" />
    </svg>
  );
}
