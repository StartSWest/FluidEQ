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
import type { TActiveLayers } from './useActiveLayers';

/**
 * The applied layers behind one button: its words, a dot of each layer's
 * colour, and the chips in its menu, as rows.
 *
 * The folded form of the row on the EQ page (`ActiveLayers`), and the whole
 * of it in the bar above the Bands page's graph ("Curves", Ivan 2026-09-27).
 * The dots are mockup A's (`Layers ●●● ▾`): the button says which lines the
 * graph is drawing without being opened, and a layer switched off keeps its
 * dot, hollow, so the count and the colours never disagree with the menu.
 *
 * The same split control as the Smart EQ button and the layout picker, down to
 * their classes: a main half and a caret attached to it.
 */
const ActiveLayersPicker = ({
  active,
  label,
}: {
  active: TActiveLayers;
  label: string;
}) => {
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
        {/* Before the words (Ivan, 2026-09-27: "los circulitos on the left"):
          the colours are what the eye finds first on the graph as well. */}
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
        {label}
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

export default ActiveLayersPicker;
