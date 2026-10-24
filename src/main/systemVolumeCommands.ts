/* FluidEQ — GPL-3.0-or-later */
import { randomUUID } from 'crypto';
import {
  parseSystemVolumeLine,
  type ISystemVolume,
} from '../common/systemVolume';

interface ICommand {
  kind: 'set' | 'mute';
  line: string;
  requestId?: string;
}

/** One OS write in flight. Drag events coalesce to the newest queued value,
 * and only the helper's applied response releases the next write. Native
 * notifications never feed older drag positions back into the window.
 * Old helpers keep their original protocol; acknowledgments are negotiated. */
const createSystemVolumeCommands = (
  write: (line: string) => void,
  deliver: (volume: ISystemVolume | null) => void,
) => {
  let supportsApplied = false;
  let sessionId = randomUUID();
  let deviceId: string | undefined;
  let active: ICommand | undefined;
  let abandoned = false;
  let queued: ICommand[] = [];
  const next = () => {
    if (active) {
      return;
    }
    active = queued.shift();
    if (active) {
      write(active.line);
    }
  };
  return {
    reset() {
      supportsApplied = false;
      sessionId = randomUUID();
      deviceId = undefined;
      active = undefined;
      abandoned = false;
      queued = [];
    },
    enqueue(command: ICommand) {
      if (!supportsApplied) {
        write(command.line);
        return;
      }
      queued = [
        ...queued.filter((item) => item.kind !== command.kind),
        command,
      ];
      next();
    },
    accept(line: string): boolean {
      if (line === 'ready\t2') {
        supportsApplied = true;
        return true;
      }
      const applied = line.startsWith('applied\t');
      const volume = parseSystemVolumeLine(
        applied ? `volume\t${line.slice(8)}` : line,
      );
      if (volume === undefined) {
        return false;
      }
      if (volume === null) {
        active = undefined;
        abandoned = false;
        queued = [];
        deviceId = undefined;
        sessionId = randomUUID();
        deliver(null);
        return true;
      }
      let deviceChanged = false;
      if (volume.deviceId !== undefined && volume.deviceId !== deviceId) {
        // A drag belongs to the output it began on. A new native identity
        // drops its queued writes and releases the renderer's optimistic
        // value immediately, even while the old command was in flight.
        if (deviceId !== undefined) {
          // Drain the old write's acknowledgment before issuing a new one;
          // otherwise it could accidentally acknowledge the new output's drag.
          abandoned = active !== undefined;
          queued = [];
          sessionId = randomUUID();
          deviceChanged = true;
        }
        deviceId = volume.deviceId;
      }
      if (!supportsApplied) {
        deliver(volume);
        return true;
      }
      if (applied) {
        const requestId = abandoned ? undefined : active?.requestId;
        active = undefined;
        abandoned = false;
        deliver({
          ...volume,
          canAcknowledge: true,
          sessionId,
          ...(requestId ? { appliedRequestId: requestId } : {}),
        });
        next();
      } else if (deviceChanged || (!active && queued.length === 0)) {
        deliver({ ...volume, canAcknowledge: true, sessionId });
      }
      return true;
    },
  };
};
export default createSystemVolumeCommands;
