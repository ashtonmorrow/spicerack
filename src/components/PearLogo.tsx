// Outline-only pear in the brand green. Sized via the `size` prop.
// Uses currentColor for stroke so consumers can recolor with text classes.
export function PearLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Flavor Pear"
    >
      {/* pear body: narrow neck, bulbous bottom */}
      <path d="M 32 17
               C 28.5 17 27.5 19.5 28 22
               C 28.5 24 27.5 25.5 25.5 26.5
               C 18 30 13 38 14 47
               C 15 55 22 60 32 60
               C 42 60 49 55 50 47
               C 51 38 46 30 38.5 26.5
               C 36.5 25.5 35.5 24 36 22
               C 36.5 19.5 35.5 17 32 17 Z" />
      {/* stem */}
      <path d="M 32 17 L 33 9" />
      {/* leaf */}
      <path d="M 33 11 C 38 7 44 9 43 14 C 38 14 35 13 33 11 Z" />
    </svg>
  );
}
