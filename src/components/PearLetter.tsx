// A filled pear sized to substitute for a letter (the "o" in "Flavor").
// Uses currentColor so consumers can recolor with text-* classes.
// Includes a leaf for visual recognition; stem is implied by the silhouette.
export function PearLetter({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="o"
      style={{
        height: "0.85em",
        width: "auto",
        display: "inline-block",
        verticalAlign: "-0.06em",
        marginInline: "0.02em",
      }}
    >
      {/* pear body */}
      <path d="M 32 16
               C 35.5 16 36.5 18.5 35.5 21
               C 34.5 23.5 35.5 25.5 38 27
               C 45 31 50 39 50 47
               C 50 56 42 60 32 60
               C 22 60 14 56 14 47
               C 14 39 19 31 26 27
               C 28.5 25.5 29.5 23.5 28.5 21
               C 27.5 18.5 28.5 16 32 16 Z" />
      {/* leaf */}
      <path d="M 33 16 C 38 11.5 44.5 13 43.5 18.5 C 38.5 18.5 35 17.5 33 16 Z" />
    </svg>
  );
}
