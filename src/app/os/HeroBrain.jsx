import data from "./heroGraph.json";

// The vault itself, drawn from the real graph: 1165 notes and 5314 links, laid
// out by the same force pass that renders it inside Klar Control. Labels and
// paths are stripped upstream, so this is the shape without the names on it.
//
// Rendered as static SVG rather than a canvas: it is a picture in a button, it
// never animates or responds, and it has to be there on the first paint.
const VIEW = 1000;
const to = (v) => (v * 0.5 + 0.5) * VIEW;

export default function HeroBrain() {
  return (
    <div className="hero-art art-brain" aria-hidden="true">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="brainart">
        <g className="ba-edges">
          {data.edges.map(([a, b], i) => {
            const na = data.nodes[a], nb = data.nodes[b];
            if (!na || !nb) return null;
            return (
              <line key={i} x1={to(na[0])} y1={to(na[1])} x2={to(nb[0])} y2={to(nb[1])} />
            );
          })}
        </g>
        <g className="ba-nodes">
          {data.nodes.map((n, i) => (
            <circle key={i} cx={to(n[0])} cy={to(n[1])} r={Math.max(1.6, n[2] * 0.9)} className={`g${n[3] % 6}`} />
          ))}
        </g>
      </svg>
      <p className="brainstat">
        <b>{data.totalNodes.toLocaleString("en-US")}</b> notes
        <i>·</i>
        <b>{data.totalEdges.toLocaleString("en-US")}</b> links
      </p>
    </div>
  );
}
