/* FluidEQ — GPL-3.0-or-later */
import { useEffect, useRef, useState } from 'react';
import type { ICaptureGraph } from '../graph/useLiveOutputSpectrum';
import {
  createSteadyReadout,
  type ISteadyReadout,
} from '../remoteAudio/steadyReadout';
import {
  startOutputMirror,
  MAX_MIRROR_VOLUME,
  type IOutputMirror,
} from './outputMirror';

export interface IDesiredMirror {
  guid: string;
  sinkId: string;
}
interface IRunningMirror extends IDesiredMirror {
  mirror: IOutputMirror;
}
const same = (a: IDesiredMirror, b: IDesiredMirror) => a.sinkId === b.sinkId;

/** The running mirrors, and how far behind each plays — an average that
 * moves only when the delay really does (`steadyReadout.ts`), so the panel
 * redraws a few times a minute, not with every report. */
export interface IMirrorPlayback {
  runningGuids: string[];
  /** Milliseconds, by endpoint GUID; absent until the first report. */
  delays: Readonly<Record<string, number>>;
}

/** Starts belong to one capture/device generation. Late promises can only
 * dispose themselves; they cannot resurrect a mirror after a switch/unmount. */
export const useMirrorPlayback = (
  desired: IDesiredMirror[],
  volumes: Record<string, number>,
  capture: ICaptureGraph | undefined,
  native: boolean,
  sourceGuid: string | undefined,
  onError: (error: unknown) => void,
): IMirrorPlayback => {
  const [runningGuids, setRunningGuids] = useState<string[]>([]);
  const [delays, setDelays] = useState<Readonly<Record<string, number>>>({});
  const readouts = useRef(new Map<string, ISteadyReadout>());
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
    readouts.current.clear();
    setRunningGuids([]);
    setDelays({});
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
      // A mirror that stopped has no delay to show, and the next one on the
      // same output starts its average afresh.
      [...readouts.current.keys()].forEach((guid) => {
        if (!running.current.has(guid) && !pending.current.has(guid)) {
          readouts.current.delete(guid);
        }
      });
      setDelays((previous) =>
        Object.keys(previous).every((guid) => running.current.has(guid))
          ? previous
          : Object.fromEntries(
              Object.entries(previous).filter(([guid]) =>
                running.current.has(guid),
              ),
            ),
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
        volume: current.current.volumes[wanted.guid] ?? MAX_MIRROR_VOLUME,
        onFailure: () =>
          reportFailure(new Error('Second output playback stopped.')),
        onDelay: (milliseconds) => {
          if (generation.current !== epoch || token.controller.signal.aborted) {
            return;
          }
          let readout = readouts.current.get(wanted.guid);
          if (!readout) {
            readout = createSteadyReadout();
            readouts.current.set(wanted.guid, readout);
          }
          const shown = readout.next(milliseconds, performance.now());
          if (shown !== undefined) {
            setDelays((previous) => ({ ...previous, [wanted.guid]: shown }));
          }
        },
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
            // A change of output may have arrived while the previous start was
            // in flight. Settling that promise, rather than a timer, retries
            // it.
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
  return { runningGuids, delays };
};
