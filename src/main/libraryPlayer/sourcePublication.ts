/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library player tells the FluidEQ Engine about the song it plays:
 * which song, what it measured, whether it is heard, and when a passage
 * starts again — and the handshake, at a stopped transport, that decides
 * whether the engine or the player's own host runs the rack for it.
 *
 * The window did this while the player lived there, over a channel to the
 * publisher here in main (`main/sourceAnalysis.ts`); the player is the
 * core's now, so it speaks to the publisher directly, and a window closing
 * or reloading no longer releases a song that is still playing.
 */
import log from 'electron-log';
import type { ISourceAnalysisUpdate } from '../../common/dsp/sourceAnalysis';
import type { ILibraryNormalizationAnalysis } from '../../common/library/types';
import type { ISourceAnalysisPublisher } from '../sourceAnalysis';

export type TSourcePublisher = Pick<
  ISourceAnalysisPublisher,
  'publish' | 'capable' | 'prepare' | 'fallback' | 'release'
>;

export interface ISourcePublication {
  /**
   * The song now playing and what is known of it. A new song is a new
   * passage; the same song with its measurement arriving is not.
   */
  setSource: (
    trackId: string | undefined,
    analysis: ILibraryNormalizationAnalysis | undefined,
  ) => void;
  /** A seek or a restart: the same song, a new passage. */
  markBoundary: () => void;
  /** Whether the Library is heard, and whether this computer is sharing. */
  setPlayback: (libraryAudible: boolean, sendingRawAudio: boolean) => void;
  /**
   * Called only while the transport is stopped, never by a status push.
   * `engineRuns`: the FluidEQ Engine is the one chosen, its switch read and
   * on, and it is running on the output. Answers whether the engine took the
   * song natively; false leaves the player's host running the rack. Rejects
   * when neither could be prepared.
   */
  prepareStart: (engineRuns: boolean) => Promise<boolean>;
  /** The transport stopped: the song is no longer heard. */
  release: (stopped?: Promise<unknown>) => Promise<boolean>;
}

export const createSourcePublication = (
  publisher: TSourcePublisher,
): ISourcePublication => {
  // From the clock, so a restart of the app never repeats an epoch the
  // engine has already acknowledged.
  let latest: ISourceAnalysisUpdate = {
    version: 1,
    epoch: Date.now(),
    libraryAudible: false,
  };
  let key = '';
  let preparing = false;
  let generation = 0;

  const publish = (): void => {
    const nextKey = JSON.stringify(latest);
    if (key === nextKey) {
      return;
    }
    key = nextKey;
    publisher.publish(latest).catch((error: unknown) => {
      if (key === nextKey) {
        key = '';
      }
      log.warn('Could not publish the Library source', error);
    });
  };

  const fellBack = async (started: number): Promise<boolean> => {
    latest = { ...latest, libraryAudible: true };
    const answered = await publisher.fallback(latest);
    if (started !== generation) {
      return false;
    }
    if (!answered) {
      throw new Error('The Library player rack could not be prepared.');
    }
    return false;
  };

  return {
    setSource: (trackId, analysis) => {
      latest = {
        ...latest,
        epoch: trackId !== latest.trackId ? latest.epoch + 1 : latest.epoch,
        ...(trackId === undefined ? {} : { trackId }),
        ...(analysis === undefined ? {} : { analysis }),
      };
      if (trackId === undefined) {
        const { trackId: _gone, ...rest } = latest;
        latest = rest;
      }
      if (analysis === undefined) {
        const { analysis: _none, ...rest } = latest;
        latest = rest;
      }
      publish();
    },

    markBoundary: () => {
      latest = { ...latest, epoch: latest.epoch + 1 };
      publish();
    },

    setPlayback: (libraryAudible, sendingRawAudio) => {
      latest = {
        ...latest,
        libraryAudible:
          preparing && !libraryAudible ? latest.libraryAudible : libraryAudible,
        sendingRawAudio,
      };
      publish();
    },

    prepareStart: async (engineRuns) => {
      generation += 1;
      const started = generation;
      preparing = true;
      try {
        const capable =
          engineRuns &&
          latest.trackId !== undefined &&
          (await publisher.capable());
        if (started !== generation) {
          return false;
        }
        if (!capable) {
          return await fellBack(started);
        }
        latest = { ...latest, libraryAudible: true };
        const prepared = await publisher.prepare(latest);
        if (started !== generation) {
          return false;
        }
        return prepared || (await fellBack(started));
      } catch (error) {
        if (started !== generation) {
          return false;
        }
        log.warn(
          'Library source preparation failed; keeping the player rack.',
          error,
        );
        return fellBack(started);
      } finally {
        if (started === generation) {
          preparing = false;
        }
      }
    },

    release: async (stopped) => {
      generation += 1;
      const released = generation;
      preparing = false;
      latest = { ...latest, libraryAudible: false };
      key = '';
      await stopped;
      if (released !== generation) {
        return false;
      }
      await publisher.release();
      return released === generation;
    },
  };
};
