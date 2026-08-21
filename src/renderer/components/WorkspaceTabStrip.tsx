/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  CSSProperties,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * The workspace tabs: four places, in one capsule, in the middle of the
 * window.
 *
 * It used to scroll, with an arrow at each end for whatever did not fit —
 * necessary when there were eight of them and Config, the last, could not be
 * reached with a pointer at a narrow width. There are four now, of four short
 * words, and they fit on anything this app runs on. The arrows went with the
 * scrolling: the lit pill overshoots slightly as it lands, and an overflow
 * measured mid-bounce was enough to make an arrow flash on for the length of
 * the animation.
 *
 * Wrapping rather than scrolling is what happens if a translation ever does
 * run long — two centred rows, which reads as a capsule that grew, not as a
 * control with something hidden off the end of it.
 */
const WorkspaceTabStrip = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  /**
   * The lit pill slides to whichever tab was chosen.
   *
   * Drawn once, behind them, and moved — rather than each tab lighting its
   * own background. A control whose highlight travels says the four are one
   * choice with one answer; four backgrounds switching on and off says they
   * are four switches that happen to agree.
   *
   * Measured rather than guessed, because these are words of different
   * lengths: the chosen tab's own box is where the pill goes. Re-measured
   * when the strip changes size — a window resize, a side pane opening —
   * through an observer rather than a clock, and whenever the selection moves,
   * which is what the second observer is for: what is selected lives in the
   * caller's markup, not in a prop this component is handed.
   */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<{ x: number; width: number } | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) {
      return undefined;
    }
    const measure = () => {
      const active = strip.querySelector<HTMLElement>('[aria-selected="true"]');
      setPill(
        active
          ? { x: active.offsetLeft, width: active.offsetWidth }
          : undefined,
      );
    };
    measure();
    const size = new ResizeObserver(measure);
    size.observe(strip);
    const selection = new MutationObserver(measure);
    selection.observe(strip, {
      attributeFilter: ['aria-selected'],
      childList: true,
      subtree: true,
    });
    return () => {
      size.disconnect();
      selection.disconnect();
    };
  }, [children]);

  return (
    <div className="workspace-tabs-shell">
      <div
        ref={stripRef}
        className="workspace-tabs"
        role="tablist"
        aria-label={label}
        style={
          pill
            ? ({
                '--tab-pill-x': `${pill.x}px`,
                '--tab-pill-width': `${pill.width}px`,
              } as CSSProperties)
            : undefined
        }
      >
        {pill && <span className="workspace-tabs__pill" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
};

export default WorkspaceTabStrip;
