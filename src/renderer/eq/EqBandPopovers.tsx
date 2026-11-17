/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IFilter } from 'common/constants';
import useExitAnimation from '../utils/useExitAnimation';
import { type TEqPageBands } from './useEqPageBands';
import { type TEqPageActions } from './useEqPageActions';
import { useBandPopoverKeys } from './bandPopover';
import useBandPopoverPlace, {
  locateBandHandle,
  locateGraphHandle,
  type TLocateHandle,
} from './useBandPopoverPlace';
import EqBandEditor from './EqBandEditor';

/** The keyframes the popover leaves by (`_motion.scss`). */
const EXIT = 'pop-out';

/** Where the popover stands: against a slider, or on the graph's card. */
type TAnchor = { kind: 'band' } | { kind: 'graph'; card: HTMLElement };

export interface IBandPopoverState {
  isOpen: boolean;
  /** Kept after it closes, so the way out plays where it was. */
  anchor: TAnchor;
}

/**
 * WHETHER THE BAND POPOVER IS UP, AND WHERE: the one place it is decided
 * (Ivan, 2026-11-17: "basically it shows while Shift is held, whether moving
 * or not, as long as a band is selected and in focus").
 *
 *   up = Shift is down (or a press that began in it is still down)
 *        AND a band is selected
 *        AND that band has the keyboard — its slider, caption or column, its
 *            graph handle — or the popover itself has it
 *        AND it was not put away with Escape or its close since Shift went
 *            down.
 *
 * However that came about — Shift first or the band first, dragging or
 * still — and the moment any part stops, it goes. Where it stands is where
 * the focused band is: against its slider, or over the graph's card beside
 * its handle; with the popover focused, where it already was.
 *
 * With several bands selected, the focused one leads the selection, so the
 * popover's dials are that band's (the group edit is measured from the
 * selection's first band).
 */
export const useBandPopoverState = (bands: TEqPageBands): IBandPopoverState => {
  const { isShiftDown, isPressInPopover, isDismissed, focus } =
    useBandPopoverKeys();
  const { selectedFilterIds, setSelectedFilterIds } = bands;
  const focusId =
    focus?.kind === 'band' || focus?.kind === 'graph' ? focus.id : undefined;
  const isFocused =
    focus?.kind === 'popover' ||
    (focusId !== undefined && selectedFilterIds.includes(focusId));
  const isOpen =
    (isShiftDown || isPressInPopover) &&
    !isDismissed &&
    selectedFilterIds.length > 0 &&
    isFocused;
  const anchor = useRef<TAnchor>({ kind: 'band' });
  if (focus?.kind === 'band') {
    anchor.current = { kind: 'band' };
  } else if (focus?.kind === 'graph') {
    anchor.current = { kind: 'graph', card: focus.card };
  }
  useEffect(() => {
    if (isOpen && focusId && selectedFilterIds[0] !== focusId) {
      setSelectedFilterIds([
        focusId,
        ...selectedFilterIds.filter((id) => id !== focusId),
      ]);
    }
  }, [isOpen, focusId, selectedFilterIds, setSelectedFilterIds]);
  return { isOpen, anchor: anchor.current };
};

interface IPopoverProps {
  bands: TEqPageBands;
  actions: TEqPageActions;
  popover: IBandPopoverState;
}

/**
 * The popover on one anchor, through its way in and out: the selected band,
 * or while it leaves after the selection emptied (a press elsewhere, its
 * band deleted), the last one it showed.
 */
const AnchoredPopover = ({
  bands,
  actions,
  isOpen,
  locate,
}: Omit<IPopoverProps, 'popover'> & {
  isOpen: boolean;
  locate: TLocateHandle;
}) => {
  const element = useRef<HTMLDivElement>(null);
  const exit = useExitAnimation(isOpen, EXIT, element);
  const last = useRef<IFilter | undefined>(undefined);
  const { selectedFilter } = bands;
  if (selectedFilter) {
    last.current = selectedFilter;
  }
  const band = exit.present ? (selectedFilter ?? last.current) : undefined;
  // What moves the band, and the popover arriving: placed again on each.
  const place = useBandPopoverPlace(
    element,
    locate,
    band?.id,
    `${exit.present}|${band?.gain}|${band?.frequency}|${bands.frequencySortedFilters.length}`,
  );
  return band ? (
    <EqBandEditor
      bands={bands}
      actions={actions}
      popover={element}
      place={place}
      band={band}
      isClosing={exit.closing}
      onAnimationEnd={exit.onAnimationEnd}
    />
  ) : null;
};

/**
 * Against the band's slider, in the bands' panel: in its markup, so the
 * keyboard reaches it after the tab row and before the sliders.
 */
export const EqBandPopoverOnBand = ({
  bands,
  actions,
  popover,
}: IPopoverProps) => (
  <AnchoredPopover
    bands={bands}
    actions={actions}
    isOpen={popover.isOpen && popover.anchor.kind === 'band'}
    locate={locateBandHandle}
  />
);

/**
 * Beside the band's handle on the graph, in the graph's own card: the graph
 * is the shell's and the page is drawn beside it, so it is portalled into
 * the card the handle is on.
 */
export const EqBandPopoverOnGraph = ({
  bands,
  actions,
  popover,
}: IPopoverProps) => {
  const { anchor } = popover;
  const card = anchor.kind === 'graph' ? anchor.card : undefined;
  return card?.isConnected
    ? createPortal(
        <AnchoredPopover
          bands={bands}
          actions={actions}
          isOpen={popover.isOpen}
          locate={locateGraphHandle}
        />,
        card,
      )
    : null;
};
