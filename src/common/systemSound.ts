/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the speakers play, from the app's core to a window, over a port the
 * window opens (`src/main/ipc/systemSoundPort.ts`). The window posts one end
 * to its preload with this channel; the preload hands it to main.
 */
export const SYSTEM_SOUND_PORT_CHANNEL = 'system-sound-port';

/**
 * `ready` once the sound is being heard; `push` for every block after it.
 * `failed` before any `ready` means it cannot be heard this way at all, and
 * the window hears it the way it always did; `lost` after one means it was
 * heard and has stopped.
 */
export type TSystemSoundMessage =
  | { kind: 'ready' }
  | { kind: 'failed' }
  | { kind: 'lost' }
  | {
      kind: 'push';
      sampleRate: number;
      channels: number;
      frames: number;
      sequence: number;
      pcm: ArrayBuffer;
    };
