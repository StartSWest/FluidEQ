/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window taking a rack the core put on the output being edited — a
 * preset it picked (`main/presetPicks.ts`). The editor is the same one, so
 * the ordinary read keeps what the window holds; this takes the core's, sends
 * nothing back (the core wrote it), and keeps a song's lent rack lent.
 */
import { act, renderHook } from '@testing-library/react';
import { showOutputEditor } from '__tests__/utils/outputEditorFixture';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import {
  adoptEditedRack,
  adoptOutputDsp,
  endDspLoan,
  isDspLent,
  readDspSettings,
  useDspSettings,
} from 'renderer/dsp/store';
import { sendSystemDspChain } from 'renderer/dsp/systemChain';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));

const preset = (id: string) => {
  const settings = dspPresetSettings(id, DSP_DEFAULTS);
  if (!settings) {
    throw new Error(`${id} missing`);
  }
  return settings;
};
const MUSIC = preset('music');
const GAMING = preset('gaming');

let generation = 10;
/** The window on an editor of its own, holding Music, with nothing sent yet. */
const editing = () => {
  generation += 1;
  const snapshot = showOutputEditor(undefined, undefined, generation);
  adoptOutputDsp({ ...snapshot, dsp: MUSIC });
  jest.mocked(sendSystemDspChain).mockClear();
  return snapshot;
};

it('keeps the window’s rack on a read of the same editor, and takes the core’s pick when told to', () => {
  const snapshot = editing();
  // The control: an ordinary read of the same editor keeps what is held.
  adoptOutputDsp({ ...snapshot, dsp: GAMING });
  expect(readDspSettings()).toEqual(MUSIC);

  // What shows the rack is told, not only what reads it next.
  const shown = renderHook(() => useDspSettings());
  act(() => adoptEditedRack({ ...snapshot, dsp: GAMING }));
  expect(shown.result.current).toEqual(GAMING);
  expect(readDspSettings()).toEqual(GAMING);
  expect(isDspLent()).toBe(false);
  // Written by the core already.
  expect(sendSystemDspChain).not.toHaveBeenCalled();
});

it('keeps a song’s lent rack lent, with the listener’s own kept to come back', () => {
  const snapshot = editing();
  adoptEditedRack({ ...snapshot, dsp: GAMING, ownedDsp: MUSIC });
  expect(readDspSettings()).toEqual(GAMING);
  expect(isDspLent()).toBe(true);

  endDspLoan(true);
  expect(readDspSettings()).toEqual(MUSIC);
});

it('takes nothing without an editor to take it for', () => {
  const snapshot = editing();
  adoptEditedRack({ ...snapshot, outputEditor: undefined, dsp: GAMING });
  expect(readDspSettings()).toEqual(MUSIC);
});
