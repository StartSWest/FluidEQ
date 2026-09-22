/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useMemo } from 'react';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { playerWidthForBands, setPlayerWidthNeed } from './playerLayout';

/**
 * The width the band layout needs, said to the layout and to the window.
 *
 * On the player's root as `--player-eq-min`, which the deck row reads to
 * decide whether the equalizer can stand beside the deck; and as the bands'
 * part of the window's floor (`setPlayerWidthNeed`), so the window cannot be
 * dragged narrower than the layout the listener chose. Withdrawn when the
 * player goes.
 */
const PlayerBandFloor = ({
  rootRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
}) => {
  const { filters } = useFluidEqContext();
  const bands = useMemo(
    () =>
      Object.values(filters).filter(
        (band) => !NO_GAIN_FILTER_TYPES.includes(band.type),
      ).length,
    [filters],
  );
  const width = playerWidthForBands(bands);

  useLayoutEffect(() => {
    rootRef.current?.style.setProperty('--player-eq-min', `${width}px`);
    setPlayerWidthNeed('bands', width);
  }, [rootRef, width]);
  useLayoutEffect(() => () => setPlayerWidthNeed('bands', undefined), []);

  return null;
};

export default PlayerBandFloor;
