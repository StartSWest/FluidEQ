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

import { CSSProperties, ReactNode } from 'react';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

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
  // The lit pill slides to whichever tab was chosen — see the hook for why it
  // is one travelling highlight rather than four that switch on and off, and
  // why it is measured rather than guessed.
  const { ref: stripRef, box: pill } = useSlidingIndicator<HTMLDivElement>();

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
