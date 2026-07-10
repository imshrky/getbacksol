"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border border-[var(--border)]">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className="bg-[var(--surface)]">
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium"
              onClick={() => setOpenIndex(open ? null : i)}
            >
              {item.q}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
            {open && (
              <div className="px-5 pb-4 text-sm text-[var(--muted)]">{item.a}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
