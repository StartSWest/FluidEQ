/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  filterVisibleAudioDevices,
  parseDeviceJson,
} from '../../main/audioDevices';
import { IAudioDevice } from '../../common/constants';

jest.mock('electron-log', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const device = (over: Partial<IAudioDevice>): IAudioDevice => ({
  id: 'id',
  name: 'Speakers',
  guid: '{GUID}',
  isDefault: false,
  isActive: true,
  isEqualizerApoAttached: false,
  ...over,
});

/**
 * The output of a PowerShell script, read as data rather than trusted as JSON.
 *
 * This used to be `JSON.parse(stdout.trim() || '[]')` with no `catch`. The
 * guard covered an empty run and nothing else — and PowerShell writes progress
 * records, deprecation notices and module-load warnings onto the same stream it
 * is asked for JSON on. One such line ahead of the payload made the whole
 * output unparseable, and the throw travelled up through the IPC handler, so a
 * machine whose devices were perfectly readable got an error instead of a list.
 */
describe('reading what the device script printed', () => {
  it('reads a normal array of devices', () => {
    const parsed = parseDeviceJson(
      JSON.stringify([{ id: 'a', name: 'Speakers' }]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('a');
  });

  /**
   * `ConvertTo-Json` emits a bare object rather than a one-element array when
   * there is exactly one of something. That is the behaviour, not a bug, and it
   * is the reason the wrap exists — a machine with one output would otherwise
   * show none.
   */
  it('wraps the single object a one-endpoint machine produces', () => {
    const parsed = parseDeviceJson(JSON.stringify({ id: 'only', name: 'DAC' }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('only');
  });

  it('gives back nothing for empty output', () => {
    expect(parseDeviceJson('')).toEqual([]);
    expect(parseDeviceJson('   \r\n  ')).toEqual([]);
  });

  it('gives back nothing rather than throwing on output that is not JSON', () => {
    expect(parseDeviceJson('WARNING: module took a while to load')).toEqual([]);
  });

  /**
   * The case the old guard actually let through: valid JSON with a warning
   * line in front of it. `trim()` does not remove it and `|| '[]'` never
   * applies, so `JSON.parse` threw.
   */
  it('gives back nothing when a warning precedes valid JSON', () => {
    expect(
      parseDeviceJson('WARNING: something\n[{"id":"a","name":"Speakers"}]'),
    ).toEqual([]);
  });

  it('gives back nothing for JSON that is not an object', () => {
    // `null` parses fine and is not a device, which is the one a bare
    // `typeof x === 'object'` check gets wrong.
    expect(parseDeviceJson('null')).toEqual([]);
    expect(parseDeviceJson('42')).toEqual([]);
    expect(parseDeviceJson('"a string"')).toEqual([]);
  });
});

describe('deciding which outputs to show', () => {
  it('hides an endpoint Windows reports as inactive', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'on', name: 'Speakers' }),
      device({ id: 'off', name: 'Unplugged', isActive: false }),
    ]);
    expect(visible.map((one) => one.id)).toEqual(['on']);
  });

  it('hides an endpoint with no usable name', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'named', name: 'Speakers' }),
      device({ id: 'blank', name: '   ' }),
    ]);
    expect(visible.map((one) => one.id)).toEqual(['named']);
  });

  /**
   * Windows commonly reports the same output under one name several times —
   * once per endpoint the driver exposes. Showing all of them puts three
   * identical rows in the picker, and the one the user needs is whichever is
   * the default.
   */
  it('keeps one row per name, preferring the default', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'dup', name: 'Speakers' }),
      device({ id: 'real', name: 'Speakers', isDefault: true }),
    ]);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('real');
  });

  it('treats names differing only in case as the same output', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'lower', name: 'speakers' }),
      device({ id: 'upper', name: 'SPEAKERS' }),
    ]);
    expect(visible).toHaveLength(1);
  });

  it('trims the name it shows', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'padded', name: '  Speakers  ' }),
    ]);
    expect(visible[0].name).toBe('Speakers');
  });

  it('sorts by name so the list does not reshuffle between reads', () => {
    const visible = filterVisibleAudioDevices([
      device({ id: 'c', name: 'Zeta' }),
      device({ id: 'a', name: 'Alpha' }),
      device({ id: 'b', name: 'Mid' }),
    ]);
    expect(visible.map((one) => one.name)).toEqual(['Alpha', 'Mid', 'Zeta']);
  });

  it('has nothing to show for nothing', () => {
    expect(filterVisibleAudioDevices([])).toEqual([]);
  });
});
