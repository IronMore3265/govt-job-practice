"use client";

// "Save report PDF": the browser's print dialog with the print stylesheet (cream paper, A4). Never forced.
export function PrintButton({ label = "Save report PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      {label}
    </button>
  );
}
