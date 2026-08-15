// Hero for column one. Three plates for the kinds of work the skills cover,
// with the real skill names packed underneath. The plates carry the eye, the
// names carry the proof: this is a sorted library, not a promise of one.
const CHIPS = [
  ["api-design", 0], ["frontend-patterns", 0], ["llm-council", 2],
  ["database-migrations", 0], ["deployment", 0], ["vault-proxy-setup", 2],
  ["e2e-testing", 0], ["cost-aware-llm", 1], ["eval-harness", 1],
  ["typeset", 0], ["colorize", 0], ["layout", 0], ["polish", 0],
  ["critique", 0], ["harden", 0], ["motion-graphics", 0],
  ["design-system", 0], ["search-first", 1], ["coding-standards", 0],
  ["postgres-patterns", 0], ["security-hardening", 0], ["docker-patterns", 0],
];

// eager, not lazy: these sit above the fold in the first panel, and a lazy
// hero image is a blank rectangle for exactly the visitors who matter most.
const PLATES = [
  { src: "/os/skills/council.webp", alt: "" },
  { src: "/os/skills/design.webp", alt: "" },
  { src: "/os/skills/motion.webp", alt: "" },
];

export default function HeroSkills() {
  return (
    <div className="hero-art art-skills" aria-hidden="true">
      <div className="plates">
        {PLATES.map((p) => (
          <span className="plate-img" key={p.src}>
            <img src={p.src} alt={p.alt} width="160" height="160" loading="eager" decoding="async" />
          </span>
        ))}
      </div>
      <div className="chipfield">
        {CHIPS.map(([name, kind], i) => (
          <span key={name} className={`chip k${kind}`} style={{ animationDelay: `${(i % 8) * 0.12}s` }}>
            {name}
          </span>
        ))}
      </div>
      <div className="artcount">
        <b>102</b>
        <span>skills, each with author and licence</span>
      </div>
    </div>
  );
}
