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

import { ReactNode } from 'react';
import OverflowArrow from './OverflowArrow';
import { useOverflowScroll } from '../utils/useOverflowScroll';

/**
 * The workspace tabs, with a way to reach the ones that do not fit.
 *
 * The strip has scrolled horizontally at narrow widths for a while, but with
 * its scrollbar hidden and no wheel over it there was nothing to say so: the
 * tabs ended at the window's edge and Config, the last of them, could not be
 * reached with a pointer at all. An arrow at each end, and only at the end
 * that has something past it.
 */
const WorkspaceTabStrip = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const { ref, canScrollBack, canScrollForward, scrollBy, onScroll } =
    useOverflowScroll(children);

  return (
    <div className="workspace-tabs-shell">
      {canScrollBack && (
        <OverflowArrow direction="back" onPress={() => scrollBy(-1)} />
      )}
      <div
        ref={ref}
        className="workspace-tabs"
        role="tablist"
        aria-label={label}
        onScroll={onScroll}
      >
        {children}
      </div>
      {canScrollForward && (
        <OverflowArrow direction="forward" onPress={() => scrollBy(1)} />
      )}
    </div>
  );
};

export default WorkspaceTabStrip;
