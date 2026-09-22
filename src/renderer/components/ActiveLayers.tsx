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

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import ActiveLayerChips from './ActiveLayerChips';
import useActiveLayers from './useActiveLayers';
import '../styles/ActiveLayers.scss';

/**
 * What is shaping the sound besides the bands on screen.
 *
 * The EQ page shows an editor full of bands and nothing else, which is a lie
 * whenever a convolution, a voicing, a driver correction or a measured Smart EQ
 * curve is also live — every one of them is written into the same Equalizer APO
 * chain and every one is audible, but none appear in the editor. People chased
 * phantom bumps in the graph because the thing causing them was on another tab.
 *
 * Each chip removes its own layer, because the tab that owns it is the one
 * place you would otherwise have to go to turn it off.
 */
const ActiveLayers = () => {
  const { t } = useTranslation();
  const active = useActiveLayers();
  const { layers, isBypassed } = active;

  /**
   * The chips, on one line or behind a button.
   *
   * Five layers with faders is most of a window; on a narrow one they wrapped
   * into three ragged rows above the bands and the header stopped reading as
   * a header. Collapsed they are one control saying how many there are, and
   * the same chips are inside it -- laid out as a column there, which is the
   * part that took two goes: a chip sized for a row is cut off in a menu.
   *
   * The decision is made against the widest the row has ever needed rather
   * than against what it currently measures. Measuring the collapsed row
   * would find it narrow, expand it, find it too wide, collapse it again —
   * a loop that runs as fast as the browser can lay out. The remembered
   * figure only grows while the row is open, which is the only state where it
   * means anything, and a little hysteresis on top keeps a window dragged to
   * exactly the boundary from flickering.
   */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const naturalWidthRef = useRef(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuHolder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => {
      const available = row.clientWidth;
      setIsCollapsed((wasCollapsed) => {
        if (!wasCollapsed) {
          // The children's own widths, added up, and not `scrollWidth`.
          //
          // A flex row wider than its contents reports `scrollWidth` as its
          // own width, so on a wide window the figure recorded here was the
          // window rather than the chips — and the row then stayed collapsed
          // at widths where everything would have fitted twice over. Summing
          // the children asks the question that was meant: how much do these
          // need.
          const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
          const children = Array.from(row.children);
          naturalWidthRef.current = children.reduce(
            (total, child) => total + child.getBoundingClientRect().width,
            gap * Math.max(0, children.length - 1),
          );
        }
        const needed = naturalWidthRef.current;
        if (needed === 0) {
          return wasCollapsed;
        }
        return wasCollapsed ? available < needed + 24 : available < needed;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [layers.length]);

  // Nothing to hang a menu off once the row fits again.
  useEffect(() => {
    if (!isCollapsed) {
      setIsMenuOpen(false);
    }
  }, [isCollapsed]);

  // Closes on a press elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !menuHolder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  // alternative was floating it over the layout, which trades the jump for a
  // strip that covers whatever is underneath.
  if (layers.length === 0) {
    return <div className="active-layers is-empty" aria-hidden />;
  }

  /**
   * How many of them are switched off, for the button that hides them.
   *
   * Only the button says it. With the chips on the surface a bypassed one is
   * struck through and dimmed where you can see it; folded behind a count,
   * "4 layers" would be the same words whether all four were doing something
   * or none of them were.
   */
  const offCount = layers.filter(
    (layer) => (layer.feature && isBypassed(layer.feature)) || layer.isInactive,
  ).length;

  const chips = <ActiveLayerChips active={active} />;

  return (
    <div
      ref={rowRef}
      className={`active-layers${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label={t('eq.layers.aria')}
    >
      <span className="active-layers__lede">{t('eq.layers')}</span>
      {isCollapsed ? (
        // The same split control as the Smart EQ button and the layout picker
        // beside it, down to their classes: a main half and a caret attached
        // to it. Written as a plain button with a chevron inside, it was the
        // one dropdown in this header that looked like something else.
        <span
          className={`eq-mode is-subtle active-layers__picker${
            isMenuOpen ? ' is-open' : ''
          }`}
          ref={menuHolder}
        >
          <button
            type="button"
            className="button small subtle eq-mode__main active-layers__trigger"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}
          >
            {offCount > 0
              ? t('eq.layers.countOff', {
                  count: layers.length,
                  off: offCount,
                })
              : t('eq.layers.count', { count: layers.length })}
          </button>
          <button
            type="button"
            className="eq-mode__caret"
            aria-label={t('eq.layers.aria')}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 6.5l4 4 4-4" />
            </svg>
          </button>
          <AnchoredMenu
            anchor={menuHolder.current}
            isOpen={isMenuOpen}
            className="active-layers__menu"
            ariaLabel={t('eq.layers.aria')}
          >
            {chips}
          </AnchoredMenu>
        </span>
      ) : (
        chips
      )}
    </div>
  );
};

export default ActiveLayers;
