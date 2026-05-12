// Dynamic OG image rendered by Next.js's built-in ImageResponse (next/og,
// powered by @vercel/og). Tiles a scatter of Twemoji food glyphs in the
// background with a faded wash, overlays the "Flavor Pare" wordmark + tagline.
//
// Twemoji is CC BY 4.0; ImageResponse's `emoji: "twemoji"` option fetches
// glyph SVGs at render time so we don't ship them in our bundle.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Flavor Pare — pare down what you have to figure out what to cook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Curated scatter of food-y glyphs. Mix of fruit, veg, herbs, proteins,
// grain, dairy, spice — visually busy without being any single cuisine.
const SCATTER = [
  "🍎", "🥑", "🧄", "🧅", "🥕", "🌶️", "🍋", "🍐",
  "🥩", "🐟", "🍗", "🥚", "🧀", "🥛", "🍯", "🌿",
  "🌱", "🌶️", "🍅", "🥔", "🥦", "🍇", "🥥", "🥖",
  "🍝", "🍚", "🌽", "🍄", "🥬", "🌰",
];

// Pre-arranged scatter positions so the layout is intentional, not random
// per build. Coordinates are in CSS px relative to the 1200×630 image.
const POSITIONS: { left: number; top: number; size: number; rot: number }[] = [
  { left: 60, top: 60, size: 84, rot: -8 },
  { left: 180, top: 30, size: 56, rot: 12 },
  { left: 290, top: 90, size: 72, rot: -4 },
  { left: 420, top: 40, size: 60, rot: 18 },
  { left: 560, top: 80, size: 76, rot: -10 },
  { left: 690, top: 30, size: 56, rot: 6 },
  { left: 820, top: 90, size: 64, rot: -14 },
  { left: 950, top: 40, size: 72, rot: 8 },
  { left: 1080, top: 80, size: 56, rot: -6 },

  { left: 30, top: 200, size: 64, rot: 14 },
  { left: 130, top: 260, size: 56, rot: -4 },
  { left: 1100, top: 220, size: 80, rot: -12 },
  { left: 1020, top: 320, size: 60, rot: 10 },

  { left: 40, top: 380, size: 72, rot: -8 },
  { left: 150, top: 460, size: 60, rot: 16 },
  { left: 1080, top: 420, size: 68, rot: 4 },
  { left: 990, top: 510, size: 56, rot: -10 },

  { left: 70, top: 540, size: 80, rot: 6 },
  { left: 220, top: 560, size: 56, rot: -16 },
  { left: 340, top: 530, size: 68, rot: 10 },
  { left: 480, top: 560, size: 60, rot: -6 },
  { left: 610, top: 530, size: 76, rot: 14 },
  { left: 760, top: 560, size: 60, rot: -10 },
  { left: 890, top: 540, size: 68, rot: 6 },
];

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #FBFAF7 0%, #F7F6F3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Faded scatter background of food emojis */}
        {POSITIONS.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.left,
              top: p.top,
              fontSize: p.size,
              opacity: 0.22,
              transform: `rotate(${p.rot}deg)`,
              display: "flex",
            }}
          >
            {SCATTER[i % SCATTER.length]}
          </div>
        ))}

        {/* Center plate behind the wordmark for legibility */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.78)",
            border: "1px solid rgba(120, 119, 116, 0.18)",
            borderRadius: 24,
            padding: "44px 72px",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.06)",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 128,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#37352F",
              gap: 4,
            }}
          >
            <span>Flav</span>
            <span style={{ fontSize: 132, display: "flex" }}>🍐</span>
            <span>r Pare</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 32,
              color: "#787774",
              letterSpacing: "-0.01em",
              display: "flex",
            }}
          >
            Pare down what you have to figure out what to cook.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // Twemoji renders the food glyphs as cleanly-vector SVGs fetched at
      // render time. CC BY 4.0.
      emoji: "twemoji",
    }
  );
}
