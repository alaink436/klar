/**
 * Animated liquid-metal background.
 *
 * Reads from /public/bg/bg-1.jpg, bg-2.jpg, bg-3.jpg.
 * If files are missing, the layers fall back to subtle SVG noise patterns
 * so the page never looks broken — but real images are way better.
 */
const BG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'>
      <filter id='turb'>
        <feTurbulence type='fractalNoise' baseFrequency='0.012 0.025' numOctaves='3' seed='3'/>
        <feColorMatrix type='matrix' values='0 0 0 0 0.85  0 0 0 0 0.85  0 0 0 0 0.9  0 0 0 1.0 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#turb)'/>
    </svg>`
  );

export default function Background() {
  return (
    <div className="bg-stage" aria-hidden="true">
      <div
        className="bg-layer bg-layer-1"
        style={{
          backgroundImage: `url('/bg/bg-1.jpg'), url("${BG_FALLBACK}")`,
        }}
      />
      <div
        className="bg-layer bg-layer-2"
        style={{
          backgroundImage: `url('/bg/bg-2.jpg'), url("${BG_FALLBACK}")`,
        }}
      />
      <div
        className="bg-layer bg-layer-3"
        style={{
          backgroundImage: `url('/bg/bg-3.jpg'), url("${BG_FALLBACK}")`,
        }}
      />
      <div className="bg-vignette" />
    </div>
  );
}
