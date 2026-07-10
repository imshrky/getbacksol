"use client";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  cost,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  cost?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        {cost && <span className="pill">{cost}</span>}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed"
          style={{
            background: checked ? "var(--accent)" : "var(--border)",
            borderColor: checked ? "var(--accent)" : "var(--border-strong)",
          }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
