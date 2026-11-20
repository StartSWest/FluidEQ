/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { useSmartEqPreview } from '../utils/smartEqPreview';
import {
  smartHeardSeconds,
  smartPhaseWord,
} from '../eq/autoEq/smartPhaseWords';

/**
 * What the dust is doing, said on the plot where it happens: Listening and
 * the music heard, Settling, then Held for this song, which leaves with the
 * dust (`chart-smart-chip`). The panel holds the longer story and Measure
 * again; this is the sign that a measurement is running at all, on the
 * surface where its work is drawn.
 */
const SmartEqChip = ({ left, top }: { left: number; top: number }) => {
  const { t, locale } = useTranslation();
  const preview = useSmartEqPreview();
  if (preview.phase === 'idle') {
    return null;
  }
  const heard = smartHeardSeconds(preview, t, locale);
  return (
    <div
      // Keyed by the hold, so each one plays its leaving once.
      key={preview.phase === 'held' ? `held-${preview.holdId}` : 'running'}
      className={`chart-smart-chip is-${preview.phase}${
        preview.isSilent ? ' is-silent' : ''
      }`}
      style={{ left, top }}
      aria-hidden
    >
      <span className="chart-smart-chip__dot" />
      <span className="chart-smart-chip__word">
        {smartPhaseWord(preview, t)}
      </span>
      {heard && <span className="chart-smart-chip__heard">{heard}</span>}
    </div>
  );
};

export default SmartEqChip;
