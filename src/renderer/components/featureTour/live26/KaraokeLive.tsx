/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  midiToFrequency,
  midiToNoteName,
} from '../../../../common/karaoke/pitch';
import {
  buildKaraokeScoreSheet,
  type IKaraokeNoteResult,
  type TKaraokeVerdict,
} from '../../../../common/karaoke/scoring';
import type {
  IKaraokeLine,
  IKaraokeToken,
  TKaraokePitchTarget,
} from '../../../../common/karaoke/types';
import KaraokePitchLane from '../../../karaoke/KaraokePitchLane';
import KaraokeScoreLines from '../../../karaoke/KaraokeScoreLines';
import type { IKaraokeLivePitch } from '../../../karaoke/useKaraokeMicrophone';
import type {
  IKaraokeLaneVerdict,
  IKaraokeScoreSnapshot,
} from '../../../karaoke/useKaraokeScore';
import { prefersReducedMotion } from '../../../utils/bandReveal';
import useTourFrames from '../useTourFrames';

const nothing = () => undefined;

/**
 * Two lines of a made-up melody, written for this picture: each word a note,
 * MIDI pitch and length in beats, at 96 BPM.
 */
const MELODY: readonly (readonly [string, number, number][])[] = [
  [
    ['Hold', 64, 1],
    ['on', 67, 0.5],
    ['to', 69, 0.5],
    ['the', 71, 1],
    ['morning', 69, 2],
    ['light', 67, 2],
  ],
  [
    ['Sing', 64, 1],
    ['it', 62, 0.5],
    ['back', 64, 0.5],
    ['to', 67, 1],
    ['me', 69, 1.5],
    ['tonight', 67, 2.5],
  ],
];
const BEAT_MS = 625;
const START_MS = 800;
const LINE_GAP_MS = 900;

/** How each note is sung, in order: mostly right, a few honest misses. */
const SUNG: readonly TKaraokeVerdict[] = [
  'perfect',
  'good',
  'perfect',
  'low',
  'perfect',
  'good',
  'perfect',
  'late',
  'good',
  'perfect',
  'high',
  'perfect',
];
/** How far off each kind of note is sung, in semitones. */
const OFF_BY: Record<TKaraokeVerdict, number> = {
  perfect: 0.05,
  good: 0.25,
  late: 0.1,
  low: -0.7,
  high: 0.65,
  missed: 0,
  skipped: 0,
};
const CREDIT: Record<TKaraokeVerdict, number> = {
  perfect: 1,
  good: 0.75,
  late: 0.6,
  low: 0.35,
  high: 0.35,
  missed: 0,
  skipped: 0,
};

const { LINES, NOTES, LOOP_MS } = (() => {
  const notes: IKaraokeToken[] = [];
  const lines: IKaraokeLine[] = [];
  let at = START_MS;
  MELODY.forEach((words, lineIndex) => {
    const tokens = words.map(([text, midi, beats]) => {
      const token: IKaraokeToken = {
        text,
        startsWord: true,
        startMs: at,
        endMs: at + beats * BEAT_MS * 0.92,
        targetMidi: midi,
      };
      at += beats * BEAT_MS;
      notes.push(token);
      return token;
    });
    lines.push({
      id: `tour-line-${lineIndex}`,
      startMs: tokens[0].startMs,
      endMs: tokens[tokens.length - 1].endMs,
      tokens,
    });
    at += LINE_GAP_MS;
  });
  return { LINES: lines, NOTES: notes, LOOP_MS: at + 1200 };
})();

const TARGET: TKaraokePitchTarget = {
  kind: 'notes',
  source: 'tour',
  coordinateSystem: 'midi-semitones',
  octavePolicy: 'absolute',
  notes: NOTES,
};

/** Where the picture rests with Animations off: the second line half sung. */
const STILL_MS = LINES[1].tokens[3].endMs ?? 0;

const resultOf = (verdict: TKaraokeVerdict): IKaraokeNoteResult => ({
  verdict,
  credit: CREDIT[verdict],
  points: Math.round(CREDIT[verdict] * (10_000 / NOTES.length)),
  octave: false,
  onTime: verdict !== 'late',
  meanCents: Math.round(OFF_BY[verdict] * 100),
  voicedMs: 1,
  inTuneMs: 1,
});

/**
 * Karaoke's pitch strip and its score, as the Karaoke tab draws them while
 * somebody sings: a made-up song's notes, a made-up voice that sings them,
 * mostly in tune with a few honest misses, and each note judged as it ends,
 * its verdict on the strip and its cell in the line's row under it. The
 * strip and the rows are Karaoke's own (`KaraokePitchLane`,
 * `KaraokeScoreLines`); the sheet is the one `buildKaraokeScoreSheet` builds
 * from the notes; only the voice and its verdicts are written here, and
 * nothing is kept as a score.
 */
export default function KaraokeLive() {
  const sheet = useMemo(() => buildKaraokeScoreSheet(TARGET, LINES), []);
  const start = useRef(performance.now());
  const isStill = useRef(prefersReducedMotion());
  const readPlayheadMs = useCallback(
    () =>
      isStill.current
        ? STILL_MS
        : (performance.now() - start.current) % LOOP_MS,
    [],
  );
  const judgedAt = useRef(new Map<number, number>());
  const [pitch, setPitch] = useState<IKaraokeLivePitch | undefined>();
  const [ended, setEnded] = useState(0);

  useTourFrames(
    () => {
      const now = readPlayheadMs();
      const sungUntil = NOTES.filter((note) => (note.endMs ?? 0) <= now).length;
      if (sungUntil < judgedAt.current.size) {
        judgedAt.current.clear();
      }
      for (let index = judgedAt.current.size; index < sungUntil; index += 1) {
        judgedAt.current.set(index, performance.now());
      }
      setEnded((before) => (before === sungUntil ? before : sungUntil));
      const at = NOTES.findIndex(
        (note) => (note.startMs ?? 0) <= now && (note.endMs ?? 0) > now,
      );
      if (at < 0) {
        setPitch(undefined);
        return;
      }
      const verdict = SUNG[at % SUNG.length];
      const wobble = 0.08 * Math.sin(now / 90);
      const midi = (NOTES[at].targetMidi ?? 60) + OFF_BY[verdict] + wobble;
      setPitch({
        frequencyHz: midiToFrequency(midi),
        midi,
        note: midiToNoteName(Math.round(midi)),
        cents: Math.round((midi - Math.round(midi)) * 100),
        confidence: 0.92,
        rms: 0.12,
        capturedAtMs: performance.now(),
        processingMs: 4,
      });
    },
    { fps: 20, still: 0 },
  );

  const readVerdict = useCallback(
    (note: IKaraokeToken): IKaraokeLaneVerdict | undefined => {
      const index = NOTES.indexOf(note);
      const at = judgedAt.current.get(index);
      return at === undefined
        ? undefined
        : { verdict: SUNG[index % SUNG.length], octave: false, judgedAt: at };
    },
    [],
  );

  const snapshot = useMemo<IKaraokeScoreSnapshot>(
    () => ({
      results: NOTES.map((_, index) =>
        index < ended ? resultOf(SUNG[index % SUNG.length]) : undefined,
      ),
      firstOpen: ended,
    }),
    [ended],
  );

  return (
    <div className="karaoke-page tour-live26-karaoke">
      <KaraokePitchLane
        isActive
        isPlaying
        pitch={pitch}
        analysisStatus="ready"
        target={TARGET}
        durationMs={LOOP_MS}
        readPlayheadMs={readPlayheadMs}
        microphoneStatus="live"
        readVerdict={readVerdict}
      />
      {sheet && (
        <KaraokeScoreLines
          sheet={sheet}
          snapshot={snapshot}
          onPractiseLine={nothing}
        />
      )}
    </div>
  );
}
