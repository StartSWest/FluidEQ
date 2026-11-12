/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AUTHOR_NAME } from '../../../common/branding';
import EditionsVisual from './EditionsVisual';
import ShowcaseSlide from './ShowcaseSlide';
import type { ISlideActions } from './slides';

/**
 * 2.5's news for everybody, first in the sound's What's New: FluidEQ in two
 * editions. The free one stays complete and stops updating itself; the
 * signed one is the same app, paid once, and keeps updating itself. Its
 * button opens the Account panel, where the offer, the owner's download and
 * linking by a code are.
 *
 * No price anywhere: it is the server's launch price and changes without a
 * release. The publisher is the developer's own name, the one on the signed
 * build's certificate, never the business the edition is sold through.
 */
export default function EditionsSlide({ actions }: { actions: ISlideActions }) {
  return (
    <ShowcaseSlide
      prefix="tour.editions"
      onOpen={actions.openAccount}
      visual={<EditionsVisual />}
      values={{ publisher: AUTHOR_NAME }}
    />
  );
}
