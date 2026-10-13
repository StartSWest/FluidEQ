/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  bandChannelOf,
  IFilter,
  isBandEnabled,
  type TBandSide,
} from 'common/constants';
import { SIDE_NAME_KEYS } from '../eq/earNames';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import '../styles/BandMenu.scss';

/**
 * The event a band's surface fires to ask for its menu. Two surfaces show a
 * band — its slider in the editor and its handle on the graph — and they are
 * different components in different subtrees, so the request travels as an
 * event carrying the band's id and the point it was asked at, and
 * `MainContent`, which owns the actions, answers it.
 */
export const BAND_MENU_EVENT = 'fluideq-band-menu';

export const requestBandMenu = (filterId: string, x: number, y: number) => {
  window.dispatchEvent(
    new CustomEvent(BAND_MENU_EVENT, { detail: { filterId, x, y } }),
  );
};

interface IBandMenuProps {
  /** The band that was right-clicked. */
  filter: IFilter;
  /** Every band the menu acts on: the selection, when the band is in one. */
  filters: readonly IFilter[];
  x: number;
  y: number;
  onReset: (filters: readonly IFilter[]) => void;
  /** Put the bands in or out of the chain, keeping everything they are set to. */
  onSetEnabled: (filters: readonly IFilter[], isEnabled: boolean) => void;
  onAddBeside: (filter: IFilter, side: 'left' | 'right') => void;
  /**
   * Which ear the bands play on. Given only while the output's channels are
   * apart: linked, every band plays on both and there is nothing to choose.
   */
  onSetChannel?: (filters: readonly IFilter[], side: TBandSide) => void;
  onClose: () => void;
}

const SIDES: readonly TBandSide[] = ['both', 'left', 'right'];

/**
 * What a band offers when it is right-clicked: put it back to neutral, or
 * grow a neighbour on either side. The anchor is an empty element parked at
 * the pointer, because `AnchoredMenu` positions against an element and the
 * thing clicked may be an SVG circle that scrolls with the plot.
 */
const BandMenu = ({
  filter,
  filters,
  x,
  y,
  onReset,
  onSetEnabled,
  onAddBeside,
  onSetChannel,
  onClose,
}: IBandMenuProps) => {
  const { t } = useTranslation();
  // Over a selection the menu is about all of it, and growing a neighbour
  // beside "several bands" means nothing — only reset and the switch survive.
  const isSelection = filters.length > 1;
  // Same reading as the switch in the editor row: any band still in the chain
  // means the entry offers to take them out.
  const isAnyEnabled = filters.some(isBandEnabled);
  // The ear they share, or none lit when a selection is split between them.
  const sides = new Set(filters.map(bandChannelOf));
  const sharedSide = sides.size === 1 ? [...sides][0] : undefined;
  // Held in state, not a ref: `AnchoredMenu` measures the anchor in an
  // effect keyed on the element, and a ref's current is still null on the
  // render that mounts it.
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <>
      {/* Into the body, like the menu itself. A fixed element inside the
          workspace lands relative to whichever ancestor has a transform or a
          scroll of its own, and this one has to be at the pointer's viewport
          coordinates, exactly where the click was. */}
      {createPortal(
        <span
          ref={setAnchor}
          className="band-menu__anchor"
          style={{ left: x, top: y }}
          aria-hidden="true"
        />,
        document.body,
      )}
      <AnchoredMenu
        anchor={anchor}
        isOpen
        className="band-menu"
        ariaLabel={t('eq.menu.aria', { frequency: filter.frequency })}
      >
        <p className="band-menu__subject">
          {isSelection
            ? t('eq.menu.selection', { count: filters.length })
            : t('eq.menu.subject', { frequency: filter.frequency })}
        </p>
        <button
          type="button"
          onClick={() => {
            onReset(filters);
            onClose();
          }}
        >
          <MenuIcon name="reset" className="band-menu__icon" />
          <span>
            {isSelection
              ? t('eq.menu.resetSelection', { count: filters.length })
              : t('eq.menu.reset')}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            onSetEnabled(filters, !isAnyEnabled);
            onClose();
          }}
        >
          <MenuIcon name="power" className="band-menu__icon" />
          <span>
            {(() => {
              if (isSelection) {
                return isAnyEnabled
                  ? t('eq.menu.disableSelection', { count: filters.length })
                  : t('eq.menu.enableSelection', { count: filters.length });
              }
              return isAnyEnabled ? t('eq.menu.disable') : t('eq.menu.enable');
            })()}
          </span>
        </button>
        {onSetChannel && (
          <>
            <div className="band-menu__rule" role="none" />
            <div className="band-menu__ears">
              <span className="band-menu__ears-label" id="band-menu-ears">
                {t('eq.channels.playsOn')}
              </span>
              <div
                className="segmented band-menu__ears-track"
                role="radiogroup"
                aria-labelledby="band-menu-ears"
              >
                {SIDES.map((side) => (
                  <button
                    type="button"
                    role="radio"
                    key={side}
                    aria-checked={sharedSide === side}
                    className={`segmented__option${
                      sharedSide === side ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      onSetChannel(filters, side);
                      onClose();
                    }}
                  >
                    {t(SIDE_NAME_KEYS[side])}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {!isSelection && (
          <>
            <div className="band-menu__rule" role="none" />
            <button
              type="button"
              onClick={() => {
                onAddBeside(filter, 'left');
                onClose();
              }}
            >
              <MenuIcon name="previous" className="band-menu__icon" />
              <span>{t('eq.menu.addLeft')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAddBeside(filter, 'right');
                onClose();
              }}
            >
              <MenuIcon name="next" className="band-menu__icon" />
              <span>{t('eq.menu.addRight')}</span>
            </button>
          </>
        )}
      </AnchoredMenu>
    </>
  );
};

export default BandMenu;
