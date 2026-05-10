/**
 * Glitch wordmark v3 — more strips, more fonts, more variations.
 *
 * Layers (back to front):
 *   - Two RGB-style mono shifts (white + grey x-translated duplicates)
 *   - Base wordmark (Space Grotesk)
 *   - Six clip-path slice strips at different vertical bands, each with
 *     a different Google Font (Bowlby, Bungee, Major Mono, Honk, Audiowide,
 *     Tourney) flashing at staggered times
 *
 * Animations run on prime-number cycles (8s, 11s, 13s) so the pattern
 * doesn't visibly repeat.
 */
interface Props {
  text?: string;
  className?: string;
}

export default function GlitchWordmark({
  text = "klar",
  className = "",
}: Props) {
  return (
    <span className={`glitch-wordmark display ${className}`} aria-label={text}>
      <span className="glitch-shift shift-1" aria-hidden="true">{text}</span>
      <span className="glitch-shift shift-2" aria-hidden="true">{text}</span>
      <span className="glitch-base">{text}</span>
      <span className="glitch-strip strip-1" aria-hidden="true">{text}</span>
      <span className="glitch-strip strip-2" aria-hidden="true">{text}</span>
      <span className="glitch-strip strip-3" aria-hidden="true">{text}</span>
      <span className="glitch-strip strip-4" aria-hidden="true">{text}</span>
      <span className="glitch-strip strip-5" aria-hidden="true">{text}</span>
      <span className="glitch-strip strip-6" aria-hidden="true">{text}</span>
      <span className="glitch-skew" aria-hidden="true">{text}</span>
    </span>
  );
}
