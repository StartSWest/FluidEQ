/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';

/**
 * The path each filter shape draws, in a 24x14 box with the flat line at y=9.
 *
 * Drawn rather than named, because the shape IS the name for anyone who has
 * used an EQ: a bell, a step up at one end, a spike down. The word beside it
 * is for everyone else.
 */
const SHAPES: Record<string, string> = {
  [FilterTypeEnum.PK]: 'M1 9 H7 C9.5 9 9.5 2 12 2 C14.5 2 14.5 9 17 9 H23',
  [FilterTypeEnum.LSC]: 'M1 3 H7 C9.5 3 9.5 9 12 9 H23',
  [FilterTypeEnum.HSC]: 'M1 9 H12 C14.5 9 14.5 3 17 3 H23',
  [FilterTypeEnum.NO]: 'M1 4 H10.5 L12 13 L13.5 4 H23',
  [FilterTypeEnum.LPQ]: 'M1 4 H12 C15 4 16 12 19 12.5 L23 13',
  [FilterTypeEnum.HPQ]: 'M1 13 L5 12.5 C8 12 9 4 12 4 H23',
  [FilterTypeEnum.BP]: 'M1 13 H7 C9.5 13 9.5 3 12 3 C14.5 3 14.5 13 17 13 H23',
};

interface IDspFilterShapeIconProps {
  type: string;
}

const DspFilterShapeIcon = ({ type }: IDspFilterShapeIconProps) => (
  <svg
    className="dsp-shape-icon"
    viewBox="0 0 24 14"
    width="24"
    height="14"
    aria-hidden="true"
  >
    <path d={SHAPES[type] ?? SHAPES[FilterTypeEnum.PK]} />
  </svg>
);

export default DspFilterShapeIcon;
