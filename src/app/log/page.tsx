import Link from "next/link";
import { getAllPosts } from "@/lib/log";

export const metadata = {
  title: "Log · Klar",
  description: "Build log. What shipped, when, why.",
};

export default function LogPage() {
  const posts = getAllPosts();

  return (
    <>
      <div className="bg-stage" aria-hidden="true">
        <div
          className="bg-layer bg-layer-1"
          style={{ backgroundImage: "url('/bg/bg-1.webp')" }}
        />
        <div
          className="bg-layer bg-layer-2"
          style={{ backgroundImage: "url('/bg/bg-2.webp')" }}
        />
        <div
          className="bg-layer bg-layer-3"
          style={{ backgroundImage: "url('/bg/bg-3.webp')" }}
        />
        <div
          className="bg-layer bg-layer-4"
          style={{ backgroundImage: "url('/bg/bg-4.webp')" }}
        />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <Link href="/" className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">/log</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
            <Link href="/#apps" className="label hover:text-[var(--fg)] transition">
              apps
            </Link>
            <Link href="/log" className="label-fg">
              log
            </Link>
            <Link href="/" className="label hover:text-[var(--fg)] transition">
              home ↗
            </Link>
          </div>
        </nav>

        <section className="veil-mid px-4 sm:px-6 md:px-12 pt-12 sm:pt-20 md:pt-28 pb-12 sm:pb-16 relative z-10 border-b border-[var(--line)]">
          <div className="flex items-baseline justify-between mb-6 sm:mb-10">
            <p className="label">001 // log.</p>
            <p className="label">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
          </div>

          <h1 className="display t-display max-w-4xl">
            build log.
          </h1>
          <p className="editorial t-editorial-lg text-[var(--fg-2)] mt-6 max-w-2xl">
            What shipped, when, why. Short.
          </p>
        </section>

        <section className="veil-dark relative z-10">
          {posts.length === 0 ? (
            <div className="px-4 sm:px-6 md:px-12 py-20 sm:py-28">
              <p className="editorial t-editorial-lg text-[var(--fg-3)]">
                Nothing posted yet. Daily posts arrive here automatically.
              </p>
            </div>
          ) : (
            <div className="border-t border-[var(--line-strong)]">
              {posts.map((p, i) => (
                <Link
                  key={p.slug}
                  href={`/log/${p.slug}`}
                  className="block border-b border-[var(--line)] px-4 sm:px-6 md:px-12 py-6 sm:py-8 group hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                >
                  <div className="grid grid-cols-12 gap-3 sm:gap-6 items-baseline">
                    <div className="col-span-1">
                      <span className="label group-hover:text-[var(--bg)] group-hover:opacity-70">
                        {String(posts.length - i).padStart(3, "0")}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <span className="label group-hover:text-[var(--bg)] group-hover:opacity-70">
                        {p.date}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <span className="label group-hover:text-[var(--bg)] group-hover:opacity-70">
                        {p.project.toLowerCase()}
                      </span>
                    </div>
                    <div className="col-span-12 sm:col-span-7">
                      <h2 className="display text-2xl sm:text-3xl md:text-4xl">
                        {p.title}
                      </h2>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <Link href="/" className="display text-2xl sm:text-3xl">
              ← klar
            </Link>
            <p className="label">build / ship / loop</p>
          </div>
        </footer>
      </main>
    </>
  );
}
