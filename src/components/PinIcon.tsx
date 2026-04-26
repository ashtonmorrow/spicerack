// Compact pushpin glyph used to mark/toggle pinned saved items.
// `filled` switches between outline and solid for clear pinned vs. unpinned state.
export function PinIcon({
  filled = false,
  size = 14,
  className = "",
}: {
  filled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Pushpin: angled head with a stem and base.
          Slight tilt gives it the "pinned to a board" silhouette. */}
      <path d="M14.5 3.5 L20.5 9.5" />
      <path d="M16.5 5.5 L9 13 L5 14 L10 19 L11 15 L18.5 7.5 Z" />
      <path d="M10 19 L4 23" />
    </svg>
  );
}
