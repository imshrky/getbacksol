import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BLOG_POSTS, getPostBySlug, type BlogBlock } from "@/lib/blogPosts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const title = `${post.title} | GetBackSOL Blog`;
  return {
    title,
    description: post.description,
    openGraph: {
      title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
    },
    twitter: { card: "summary_large_image", title, description: post.description },
  };
}

function Block({ block }: { block: BlogBlock }) {
  if (block.type === "h2") {
    return <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight">{block.text}</h2>;
  }
  if (block.type === "ul") {
    return (
      <ul className="my-4 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="my-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">{block.text}</p>;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "GetBackSOL" },
    publisher: { "@type": "Organization", name: "GetBackSOL" },
    mainEntityOfPage: `https://getbacksol.com/blog/${post.slug}`,
  };

  return (
    <article className="fade-in mx-auto max-w-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to blog
      </Link>

      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
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

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>

      <div className="mt-6">
        {post.content.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      <div className="mt-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <p className="text-sm text-[var(--muted)]">
          Ready to check your own wallet?{" "}
          <Link href="/#reclaim" className="font-medium text-[var(--accent)] hover:underline">
            Scan it with GetBackSOL
          </Link>{" "}
          — free to check, 15% fee only on what you actually reclaim.
        </p>
      </div>
    </article>
  );
}
