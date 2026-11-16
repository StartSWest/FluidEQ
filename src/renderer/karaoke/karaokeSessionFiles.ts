/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The files of one karaoke song, as the session takes them in: a restored
 * session's files fetched back from main, and the song put together from the
 * audio, the parsed lyrics and the stage's pictures. Out of
 * `useKaraokeSession` because none of it is playback.
 */
import {
  karaokeFileBaseName,
  karaokeFileExtension,
  parseKaraokeLyricFile,
  selectKaraokeStageMedia,
} from '../../common/karaoke/files';
import { IKaraokeSong, KaraokeParseError } from '../../common/karaoke/types';
import readKaraokeSongChords from './karaokeSongChords';
import { materializeRestoredMedia } from './karaokeRestoredFiles';

export type TParsedKaraokeLyrics = Awaited<
  ReturnType<typeof parseKaraokeLyricFile>
>;

export const asKaraokeParseError = (
  error: unknown,
): KaraokeParseError | undefined =>
  error instanceof KaraokeParseError ? error : undefined;

const displayTitleFromFile = (file: File): string => {
  const extension = karaokeFileExtension(file.name);
  return (extension ? file.name.slice(0, -(extension.length + 1)) : file.name)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/** A song by its audio file: what its Maker drafts and the Library's link to it are kept under. */
export const karaokeSongIdForFile = (file: File): string =>
  `${karaokeFileBaseName(file.name)}-${file.size}-${file.lastModified}`;

/** The song, from its audio, its lyrics if they parsed, and its folder. */
export const assembleKaraokeSong = async ({
  audioFile,
  importedAudio,
  lyrics,
  parsed,
  files,
}: {
  /** The audio, its bytes fetched back if it was restored. */
  audioFile: File;
  /** The audio as it was imported, which the stage media is matched by. */
  importedAudio: File;
  lyrics: File | undefined;
  parsed: TParsedKaraokeLyrics | undefined;
  files: readonly File[];
}): Promise<IKaraokeSong> => {
  const id = karaokeSongIdForFile(audioFile);
  // Resolved here rather than at import, because only now is the lyric
  // file parsed — UltraStar names its own cover, background and video,
  // and a folder holding several songs' artwork needs that header to
  // pick the right one. Formats with no header fall back to matching by
  // base name, which is all an LRC or a bare MP3 can offer.
  const chosenMedia = selectKaraokeStageMedia(importedAudio, files, {
    coverFileName: parsed?.coverFileName,
    backgroundFileName: parsed?.backgroundFileName,
    videoFileName: parsed?.videoFileName,
  });
  // Only the three that won are read off disk. Fetching every picture in
  // the folder would mean loading the losing candidates too, and a song
  // folder can hold a 60MB video that the stage never shows.
  const [cover, background, video] = await Promise.all([
    materializeRestoredMedia(chosenMedia.cover),
    materializeRestoredMedia(chosenMedia.background),
    materializeRestoredMedia(chosenMedia.video),
  ]);
  // The chords the song's own files write: a sheet beside it, or the
  // lyric file's own (`karaokeSongChords.ts`); none, and they are heard.
  const chords = await readKaraokeSongChords(
    importedAudio,
    files,
    parsed,
    materializeRestoredMedia,
  );
  const mediaAsset = (
    role: 'cover' | 'background' | 'video',
    file: File | undefined,
  ) =>
    file
      ? [
          {
            id: `${id}-${role}`,
            role,
            file,
            extension: karaokeFileExtension(file.name),
          },
        ]
      : [];
  return {
    id,
    title: parsed?.title || displayTitleFromFile(audioFile),
    artist: parsed?.artist,
    assets: [
      {
        id: `${id}-audio`,
        role: 'audio',
        file: audioFile,
        extension: karaokeFileExtension(audioFile.name),
      },
      ...mediaAsset('cover', cover),
      ...mediaAsset('background', background),
      ...mediaAsset('video', video),
      ...(lyrics
        ? [
            {
              id: `${id}-lyrics`,
              role: 'lyrics' as const,
              file: lyrics,
              extension: karaokeFileExtension(lyrics.name),
            },
          ]
        : []),
    ],
    timingPrecision: parsed?.timingPrecision ?? 'none',
    lines: parsed?.lines ?? [],
    chords,
    pitch: parsed?.pitch ?? { kind: 'none', reason: 'missing' },
    meta: {
      sourceFormat: parsed?.sourceFormat ?? 'audio-only',
      gapMs: parsed?.gapMs ?? 0,
      videoGapMs: parsed?.videoGapMs,
      bpm: parsed?.bpm,
      language: parsed?.language,
    },
  };
};
