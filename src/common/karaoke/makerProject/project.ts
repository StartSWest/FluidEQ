/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * The file: creating one, importing lyrics, writing it out and reading it back.
 *
 * The parser is the reason this is its own module. Everything else here trusts
 * its input because it came from the app; this reads JSON off disk that may have
 * been written by an older version, hand-edited, or truncated, and every field
 * it takes has to survive being absent, wrong-typed or hostile.
 */
import { karaokeFileRelativePath } from '../files';
import { IKaraokeParsedLyrics, IKaraokeSong, IKaraokeToken } from '../types';
import {
  confidenceOrUndefined,
  finiteOrUndefined,
  IKaraokeMakerLicenseRecord,
  IKaraokeMakerLine,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  KARAOKE_MAKER_PROJECT_VERSION,
  KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION,
  karaokeMakerId,
  karaokeMakerSourceIsAutomatic,
  karaokeMakerWordDurationIsPlausible,
  safeDate,
  safeSource,
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

/** Parse an untrusted project without allowing unbounded arrays into the UI. */
export const parseKaraokeMakerProject = (
  contents: string,
): IKaraokeMakerProject => {
  const value = JSON.parse(contents) as Partial<IKaraokeMakerProject>;
  if (value.version !== KARAOKE_MAKER_PROJECT_VERSION) {
    throw new Error('Unsupported FluidEQ Karaoke Maker project version.');
  }
  const now = new Date().toISOString();
  const rawLinesUnfiltered = Array.isArray(value.lyrics?.lines)
    ? value.lyrics.lines.slice(0, 5_000)
    : [];
  const legacyWhisperAlignment =
    value.analysis?.whisperAlignmentVersion !==
    KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION;
  let skippingRecommendations = false;
  const rawLines = rawLinesUnfiltered.filter((line) => {
    const text = (Array.isArray(line?.tokens) ? line.tokens : [])
      .map((token) => String(token?.text ?? ''))
      .join(' ')
      .trim();
    if (/^you might also like:?$/iu.test(text)) {
      skippingRecommendations = true;
      return false;
    }
    if (skippingRecommendations && isKaraokeSectionText(text)) {
      skippingRecommendations = false;
    }
    return !skippingRecommendations && !/^\d*\s*embed$/iu.test(text);
  });
  const clearedAutomaticTokenIds = new Set<string>();
  const lines: IKaraokeMakerLine[] = rawLines.map((line, lineIndex) => ({
    id:
      typeof line?.id === 'string' && line.id
        ? line.id.slice(0, 256)
        : `line-${lineIndex}`,
    kind:
      line?.kind === 'section' ||
      isKaraokeSectionText(
        (Array.isArray(line?.tokens) ? line.tokens : [])
          .map((token) => String(token?.text ?? ''))
          .join(' ')
          .trim(),
      )
        ? 'section'
        : 'lyrics',
    startMs: finiteOrUndefined(line?.startMs),
    endMs: finiteOrUndefined(line?.endMs),
    tokens: (Array.isArray(line?.tokens) ? line.tokens : [])
      .slice(0, 2_000)
      .map((token, tokenIndex) => {
        const id =
          typeof token?.id === 'string' && token.id
            ? token.id.slice(0, 256)
            : `word-${lineIndex}-${tokenIndex}`;
        const text =
          typeof token?.text === 'string' ? token.text.slice(0, 2_000) : '';
        const source = safeSource(token?.source);
        let startMs = finiteOrUndefined(token?.startMs);
        let endMs = finiteOrUndefined(token?.endMs);
        const confidence = confidenceOrUndefined(token?.confidence);
        const inheritedUnsafeEstimate =
          legacyWhisperAlignment &&
          source === 'whisper' &&
          token?.timingLocked !== true;
        if (
          inheritedUnsafeEstimate ||
          (startMs !== undefined &&
            endMs !== undefined &&
            !karaokeMakerWordDurationIsPlausible(text, endMs - startMs, source))
        ) {
          startMs = undefined;
          endMs = undefined;
          clearedAutomaticTokenIds.add(id);
        }
        return {
          id,
          text,
          startsWord: token?.startsWord !== false,
          startMs,
          endMs,
          confidence: startMs === undefined ? undefined : confidence,
          source,
          timingLocked:
            startMs === undefined
              ? undefined
              : token?.timingLocked === true || undefined,
        };
      })
      .filter((token) => token.text.trim()),
  }));
  const notes: IKaraokeMakerNote[] = (
    Array.isArray(value.melody?.notes) ? value.melody.notes : []
  )
    .slice(0, 100_000)
    .flatMap((note, noteIndex): IKaraokeMakerNote[] => {
      const startMs = finiteOrUndefined(note?.startMs);
      const endMs = finiteOrUndefined(note?.endMs);
      const targetMidi = finiteOrUndefined(note?.targetMidi);
      if (
        startMs === undefined ||
        endMs === undefined ||
        targetMidi === undefined ||
        (typeof note?.tokenId === 'string' &&
          clearedAutomaticTokenIds.has(note.tokenId) &&
          karaokeMakerSourceIsAutomatic(safeSource(note?.source)))
      ) {
        return [];
      }
      return [
        {
          id:
            typeof note?.id === 'string' && note.id
              ? note.id.slice(0, 256)
              : `note-${noteIndex}`,
          tokenId:
            typeof note?.tokenId === 'string'
              ? note.tokenId.slice(0, 256)
              : undefined,
          startMs,
          endMs,
          targetMidi,
          kind: ['normal', 'golden', 'free'].includes(String(note?.kind))
            ? note.kind
            : 'normal',
          confidence: confidenceOrUndefined(note?.confidence),
          source: safeSource(note?.source),
        },
      ];
    });
  return {
    version: KARAOKE_MAKER_PROJECT_VERSION,
    id:
      typeof value.id === 'string'
        ? value.id.slice(0, 512)
        : karaokeMakerId('project'),
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title.slice(0, 2_000)
        : 'Untitled karaoke',
    artist:
      typeof value.artist === 'string'
        ? value.artist.slice(0, 2_000)
        : undefined,
    createdAt: safeDate(value.createdAt, now),
    updatedAt: safeDate(value.updatedAt, now),
    audio: {
      name:
        typeof value.audio?.name === 'string'
          ? value.audio.name.slice(0, 2_000)
          : '',
      relativePath:
        typeof value.audio?.relativePath === 'string'
          ? value.audio.relativePath.slice(0, 4_096)
          : '',
      size: Math.max(0, finiteOrUndefined(value.audio?.size) ?? 0),
      lastModified: Math.max(
        0,
        finiteOrUndefined(value.audio?.lastModified) ?? 0,
      ),
      durationMs: finiteOrUndefined(value.audio?.durationMs),
    },
    lyrics: {
      language:
        typeof value.lyrics?.language === 'string'
          ? value.lyrics.language.slice(0, 64)
          : undefined,
      source: safeSource(value.lyrics?.source),
      lines,
    },
    melody: {
      source: safeSource(value.melody?.source),
      octavePolicy:
        value.melody?.octavePolicy === 'absolute'
          ? 'absolute'
          : 'nearest-target',
      notes,
    },
    meta: {
      bpm: finiteOrUndefined(value.meta?.bpm),
      gapMs: finiteOrUndefined(value.meta?.gapMs) ?? 0,
      rightsConfirmed: value.meta?.rightsConfirmed === true,
    },
    analysis: {
      waveform: Array.isArray(value.analysis?.waveform)
        ? value.analysis.waveform
            .slice(0, 8_192)
            .map((peak) => Math.min(1, Math.max(0, Number(peak) || 0)))
        : undefined,
      lastRunAt:
        typeof value.analysis?.lastRunAt === 'string'
          ? value.analysis.lastRunAt
          : undefined,
      vocalFocus: value.analysis?.vocalFocus !== false,
      whisperPasses:
        typeof value.analysis?.whisperPasses === 'number'
          ? Math.max(0, Math.min(100, Math.floor(value.analysis.whisperPasses)))
          : undefined,
      whisperAlignmentVersion:
        typeof value.analysis?.whisperAlignmentVersion === 'number'
          ? Math.max(0, Math.floor(value.analysis.whisperAlignmentVersion))
          : undefined,
    },
    provenance: (Array.isArray(value.provenance) ? value.provenance : [])
      .slice(0, 100)
      .flatMap((record): IKaraokeMakerLicenseRecord[] =>
        record &&
        typeof record.component === 'string' &&
        typeof record.version === 'string' &&
        typeof record.license === 'string' &&
        typeof record.sourceUrl === 'string'
          ? [
              {
                component: record.component.slice(0, 256),
                version: record.version.slice(0, 128),
                license: record.license.slice(0, 128),
                sourceUrl: record.sourceUrl.slice(0, 2_048),
                modelSha256:
                  typeof record.modelSha256 === 'string'
                    ? record.modelSha256.slice(0, 128)
                    : undefined,
              },
            ]
          : [],
      ),
  };
};
