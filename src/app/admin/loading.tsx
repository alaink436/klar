// Instant navigation feedback. Next shows this the moment a menu item is clicked,
// while the (force-dynamic) target page renders on the server. The persistent
// AdminShell (sidebar + .main frame) stays mounted, so this only fills
// the content area: a topbar + shimmering placeholders. The design comes from
// admin.css via the persistent admin/layout.tsx (`.klar-skel`).

export default function AdminLoading() {
  return (
    <>
      <div className="topbar">
        <span className="crumb">
          <b>Lädt…</b>
        </span>
      </div>
      <div className="content">
        <div className="klar-skel" style={{ height: 46, width: "42%", marginBottom: 14 }} />
        <div className="klar-skel" style={{ height: 18, width: "62%", marginBottom: 26, opacity: 0.7 }} />
        <div className="mb-[28px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[12px]">
          <div className="klar-skel" style={{ height: 98 }} />
          <div className="klar-skel" style={{ height: 98 }} />
          <div className="klar-skel" style={{ height: 98 }} />
          <div className="klar-skel" style={{ height: 98 }} />
        </div>
        <div className="klar-skel" style={{ height: 280, marginTop: 22 }} />
      </div>
    </>
  );
}
