/**
 * Slim glitch wordmark: crisp base + two subtle same-font shift copies
 * that flash briefly and rarely. Width is locked by the base layer so the
 * layout never jumps. No extra font downloads, opacity-only animation.
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
      <span className="glitch-base">{text}</span>
      <span className="glitch-shift shift-1" aria-hidden="true">
        {text}
      </span>
      <span className="glitch-shift shift-2" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
