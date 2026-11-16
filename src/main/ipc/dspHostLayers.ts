/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A deck's layer, as the renderer reaches it: whether the running host plays
 * layers, and a file layered on a deck or taken off it. The two gains travel
 * on the transport channel as verbs (`ipc/dspHost.ts`); what the host has to
 * do with all of it is written beside the command numbers, at `setDeckGain`
 * in `dspHost/wire.ts`.
 *
 * Its own module because `ipc/dspHost.ts` is long past the size where a
 * reader finds things, and because none of this is used by anything but the
 * Karaoke's separated songs.
 */
import { ipcMain } from 'electron';
import type { DspHostSupervisor } from '../dspHost/supervisor';

const registerDspHostLayerIpc = (
  /** The one supervisor, or undefined before the host was first asked for. */
  getSupervisor: () => DspHostSupervisor | undefined,
): void => {
  /** Whether the running host plays layers at all; asked once per process. */
  ipcMain.handle('dsp-host-layers', async (): Promise<boolean> => {
    const supervisor = getSupervisor();
    if (!supervisor || supervisor.getState() !== 'ready') {
      return false;
    }
    try {
      return await supervisor.supportsLayers();
    } catch {
      return false;
    }
  });

  /**
   * A second file on a deck, played in lockstep with it, or none (an empty
   * path). A media path like `dsp-host-load`'s, and refused by the supervisor
   * unsent unless the host has said it knows layers.
   */
  ipcMain.handle(
    'dsp-host-load-layer',
    async (_event, deck: unknown, mediaPath: unknown): Promise<boolean> => {
      const supervisor = getSupervisor();
      if (!supervisor || supervisor.getState() !== 'ready') {
        return false;
      }
      const slot = Number.isInteger(deck) ? (deck as number) : -1;
      if (slot < 0 || slot > 1 || typeof mediaPath !== 'string') {
        return false;
      }
      try {
        return await supervisor.loadLayer(slot, mediaPath || undefined);
      } catch {
        return false;
      }
    },
  );
};

export default registerDspHostLayerIpc;
