/* FluidEQ — GPL-3.0-or-later */
import {
  copySourceAnalysisUpdate,
  SOURCE_ANALYSIS_CHANNEL,
  type ISourceAnalysisUpdate,
} from '../../common/dsp/sourceAnalysis';
import type { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { sendRequest, simpleResponseHandler } from '../utils/ipcRequest';
import { readRackGate } from './rackPlacement';

interface IInputSourceAnalysis {
  trackId?: string;
  status?: 'idle' | 'analyzing' | 'ready' | 'unavailable';
  analysis?: ILibraryNormalizationAnalysis;
}

let latest: ISourceAnalysisUpdate = {
  version: 1,
  epoch: Date.now(),
  libraryAudible: false,
};
let key = '';
let preparing = false;
let generation = 0;
let nativeOwns = false;

const request = (action: string, update?: ISourceAnalysisUpdate) =>
  sendRequest<boolean>(
    SOURCE_ANALYSIS_CHANNEL,
    [action, update],
    simpleResponseHandler<boolean>(),
  );

const publish = (): void => {
  const nextKey = JSON.stringify(latest);
  if (key === nextKey) {
    return;
  }
  key = nextKey;
  request('publish', latest)
    .then((accepted) => {
      if (!accepted && key === nextKey) {
        key = '';
      }
      return accepted;
    })
    .catch(() => {
      if (key === nextKey) {
        key = '';
      }
    });
};

/** Called by the input-analysis setter, including a late floor rescan. */
export const publishDspSourceAnalysis = (input: IInputSourceAnalysis): void => {
  const next = copySourceAnalysisUpdate({
    ...latest,
    trackId: input.trackId,
    // A background edge scan can announce progress without repeating the
    // accepted level. Its progress must not turn normalization off mid-song.
    analysis:
      input.analysis ??
      (input.status === 'analyzing' && input.trackId === latest.trackId
        ? latest.analysis
        : undefined),
    epoch: input.trackId !== latest.trackId ? latest.epoch + 1 : latest.epoch,
  });
  if (!next) {
    return;
  }
  latest = next;
  publish();
};

/** Seeks/replay need an epoch even when the track identity stays the same. */
export const markDspSourceBoundary = (trackId?: string): void => {
  // A new track identity advances its own epoch in publishDspSourceAnalysis.
  if (trackId !== undefined && trackId !== latest.trackId) {
    return;
  }
  latest = { ...latest, epoch: latest.epoch + 1 };
  publish();
};

export const setDspSourcePlayback = ({
  libraryAudible,
  sendingRawAudio,
}: {
  libraryAudible: boolean;
  sendingRawAudio?: boolean;
}): void => {
  latest = {
    ...latest,
    libraryAudible:
      preparing && !libraryAudible ? latest.libraryAudible : libraryAudible,
    sendingRawAudio: sendingRawAudio === true,
  };
  publish();
};

/** Only called while the transport is stopped, never by a status push. */
export const prepareDspSourceStart = async (
  setOwner: (native: boolean) => void,
): Promise<void> => {
  generation += 1;
  const started = generation;
  preparing = true;
  try {
    const gate = readRackGate();
    const capable =
      gate.engine === 'fluid' &&
      gate.eqLoaded &&
      !gate.engineOff &&
      !!latest.trackId &&
      (await request('capable'));
    if (started !== generation) {
      return;
    }
    if (!capable) {
      nativeOwns = false;
      latest = { ...latest, libraryAudible: true };
      const fellBack = await request('fallback', latest);
      if (started !== generation) {
        return;
      }
      if (!fellBack) {
        throw new Error('The Library player rack could not be prepared.');
      }
      setOwner(false);
      return;
    }
    latest = { ...latest, libraryAudible: true };
    // The endpoint copy is prepared while the native transport is stopped.
    setOwner(true);
    const prepared = await request('prepare', latest);
    if (started !== generation) {
      return;
    }
    nativeOwns = prepared;
    if (!nativeOwns) {
      const fellBack = await request('fallback', latest);
      if (started !== generation) {
        return;
      }
      if (!fellBack) {
        throw new Error('The Library player rack could not be prepared.');
      }
      setOwner(false);
    }
  } catch {
    if (started === generation) {
      nativeOwns = false;
      latest = { ...latest, libraryAudible: true };
      const fellBack = await request('fallback', latest);
      if (started !== generation) {
        return;
      }
      if (!fellBack) {
        throw new Error('The Library player rack could not be prepared.');
      }
      setOwner(false);
    }
  } finally {
    if (started === generation) {
      preparing = false;
    }
  }
};

export const releaseDspSourcePlayback = async (
  stopped?: Promise<unknown>,
): Promise<boolean> => {
  generation += 1;
  const released = generation;
  preparing = false;
  nativeOwns = false;
  latest = { ...latest, libraryAudible: false };
  key = '';
  await stopped;
  if (released !== generation) {
    return false;
  }
  await request('release');
  return released === generation;
};

export const nativeOwnsDspSource = (): boolean => nativeOwns;
