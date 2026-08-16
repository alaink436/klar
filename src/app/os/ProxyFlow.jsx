// The proxy mechanic as a looping animation: the use-token travels from the
// agent to the proxy, the key exists only inside the server boundary, rides
// upstream for milliseconds, and the response returns without it. Pure CSS
// timeline, no JS. With reduced motion the diagram shows all states at once.
export default function ProxyFlow() {
  return (
    <div className="pflow" aria-label="Animated diagram: the agent's request carries only a use-token. The proxy decrypts the key on the server, sends it upstream for milliseconds, and streams the response back. The key never reaches the agent.">
      <svg viewBox="0 0 720 236" className="pfsvg" aria-hidden="true">
        {/* rails */}
        <line className="pfrail" x1="180" y1="112" x2="540" y2="112" />
        <line className="pfrail" x1="180" y1="148" x2="540" y2="148" />

        {/* the boundary the key never crosses */}
        <line className="pfwall" x1="248" y1="34" x2="248" y2="206" />
        <text className="pfwalltext" x="248" y="24" textAnchor="middle">keys never cross this line</text>

        {/* agent */}
        <g className="pfbox">
          <rect x="24" y="72" width="156" height="96" rx="10" />
          <text className="pft" x="102" y="106" textAnchor="middle">agent</text>
          <text className="pfs" x="102" y="128" textAnchor="middle">holds a use-token,</text>
          <text className="pfs" x="102" y="144" textAnchor="middle">never a key</text>
        </g>

        {/* proxy, server side */}
        <g className="pfbox pfserver">
          <rect x="248" y="72" width="176" height="96" rx="10" />
          <text className="pft" x="336" y="100" textAnchor="middle">proxy</text>
          <text className="pfs" x="336" y="120" textAnchor="middle">your Vercel, your DB</text>
          {/* the key: pops into existence only here, then rides upstream */}
          <g className="pfkeychip">
            <rect x="306" y="130" width="60" height="22" rx="11" />
            <text x="336" y="145" textAnchor="middle">sk_live…</text>
          </g>
        </g>

        {/* provider */}
        <g className="pfbox">
          <rect x="540" y="72" width="156" height="96" rx="10" />
          <text className="pft" x="618" y="106" textAnchor="middle">provider</text>
          <text className="pfs" x="618" y="128" textAnchor="middle">OpenAI, Stripe,</text>
          <text className="pfs" x="618" y="144" textAnchor="middle">Resend, …</text>
        </g>

        {/* 1: token chip, agent to proxy */}
        <g className="pfchip pfc-token">
          <rect x="-30" y="101" width="60" height="22" rx="11" />
          <text x="0" y="116" textAnchor="middle">token</text>
        </g>

        {/* 2: key chip riding upstream, proxy to provider */}
        <g className="pfchip pfc-key">
          <rect x="-30" y="101" width="60" height="22" rx="11" />
          <text x="0" y="116" textAnchor="middle">sk_live…</text>
        </g>

        {/* 3: response, provider back to agent on the lower rail */}
        <g className="pfchip pfc-resp">
          <rect x="-34" y="137" width="68" height="22" rx="11" />
          <text x="0" y="152" textAnchor="middle">200 OK</text>
        </g>
      </svg>
      {/* Each caption is a two-column row: the step number, then the sentence.
          Both parts are real elements. They used to be one bare text node, and
          a bare text node in a grid becomes an anonymous item in the FIRST
          column, which is 2.4rem wide. The sentence was rendering in 38 pixels,
          one word per line, while the wide column next to it sat empty. */}
      <ol className="pfcaps">
        <li className="pfcap pfcap1">
          <b>1</b>
          <span>The agent sends its request with a scoped use-token. That token can call, not read.</span>
        </li>
        <li className="pfcap pfcap2">
          <b>2</b>
          <span>The proxy checks the token and decrypts the key. Server-side only, in memory.</span>
        </li>
        <li className="pfcap pfcap3">
          <b>3</b>
          <span>The key rides upstream for milliseconds, then it is gone again.</span>
        </li>
        <li className="pfcap pfcap4">
          <b>4</b>
          <span>The response streams back to the agent. The key stayed behind the line.</span>
        </li>
      </ol>
    </div>
  );
}
