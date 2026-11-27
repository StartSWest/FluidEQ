/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import { smartPhaseNote } from 'renderer/eq/autoEq/smartPhaseWords';
import type {
  ISmartEqPreview,
  ISmartEqPreviewRegion,
} from 'renderer/utils/smartEqPreview';

/**
 * The panel's line while Smart correction listens says what is heard: the
 * correction coming in as it forms, where it does (the FluidEQ Engine), and
 * what played before staying until the hold where it does not.
 */

const t = ((key: string) => key) as unknown as Translate;

const region = (label: string, confidence: number): ISmartEqPreviewRegion => ({
  label,
  lowFrequency: 0,
  highFrequency: 0,
  centreFrequency: 0,
  confidence,
  isCovered: confidence >= 1,
  liveDb: 0,
  typicalDb: 0,
});

const listening = (
  isHeardForming: boolean,
  regions: ISmartEqPreviewRegion[],
): ISmartEqPreview => ({
  phase: 'listening',
  heardMs: 4000,
  isSilent: false,
  regions,
  meanCoverage: 0.5,
  isHeardForming,
  missing: [],
  holdId: 0,
  departId: 0,
});

describe('the panel’s line while Smart correction listens', () => {
  it('says the correction is coming in when it is', () => {
    const heard = [region('bass', 1), region('treble', 1)];
    expect(smartPhaseNote(listening(true, heard), t)).toBe(
      'autoEq.smart.note.listeningLive',
    );
    // The control: where nothing is put on until the hold, it says so.
    expect(smartPhaseNote(listening(false, heard), t)).toBe(
      'autoEq.smart.note.listening',
    );
  });

  it('names the range it waits on either way', () => {
    const waiting = [region('bass', 1), region('treble', 0.4)];
    expect(smartPhaseNote(listening(true, waiting), t)).toBe(
      'autoEq.smart.note.waitingOnLive',
    );
    expect(smartPhaseNote(listening(false, waiting), t)).toBe(
      'autoEq.smart.note.waitingOn',
    );
  });
});
