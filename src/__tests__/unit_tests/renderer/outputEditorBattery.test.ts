/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A headset's battery is read again every few seconds and rides on its
 * device record. Compared whole, every percent it lost told the rack store
 * and the song memory that a new output was being edited.
 */
import type { IAudioDevice } from 'common/constants';
import type { IEqualizerSnapshot } from 'common/outputSettings';
import {
  readOutputEditor,
  updateOutputEditor,
} from 'renderer/utils/outputEditor';

const headset = (batteryPercent: number, generation = 1) => {
  const device: IAudioDevice = {
    id: 'headset',
    name: 'Headset',
    guid: '{0000-headset}',
    isDefault: true,
    isActive: true,
    batteryPercent,
  };
  return {
    outputEditor: { device, generation },
    playbackOutput: device,
  } as IEqualizerSnapshot;
};

const changes = () => {
  const heard = jest.fn();
  window.addEventListener('fluideq-editor-changed', heard);
  return {
    heard,
    stop: () => window.removeEventListener('fluideq-editor-changed', heard),
  };
};

it('hears nothing new when only a battery level moved', () => {
  updateOutputEditor(headset(80));
  const { heard, stop } = changes();
  updateOutputEditor(headset(79));
  updateOutputEditor(headset(78));
  stop();
  expect(heard).not.toHaveBeenCalled();
});

it('hears a new edit of the same output (positive control)', () => {
  updateOutputEditor(headset(80, 1));
  const { heard, stop } = changes();
  updateOutputEditor(headset(80, 2));
  stop();
  expect(heard).toHaveBeenCalledTimes(1);
  expect(readOutputEditor().editor?.generation).toBe(2);
});
