import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, renderInline } from "@/lib/log";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: `${post.title} · Klar log`,
    description: post.body.slice(0, 160),
  };
}

export default async function LogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n\n+/);

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
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <Link href="/" className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">/log/{post.slug}</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
            <Link href="/log" className="label hover:text-[var(--fg)] transition">
              ← log
            </Link>
            <Link href="/" className="label hover:text-[var(--fg)] transition">
              home ↗
            </Link>
          </div>
        </nav>

        <article className="veil-dark px-4 sm:px-6 md:px-12 py-14 sm:py-20 md:py-28 relative z-10 border-b border-[var(--line)]">
          <div className="max-w-3xl">
            <div className="flex items-baseline gap-3 mb-6 sm:mb-8 flex-wrap">
              <span className="label">{post.date}</span>
              <span className="label">·</span>
              <span className="label-fg">{post.project.toLowerCase()}</span>
              {post.originalDate && (
                <>
                  <span className="label">·</span>
                  <span className="label">
                    originally shipped {post.originalDate}
                  </span>
                </>
              )}
            </div>

            <h1 className="display t-display mb-8 sm:mb-12">
              {post.title}
            </h1>

            <div className="space-y-5 sm:space-y-6 text-[var(--fg-2)] t-body-lg leading-relaxed max-w-2xl">
              {paragraphs.map((p, i) => (
                <p key={i}>{renderInline(p)}</p>
              ))}
            </div>
          </div>
        </article>

        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <Link href="/log" className="display text-2xl sm:text-3xl">
              ← all posts
            </Link>
            <p className="label">build / ship / loop</p>
          </div>
        </footer>
      </main>
    </>
  );
}
