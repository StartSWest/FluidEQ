/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How tall the pane under the graph has to be for the band sliders to stand
 * at their full first-run length, measured off the page as it is laid out.
 *
 * The pane under an EQ page's graph opens at a height nobody has chosen until
 * the divider is moved (`paneSizes.ts`), and that height was a number: 344px,
 * measured once as a 96px track at every width down to 1100. It was not one
 * at 2560x1440, where the Tone row's dials take their full size and the row
 * stands 100px tall where it stood 76: the same 344px left the tracks at their
 * 72px floor and the first thing a new install showed was the bands at their
 * most cramped (Ivan, 2026-09-26: "make sure the EQ default height also is
 * enough … it starts from that nice position"). The Tone row taking a second
 * line on a narrow window, a long language and a band editor of another shape
 * move it the same way, so the height is measured rather than written down.
 *
 * What is measured: everything in the pane that is not the rail — the pane
 * less the rail, plus whatever of the page already overflows it — and the rail
 * the full track needs is added back.
 */

/**
 * The rail at which the sliders are 96px: the track is the rail less 114px
 * (`--range-length` in `MainContent.scss`), and 96px is the length the
 * first-run height was chosen for.
 */
const RAIL_FOR_FULL_TRACK = 96 + 114;

let need: number | undefined;
const listeners = new Set<() => void>();

export const getBandsPaneNeed = (): number | undefined => need;

export const subscribeBandsPaneNeed = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Published when it moves by a whole pixel, which is what the pane moves by. */
export const publishBandsPaneNeed = (next: number) => {
  const rounded = Math.round(next);
  if (rounded === need) {
    return;
  }
  need = rounded;
  listeners.forEach((listener) => listener());
};

/**
 * The pane's need from its parts: the pane, how far the page inside it
 * already overflows, and the rail's own height now.
 *
 * Linear in the pane, so a pane opened at what it reports measures the same
 * again: the rail is the pane less everything else, and everything else is
 * what is kept.
 */
export const bandsPaneNeedOf = ({
  pane,
  overflow,
  rail,
}: {
  pane: number;
  overflow: number;
  rail: number;
}) => pane + Math.max(0, overflow) - rail + RAIL_FOR_FULL_TRACK;

/**
 * A callback ref for the bands' rail: watches it and the pane it stands in,
 * and publishes the pane's need while that pane is the one under the graph.
 * Not while the graph is hidden, where the bands have the whole column and
 * their own longer tracks (`#root.minimized`), nor while the graph stands
 * under the page — neither pane is the one this sizes.
 */
export const watchBandsPaneNeed = (
  rail: HTMLElement | null,
): (() => void) | undefined => {
  if (!rail || typeof ResizeObserver === 'undefined') {
    return undefined;
  }
  const pane = rail.closest<HTMLElement>('.middle-content');
  const scroll = rail.closest<HTMLElement>('.workspace-tab-panel__scroll');
  if (!pane || !scroll) {
    return undefined;
  }
  const measure = () => {
    const isUnderGraph =
      pane.closest('.center-workspace.is-graph-first') !== null &&
      pane.closest('#root.minimized') === null;
    if (!isUnderGraph) {
      return;
    }
    publishBandsPaneNeed(
      bandsPaneNeedOf({
        pane: pane.getBoundingClientRect().height,
        overflow: scroll.scrollHeight - scroll.clientHeight,
        rail: rail.getBoundingClientRect().height,
      }),
    );
  };
  // The rail changes with the Tone row and the band editor above it; the pane
  // with the divider and the window.
  const observer = new ResizeObserver(measure);
  observer.observe(rail);
  observer.observe(pane);
  return () => observer.disconnect();
};
