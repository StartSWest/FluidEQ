/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A section's longer explanation, kept behind a small "i" beside its heading
 * on the Tune tab (Ivan, 2026-11-17: "a lot of waste"): the sentences that
 * used to stand under every heading in small grey type are the app's own
 * tooltip now (`utils/tooltipLayer.ts`, which shows any `title` on hover and
 * on keyboard focus), so the tab reads as headings and sliders. A button so
 * it takes focus, named by the text it holds; pressing it does nothing, as a
 * press only hides a tooltip.
 */
export default function StudioInfo({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="studio-info"
      title={text}
      aria-label={text}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="4.6" r="1.05" />
        <rect x="7.1" y="6.7" width="1.8" height="5.4" rx="0.9" />
      </svg>
    </button>
  );
}
