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

import { CSSProperties } from 'react';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

export type TSectionTab = { id: string; label: string };

/**
 * The sections inside a page — today, the equaliser's five.
 *
 * Deliberately not the same instrument as the row in the titlebar. That one
 * is the app's four places and lights the chosen one with a filled pill; five
 * smaller pills under it would read as nine tabs of the same kind in two
 * rows, which is the arrangement the split exists to undo.
 *
 * These are set as a rail instead: small letters spaced out, and one lit bar
 * that travels along the rule under them. Same accent, different instrument —
 * so the two rows read as two levels rather than as one row repeated.
 */
const WorkspaceSectionTabs = ({
  label,
  tabs,
  activeId,
  onSelect,
}: {
  label: string;
  tabs: readonly TSectionTab[];
  activeId: string;
  onSelect: (id: string) => void;
}) => {
  const { ref, box } = useSlidingIndicator<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="workspace-tab-group"
      role="tablist"
      aria-label={label}
      style={
        box
          ? ({
              '--section-bar-x': `${box.x}px`,
              '--section-bar-width': `${box.width}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={`workspace-pill${activeId === tab.id ? ' is-active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      {box && <span className="workspace-tab-group__bar" aria-hidden="true" />}
    </div>
  );
};

export default WorkspaceSectionTabs;
