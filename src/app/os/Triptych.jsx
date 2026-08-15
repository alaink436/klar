"use client";
import { useState } from "react";
import HeroSkills from "./HeroSkills";
import HeroProxy from "./HeroProxy";
import HeroBrain from "./HeroBrain";

// The whole product in one screen: three floor-to-ceiling panels, each its own
// hero. Detail stays folded away until a panel is opened, so the first look is
// the offer and nothing else.
const PANELS = [
  {
    id: "setup",
    n: "01",
    price: "Free forever",
    title: "The setup, with the skills",
    line: "A vault your agent reads every session, and a curated skill registry with author and licence on all 102. Yours to keep, no account, no trial.",
    art: "skills",
    cta: "Take it, free",
  },
  {
    id: "proxy",
    n: "02",
    price: "Free forever",
    title: "The reverse proxy",
    line: "Your agents use your API keys and can never read one. It deploys itself onto infrastructure you own. Try the mechanic right here before you download anything.",
    art: "proxy",
    cta: "Try it",
  },
  {
    id: "brain",
    n: "03",
    price: "$49",
    title: "The AI brain",
    line: "The real vault: 1,165 notes, 5,314 links, 254 learnings from five months and seven shipped apps.",
    art: "brain",
    cta: "See the data",
    paid: true,
  },
];

export default function Triptych({ details }) {
  const [open, setOpen] = useState(null);

  function toggle(id) {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) {
      requestAnimationFrame(() => {
        document.getElementById(`detail-${next}`)?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }

  return (
    <>
      <div className="triptych">
        {PANELS.map((p) => (
          <button
            key={p.id}
            className={`pane ${p.paid ? "paid" : ""} ${open === p.id ? "open" : ""}`}
            onClick={() => toggle(p.id)}
            aria-expanded={open === p.id}
            aria-controls={`detail-${p.id}`}
          >
            <span className="pane-top">
              <span className="pane-n">{p.n}</span>
              <span className={`pane-price ${p.paid ? "paid" : ""}`}>{p.price}</span>
            </span>

            <span className="pane-art">
              {p.art === "skills" ? <HeroSkills /> : null}
              {p.art === "proxy" ? <HeroProxy /> : null}
              {p.art === "brain" ? <HeroBrain /> : null}
            </span>

            <span className="pane-foot">
              <span className="pane-title">{p.title}</span>
              <span className="pane-line">{p.line}</span>
              <span className="pane-cta">
                {open === p.id ? "Close" : p.cta || "Open"}
                <i aria-hidden="true">{open === p.id ? "−" : "+"}</i>
              </span>
            </span>
          </button>
        ))}
      </div>

      {PANELS.map((p) => (
        <section
          key={p.id}
          id={`detail-${p.id}`}
          className="detail"
          hidden={open !== p.id}
        >
          {details[p.id]}
        </section>
      ))}
    </>
  );
}
