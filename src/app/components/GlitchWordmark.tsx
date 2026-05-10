/**
 * Glitch wordmark — 4 horizontal-slice strips with different fonts at
 * staggered prime cycles (8s, 11s, 13s) plus 2 RGB-style mono shifts and
 * a brief skew distortion. Width is locked by the absolute-positioned
 * base layer so the layout never jumps.
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
      <span className="glitch-skew" aria-hidden="true">{text}</span>
    </span>
  );
}
