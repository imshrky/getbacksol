import { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("card p-6 sm:p-8", className)}>{children}</div>;
}

export function SectionTitle({
  index,
  eyebrow,
  title,
  description,
  align = "center",
}: {
  index?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  return (
    <div className={clsx("mb-8", isCenter && "text-center")}>
      {eyebrow && (
        <span className={clsx("eyebrow mb-3", isCenter && "justify-center")}>
          {index && <span className="index">{index}</span>}
          {eyebrow}
        </span>
      )}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description && (
        <p
          className={clsx(
            "mt-3 max-w-xl text-sm text-[var(--muted)]",
            isCenter && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
      {isCenter && <div className="mx-auto mt-6 h-px w-16 bg-[var(--accent)]" />}
    </div>
  );
}
