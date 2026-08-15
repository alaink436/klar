// Hero for column two: the proxy, drawn as a cross-section through the boundary
// rather than three boxes on a wire. The key only ever exists inside the middle
// band, which is the whole product claim, so the drawing gives that band real
// weight: a hatched wall, a vault plate, and the key pinned inside it.
export default function HeroProxy() {
  return (
    <div className="hero-art art-proxy" aria-hidden="true">
      <svg viewBox="0 0 300 340" className="proxyart">
        <defs>
          <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" className="pa-hatchline" />
          </pattern>
        </defs>

        {/* the protected band, given real thickness */}
        <rect className="pa-band" x="0" y="118" width="300" height="104" />
        <rect className="pa-bandfill" x="0" y="118" width="300" height="104" fill="url(#hatch)" />
        <line className="pa-wall" x1="0" y1="118" x2="300" y2="118" />
        <line className="pa-wall" x1="0" y1="222" x2="300" y2="222" />

        {/* agent above the line */}
        <g className="pa-box">
          <rect x="62" y="18" width="176" height="60" rx="2" />
          <text className="pa-t" x="150" y="44" textAnchor="middle">your agent</text>
          <text className="pa-s" x="150" y="60" textAnchor="middle">holds a scoped token</text>
        </g>
        <line className="pa-rail" x1="110" y1="78" x2="110" y2="118" />

        {/* the vault plate: the only place a key exists */}
        <g className="pa-plate">
          <rect x="46" y="140" width="208" height="60" rx="2" />
          <circle className="pa-bolt" cx="58" cy="152" r="2.4" />
          <circle className="pa-bolt" cx="242" cy="152" r="2.4" />
          <circle className="pa-bolt" cx="58" cy="188" r="2.4" />
          <circle className="pa-bolt" cx="242" cy="188" r="2.4" />
          <text className="pa-t" x="150" y="166" textAnchor="middle">your proxy</text>
          <g className="pa-key">
            <rect x="112" y="176" width="76" height="16" rx="2" />
            <text x="150" y="188" textAnchor="middle">sk_live…</text>
          </g>
        </g>
        <text className="pa-wt" x="8" y="112">keys never cross this line</text>

        {/* provider below */}
        <line className="pa-rail" x1="190" y1="222" x2="190" y2="262" />
        <g className="pa-box">
          <rect x="62" y="262" width="176" height="60" rx="2" />
          <text className="pa-t" x="150" y="288" textAnchor="middle">the provider</text>
          <text className="pa-s" x="150" y="304" textAnchor="middle">OpenAI, Stripe, Resend</text>
        </g>

        {/* what actually travels */}
        <g className="pa-chip pa-token">
          <rect x="-30" y="-8" width="60" height="16" rx="2" />
          <text x="0" y="4" textAnchor="middle">token</text>
        </g>
        <g className="pa-chip pa-keytrip">
          <rect x="-34" y="-8" width="68" height="16" rx="2" />
          <text x="0" y="4" textAnchor="middle">sk_live…</text>
        </g>
        <g className="pa-chip pa-resp">
          <rect x="-30" y="-8" width="60" height="16" rx="2" />
          <text x="0" y="4" textAnchor="middle">200 OK</text>
        </g>
      </svg>
    </div>
  );
}
