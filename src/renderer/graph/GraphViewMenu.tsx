/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useEffect, useRef, useState } from 'react';
import { TGraphView } from '../utils/graphStyle';

/**
 * How big the graph is, and how to say so from the keyboard.
 *
 * A menu rather than the button it replaces, because there are now two sizes
 * and they answer different questions — expanded is "show me the trace better
 * while I work", fullscreen is "I am not working, I am listening". A single
 * toggle could only offer one of them.
 *
 * It carries the shortcuts as well, and that is most of the point. Every one of
 * these is bound to the window so it works without hunting for the right thing
 * to focus first — which makes them fast once known and completely invisible
 * until then. A key hint beside the thing it does is the only documentation
 * anybody reads.
 */

interface IGraphViewMenuProps {
  view: TGraphView;
  isSolo: boolean;
  onChangeView: (next: TGraphView) => void;
  onToggleSolo: () => void;
}

const VIEW_LABEL: Record<TGraphView, string> = {
  normal: 'View',
  expanded: 'Expanded',
  fullscreen: 'Full screen',
};

const GraphViewMenu = ({
  view,
  isSolo,
  onChangeView,
  onToggleSolo,
}: IGraphViewMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Every item closes the menu. None of these is a setting to be adjusted
  // repeatedly — each one changes the whole shape of the screen, and a menu
  // still hanging over the result is in the way of seeing what it did.
  const choose = (run: () => void) => () => {
    setIsOpen(false);
    run();
  };

  return (
    <div className="graph-view-menu" ref={rootRef}>
      <button
        type="button"
        className={`graph-solo${view !== 'normal' ? ' is-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        title="How much of the screen the graph gets"
      >
        {VIEW_LABEL[view]}
        <svg viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="graph-view-menu__list" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={view === 'expanded'}
            className={view === 'expanded' ? 'is-on' : undefined}
            onClick={choose(() =>
              onChangeView(view === 'expanded' ? 'normal' : 'expanded'),
            )}
          >
            <span>Expand view</span>
            <kbd>Ctrl+S</kbd>
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={view === 'fullscreen'}
            className={view === 'fullscreen' ? 'is-on' : undefined}
            onClick={choose(() =>
              onChangeView(view === 'fullscreen' ? 'normal' : 'fullscreen'),
            )}
          >
            <span>Full screen</span>
            <kbd>Ctrl+F</kbd>
          </button>

          <div className="graph-view-menu__divider" />

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isSolo}
            className={isSolo ? 'is-on' : undefined}
            onClick={choose(onToggleSolo)}
          >
            <span>{isSolo ? 'Show EQ curves' : 'Wave only'}</span>
            <kbd>Ctrl+W</kbd>
          </button>

          <div className="graph-view-menu__divider" />

          {/* Listed but not clickable: the plot itself is the control, and a
              menu item that walks the styles one at a time would mean opening
              the menu forty times. They are here to be read. */}
          <div className="graph-view-menu__hint">
            <span>Next style</span>
            <kbd>Space</kbd>
          </div>
          <div className="graph-view-menu__hint">
            <span>Previous style</span>
            <kbd>Ctrl+Space</kbd>
          </div>
          <div className="graph-view-menu__hint">
            <span>Back to normal</span>
            <kbd>Esc</kbd>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphViewMenu;
