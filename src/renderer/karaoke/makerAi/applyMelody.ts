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
  IKaraokeMakerProject,
  karaokeMakerId,
  synchronizeKaraokeMakerSections,
  touchKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import type { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';
import { upsertProvenance } from './audio';
import { SWIFT_F0_PROVENANCE } from './swiftF0Notes';
import {
  autoAlignNotesOnly,
  karaokeMakerMelodyNotesForLyrics,
} from './guideNotes';

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
