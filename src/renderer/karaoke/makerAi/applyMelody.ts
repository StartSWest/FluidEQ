/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Putting detected notes onto a project.
 *
 * Split out of `apply.ts`, which carries the two transcript paths and had
 * grown past the size limit. The seam is a real one and not arithmetic:
 * nothing here reads a transcript, and nothing there reads a note.
 */
import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import { repairEstimatedWhisperTimingWithMelody } from '../makerAlignment';
import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  karaokeMakerId,
  karaokeMakerLineIsSection,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import type { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';
import { upsertProvenance } from './audio';
import { SWIFT_F0_PROVENANCE } from './swiftF0Notes';
import {
  IKaraokeSungPitch,
  karaokeSungKey,
  rekeyKaraokeNotes,
} from './songKeys';
import {
  autoAlignNotesOnly,
  karaokeMakerMelodyNotesForLyrics,
} from './guideNotes';

/**
 * How much of a word has to be sung on a pitch before it is given a note of
 * its own. Shorter than this is a consonant or a breath the tracker caught.
 */
const SUNG_WORD_MINIMUM_MS = 60;

/**
 * A note for each timed word the note cutter left without one.
 *
 * The cutter keeps a note only where it is sure for long enough, so a word
 * sung softly or quickly could come out with nothing over it: 3 to 10% of a
 * chart's notes on the measured songs. The word's own time says where to
 * listen, which the cutter never knew, and the pitch sung there names the
 * note. A word with nothing sung on a pitch still gets none.
 */
const withNotesForSungWords = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerNote[],
  sung: IKaraokeSungPitch,
): IKaraokeMakerNote[] => {
  const added: IKaraokeMakerNote[] = [];
  project.lyrics.lines.forEach((line) => {
    if (karaokeMakerLineIsSection(line)) {
      return;
    }
    line.tokens.forEach((token) => {
      const { startMs, endMs } = token;
      if (startMs === undefined || endMs === undefined || endMs <= startMs) {
        return;
      }
      if (notes.some((note) => note.startMs < endMs && startMs < note.endMs)) {
        return;
      }
      // Inside the word only: there is no note here whose held part could
      // run past the end.
      const key = karaokeSungKey(
        sung,
        startMs,
        endMs,
        endMs,
        SUNG_WORD_MINIMUM_MS,
      );
      if (key !== undefined) {
        added.push({
          id: karaokeMakerId('note'),
          tokenId: token.id,
          startMs,
          endMs,
          targetMidi: key,
          kind: 'normal',
          source: 'basic-pitch',
        });
      }
    });
  });
  return added.length
    ? [...notes, ...added].sort((left, right) => left.startMs - right.startMs)
    : [...notes];
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
  /**
   * The contour the notes came from. With it each note is named from the
   * pitch under its own word rather than from the candidate that covered it.
   */
  sung: IKaraokeSungPitch | undefined = undefined,
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
      melody: sung
        ? {
            ...aligned.melody,
            notes: withNotesForSungWords(
              aligned,
              rekeyKaraokeNotes(
                aligned.melody.notes,
                sung,
                (note) => note.source !== 'basic-pitch',
              ),
              sung,
            ),
          }
        : aligned.melody,
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
