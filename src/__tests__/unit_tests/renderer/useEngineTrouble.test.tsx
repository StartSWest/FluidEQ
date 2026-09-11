/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the window asks whether the FluidEQ Engine is failing: at the moment
 * the live capture starts hearing sound, and of the disk rather than of a
 * copy that could still be on its way — the engine writes its status before
 * Windows lets any audio through, so a read after the sound is the truth.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { IFluidEngineEndpoint } from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import type { IEngineHealth } from 'common/engineHealth';
import { useLiveAudioControl } from 'renderer/audio/LiveAudioContext';
import {
  OUTPUT_SIGNAL_EVENT,
  announceOutputSignal,
  createSignalEdge,
} from 'renderer/audio/outputSignal';
import useEngineTrouble from 'renderer/audio/useEngineTrouble';
import { getAudioDevices } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAudioDevices: jest.fn(),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: jest.fn(),
}));

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  isFluidEngineAttached: true,
  canHostEffects: true,
};

const endpoints: IFluidEngineEndpoint[] = [
  { guid: '{AAAA}', attached: true, backupExists: true },
];

const locked: IEngineHealth = {
  outputs: [
    {
      endpoint: '{AAAA}',
      locked: true,
      processing: true,
      owner: true,
      problems: [],
    },
  ],
};
const nothing: IEngineHealth = { outputs: [] };

/** A stand-in for an AudioContext: only its identity is ever used. */
const fakeContext = () => ({}) as AudioContext;

let onDisk: IEngineHealth;
let pushed: ((health: IEngineHealth) => void) | undefined;
let reads: number;
// When set, the next read pushes at once and holds its reply until released.
let heldReply: Promise<void> | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  onDisk = nothing;
  pushed = undefined;
  reads = 0;
  heldReply = undefined;
  (getAudioDevices as jest.Mock).mockResolvedValue([speakers]);
  window.electron = {
    ipcRenderer: {
      // As main does it: the push for a change goes out before the reply.
      getEngineHealth: jest.fn(async () => {
        reads += 1;
        pushed?.(onDisk);
        const hold = heldReply;
        heldReply = undefined;
        await hold;
        return onDisk;
      }),
      onEngineHealth: (listener: (health: IEngineHealth) => void) => {
        pushed = listener;
        return () => {
          pushed = undefined;
        };
      },
    },
  } as unknown as typeof window.electron;
});

const withCapture = (context: AudioContext | undefined) =>
  (useLiveAudioControl as jest.Mock).mockReturnValue({
    capture: context ? { context, source: {} } : undefined,
  });

const hear = async (context: AudioContext) => {
  await act(async () => {
    announceOutputSignal(context);
  });
};

describe('createSignalEdge', () => {
  it('fires where sound begins, once per stretch of it', () => {
    const isEdge = createSignalEdge();
    // Sound in the first frame, a stretch of it, a gap, and sound again.
    const frames = [true, true, true, false, false, true, true];
    expect(frames.map(isEdge)).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it('says nothing about silence, however long', () => {
    const isEdge = createSignalEdge();
    expect([false, false, false].map(isEdge)).toEqual([false, false, false]);
  });
});

describe('useEngineTrouble', () => {
  it('says nothing about an output that is not playing, running or not', async () => {
    withCapture(fakeContext());
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));
    await waitFor(() => expect(reads).toBe(1));
    expect(result.current).toBeUndefined();
  });

  it('asks the disk again when sound starts, and says the engine is off', async () => {
    const context = fakeContext();
    withCapture(context);
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));
    await waitFor(() => expect(reads).toBe(1));

    await hear(context);

    await waitFor(() => expect(result.current?.kind).toBe('off'));
    expect(reads).toBe(2);
  });

  it('believes the read made after the sound, not what it held before', async () => {
    // What the window was told at start says "not running"; the engine
    // locked since, and wrote so before the sound could reach the capture.
    const context = fakeContext();
    withCapture(context);
    const seen: (string | undefined)[] = [];
    const { result } = renderHook(() => {
      const trouble = useEngineTrouble('fluid', endpoints);
      seen.push(trouble?.kind);
      return trouble;
    });
    await waitFor(() => expect(reads).toBe(1));

    // The read's reply is held back, so the moment the sound is taken in can
    // be waited for rather than guessed at.
    let release: () => void = () => undefined;
    heldReply = new Promise<void>((resolve) => {
      release = resolve;
    });
    onDisk = locked;
    await hear(context);
    await waitFor(() => expect(reads).toBe(2));
    const rendersBefore = seen.length;
    await act(async () => release());
    await waitFor(() => expect(seen.length).toBeGreaterThan(rendersBefore));

    expect(result.current).toBeUndefined();
    expect(seen).not.toContain('off');
    // Positive control: the same sound, and then the engine letting go of
    // the output — which reads as "off" only because the sound was taken in.
    act(() => pushed?.(nothing));
    expect(result.current?.kind).toBe('off');
  });

  it('lists no devices when sound starts', async () => {
    // Music with gaps starts sound over and over, and a device listing is a
    // PowerShell: sound starting costs one read of the disk and nothing else.
    const context = fakeContext();
    withCapture(context);
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));
    await waitFor(() => expect(reads).toBe(1));
    await hear(context);
    await waitFor(() => expect(result.current?.kind).toBe('off'));
    const listings = (getAudioDevices as jest.Mock).mock.calls.length;

    await hear(context);
    await hear(context);
    await waitFor(() => expect(reads).toBe(4));

    expect((getAudioDevices as jest.Mock).mock.calls.length).toBe(listings);
  });

  it('takes the notice down when the engine comes back', async () => {
    const context = fakeContext();
    withCapture(context);
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));
    await hear(context);
    await waitFor(() => expect(result.current?.kind).toBe('off'));

    act(() => pushed?.(locked));

    expect(result.current).toBeUndefined();
  });

  it('forgets what was heard when a new capture starts', async () => {
    const first = fakeContext();
    withCapture(first);
    const { result, rerender } = renderHook(() =>
      useEngineTrouble('fluid', endpoints),
    );
    await hear(first);
    await waitFor(() => expect(result.current?.kind).toBe('off'));

    // A capture restarting is bound to whatever the output is now, and has
    // heard nothing on it yet.
    withCapture(fakeContext());
    rerender();

    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it('counts sound heard before the capture was recorded as started', async () => {
    // The capture's first frames can beat the effect that records it.
    withCapture(undefined);
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));

    await hear(fakeContext());

    await waitFor(() => expect(result.current?.kind).toBe('off'));
  });

  it('ignores an event that names no capture', async () => {
    withCapture(fakeContext());
    const { result } = renderHook(() => useEngineTrouble('fluid', endpoints));
    await waitFor(() => expect(reads).toBe(1));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OUTPUT_SIGNAL_EVENT));
    });

    expect(reads).toBe(1);
    expect(result.current).toBeUndefined();
  });

  it('asks nothing at all under Equalizer APO', async () => {
    const context = fakeContext();
    withCapture(context);
    const { result } = renderHook(() => useEngineTrouble('apo', endpoints));

    await hear(context);

    expect(reads).toBe(0);
    expect(getAudioDevices).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });
});
