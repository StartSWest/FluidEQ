/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { forwardRef, type CSSProperties } from 'react';
import type { IShippedStillFile } from './shippedStill';
import { useShippedStillReady } from './stillFetch';
import { STILL_GAP, STILL_PIXELS } from './stillSize';

/**
 * Where layer `index` of `count` sits in its picture, as the background's or
 * mask's size and position: the layers are stacked top to bottom,
 * `STILL_GAP` clear rows apart (`scripts/look-stills/generate.ts`), and the
 * plate shows one of them whole.
 */
const layerPlacement = (index: number, count: number) => {
  const { height } = STILL_PIXELS;
  const gap = STILL_GAP;
  const total = count * height + (count - 1) * gap;
  const travel = total - height;
  return {
    size: `100% ${(total / height) * 100}%`,
    position: `0 ${travel > 0 ? ((index * (height + gap)) / travel) * 100 : 0}%`,
  };
};

/**
 * A standard look's shipped still on its plate (`stillRoles.ts`): what the
 * look draws in fixed inks, then each of the window's colours laid through
 * its mask and added on, inside a group of their own so the sum lands on the
 * plate as one picture. Painted with the page, from pictures already in
 * memory (`fetchShippedStills`), so it is there in the picker's first frame,
 * and it follows the window's colours without being drawn again.
 */
const ShippedLookStill = forwardRef<
  HTMLSpanElement,
  { file: IShippedStillFile; roles: Readonly<Record<string, string>> }
>(({ file, roles }, ref) => {
  const ready = useShippedStillReady(file.url);
  const count = file.roles.length + 1;
  const url = `url("${file.url}")`;
  const rest = layerPlacement(0, count);
  return (
    <span ref={ref} className="look-tile-art__still look-still" aria-hidden>
      {ready && (
        <span
          className="look-still__layer"
          style={{
            backgroundImage: url,
            backgroundSize: rest.size,
            backgroundPosition: rest.position,
          }}
        />
      )}
      {ready &&
        file.roles.map((role, index) => {
          const placed = layerPlacement(index + 1, count);
          const style: CSSProperties = {
            backgroundColor: roles[role] ?? 'transparent',
            maskImage: url,
            maskSize: placed.size,
            maskPosition: placed.position,
          };
          // A role whose light adds past one is laid on again: a key a layer.
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key -- the layers are fixed for the picture, never reordered
              key={`${role}-${index}`}
              className="look-still__layer look-still__layer--colour"
              style={style}
            />
          );
        })}
    </span>
  );
});

ShippedLookStill.displayName = 'ShippedLookStill';

export default ShippedLookStill;
