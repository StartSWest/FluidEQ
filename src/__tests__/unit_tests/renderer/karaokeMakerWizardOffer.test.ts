import { renderHook } from '@testing-library/react';
import {
  createKaraokeMakerProject,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import useMakerWizardOffer from '../../../renderer/karaoke/useMakerWizardOffer';

const audioFile = new File(['audio'], 'Artist - Song.mp3', {
  type: 'audio/mpeg',
  lastModified: 42,
});

const song = (vocals = false): IKaraokeSong => ({
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  durationMs: 20_000,
  assets: [
    { id: 'audio', role: 'audio', extension: 'mp3', file: audioFile },
    ...(vocals
      ? [
          {
            id: 'vocals',
            role: 'vocals' as const,
            extension: 'wav',
            file: audioFile,
          },
        ]
      : []),
  ],
  timingPrecision: 'word',
  lines: [],
  pitch: {
    kind: 'notes',
    source: 'fixture',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'absolute',
    notes: [],
  },
  meta: { sourceFormat: 'ultrastar', gapMs: 0, bpm: 120 },
});

const timed = (
  id: string,
  source: IKaraokeMakerToken['source'],
): IKaraokeMakerToken => ({
  id,
  text: id,
  startsWord: true,
  startMs: 1_000,
  endMs: 1_500,
  source,
});

const projectWith = (
  tokens: IKaraokeMakerToken[],
  notes = 0,
): IKaraokeMakerProject => {
  const project = createKaraokeMakerProject(song());
  project.lyrics.lines = [{ id: 'line', startMs: 1_000, tokens }];
  project.melody.notes = Array.from({ length: notes }, (_unused, index) => ({
    id: `note-${index}`,
    startMs: 1_000,
    endMs: 1_500,
    targetMidi: 60,
    kind: 'normal' as const,
    source: 'imported' as const,
  }));
  return project;
};

const offered = (project: IKaraokeMakerProject, withVocals = false) =>
  renderHook(() => useMakerWizardOffer({ song: song(withVocals), project }))
    .result.current.wizardOpen;

describe('when the set-up wizard is offered', () => {
  it('offers it for a song with nothing timed', () => {
    expect(
      offered(
        projectWith([
          { id: 'a', text: 'a', startsWord: true, source: 'imported' },
        ]),
      ),
    ).toBe(true);
  });

  it('offers it for a word-timed song that has no notes to sing', () => {
    expect(offered(projectWith([timed('a', 'imported')]))).toBe(true);
  });

  it('does not offer it once that song has its notes', () => {
    expect(offered(projectWith([timed('a', 'imported')], 3))).toBe(false);
  });

  it('does not offer it for words a detector already timed', () => {
    // Fully timed and still without notes, but not from a file: this song
    // has been through the detectors, and asking again is nagging.
    expect(offered(projectWith([timed('a', 'auto-align')]))).toBe(false);
  });

  it('does not offer it when the stems were already restored', () => {
    expect(offered(projectWith([timed('a', 'imported')]), true)).toBe(false);
  });
});
