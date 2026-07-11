import { Unlock } from "lucide-react";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent)] text-[var(--accent-ink)] ${className}`}
    >
      <Unlock className="h-[55%] w-[55%]" strokeWidth={2.5} />
    </span>
  );
}
