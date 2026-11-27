/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IResolvedLook } from 'common/customLooks';
import LookIcon from '../icons/LookIcon';
import LookStillPainter from './LookStillPainter';
import { usePlateStill, useStillPaintKey } from './lookStillPlate';
import { useStillTurn } from './lookStillStore';
import { drawnSizeOf } from './lookStills/drawnSize';
import ShippedLookStill from './lookStills/ShippedLookStill';
import { shippedStillOf } from './lookStills/shippedStill';
import { fetchShippedStills } from './lookStills/stillFetch';
import { STILL_BOX, STILL_COLOURS, STILL_SIDES } from './lookStills/stillSize';

/** Every still `look` ships with: each side of the Brightness, one colour and many. */
const everyShippedStill = (look: IResolvedLook) =>
  STILL_SIDES.flatMap((side) =>
    STILL_COLOURS.flatMap((colours) => {
      const file = shippedStillOf(look, { side, colours });
      return file ? [file] : [];
    }),
  );

/**
 * A look's picture in the graph's gallery (`GraphGallery`) - the look before
 * the one on show, that one in its credit, and the look after - as the same
 * still the look picker shows for it, never a drawn icon (Ivan, 2026-11-27:
 * "let's use the real capture here too for the standard viz, not the icons").
 * A standard look's is shipped with the app and laid in the window's colours
 * (`ShippedLookStill`); a look the member made or coloured has its still
 * painted, under the same name as the picker's (`lookStillPlate.ts`), so a
 * still either one paints serves both. Never live: the bar is chrome over
 * the look itself.
 *
 * The stills are drawn for the picker's 16:9 plate and the gallery's are
 * narrower, so the still covers its plate as a scene's picture does beside
 * it, whole from top to bottom and its middle on the plate's
 * (`.graph-gallery-still`). The icon stands only where no still can be had
 * at all, as in the picker.
 */
const GalleryLookStill = ({
  look,
  isAsleep,
}: {
  look: IResolvedLook;
  /** The bar is away with the rest of the chrome. */
  isAsleep: boolean;
}) => {
  const paintKey = useStillPaintKey();
  const {
    stillKey,
    stillWindow,
    shipped,
    still,
    picture,
    unavailable,
    arriving,
  } = usePlateStill(look, paintKey);
  // Every still of this look in memory before the window asks for it: the
  // Brightness crossing its middle, or the Tint taking a second colour, puts
  // another still on the plate in the same frame rather than a bare plate
  // while it loads (`useShippedStillReady`). The rest of the walk, in the
  // window's colours as they are, is fetched by the picker in the credit
  // (`LookPicker`), so a step finds the next look's still in already.
  useEffect(() => {
    fetchShippedStills(everyShippedStill(look));
  }, [look]);
  // Asked for once the bar has been shown with this look on it - nothing is
  // painted while nobody would see it, as nothing is asked for a scene - and
  // never withdrawn when the bar goes away: a paint takes seconds, and one
  // stopped each time the chrome rested might never finish under a pointer
  // left still.
  const [seen, setSeen] = useState(!isAsleep);
  if (!seen && !isAsleep) {
    setSeen(true);
  }
  // In line with the picker's tiles, one still painted at a time across the
  // window (`useStillTurn`). Any still kept for this look serves: the
  // picker's are drawn for plates several times the size of these.
  const { mine, done } = useStillTurn(
    seen && !shipped && still === undefined && !unavailable,
  );
  if (!shipped && !picture && unavailable) {
    return (
      <LookIcon
        className="graph-gallery-picture__glyph"
        style={look.style}
        palette={look.palette}
        colours={look.colours}
      />
    );
  }
  // Painted at the picker's usual tile, so the picker's grid finds it the
  // size it would have painted itself.
  const drawn = drawnSizeOf(look.style, STILL_BOX);
  return (
    <span className="graph-gallery-still">
      {shipped && <ShippedLookStill file={shipped} roles={stillWindow.roles} />}
      {!shipped && picture && (
        <img
          className={`look-tile-art__still${arriving ? ' is-arriving' : ''}`}
          src={picture.url}
          alt=""
          draggable={false}
        />
      )}
      {mine && (
        <span
          className="look-tile-art__stage"
          style={{ width: drawn.width, height: drawn.height }}
        >
          <LookStillPainter
            look={look}
            stillKey={stillKey}
            width={drawn.width}
            height={drawn.height}
            onDone={done}
          />
        </span>
      )}
    </span>
  );
};

export default GalleryLookStill;
