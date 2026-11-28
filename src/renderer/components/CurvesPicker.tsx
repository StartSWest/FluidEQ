/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { LAYER_SWATCH } from '../styles/color';
import Chevron from '../icons/Chevron';
import MenuIcon from '../icons/MenuIcon';
import { openHeadphoneCorrections } from '../eq/headphoneCorrectionsOpen';
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
 * One menu trigger: the label and caret perform the same action, so splitting
 * them would suggest a second action and add a redundant keyboard stop.
 */
interface ICurvesPickerProps {
  /**
   * Where the way to a headphone correction leads: the full app's page, by
   * default. The amp hands in its own way back to that page, because the
   * page is not in its window (Ivan, 2026-11-27: "it tries to show on side
   * pane not good for amp").
   */
  onAddCorrection?: () => void;
}

const CurvesMenu = ({
  active,
  onAddCorrection = openHeadphoneCorrections,
}: ICurvesPickerProps & { active: TActiveLayers }) => {
  const { t } = useTranslation();
  const { layers, isBypassed } = active;
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const hasCorrection = layers.some((layer) => layer.key === 'headphone');

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
        aria-haspopup="menu"
        // Named where the row leaves it its dots alone (`useToolRowFit`).
        title={t('graph.curves')}
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
        <span className="eq-toolbar__word">{t('graph.curves')}</span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isOpen}
        className="active-layers__menu"
        ariaLabel={t('eq.layers.aria')}
      >
        <ActiveLayerChips active={active} />
        {/* The way to a headphone correction from the list of what shapes
            the sound (Ivan, 2026-11-20: "curves should have a button to add
            a headset correction"): its page, OPRA's library and your own
            curves, to add one or to change the one playing. */}
        <button
          type="button"
          className="button small plain active-layers__add"
          onClick={() => {
            setIsOpen(false);
            onAddCorrection();
          }}
        >
          <MenuIcon name="model" />
          {t(
            hasCorrection
              ? 'eq.layers.changeCorrection'
              : 'eq.layers.addCorrection',
          )}
        </button>
      </AnchoredMenu>
    </span>
  );
};

const CurvesPicker = ({ onAddCorrection }: ICurvesPickerProps) => {
  const active = useActiveLayers();
  // Unmounted, not hidden, while nothing is applied: a menu open when the
  // last layer was removed must not pop open again with the next one.
  return active.layers.length === 0 ? null : (
    <CurvesMenu active={active} onAddCorrection={onAddCorrection} />
  );
};

export default CurvesPicker;
