/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildKaraokeScoreSheet,
  type IKaraokeNoteResult,
  type IKaraokeScoreSheet,
  type TKaraokeVerdict,
} from '../../common/karaoke/scoring';
import {
  createKaraokeScoreRun,
  finishKaraokeScore,
  type IKaraokeScoreRun,
  seekKaraokeScore,
  stepKaraokeScore,
} from '../../common/karaoke/scoringRun';
import {
  type IKaraokeRunSummary,
  karaokeLineDeltas,
  karaokeProgress,
  karaokeRunDeservesSummary,
  summarizeKaraokeRun,
  type TKaraokeProgress,
} from '../../common/karaoke/scoringSummary';
import {
  type IKaraokeSong,
  type IKaraokeToken,
} from '../../common/karaoke/types';
import { type IKaraokeLiveValue } from './karaokeLiveValue';
import {
  type IKaraokeAttempt,
  readKaraokeSongHistory,
  recordKaraokeAttempt,
} from './karaokeScoreHistory';
import { type TKaraokePlaybackStatus } from './useKaraokeSession';
import {
  type IKaraokeLivePitch,
  type TKaraokeMicrophoneStatus,
} from './useKaraokeMicrophone';

/**
 * How far the song may move between two frames and still be one stretch of
 * listening. Further forward is a jump (or frames the window never painted,
 * when nothing was heard either); any real step backwards is a rewind. A
 * few ms back is the media clock settling, not the singer's doing.
 */
const STEP_LIMIT_MS = 400;
const BACKWARD_TOLERANCE_MS = 40;

export interface IKaraokeScoreSnapshot {
  results: readonly (IKaraokeNoteResult | undefined)[];
  firstOpen: number;
}

export interface IKaraokeLaneVerdict {
  verdict: TKaraokeVerdict;
  octave: boolean;
  /** `performance.now()` when it was judged, for its chip's arrival. */
  judgedAt: number;
}

export type TKaraokeBestState =
  | { kind: 'first' }
  | { kind: 'new'; delta: number }
  | { kind: 'tied' }
  | { kind: 'behind'; delta: number };

export interface IKaraokeEndCard {
  sheet: IKaraokeScoreSheet;
  results: readonly (IKaraokeNoteResult | undefined)[];
  summary: IKaraokeRunSummary;
  best: TKaraokeBestState;
  /** Each line against the best attempt's, in points; undefined unknown. */
  deltas: (number | undefined)[];
  progress: TKaraokeProgress;
  /** Oldest first, this attempt last. */
  attempts: IKaraokeAttempt[];
  bestAt: number | undefined;
}

interface IUseKaraokeScoreInput {
  song: IKaraokeSong | undefined;
  livePitch: IKaraokeLiveValue<IKaraokeLivePitch | undefined>;
  microphoneStatus: TKaraokeMicrophoneStatus;
  status: TKaraokePlaybackStatus;
  readPlayheadMs: () => number;
  isActive: boolean;
}

const EMPTY_SNAPSHOT: IKaraokeScoreSnapshot = { results: [], firstOpen: 0 };

const bestState = (
  score: number,
  best: IKaraokeAttempt | undefined,
): TKaraokeBestState => {
  if (!best) {
    return { kind: 'first' };
  }
  if (score > best.score) {
    return { kind: 'new', delta: score - best.score };
  }
  return score === best.score
    ? { kind: 'tied' }
    : { kind: 'behind', delta: best.score - score };
};

/**
 * The singer's score through the song on the stage: every note judged as it
 * ends, from the microphone's pitch against the song's own clock, read the
 * way the pitch lane reads both. Listens only while the microphone is on;
 * what passes while it is off is not scored rather than missed.
 *
 * The run lives in a ref and is advanced every frame; React hears of it only
 * when a verdict lands, which is a few times a second at most.
 */
const useKaraokeScore = ({
  song,
  livePitch,
  microphoneStatus,
  status,
  readPlayheadMs,
  isActive,
}: IUseKaraokeScoreInput) => {
  const pitch = song?.pitch;
  const lines = song?.lines;
  const songId = song?.id;
  const sheet = useMemo(
    () => (pitch && lines ? buildKaraokeScoreSheet(pitch, lines) : undefined),
    [pitch, lines],
  );
  const noteIndexOf = useMemo(
    () =>
      new Map<IKaraokeToken, number>(
        (sheet?.notes ?? []).map((note) => [note.token, note.index]),
      ),
    [sheet],
  );
  const runRef = useRef<IKaraokeScoreRun | undefined>(undefined);
  const judgedAtRef = useRef(new Map<number, number>());
  const recordedRunRef = useRef<IKaraokeScoreRun | undefined>(undefined);
  const readPlayheadRef = useRef(readPlayheadMs);
  readPlayheadRef.current = readPlayheadMs;
  const [snapshot, setSnapshot] =
    useState<IKaraokeScoreSnapshot>(EMPTY_SNAPSHOT);
  const [endCard, setEndCard] = useState<IKaraokeEndCard | undefined>();

  const publish = useCallback(() => {
    const run = runRef.current;
    setSnapshot(
      run
        ? { results: [...run.results], firstOpen: run.firstOpen }
        : EMPTY_SNAPSHOT,
    );
  }, []);

  // A new song, or this one's notes edited in the Maker: a fresh run.
  useEffect(() => {
    runRef.current = sheet ? createKaraokeScoreRun(sheet) : undefined;
    judgedAtRef.current = new Map();
    publish();
    setEndCard(undefined);
  }, [sheet, publish]);

  const isListening = Boolean(sheet) && isActive && microphoneStatus === 'live';
  useEffect(() => {
    if (!isListening) {
      return undefined;
    }
    let frame = 0;
    // Undefined at the start of every listening stretch, so whatever played
    // while the microphone was off is a jump the run was not there for.
    let lastMs: number | undefined;
    const tick = () => {
      const run = runRef.current;
      const songMs = readPlayheadRef.current();
      if (run && Number.isFinite(songMs)) {
        const openBefore = run.firstOpen;
        let judged: number[] = [];
        let next = run;
        if (
          lastMs === undefined ||
          songMs - lastMs > STEP_LIMIT_MS ||
          songMs - lastMs < -BACKWARD_TOLERANCE_MS
        ) {
          next = seekKaraokeScore(run, songMs);
        } else if (songMs > lastMs) {
          judged = stepKaraokeScore(
            run,
            lastMs,
            songMs,
            livePitch.read()?.midi,
          );
        }
        lastMs = songMs;
        if (next !== run) {
          runRef.current = next;
          judgedAtRef.current = new Map();
        }
        const now = performance.now();
        judged.forEach((index) => judgedAtRef.current.set(index, now));
        if (next !== run || judged.length || next.firstOpen !== openBefore) {
          publish();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isListening, livePitch, publish]);

  // The song played out: judge what is left and, for a run worth it, keep
  // the attempt and open the card. Once per run, however often it ends.
  useEffect(() => {
    const run = runRef.current;
    if (status !== 'ended' || !run || !songId) {
      return;
    }
    if (recordedRunRef.current === run) {
      return;
    }
    recordedRunRef.current = run;
    const now = performance.now();
    finishKaraokeScore(run).forEach((index) =>
      judgedAtRef.current.set(index, now),
    );
    publish();
    const summary = summarizeKaraokeRun(run.sheet, run.results);
    if (!karaokeRunDeservesSummary(summary)) {
      return;
    }
    const before = readKaraokeSongHistory(songId);
    const attempt: IKaraokeAttempt = {
      at: Date.now(),
      score: Math.round(summary.score),
      lines: summary.linePercents.map((percent) => percent ?? null),
    };
    const after = recordKaraokeAttempt(songId, attempt);
    const deltas = karaokeLineDeltas(summary.linePercents, before.best?.lines);
    setEndCard({
      sheet: run.sheet,
      results: [...run.results],
      summary,
      best: bestState(attempt.score, before.best),
      deltas,
      progress: karaokeProgress(deltas, before.best !== undefined),
      attempts: after.attempts,
      bestAt: after.best?.at,
    });
  }, [status, songId, publish]);

  /** The strip's question each frame: has this note been judged, and how. */
  const readVerdict = useCallback(
    (token: IKaraokeToken): IKaraokeLaneVerdict | undefined => {
      const index = noteIndexOf.get(token);
      const result =
        index === undefined ? undefined : runRef.current?.results[index];
      if (index === undefined || !result || result.verdict === 'skipped') {
        return undefined;
      }
      return {
        verdict: result.verdict,
        octave: result.octave,
        judgedAt: judgedAtRef.current.get(index) ?? 0,
      };
    },
    [noteIndexOf],
  );

  const closeEndCard = useCallback(() => setEndCard(undefined), []);

  return {
    sheet,
    snapshot,
    isListening,
    readVerdict,
    endCard,
    closeEndCard,
  };
};

export default useKaraokeScore;
