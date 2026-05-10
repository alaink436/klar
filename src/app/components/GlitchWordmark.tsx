/**
 * Wordmark with stacked Google Fonts that flicker briefly,
 * plus a horizontal RGB-style slice on the base layer.
 * CSS-only, no JS.
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
    <span
      className={`glitch-wordmark display ${className}`}
      aria-label={text}
    >
      <span className="glitch-base block" data-text={text}>
        {text}
      </span>
      <span className="glitch-layer glitch-layer-1" aria-hidden="true">
        {text}
      </span>
      <span className="glitch-layer glitch-layer-2" aria-hidden="true">
        {text}
      </span>
      <span className="glitch-layer glitch-layer-3" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
