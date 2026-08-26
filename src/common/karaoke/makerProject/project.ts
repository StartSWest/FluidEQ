/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Creating a project, importing lyrics into one, and writing it out.
 *
 * Everything here trusts its input because it came from the app. Reading one
 * back — JSON off disk that may have been written by an older version,
 * hand-edited, or truncated — is defensive enough to earn its own module; see
 * `parse.ts`.
 */
import { karaokeFileRelativePath } from '../files';
import { IKaraokeParsedLyrics, IKaraokeSong, IKaraokeToken } from '../types';
import {
  IKaraokeMakerLine,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  KARAOKE_MAKER_PROJECT_VERSION,
  karaokeMakerId,
} from './model';
import { isKaraokeSectionText } from '../sections';

const makerLinesFromSong = (song: IKaraokeSong): IKaraokeMakerLine[] =>
  song.lines.map((line) => {
    const isSection =
      line.kind === 'section' ||
      isKaraokeSectionText(
        line.tokens
          .map((token) => token.text)
          .join(' ')
          .trim(),
      );
    return {
      id: line.id || karaokeMakerId('line'),
      kind: isSection ? ('section' as const) : ('lyrics' as const),
      startMs: line.startMs,
      endMs: line.endMs,
      tokens: line.tokens
        .filter((token) => token.text.trim())
        .map((token) => ({
          id: karaokeMakerId('word'),
          text: token.text.trim(),
          startsWord: token.startsWord ?? true,
          startMs: isSection ? undefined : token.startMs,
          endMs: isSection ? undefined : token.endMs,
          source: 'imported' as const,
        })),
    };
  });

const closestTokenId = (
  lines: readonly IKaraokeMakerLine[],
  note: IKaraokeToken,
): string | undefined => {
  const midpoint = ((note.startMs ?? 0) + (note.endMs ?? 0)) / 2;
  let best: { id: string; distance: number } | undefined;
  lines.forEach((line) =>
    line.tokens.forEach((token) => {
      if (token.startMs === undefined || token.endMs === undefined) {
        return;
      }
      let distance = 0;
      if (midpoint < token.startMs) {
        distance = token.startMs - midpoint;
      } else if (midpoint > token.endMs) {
        distance = midpoint - token.endMs;
      }
      if (!best || distance < best.distance) {
        best = { id: token.id, distance };
      }
    }),
  );
  return best?.id;
};

export const createKaraokeMakerProject = (
  song: IKaraokeSong,
): IKaraokeMakerProject => {
  const now = new Date().toISOString();
  const audio = song.assets.find((asset) => asset.role === 'audio')?.file;
  const lines = makerLinesFromSong(song);
  const notes =
    song.pitch.kind === 'notes'
      ? song.pitch.notes.flatMap((note): IKaraokeMakerNote[] => {
          if (
            note.startMs === undefined ||
            note.endMs === undefined ||
            note.targetMidi === undefined
          ) {
            return [];
          }
          return [
            {
              id: karaokeMakerId('note'),
              tokenId: closestTokenId(lines, note),
              startMs: note.startMs,
              endMs: note.endMs,
              targetMidi: note.targetMidi,
              kind: note.kind ?? 'normal',
              source: 'imported',
            },
          ];
        })
      : [];
  return {
    version: KARAOKE_MAKER_PROJECT_VERSION,
    id:
      song.meta.sourceFormat === 'fluideq-maker' ? song.id : `maker-${song.id}`,
    title: song.title,
    artist: song.artist,
    createdAt: now,
    updatedAt: now,
    audio: {
      name: audio?.name ?? song.title,
      relativePath: audio ? karaokeFileRelativePath(audio) : song.title,
      size: audio?.size ?? 0,
      lastModified: audio?.lastModified ?? 0,
      durationMs: song.durationMs,
    },
    lyrics: {
      language: song.meta.language,
      source: song.lines.length ? 'imported' : 'manual',
      lines,
    },
    melody: {
      source: notes.length ? 'imported' : 'manual',
      octavePolicy:
        song.pitch.kind === 'notes'
          ? song.pitch.octavePolicy
          : 'nearest-target',
      notes,
    },
    meta: {
      bpm: song.meta.bpm,
      gapMs: song.meta.gapMs,
      rightsConfirmed: false,
    },
    analysis: { vocalFocus: true },
    provenance: [],
  };
};

/** Replace the editable lyrics and melody with any normalized import adapter. */
export const importLyricsIntoKaraokeMakerProject = (
  current: IKaraokeMakerProject,
  parsed: IKaraokeParsedLyrics,
): IKaraokeMakerProject => {
  const imported = createKaraokeMakerProject({
    id: current.id,
    title: parsed.title || current.title,
    artist: parsed.artist ?? current.artist,
    durationMs: current.audio.durationMs,
    assets: [],
    timingPrecision: parsed.timingPrecision,
    lines: parsed.lines,
    pitch: parsed.pitch,
    meta: {
      sourceFormat: parsed.sourceFormat,
      gapMs: parsed.gapMs,
      bpm: parsed.bpm,
    },
  });
  return touchKaraokeMakerProject({
    ...imported,
    id: current.id,
    createdAt: current.createdAt,
    audio: current.audio,
    lyrics: {
      ...imported.lyrics,
      language: parsed.language ?? current.lyrics.language,
    },
    meta: {
      ...imported.meta,
      rightsConfirmed: current.meta.rightsConfirmed,
    },
    analysis: current.analysis,
    provenance: current.provenance,
  });
};

export const touchKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => ({
  ...project,
  updatedAt: new Date().toISOString(),
});

export const serializeKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): string => `${JSON.stringify(touchKaraokeMakerProject(project), null, 2)}\n`;
