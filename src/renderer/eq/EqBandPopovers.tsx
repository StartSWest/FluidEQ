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
import { closeBandPopover, useBandPopover } from './bandPopover';
import useBandPopoverPlace, {
  type IBandPopoverPlace,
} from './useBandPopoverPlace';
import useGraphPopoverPlace from './useGraphPopoverPlace';
import EqBandEditor from './EqBandEditor';

/** The keyframes the popover leaves by (`_motion.scss`). */
const EXIT = 'pop-out';

interface IPopoverProps {
  bands: TEqPageBands;
  actions: TEqPageActions;
}

/**
 * Whether the popover is up on this anchor, and the band it shows: the
 * selected one, or while it leaves after the selection emptied (a press
 * elsewhere, its band deleted), the last one it showed.
 */
const useShownBand = (bands: TEqPageBands, kind: 'band' | 'graph') => {
  const popover = useBandPopover();
  const isOpen = popover.isOpen && popover.anchor.kind === kind;
  const element = useRef<HTMLDivElement>(null);
  const exit = useExitAnimation(isOpen, EXIT, element);
  const last = useRef<IFilter | undefined>(undefined);
  const { selectedFilter } = bands;
  if (selectedFilter) {
    last.current = selectedFilter;
  }
  // Nothing left selected: the popover has nothing to edit, and goes.
  useEffect(() => {
    if (isOpen && !selectedFilter) {
      closeBandPopover();
    }
  }, [isOpen, selectedFilter]);
  const band = exit.present ? (selectedFilter ?? last.current) : undefined;
  // What moves the band, and the popover arriving: placed again on each.
  const moved = `${exit.present}|${band?.gain}|${band?.frequency}|${bands.frequencySortedFilters.length}`;
  return { popover, element, exit, band, moved };
};

const Popover = ({
  bands,
  actions,
  shown,
  place,
}: IPopoverProps & {
  shown: ReturnType<typeof useShownBand>;
  place: IBandPopoverPlace | undefined;
}) =>
  shown.band ? (
    <EqBandEditor
      bands={bands}
      actions={actions}
      popover={shown.element}
      place={place}
      band={shown.band}
      isClosing={shown.exit.closing}
      onAnimationEnd={shown.exit.onAnimationEnd}
    />
  ) : null;

/**
 * Against the band's slider, in the bands' panel: in its markup, so the
 * keyboard reaches it after the tab row and before the sliders.
 */
export const EqBandPopoverOnBand = ({ bands, actions }: IPopoverProps) => {
  const shown = useShownBand(bands, 'band');
  const place = useBandPopoverPlace(shown.element, shown.band?.id, shown.moved);
  return (
    <Popover bands={bands} actions={actions} shown={shown} place={place} />
  );
};

/**
 * Over the band's handle on the graph, in the graph's own card (Ivan,
 * 2026-11-17: "also in the graph it appears above if I press shift"): the
 * graph is the shell's and the page is drawn beside it, so it is portalled
 * into the card the press came from.
 */
export const EqBandPopoverOnGraph = ({ bands, actions }: IPopoverProps) => {
  const shown = useShownBand(bands, 'graph');
  const place = useGraphPopoverPlace(
    shown.element,
    shown.band?.id,
    shown.moved,
  );
  const { anchor } = shown.popover;
  const card = anchor.kind === 'graph' ? anchor.card : undefined;
  return card?.isConnected
    ? createPortal(
        <Popover bands={bands} actions={actions} shown={shown} place={place} />,
        card,
      )
    : null;
};
