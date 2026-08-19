/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
} from '../makerAnalysis';
import { repairEstimatedWhisperTimingWithMelody } from '../makerAlignment';
import {
  IKaraokeMakerProject,
  karaokeMakerId,
  makerLinesFromPlainText,
  KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
  karaokeMakerLineIsSection,
  karaokeMakerWordDurationIsPlausible,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { upsertProvenance, WHISPER_PROVENANCE } from './audio';
import { SWIFT_F0_PROVENANCE } from './swiftF0Notes';
import {
  IKaraokeMakerTranscriptWord,
  IKaraokeMakerWhisperSegment,
} from './whisperProgress';
import type { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';
import {
  constrainAutomaticWordTiming,
  constrainTranscriptWords,
  IKaraokeMakerTranscriptPlacement,
  placeTranscriptWords,
} from './wordMatching';
import { karaokeMakerSnapWordsToOnsets } from './voiceOnsets';
import {
  IKaraokeMakerVocalRest,
  karaokeMakerLineBreaks,
  karaokeMakerWordsInsideRests,
} from './vocalRests';
import {
  karaokeMakerRepeatEdgeBreaks,
  karaokeMakerRepeatedRuns,
} from './lyricRepetition';
import { karaokeMakerInconsistentRepeatWords } from './repeatConsistency';
import {
  alignLyricsBySentence,
  distributeAlignmentWordTiming,
  karaokeMakerAlignmentWords,
  mergeTranscriptFragmentsForLyrics,
} from './sentenceAlignment';
import {
  autoAlignNotesOnly,
  karaokeMakerMelodyNotesForLyrics,
} from './guideNotes';

/**
 * What a word timed straight from Whisper's own timestamp is worth. Above the
 * 0.7 the melody repair calls doubtful, below the 0.96 a word that survived
 * several passes earns.
 */
const DIRECT_WHISPER_CONFIDENCE = 0.82;

/**
 * One transcript entry, one lyric token.
 *
 * The lines built below are re-tokenised from text on whitespace and then
 * walked in step with the transcript, which silently assumes each entry holds
 * exactly one word. Whisper does not promise that — a chunk can come back as
 * "thank you" — and when it happens the walk shifts by one and every remaining
 * word in the song wears its neighbour's timing. Splitting here keeps the
 * invariant true instead of hoping for it, sharing the entry's span by letter
 * count the way a syllable group already divides one word's.
 */
const splitTranscriptWordOnWhitespace = (
  word: IKaraokeMakerTranscriptWord,
): IKaraokeMakerTranscriptWord[] => {
  const parts = word.text.trim().split(/\s+/u).filter(Boolean);
  if (parts.length <= 1) {
    return [word];
  }
  const weights = parts.map((part) =>
    Math.max(1, Array.from(part.replace(/[^\p{L}\p{N}]+/gu, '')).length),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const durationMs = Math.max(0, word.endMs - word.startMs);
  let consumed = 0;
  return parts.map((text, index) => {
    const startMs = word.startMs + (durationMs * consumed) / total;
    consumed += weights[index];
    return {
      ...word,
      text,
      startMs,
      endMs: word.startMs + (durationMs * consumed) / total,
    };
  });
};

/**
 * Turn a transcript into the lyrics themselves, for a song that has none.
 *
 * The alignment path below deliberately treats Whisper as evidence for timing
 * and never as the lyric author. This is the sanctioned exception: when the
 * project has no reference text at all, requiring the user to type the song
 * out before detection could run made the detector useless on exactly the
 * songs it exists for. The transcript becomes editable lyric lines — grouped
 * where the singer breathes — and every word carries its detected timing, so
 * the result lands ready to correct rather than ready to start.
 */
export const applyTranscriptAsLyrics = (
  project: IKaraokeMakerProject,
  transcript: readonly IKaraokeMakerTranscriptWord[],
  rests: readonly IKaraokeMakerVocalRest[] = [],
  segments: readonly IKaraokeMakerWhisperSegment[] = [],
  onsets: readonly number[] = [],
): IKaraokeMakerProject => {
  const heard = karaokeMakerWordsInsideRests(
    [...transcript]
      .sort((left, right) => left.startMs - right.startMs)
      .filter((word) => word.text.trim().length > 0)
      .flatMap(splitTranscriptWordOnWhitespace),
    rests,
  );
  if (!heard.length) {
    return project;
  }
  // Grouping and placing are different questions, and only the second one
  // needs a trustworthy timestamp. A word whose span is unusable still marks
  // roughly where Whisper heard the phrase, which is all a line break asks of
  // it. Reading breaths from the placed words alone merged everything the
  // placement rejected into its neighbour — one line of forty words.
  // Whisper says which word and roughly when; the voice says exactly when.
  // A word is moved only to an onset it can reach without overtaking its
  // predecessor, so one that has no sound near it keeps what it had.
  const repeats = karaokeMakerRepeatedRuns(heard);
  // A phrase the singer performs twice is the song checking its own timing.
  // Where the two performances disagree about the shape of the phrase, the
  // one further from this singer's pace loses its timestamps — the word is
  // still sung and still becomes a lyric, it just no longer claims to know
  // when. The melody repair and the onset snap can answer that; a confidently
  // wrong timestamp stops either of them from trying.
  const contradicted = karaokeMakerInconsistentRepeatWords(heard, repeats);
  const words = karaokeMakerSnapWordsToOnsets(
    placeTranscriptWords(heard, project.audio.durationMs ?? 0),
    onsets,
  ).map((word, index) =>
    contradicted.has(index)
      ? { ...word, startMs: undefined, endMs: undefined }
      : word,
  );
  // A line breaks where the singer stops, and the isolated voice is what says
  // where that is. 700 ms between two of Whisper's own timestamps is a breath
  // it noticed; a rest measured in the vocal stem is a breath that happened.
  //
  // Both, because neither is enough alone. Whisper's gaps disappear exactly
  // when its timestamps collapse — measured on one song, 39 words across 14.2
  // seconds with all 38 gaps at zero and no punctuation, which is a timestamp
  // head that stopped reporting rather than a singer who never breathed. The
  // stem knows better and does not care what Whisper thought.
  //
  // A word count used to stand in for all of this, breaking every ninth word
  // wherever the counter ran out: the preview read "…gotta leave some behind
  // We all got", carrying the next sentence's opening words. Counting is not
  // evidence, and there is no count here.
  // Whisper's own utterance ends carry no dependence on the word timings — the
  // model divided this audio itself — and a phrase the singer performs twice
  // has edges by construction. That last one is what a song with no silence
  // has left: a stem voiced 80% of the time, backing harmony over every gap.
  //
  // Every source goes through one decision. Sentence ends and audible gaps
  // used to be tested here in the loop instead, so they escaped the merge that
  // collapses neighbouring claims: a corroborated boundary at one word and a
  // full stop at the next still cut twice and left a one-word line between
  // them. Fourteen of forty-six lines came back that way.
  const fromWords = new Set(
    heard.flatMap((word, index) => {
      if (index === 0) {
        return [];
      }
      const previous = heard[index - 1];
      const sentenceEnded = /[.!?…。？！]$/u.test(previous.text.trim());
      const gap = word.startMs - previous.endMs;
      return sentenceEnded || gap > 700 ? [index] : [];
    }),
  );
  const breaks = karaokeMakerLineBreaks(
    heard,
    rests,
    segments.map((segment) => segment.endMs),
    karaokeMakerRepeatEdgeBreaks(repeats, heard.length),
    fromWords,
  );
  const lines: IKaraokeMakerTranscriptPlacement[][] = [[]];
  words.forEach((word, index) => {
    const current = lines[lines.length - 1];
    if (current.length && breaks.has(index)) {
      lines.push([word]);
    } else {
      current.push(word);
    }
  });
  const text = lines
    .map((line) => line.map((word) => word.text.trim()).join(' '))
    .join('\n');
  const built = makerLinesFromPlainText(text, 'whisper');
  // The lines were built from the words in order, so walking both in step
  // reattaches each detected timing to the token it produced.
  const flatWords = lines.flat();
  let wordIndex = 0;
  const timedLines = built.map((line) => ({
    ...line,
    tokens: line.tokens.map((token) => {
      const word = flatWords[wordIndex];
      wordIndex += 1;
      // A placed word says so. The melody repair treats anything below 0.7 as
      // doubtful and re-derives it from the detected notes; without a
      // confidence here every authored word looked doubtful, and turning the
      // repair on would have thrown away each timestamp Whisper got right to
      // replace it with a note boundary.
      return word?.startMs !== undefined && word.endMs !== undefined
        ? {
            ...token,
            startMs: word.startMs,
            endMs: word.endMs,
            confidence: DIRECT_WHISPER_CONFIDENCE,
          }
        : token;
    }),
  }));
  return touchKaraokeMakerProject({
    ...project,
    lyrics: { ...project.lyrics, lines: timedLines },
    provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
    analysis: {
      ...project.analysis,
      whisperPasses: (project.analysis.whisperPasses ?? 0) + 1,
      whisperAlignmentVersion: KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
    },
  });
};

export const applyWhisperTranscript = (
  project: IKaraokeMakerProject,
  transcript: readonly IKaraokeMakerTranscriptWord[] & {
    passes?: readonly (readonly IKaraokeMakerTranscriptWord[])[];
  },
  rests: readonly IKaraokeMakerVocalRest[] = [],
  onsets: readonly number[] = [],
): IKaraokeMakerProject => {
  const alignmentGroups = karaokeMakerAlignmentWords(project);
  const existing = alignmentGroups.map(({ word }) => word);
  const sourcePasses = transcript.passes?.length
    ? transcript.passes
    : [transcript];
  const alignmentPasses = sourcePasses.map((pass) => {
    // Both of these were measured on the stem, so both belong before the
    // project offset is applied — after it the words are in project time and
    // the evidence is not.
    //
    // The authoring path had them and this one did not, which is backwards:
    // there, an invented word becomes a visible lyric line the user can see
    // and delete. Here it silently steals a real word's timing, because the
    // supplied lyrics guarantee that whatever Whisper invented gets matched to
    // whichever line it resembles. "Thank you." over a silent intro timed the
    // song's first real "you" into the instrumental.
    const snapped = karaokeMakerSnapWordsToOnsets(
      karaokeMakerWordsInsideRests(pass, rests),
      onsets,
    );
    // On this path a contradicted word is dropped outright rather than
    // stripped of its timing: the lyrics are already written, so the word
    // carries no text worth keeping — only evidence, and this is evidence the
    // song itself contradicts.
    const contradicted = karaokeMakerInconsistentRepeatWords(
      snapped,
      karaokeMakerRepeatedRuns(snapped),
    );
    const heard = snapped.filter((_word, index) => !contradicted.has(index));
    const transcriptOffsetMs = heard.length
      ? karaokeMakerAnalysisOffsetMs(
          project,
          Math.min(...heard.map((word) => word.startMs)),
        )
      : 0;
    const shifted = constrainTranscriptWords(
      heard.map((word) => ({
        ...word,
        startMs: word.startMs + transcriptOffsetMs,
        endMs: word.endMs + transcriptOffsetMs,
      })),
    );
    return mergeTranscriptFragmentsForLyrics(existing, shifted);
  });
  const canonicalSinglePass = transcript.passes?.length === 1;
  const refinementPasses = project.analysis.whisperPasses ?? 0;
  if (!existing.length) {
    // Whisper is evidence for timing; it is not the lyric author. The Maker
    // intentionally requires supplied lyrics, so a hallucinated transcript
    // over music can never become visible karaoke text through this API.
    return touchKaraokeMakerProject({
      ...project,
      provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
      analysis: {
        ...project.analysis,
        whisperPasses: refinementPasses + 1,
        whisperAlignmentVersion: KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
      },
    });
  }
  const timingIsOrdered = existing.map((token, index) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      return false;
    }
    const previous = existing[index - 1];
    const next = existing[index + 1];
    return (
      (previous?.endMs === undefined || token.startMs >= previous.endMs) &&
      (next?.startMs === undefined || token.endMs <= next.startMs)
    );
  });
  const alignmentTranscript =
    alignmentPasses
      .slice()
      .sort((left, right) => right.length - left.length)[0] ?? [];
  const directMapping = alignLyricsBySentence(alignmentGroups, alignmentPasses);
  // Whisper timestamps are the only automatic timing evidence. Missing words
  // are filled only inside a strongly confirmed sentence; unmatched lines and
  // long gaps remain untimed so instrumental sections never receive lyrics.
  // Repeated runs use different Whisper window sizes. Keep a complete earlier
  // line when the new run misses that line entirely, but only when its direct
  // timings were high-confidence and ordered. Any current evidence on the line
  // replaces it, preventing a stale false positive from surviving correction.
  const refinedMapping = new Map(directMapping);
  // Legacy projects may have been refined by several independent profiles.
  // The new worker marks its one canonical pass explicitly; in that mode the
  // current acoustic evidence replaces stale automatic timings instead of
  // averaging them and reintroducing drift from an older analysis.
  if (refinementPasses > 0 && !canonicalSinglePass) {
    const linesWithCurrentEvidence = new Set(
      alignmentGroups
        .filter((group) => directMapping.has(group.word.id))
        .map((group) => group.lineIndex),
    );
    alignmentGroups.forEach((group, index) => {
      const token = existing[index];
      if (
        linesWithCurrentEvidence.has(group.lineIndex) ||
        token.timingLocked ||
        token.source !== 'whisper' ||
        token.startMs === undefined ||
        token.endMs === undefined ||
        (token.confidence ?? 0) < 0.8 ||
        !timingIsOrdered[index]
      ) {
        return;
      }
      refinedMapping.set(token.id, {
        text: token.text,
        startMs: token.startMs,
        endMs: token.endMs,
      });
    });
    existing.forEach((token, index) => {
      if (
        token.timingLocked ||
        token.source !== 'whisper' ||
        token.startMs === undefined ||
        token.endMs === undefined ||
        !timingIsOrdered[index]
      ) {
        return;
      }
      const nextTiming = refinedMapping.get(token.id);
      const isDirect = !nextTiming?.inferred;
      if (!nextTiming) {
        return;
      }
      const largestDelta = Math.max(
        Math.abs(nextTiming.startMs - token.startMs),
        Math.abs(nextTiming.endMs - token.endMs),
      );
      if (isDirect && (token.confidence ?? 0) >= 0.8 && largestDelta <= 1_200) {
        const priorWeight = Math.min(3, refinementPasses);
        refinedMapping.set(token.id, {
          ...nextTiming,
          startMs:
            (token.startMs * priorWeight + nextTiming.startMs) /
            (priorWeight + 1),
          endMs:
            (token.endMs * priorWeight + nextTiming.endMs) / (priorWeight + 1),
        });
      }
    });
  }
  const mapping = constrainAutomaticWordTiming(
    existing,
    refinedMapping,
    project.audio.durationMs ??
      alignmentTranscript[alignmentTranscript.length - 1]?.endMs ??
      0,
  );
  const tokenMapping = new Map<string, IKaraokeMakerTranscriptWord>();
  alignmentGroups.forEach((group) => {
    const timing = mapping.get(group.word.id);
    if (!timing || group.word.timingLocked) {
      return;
    }
    distributeAlignmentWordTiming(group, timing).forEach((word, tokenId) =>
      tokenMapping.set(tokenId, word),
    );
  });
  const lines = project.lyrics.lines.map((line) => ({
    ...line,
    tokens: line.tokens.map((token) => {
      const hasPlausibleLockedTiming =
        token.timingLocked &&
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        karaokeMakerWordDurationIsPlausible(
          token.text,
          token.endMs - token.startMs,
          token.source,
        );
      if (karaokeMakerLineIsSection(line) || hasPlausibleLockedTiming) {
        return token;
      }
      const word = tokenMapping.get(token.id);
      const canPreserveWithoutEvidence =
        (token.source === 'manual' || token.timingLocked) &&
        (token.startMs === undefined ||
          token.endMs === undefined ||
          karaokeMakerWordDurationIsPlausible(
            token.text,
            token.endMs - token.startMs,
            token.source,
          ));
      if (word) {
        return {
          ...token,
          startMs: word.startMs,
          endMs: word.endMs,
          confidence: word.inferred
            ? Math.min(0.78, 0.62 + refinementPasses * 0.04)
            : Math.min(
                0.96,
                DIRECT_WHISPER_CONFIDENCE + refinementPasses * 0.04,
              ),
          source: 'whisper' as const,
        };
      }
      if (canPreserveWithoutEvidence) {
        return token;
      }
      return {
        ...token,
        startMs: undefined,
        endMs: undefined,
        confidence: undefined,
        source: 'whisper' as const,
      };
    }),
  }));
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...project,
      lyrics: { ...project.lyrics, source: 'whisper', lines },
      provenance: upsertProvenance(project.provenance, WHISPER_PROVENANCE),
      analysis: {
        ...project.analysis,
        whisperPasses: refinementPasses + 1,
        whisperAlignmentVersion: KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
      },
    }),
  );
};

export const applyBasicPitchMelody = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  repairWordTiming = false,
  // Whichever model produced the notes signs the project. SwiftF0 is the only
  // detector left — Basic Pitch is gone, and this function keeps its name
  // solely because `source: 'basic-pitch'` is written into saved projects and
  // renaming the value would orphan every note in every file on disk.
  provenance: IKaraokeMakerLicenseRecord = SWIFT_F0_PROVENANCE,
): IKaraokeMakerProject => {
  const repairedProject = repairWordTiming
    ? repairEstimatedWhisperTimingWithMelody(project, notes)
    : project;
  const forLyrics = karaokeMakerMelodyNotesForLyrics(repairedProject, notes);
  // A project with no timed lyrics gives the aligner nothing to attach notes
  // to, and "re-detect melody" silently produced zero from four hundred good
  // candidates — a working detector reported as broken. Detected notes stand
  // on their own as free notes in that case; they attach to words later, when
  // there are words to attach to.
  if (!forLyrics.length && notes.length) {
    return touchKaraokeMakerProject(
      synchronizeKaraokeMakerSections({
        ...repairedProject,
        melody: {
          ...repairedProject.melody,
          notes: [
            ...repairedProject.melody.notes.filter(
              (note) => note.source === 'manual',
            ),
            ...notes.map((note) => ({
              id: karaokeMakerId('note'),
              startMs: Math.round(note.startMs),
              endMs: Math.round(note.endMs),
              targetMidi: note.targetMidi,
              kind: 'free' as const,
              confidence: note.confidence,
              source: 'basic-pitch' as const,
            })),
          ],
        },
        provenance: upsertProvenance(repairedProject.provenance, provenance),
      }),
    );
  }
  const aligned = autoAlignNotesOnly(repairedProject, forLyrics, 'basic-pitch');
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...aligned,
      provenance: upsertProvenance(aligned.provenance, provenance),
    }),
  );
};

/** Apply the lightweight local detector without relabelling it as Basic Pitch. */
export const applyDetectedPitchMelody = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  repairWordTiming = false,
): IKaraokeMakerProject => {
  const repairedProject = repairWordTiming
    ? repairEstimatedWhisperTimingWithMelody(project, notes)
    : project;
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections(
      autoAlignNotesOnly(
        repairedProject,
        karaokeMakerMelodyNotesForLyrics(repairedProject, notes),
        'pitch-analysis',
      ),
    ),
  );
};
