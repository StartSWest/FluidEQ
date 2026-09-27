/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { LAYER_SWATCH } from '../styles/color';
import ActiveLayerChips from './ActiveLayerChips';
import useActiveLayers from './useActiveLayers';
import type { TActiveLayers } from './useActiveLayers';

/**
 * What is shaping the sound besides the bands on screen, as "Curves" among
 * the Bands page's tools (Ivan, 2026-09-27: "make applied filters always on
 * curves dropdown", then "switch curves with game engine").
 *
 * A convolution, a preset's curve, a driver correction, a measured Smart EQ
 * curve are all written into the same chain as the bands and all audible,
 * and none of them is in the editor: people chased phantom bumps in the graph
 * because the thing causing them was on another tab. Each row in the menu
 * removes or switches off its own layer, because the tab that owns it is the
 * one place you would otherwise have to go to do it.
 *
 * The button says which lines the graph is drawing without being opened: a
 * dot of each layer's colour before the word ("los circulitos on the left"),
 * and a layer switched off keeps its dot, hollow, so the dots and the menu
 * never disagree about how many there are. Nothing at all while nothing is
 * applied, rather than a dropdown with an empty menu.
 *
 * The same split control as the Smart EQ button and the layout picker, down
 * to their classes: a main half and a caret attached to it.
 */
const CurvesMenu = ({ active }: { active: TActiveLayers }) => {
  const { t } = useTranslation();
  const { layers, isBypassed } = active;
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);

  // Closes on a press elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <span
      className={`eq-mode is-subtle active-layers__picker${
        isOpen ? ' is-open' : ''
      }`}
      ref={holder}
    >
      <button
        type="button"
        className="button small subtle eq-mode__main active-layers__trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <span className="active-layers__dots" aria-hidden>
          {layers.map((layer) => (
            <i
              key={layer.key}
              className={
                (layer.feature && isBypassed(layer.feature)) || layer.isInactive
                  ? 'is-off'
                  : undefined
              }
              style={{ color: LAYER_SWATCH[layer.key] }}
            />
          ))}
        </span>
        {t('graph.curves')}
      </button>
      <button
        type="button"
        className="eq-mode__caret"
        aria-label={t('eq.layers.aria')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isOpen}
        className="active-layers__menu"
        ariaLabel={t('eq.layers.aria')}
      >
        <ActiveLayerChips active={active} />
      </AnchoredMenu>
    </span>
  );
};

const CurvesPicker = () => {
  const active = useActiveLayers();
  // Unmounted, not hidden, while nothing is applied: a menu open when the
  // last layer was removed must not pop open again with the next one.
  return active.layers.length === 0 ? null : <CurvesMenu active={active} />;
};

export default CurvesPicker;
