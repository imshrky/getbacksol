import type { Metadata } from "next";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/Card";
import { BLOG_POSTS } from "@/lib/blogPosts";

const TITLE = "Blog | GetBackSOL";
const DESCRIPTION =
  "Guides and explainers on Solana rent, dormant token accounts, and reclaiming locked SOL — written to actually answer the question, not just rank for it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/blog" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  return (
    <div className="fade-in">
      <SectionTitle
        eyebrow="Blog"
        title="Guides on Solana rent & dormant accounts"
        description="Straight explainers, not filler — how rent works, what's safe, and what to expect before you reclaim anything."
      />
      <div className="mx-auto flex max-w-2xl flex-col divide-y divide-[var(--border)] rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="surface-hover flex flex-col gap-1.5 px-5 py-4"
          >
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span>·</span>
              <span>{post.readingTime}</span>
            </div>
            <h2 className="text-base font-semibold tracking-tight">{post.title}</h2>
            <p className="text-sm text-[var(--muted)]">{post.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
