/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FilterTypeEnum,
  NO_GAIN_FILTER_TYPES,
  type IFilter,
} from '../../common/constants';
import type { IEqBandSettings, IEqSettings } from '../../common/dsp/chain';
import { engineRackKeepsEars } from '../../common/engineHealth';
import BandMenu from '../components/BandMenu';
import { withEarChange } from './dspEqEars';

interface IDspBandMenuProps {
  eq: IEqSettings;
  index: number;
  x: number;
  y: number;
  onPatch: (index: number, next: IEqBandSettings) => void;
  /** The whole rack after an ear change, which can add or join a twin. */
  onBands: (next: IEqBandSettings[]) => void;
  onAddBeside: (index: number, side: 'left' | 'right') => void;
  onClose: () => void;
}

/** A rack band in the shape the band menu reads, keyed by its place. */
const asFilter = (band: IEqBandSettings, index: number): IFilter => ({
  id: String(index),
  frequency: band.frequency,
  gain: band.gainDb,
  quality: band.quality,
  type: band.type as FilterTypeEnum,
  isEnabled: band.enabled,
  ...(band.ear ? { channel: band.ear } : {}),
});

/**
 * The DSP EQ's band menu: the main EQ's own, on a rack band — reset it,
 * switch it, the ear it plays on, a neighbour on either side (Ivan,
 * 2026-10-13: the same simple way in both EQs, nothing new on the page).
 *
 * The ear is offered only while the EQ applies to Stereo: Mid and Sides have
 * no left or right, and the engine plays every band on both there. Its note
 * reads the rack's own version, 1.22 (`engineRackKeepsEars`), where the main
 * EQ's reads 1.21.
 */
const DspBandMenu = ({
  eq,
  index,
  x,
  y,
  onPatch,
  onBands,
  onAddBeside,
  onClose,
}: IDspBandMenuProps) => {
  const band = eq.bands[index];
  if (band === undefined) {
    return null;
  }
  const filter = asFilter(band, index);
  return (
    <BandMenu
      filter={filter}
      filters={[filter]}
      x={x}
      y={y}
      onReset={() =>
        // Flat where the shape has a gain, as the main EQ's Reset leaves it.
        onPatch(index, {
          ...band,
          ...(NO_GAIN_FILTER_TYPES.includes(filter.type) ? {} : { gainDb: 0 }),
        })
      }
      onSetEnabled={(_, isEnabled) =>
        onPatch(index, { ...band, enabled: isEnabled })
      }
      onAddBeside={(_, side) => onAddBeside(index, side)}
      onSetChannel={
        eq.stereo === 'stereo'
          ? (_, side) => onBands(withEarChange(eq.bands, index, side))
          : undefined
      }
      engineKeepsEarsFrom={engineRackKeepsEars}
      onClose={onClose}
    />
  );
};

export default DspBandMenu;
