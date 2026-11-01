/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the core hears the output on the Mac: the Core Audio tap the Mac
 * helper opens for the live displays (`startMacMonitorCapture` in
 * `main/macEngine/macNetworkCapture.ts`), as the core's source. The tap is
 * handed in rather than reached for: it lives behind main's lease on the
 * helper process, and the core may not reach into main.
 *
 * One tap for everybody. The window's own Mac channel (`macMonitorIpc.ts`)
 * listens to the core's sound instead of opening a second tap of its own, so
 * the graph, the desktop backgrounds and the song memories' clock all hear the
 * same blocks.
 *
 * A tap that stops by itself is `failed`: nothing says it is the output
 * moving, and whoever still wants the sound asks again.
 */
import type { ICoreLog } from '../../coreLog';
import type {
  ISystemSoundBlock,
  ISystemSoundSource,
} from '../../systemSound/systemSound';

/** The Mac helper's tap, as main starts it. */
export type TStartMacMonitor = (
  onAudio: (block: ISystemSoundBlock) => void,
  onFailure: () => void,
) => Promise<{ close(): Promise<void> }>;

export const createMacMonitorSource = (
  startTap: TStartMacMonitor,
  log: ICoreLog,
): ISystemSoundSource => ({
  start: (handlers) => {
    let stopped = false;
    let tap: { close(): Promise<void> } | undefined;
    const end = () => {
      if (!stopped) {
        stopped = true;
        handlers.ended('failed');
      }
    };
    const audio = (block: ISystemSoundBlock) => {
      if (!stopped) {
        handlers.audio({
          sampleRate: block.sampleRate,
          channels: block.channels,
          frames: block.frames,
          sequence: block.sequence,
          pcm: block.pcm,
        });
      }
    };
    const open = async () => {
      try {
        const opened = await startTap(audio, end);
        // Stopped while it was opening: the tap goes at once.
        if (stopped) {
          await opened.close();
          return;
        }
        tap = opened;
        handlers.ready();
      } catch (error) {
        if (!stopped) {
          log.warn(
            `The Mac output tap could not open: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        end();
      }
    };
    // Every failure is handled inside; nothing is left to reject.
    open().catch(() => undefined);
    return {
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        tap?.close().catch(() => undefined);
      },
    };
  },
});
