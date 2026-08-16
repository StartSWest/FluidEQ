/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
  repairEstimatedWhisperTimingWithMelody,
} from '../makerAnalysis';
import {
  IKaraokeMakerProject,
  KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
  karaokeMakerLineIsSection,
  karaokeMakerWordDurationIsPlausible,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import {
  BASIC_PITCH_PROVENANCE,
  upsertProvenance,
  WHISPER_PROVENANCE,
} from './audio';
import { IKaraokeMakerTranscriptWord } from './whisperProgress';
import {
  constrainAutomaticWordTiming,
  constrainTranscriptWords,
} from './wordMatching';
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

export const applyWhisperTranscript = (
  project: IKaraokeMakerProject,
  transcript: readonly IKaraokeMakerTranscriptWord[] & {
    passes?: readonly (readonly IKaraokeMakerTranscriptWord[])[];
  },
): IKaraokeMakerProject => {
  const alignmentGroups = karaokeMakerAlignmentWords(project);
  const existing = alignmentGroups.map(({ word }) => word);
  const sourcePasses = transcript.passes?.length
    ? transcript.passes
    : [transcript];
  const alignmentPasses = sourcePasses.map((pass) => {
    const transcriptOffsetMs = pass.length
      ? karaokeMakerAnalysisOffsetMs(
          project,
          Math.min(...pass.map((word) => word.startMs)),
        )
      : 0;
    const shifted = constrainTranscriptWords(
      pass.map((word) => ({
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
            : Math.min(0.96, 0.82 + refinementPasses * 0.04),
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
): IKaraokeMakerProject => {
  const repairedProject = repairWordTiming
    ? repairEstimatedWhisperTimingWithMelody(project, notes)
    : project;
  const aligned = autoAlignNotesOnly(
    repairedProject,
    karaokeMakerMelodyNotesForLyrics(repairedProject, notes),
    'basic-pitch',
  );
  return touchKaraokeMakerProject(
    synchronizeKaraokeMakerSections({
      ...aligned,
      provenance: upsertProvenance(aligned.provenance, BASIC_PITCH_PROVENANCE),
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
