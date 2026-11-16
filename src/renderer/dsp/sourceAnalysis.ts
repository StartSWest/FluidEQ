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

/**
 * What the output is told about the Library's sound.
 *
 * `epoch` names a passage of continuous sound, not a song: it moves only when
 * the source becomes another player's (`setDspSourceClient`). It used to
 * move at every new song and every seek, and the engine starts the graph of
 * a new source empty — no filter history, no audio in its delay lines, no
 * limiter or level state (`adopt_state`, `feq_chain_transfer_state`). The
 * file landed while the music went on, in the middle of a crossfade's
 * handoff or right after a seek, so 1589 frames of silence (33 ms at
 * 48 kHz) and a cold limiter were heard there: the sound "se calla" (Ivan,
 * 2026-11-16). With the epoch kept, a new song's level and floor reach the
 * engine as an edit of the same passage — its state carried and its gains
 * gliding from the last song's — as they did in the Library host's own
 * chain.
 */
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

/**
 * The Library's own record while the Karaoke holds the host (`hostLease.ts`),
 * or undefined while the Library does.
 *
 * What is published names the Library's track and carries its measured level
 * and noise floor, and the engine is told whose sound that is. Left in place
 * under a karaoke song, preparing the Karaoke's start would hand the endpoint
 * the Library track's analysis — Denoise subtracting another record's hiss,
 * the leveller aiming at another record's loudness. The Karaoke has no
 * analysis of that kind, so while it plays the source names no track, and
 * `prepareDspSourceStart` keeps the rack in the player's host, as it does for
 * any source it cannot vouch for. The Library's record waits here and comes
 * back whole, kept current by anything its analysis says in the meantime.
 */
let libraryRecord: ISourceAnalysisUpdate | undefined;

/** Which player's sound the source describes. See `libraryRecord`. */
export const setDspSourceClient = (client: 'library' | 'karaoke'): void => {
  if (client === 'karaoke') {
    if (libraryRecord !== undefined) {
      return;
    }
    libraryRecord = latest;
    latest = {
      ...latest,
      trackId: undefined,
      analysis: undefined,
      epoch: latest.epoch + 1,
    };
    publish();
    return;
  }
  if (libraryRecord === undefined) {
    return;
  }
  latest = {
    ...libraryRecord,
    // Where playback stands now, not where it stood when the Karaoke came.
    libraryAudible: latest.libraryAudible,
    sendingRawAudio: latest.sendingRawAudio,
    epoch: latest.epoch + 1,
  };
  libraryRecord = undefined;
  publish();
};

/** Called by the input-analysis setter, including a late floor rescan. */
export const publishDspSourceAnalysis = (input: IInputSourceAnalysis): void => {
  if (libraryRecord !== undefined) {
    // The Library's analysis, while the Karaoke's sound is the source: kept
    // for the Library's return, never published under the karaoke song.
    const kept = copySourceAnalysisUpdate({
      ...libraryRecord,
      trackId: input.trackId,
      analysis:
        input.analysis ??
        (input.status === 'analyzing' && input.trackId === libraryRecord.trackId
          ? libraryRecord.analysis
          : undefined),
    });
    if (kept) {
      libraryRecord = kept;
    }
    return;
  }
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
  });
  if (!next) {
    return;
  }
  latest = next;
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
