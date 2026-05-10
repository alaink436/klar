/**
 * Glitch wordmark — horizontal slice + font-swap.
 *
 * Approach: base layer is always visible Space Grotesk.
 * Three semi-transparent overlay strips clip-paths into top / middle / bottom
 * thirds and swap to different Google Fonts. They flash briefly at staggered
 * times. Two extra base-font duplicates with x-shift create an RGB-style echo.
 *
 * Width never breaks the layout because every overlay is absolute-positioned
 * and inherits the base's box; clip-path keeps each strip inside the bounds.
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
    </span>
  );
}
