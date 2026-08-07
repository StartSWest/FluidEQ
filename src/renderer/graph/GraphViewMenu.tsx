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
  onChangeView: (next: TGraphView) => void;
  onCycleLook: (direction: 1 | -1) => void;
  isWaveHidden: boolean;
  onToggleWave: () => void;
  isEqHidden: boolean;
  onToggleEq: () => void;
  /** Walks the four states the three switches below add up to. */
  onCycleContents: () => void;
  isGridHidden: boolean;
  onToggleGrid: () => void;
  isStretched: boolean;
  onToggleStretch: () => void;
  waveOrientation: TWaveOrientation;
  onCycleOrientation: () => void;
  /**
   * How much of what is behind the card shows through, and how hard it is
   * blurred. Meaningful in both of the larger modes, and offered in both.
   */
  overlayOpacity: number;
  onChangeOverlayOpacity: (next: number) => void;
  overlayBlur: number;
  onChangeOverlayBlur: (next: number) => void;
  minOverlayOpacity: number;
  maxOverlayBlur: number;
  /** Whether full screen keeps FluidEQ's own top bar. Full screen only. */
  hasTopBar: boolean;
  onToggleTopBar: () => void;
}

/** Names the state the next press moves to, since three states cycle. */
const ORIENTATION_LABEL: Record<TWaveOrientation, string> = {
  up: 'Hang the wave down',
  down: 'Mirror the wave',
  mirrored: 'Mirror from the centre',
  centred: 'Stand the wave up',
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
  onChangeView,
  onCycleLook,
  isWaveHidden,
  onToggleWave,
  isEqHidden,
  onToggleEq,
  onCycleContents,
  isGridHidden,
  onToggleGrid,
  isStretched,
  onToggleStretch,
  waveOrientation,
  onCycleOrientation,
  overlayOpacity,
  onChangeOverlayOpacity,
  overlayBlur,
  onChangeOverlayBlur,
  minOverlayOpacity,
  maxOverlayBlur,
  hasTopBar,
  onToggleTopBar,
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

          {/* The key that walks the group, given a row of its own.

              Ctrl+W moves between four arrangements of the three switches under
              it, so printing it beside any one of them would promise it did
              only that — and leaving it off the menu entirely, which is what
              happened before, left the app's most-used graph shortcut written
              down nowhere. A row that does the cycling says exactly what the
              key says. */}
          <button type="button" onClick={choose(onCycleContents)}>
            <Icon>
              <path d="M13.5 6.5A5.5 5.5 0 1 0 14 9" />
              <path d="M13.8 2.6v4h-4" />
            </Icon>
            <span>Cycle what is shown</span>
            <kbd>Ctrl+W</kbd>
          </button>

          {/* No `is-on` on either of the two below, unlike the modes above.
              Their labels already flip — "Hide the wave" becomes "Show the
              wave" — so colouring them as well states the same thing twice, and
              it picked out rows in a colour the rest of the menu never uses for
              no reason a reader could work out. The modes keep it because their
              labels do *not* change and something has to say which of the two
              you are in.

              Solo — the wave with every curve dropped — had a row here and no
              longer does. It is the second stop of the cycle above, one press
              away, and as a switch of its own it was the odd one out: the other
              two say which single drawing they take away, where solo took away
              five of them and was named for the one it kept. */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isWaveHidden}
            onClick={choose(onToggleWave)}
          >
            <Icon>
              <path d="M1.5 8c1.6 0 1.6-4 3.2-4s1.6 8 3.2 8 1.6-8 3.2-8 1.6 4 3.2 4" />
            </Icon>
            <span>{isWaveHidden ? 'Show the wave' : 'Hide the wave'}</span>
          </button>

          {/* The bands' own line, which the legend chip also switches.

              Worth a row here because it is the last stop of the cycle above
              and because it is the loudest thing on the plot: full weight, a
              glow, a spectrum gradient and every handle sitting on it. Taking
              it away is how you see what the other layers are doing, and its
              handles go with it — there is nothing to watch follow them. */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isEqHidden}
            onClick={choose(onToggleEq)}
          >
            <Icon>
              <path d="M1.5 11c2.2 0 3-6 5.2-6s3 6 5.2 6 2.6-3 2.6-3" />
            </Icon>
            <span>{isEqHidden ? 'Show EQ curve' : 'Hide EQ curve'}</span>
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
          {/* Nothing to turn over when there is no wave. Greyed rather than
              removed, so the row does not appear and vanish as the wave is
              switched — and so the reason it is unavailable is legible from
              the row directly above it. */}
          <button
            type="button"
            role="menuitem"
            disabled={isWaveHidden}
            onClick={onCycleOrientation}
          >
            <Icon>
              <path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" />
            </Icon>
            <span>{ORIENTATION_LABEL[waveOrientation]}</span>
            <kbd>Ctrl+I</kbd>
          </button>

          <div className="graph-view-menu__divider" />

          {/* Left open on purpose — see `choose` above. */}
          <button
            type="button"
            role="menuitem"
            disabled={isWaveHidden}
            onClick={() => onCycleLook(1)}
          >
            <Icon>
              <path d="M6 3.5l4 4.5-4 4.5" />
            </Icon>
            <span>Next style</span>
            <kbd>Space</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isWaveHidden}
            onClick={() => onCycleLook(-1)}
          >
            <Icon>
              <path d="M10 3.5l-4 4.5 4 4.5" />
            </Icon>
            <span>Previous style</span>
            <kbd>Ctrl+Space</kbd>
          </button>

          {/* Two sliders, in the menu rather than in the strip beside it.

              They lived in the row for a good reason — they are judged by
              looking at what they affect, not by reading a number — and the
              menu keeps that: it opens over the graph, so the picture is still
              on screen while either is dragged.

              What they cost out there was the whole row. They are by some way
              the widest things in it, they appear only in full screen, and the
              row is right-aligned — so arriving in the mode shoved every other
              control left, and on a narrow window pushed them under the
              waveform. A menu has vertical space to spend and the strip has
              none.

              Both of the larger modes, not full screen alone. They were full
              screen only, on the reasoning that it is the only mode where the
              card has anything behind it — and that is not what the stylesheet
              says. `--graph-overlay-opacity` and `--graph-overlay-filter` are
              read under `.center-workspace.is-graph-full`, which is set for
              expanded as well: the card floats over whichever editor is open
              and these two decide how much of it comes through. Offering the
              sliders in one of the two modes they work in was already odd
              while the value was shared, because full screen could at least set
              it for both. Now that each mode keeps its own it would be a
              setting expanded has and cannot reach. */}
          {view !== 'normal' && (
            <>
              <div className="graph-view-menu__divider" />

              {/* One switch for the whole bar rather than one per piece. The
                  parts of it are not independently useful — a waveform with no
                  creature beside it is the same bar with a hole in it.

                  Full screen alone, this one: it is the mode that takes the
                  app's own chrome away, so it is the only one with a top bar to
                  argue about. */}
              {view === 'fullscreen' && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={hasTopBar}
                  onClick={choose(onToggleTopBar)}
                >
                  <Icon>
                    <path d="M2.5 2.5h11v11h-11z" />
                    <path d="M2.5 6h11" />
                  </Icon>
                  <span>
                    {hasTopBar ? 'Hide the top bar' : 'Show the top bar'}
                  </span>
                </button>
              )}

              <label
                className="graph-view-menu__slider"
                htmlFor="graph-see-through"
                title="How much of the page shows through the graph"
              >
                <Icon>
                  <path d="M8 3.5c3 0 5 2.3 5.5 4.5-.5 2.2-2.5 4.5-5.5 4.5S3 10.2 2.5 8C3 5.8 5 3.5 8 3.5z" />
                  <path d="M8 6.2a1.8 1.8 0 100 3.6 1.8 1.8 0 100-3.6z" />
                </Icon>
                <span>See through</span>
                <input
                  id="graph-see-through"
                  type="range"
                  min={minOverlayOpacity * 100}
                  max={100}
                  step={1}
                  // Inverted, so right is more see-through. The stored value is
                  // an opacity because that is what CSS wants; the slider is a
                  // transparency because that is what the label says.
                  value={Math.round((1 - overlayOpacity) * 100)}
                  onChange={(event) =>
                    onChangeOverlayOpacity(1 - Number(event.target.value) / 100)
                  }
                />
              </label>
              <label
                className="graph-view-menu__slider"
                htmlFor="graph-see-through-blur"
                title="Blur what shows through, so it reads as light rather than as a second picture"
              >
                <Icon>
                  <path d="M8 2.5C5.5 5.4 4 7.3 4 9a4 4 0 008 0c0-1.7-1.5-3.6-4-6.5z" />
                </Icon>
                <span>Blur</span>
                <input
                  id="graph-see-through-blur"
                  type="range"
                  min={0}
                  max={maxOverlayBlur}
                  step={1}
                  value={overlayBlur}
                  onChange={(event) =>
                    onChangeOverlayBlur(Number(event.target.value))
                  }
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphViewMenu;
