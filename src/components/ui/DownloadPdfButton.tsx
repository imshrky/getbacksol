"use client";

import { Download } from "lucide-react";

// Triggers the browser's print dialog, where "Save as PDF" produces a clean
// PDF of the whitepaper. Print-specific CSS (see globals.css @media print)
// strips the nav/footer and switches to ink-friendly light styling. Kept as a
// button rather than a pre-generated file so the PDF always matches the live
// whitepaper — nothing to regenerate when the content changes.
export function DownloadPdfButton() {
  return (
    <button onClick={() => window.print()} className="btn-outline no-print inline-flex items-center gap-2 text-sm">
      <Download className="h-4 w-4" />
      Download PDF
    </button>
  );
}
