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

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TGraphView, TWaveOrientation } from '../utils/graphStyle';

/**
 * How big the graph is, what it shows, and how to say either from the keyboard.
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
 *
 * Every row does something. An earlier version listed the style shortcuts as
 * plain text, which put two greyed-out lines in the middle of a menu — and a
 * greyed row in a menu means "not available right now", not "informational".
 * They are buttons that cycle the look, and they read like the rest.
 */

interface IGraphViewMenuProps {
  view: TGraphView;
  isSolo: boolean;
  onChangeView: (next: TGraphView) => void;
  onToggleSolo: () => void;
  onCycleLook: (direction: 1 | -1) => void;
  isGridHidden: boolean;
  onToggleGrid: () => void;
  isStretched: boolean;
  onToggleStretch: () => void;
  waveOrientation: TWaveOrientation;
  onCycleOrientation: () => void;
}

/** Names the state the next press moves to, since three states cycle. */
const ORIENTATION_LABEL: Record<TWaveOrientation, string> = {
  up: 'Hang the wave down',
  down: 'Mirror the wave',
  mirrored: 'Stand the wave up',
};

const VIEW_LABEL: Record<TGraphView, string> = {
  normal: 'View',
  expanded: 'Expanded',
  fullscreen: 'Full screen',
};

/**
 * Where the list goes, decided against the window rather than assumed.
 *
 * The graph sits at the bottom of the workspace as often as not, and this menu
 * hangs off the top-right of it — so "below and right-aligned" is right about
 * half the time and off the edge of the screen the rest of it.
 */
interface IPlacement {
  isAbove: boolean;
  isLeftAligned: boolean;
}

/** Enough room to be worth opening into; less than this and it flips. */
const MENU_ESTIMATED_HEIGHT = 260;
const MENU_ESTIMATED_WIDTH = 210;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

const GraphViewMenu = ({
  view,
  isSolo,
  onChangeView,
  onToggleSolo,
  onCycleLook,
  isGridHidden,
  onToggleGrid,
  isStretched,
  onToggleStretch,
  waveOrientation,
  onCycleOrientation,
}: IGraphViewMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<IPlacement>({
    isAbove: false,
    isLeftAligned: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Measured before the browser paints, so the list never appears in the wrong
  // place and jumps. `useLayoutEffect` is the difference between choosing a
  // side and being seen to change your mind about it.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) {
      return;
    }
    setPlacement({
      isAbove:
        window.innerHeight - trigger.bottom < MENU_ESTIMATED_HEIGHT &&
        trigger.top > MENU_ESTIMATED_HEIGHT,
      isLeftAligned: trigger.right < MENU_ESTIMATED_WIDTH,
    });
  }, [isOpen]);

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

  // The mode rows close the menu; the style rows do not. Changing the size of
  // the screen is a thing you do once and then want to look at the result of,
  // and a menu still hanging over it is in the way. Walking the styles is the
  // opposite — it is done by comparison, several in a row, and closing after
  // each one would mean reopening the menu forty times.
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
        <svg className="arrow" viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`graph-view-menu__list${
            placement.isAbove ? ' is-above' : ''
          }${placement.isLeftAligned ? ' is-left' : ''}`}
          role="menu"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={view === 'expanded'}
            className={view === 'expanded' ? 'is-on' : undefined}
            onClick={choose(() =>
              onChangeView(view === 'expanded' ? 'normal' : 'expanded'),
            )}
          >
            <Icon>
              <path d="M2.5 4.5h11v7h-11z" />
              <path d="M5.5 7.2L3.6 8l1.9.8M10.5 7.2L12.4 8l-1.9.8" />
            </Icon>
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
            <Icon>
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            </Icon>
            <span>Full screen</span>
            <kbd>Ctrl+F</kbd>
          </button>

          <div className="graph-view-menu__divider" />

          {/* No `is-on` on either of the two below, unlike the modes above.
              Their labels already flip — "Wave only" becomes "Show EQ curves" —
              so colouring them as well states the same thing twice, and it
              picked out two rows in a colour the rest of the menu never uses
              for no reason a reader could work out. The modes keep it because
              their labels do *not* change and something has to say which of the
              two you are in. */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isSolo}
            onClick={choose(onToggleSolo)}
          >
            <Icon>
              <path d="M1.5 8c1.6-4.4 3.2-4.4 4.8 0s3.2 4.4 4.8 0 3.2-4.4 3.4 0" />
            </Icon>
            <span>{isSolo ? 'Show EQ curves' : 'Wave only'}</span>
            <kbd>Ctrl+W</kbd>
          </button>

          {/* The paper, rather than what is drawn on it. Solo above hides the
              other curves and keeps the scale, which is what reading a trace
              needs; this takes the scale away too, for when the graph has
              stopped being a measurement and become a visualiser. */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isGridHidden}
            onClick={choose(onToggleGrid)}
          >
            <Icon>
              <path d="M2.5 2.5h11v11h-11z" />
              <path d="M6.2 2.5v11M9.8 2.5v11M2.5 6.2h11M2.5 9.8h11" />
            </Icon>
            <span>{isGridHidden ? 'Show grid' : 'Hide grid'}</span>
            <kbd>Ctrl+G</kbd>
          </button>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isStretched}
            onClick={choose(onToggleStretch)}
          >
            <Icon>
              <path d="M8 2.5v11M5.4 5.1L8 2.5l2.6 2.6M5.4 10.9L8 13.5l2.6-2.6" />
            </Icon>
            <span>{isStretched ? 'Fit the graph' : 'Stretch to fill'}</span>
            <kbd>Ctrl+B</kbd>
          </button>

          {/* Three states, so it cycles and names the one it will go to next
              rather than the one you are in. Every look is drawn from the same
              points, so this flips all forty at once. */}
          <button type="button" role="menuitem" onClick={onCycleOrientation}>
            <Icon>
              <path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" />
            </Icon>
            <span>{ORIENTATION_LABEL[waveOrientation]}</span>
            <kbd>Ctrl+I</kbd>
          </button>

          <div className="graph-view-menu__divider" />

          {/* Left open on purpose — see `choose` above. */}
          <button type="button" role="menuitem" onClick={() => onCycleLook(1)}>
            <Icon>
              <path d="M6 3.5l4 4.5-4 4.5" />
            </Icon>
            <span>Next style</span>
            <kbd>Space</kbd>
          </button>
          <button type="button" role="menuitem" onClick={() => onCycleLook(-1)}>
            <Icon>
              <path d="M10 3.5l-4 4.5 4 4.5" />
            </Icon>
            <span>Previous style</span>
            <kbd>Ctrl+Space</kbd>
          </button>
        </div>
      )}
    </div>
  );
};

export default GraphViewMenu;
