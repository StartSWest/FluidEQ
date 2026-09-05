/* FluidEQ — GPL-3.0-or-later */
import { useEffect, useRef, useState } from 'react';
import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import {
  startOutputMirror,
  MAX_MIRROR_VOLUME,
  type IOutputMirror,
  type TMirrorMode,
} from './outputMirror';

export interface IDesiredMirror {
  guid: string;
  sinkId: string;
  mode: TMirrorMode;
}
interface IRunningMirror extends IDesiredMirror {
  mirror: IOutputMirror;
}
const same = (a: IDesiredMirror, b: IDesiredMirror) =>
  a.sinkId === b.sinkId && a.mode === b.mode;

/** Starts belong to one capture/device generation. Late promises can only
 * dispose themselves; they cannot resurrect a mirror after a switch/unmount. */
export const useMirrorPlayback = (
  desired: IDesiredMirror[],
  volumes: Record<string, number>,
  capture: ICaptureGraph | undefined,
  native: boolean,
  sourceGuid: string | undefined,
  onError: (error: unknown) => void,
) => {
  const [runningGuids, setRunningGuids] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const running = useRef(new Map<string, IRunningMirror>());
  const pending = useRef(
    new Map<string, { wanted: IDesiredMirror; controller: AbortController }>(),
  );
  const failures = useRef(new Map<string, IDesiredMirror>());
  const generation = useRef(0);
  const current = useRef({ desired, volumes, onError });
  current.current = { desired, volumes, onError };

  useEffect(() => {
    const started = running.current;
    const starting = pending.current;
    generation.current += 1;
    failures.current.clear();
    setRunningGuids([]);
    return () => {
      generation.current += 1;
      started.forEach((entry) => entry.mirror.stop());
      started.clear();
      starting.forEach((entry) => entry.controller.abort());
      starting.clear();
    };
  }, [capture, native, sourceGuid]);

  useEffect(() => {
    const epoch = generation.current;
    const publish = () => {
      const next = [...running.current.keys()];
      setRunningGuids((previous) =>
        previous.length === next.length &&
        previous.every((guid, i) => guid === next[i])
          ? previous
          : next,
      );
    };
    running.current.forEach((entry, guid) => {
      const wanted = desired.find((candidate) => candidate.guid === guid);
      if (!wanted || !same(entry, wanted)) {
        entry.mirror.stop();
        running.current.delete(guid);
      }
    });
    failures.current.forEach((entry, guid) => {
      const wanted = desired.find((candidate) => candidate.guid === guid);
      if (!wanted || !same(entry, wanted)) {
        failures.current.delete(guid);
      }
    });
    pending.current.forEach((entry, guid) => {
      const wanted = desired.find((candidate) => candidate.guid === guid);
      if (!wanted || !same(entry.wanted, wanted)) {
        entry.controller.abort();
      }
    });
    if ((!native && !capture) || !sourceGuid) {
      publish();
      return;
    }
    desired.forEach((wanted) => {
      if (
        running.current.has(wanted.guid) ||
        pending.current.has(wanted.guid) ||
        failures.current.has(wanted.guid)
      ) {
        return;
      }
      const token = { wanted, controller: new AbortController() };
      pending.current.set(wanted.guid, token);
      let failed = false;
      const reportFailure = (error: unknown) => {
        failed = true;
        if (generation.current !== epoch || token.controller.signal.aborted) {
          return;
        }
        failures.current.set(wanted.guid, wanted);
        running.current.get(wanted.guid)?.mirror.stop();
        running.current.delete(wanted.guid);
        current.current.onError(error);
        publish();
      };
      startOutputMirror({
        capture,
        signal: token.controller.signal,
        guid: native ? wanted.guid : undefined,
        sinkId: wanted.sinkId,
        mode: wanted.mode,
        volume: current.current.volumes[wanted.guid] ?? MAX_MIRROR_VOLUME,
        onFailure: () =>
          reportFailure(new Error('Second output playback stopped.')),
      })
        .then((mirror) => {
          const latest = current.current.desired.find(
            (candidate) => candidate.guid === wanted.guid,
          );
          if (
            generation.current !== epoch ||
            token.controller.signal.aborted ||
            !latest ||
            !same(wanted, latest) ||
            failed
          ) {
            mirror.stop();
            return undefined;
          }
          mirror.setVolume(
            current.current.volumes[wanted.guid] ?? MAX_MIRROR_VOLUME,
          );
          running.current.set(wanted.guid, { ...wanted, mirror });
          publish();
          return undefined;
        })
        .catch(reportFailure)
        .finally(() => {
          if (pending.current.get(wanted.guid) === token) {
            pending.current.delete(wanted.guid);
            // A mode change may have arrived while the previous start was in
            // flight. Settling that promise, rather than a timer, retries it.
            if (generation.current === epoch) {
              setRevision((value) => value + 1);
            }
          }
        });
    });
    publish();
  }, [capture, desired, native, revision, sourceGuid]);

  useEffect(() => {
    running.current.forEach((entry, guid) =>
      entry.mirror.setVolume(volumes[guid] ?? MAX_MIRROR_VOLUME),
    );
  }, [runningGuids, volumes]);
  return runningGuids;
};
