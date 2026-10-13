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
import { engineKeepsEars } from '../../common/engineHealth';
import { SIDE_MENU_KEYS } from '../eq/earNames';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { requestEngineUpdate } from '../utils/engineUpdateRequest';
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
   * Which ear the bands play on: one of the two, or both again. Absent where
   * there is no ear to choose — the DSP EQ applied to Mid or Sides.
   */
  onSetChannel?: (filters: readonly IFilter[], side: TBandSide) => void;
  /**
   * Whether the installed FluidEQ Engine plays a band on its ear: the main
   * EQ's lines from 1.21 (`engineKeepsEars`), the DSP rack's from 1.22
   * (`engineRackKeepsEars`). The menu says so beside a one-ear band when not.
   */
  engineKeepsEarsFrom?: (dllVersion: string | undefined) => boolean;
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
  engineKeepsEarsFrom = engineKeepsEars,
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
  // What the window already holds, never a new ask on opening the menu.
  const status = useKnownAudioEngineStatus();
  // Equalizer APO has always read `Channel:`; the FluidEQ Engine from 1.21.
  // Said only where it matters: a band kept to one ear on an older engine.
  const isEngineBehind =
    onSetChannel !== undefined &&
    status?.engine === 'fluid' &&
    !engineKeepsEarsFrom(status.fluid?.dllVersion) &&
    filters.some((one) => one.channel !== undefined);

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
        {/* Which ear, as three of the menu's own lines with a tick on the one
            in use — no switch anywhere else on the page (Ivan, 2026-10-13:
            "really nice and simple and not really messing with ui"). */}
        {onSetChannel && <div className="band-menu__rule" role="none" />}
        {onSetChannel &&
          SIDES.map((side) => (
            <button
              type="button"
              role="menuitemradio"
              key={side}
              aria-checked={sharedSide === side}
              onClick={() => {
                onSetChannel(filters, side);
                onClose();
              }}
            >
              {sharedSide === side ? (
                <MenuIcon name="check" className="band-menu__icon is-on" />
              ) : (
                <span className="band-menu__icon" aria-hidden="true" />
              )}
              <span>{t(SIDE_MENU_KEYS[side])}</span>
            </button>
          ))}
        {isEngineBehind && (
          <p className="band-menu__note">{t('eq.channels.update')}</p>
        )}
        {/* The update itself, where this build carries a newer engine than
            the one installed — the card the window offers at launch, which
            "Not now" otherwise put away until the next start. */}
        {isEngineBehind && status?.fluidUpdateReady === true && (
          <button
            type="button"
            className="button small band-menu__update"
            onClick={() => {
              requestEngineUpdate();
              onClose();
            }}
          >
            {t('engineUpdate.action')}
          </button>
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
