/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { karaokeFileRelativePath } from './files';
import {
  IKaraokeAsset,
  IKaraokeLine,
  IKaraokeParsedLyrics,
  IKaraokeSong,
  IKaraokeToken,
} from './types';

export const KARAOKE_MAKER_PROJECT_VERSION = 1 as const;
export const KARAOKE_MAKER_EXTENSION = 'fluideq-karaoke.json';

export type TKaraokeMakerSource =
  | 'manual'
  | 'imported'
  | 'pitch-analysis'
  | 'basic-pitch'
  | 'whisper'
  | 'auto-align';

export interface IKaraokeMakerToken {
  id: string;
  text: string;
  startsWord: boolean;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  source: TKaraokeMakerSource;
  /** User-authored timing that automatic alignment must never replace. */
  timingLocked?: boolean;
}

/** Automatic/imported timing is still pending until the user edits it. */
export const karaokeMakerTokenWasUserTouched = (
  token: Pick<IKaraokeMakerToken, 'timingLocked'>,
): boolean => token.timingLocked === true;

export interface IKaraokeMakerLine {
  id: string;
  kind?: 'lyrics' | 'section';
  startMs?: number;
  endMs?: number;
  tokens: IKaraokeMakerToken[];
}

const SECTION_MARKER =
  /^\[\s*(intro|verse(?:\s+\d+)?|pre[\s-]?chorus|chorus(?:\s+\d+)?|bridge|break|instrumental|interlude|solo|outro|hook|refrain|ending)\s*\]$/iu;

export const karaokeMakerLineIsSection = (
  line: Pick<IKaraokeMakerLine, 'kind' | 'tokens'>,
): boolean =>
  line.kind === 'section' ||
  SECTION_MARKER.test(
    line.tokens
      .map((token) => token.text)
      .join(' ')
      .trim(),
  );

const lineTiming = (
  line: IKaraokeMakerLine,
): { startMs?: number; endMs?: number } => {
  const timed = line.tokens.filter((token) => token.startMs !== undefined);
  return {
    startMs: timed.length
      ? Math.min(...timed.map((token) => token.startMs as number))
      : line.startMs,
    endMs: timed.length
      ? Math.max(...timed.map((token) => token.endMs ?? token.startMs ?? 0))
      : line.endMs,
  };
};

/** Place section markers near the following phrase without treating them as vocals. */
export const synchronizeKaraokeMakerSections = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => {
  const lines = project.lyrics.lines.map((line, index) => {
    if (!karaokeMakerLineIsSection(line)) {
      return line;
    }
    const previous = [...project.lyrics.lines.slice(0, index)]
      .reverse()
      .find((candidate) => !karaokeMakerLineIsSection(candidate));
    const next = project.lyrics.lines
      .slice(index + 1)
      .find((candidate) => !karaokeMakerLineIsSection(candidate));
    const previousTiming = previous ? lineTiming(previous) : undefined;
    const nextTiming = next ? lineTiming(next) : undefined;
    const nextStartMs = nextTiming?.startMs;
    const preferredStartMs =
      line.startMs ??
      (nextStartMs !== undefined
        ? Math.max(previousTiming?.endMs ?? 0, nextStartMs - 1_400)
        : previousTiming?.endMs);
    if (preferredStartMs === undefined) {
      return { ...line, kind: 'section' as const };
    }
    const startMs = Math.max(0, preferredStartMs);
    const endMs = Math.max(
      startMs + 200,
      Math.min(line.endMs ?? startMs + 1_200, nextStartMs ?? startMs + 1_200),
    );
    return { ...line, kind: 'section' as const, startMs, endMs };
  });
  return { ...project, lyrics: { ...project.lyrics, lines } };
};

export interface IKaraokeMakerNote {
  id: string;
  tokenId?: string;
  startMs: number;
  endMs: number;
  targetMidi: number;
  kind: 'normal' | 'golden' | 'free';
  confidence?: number;
  source: TKaraokeMakerSource;
}

export interface IKaraokeMakerLicenseRecord {
  component: string;
  version: string;
  license: string;
  sourceUrl: string;
  modelSha256?: string;
}

export interface IKaraokeMakerProject {
  version: typeof KARAOKE_MAKER_PROJECT_VERSION;
  id: string;
  title: string;
  artist?: string;
  createdAt: string;
  updatedAt: string;
  audio: {
    name: string;
    relativePath: string;
    size: number;
    lastModified: number;
    durationMs?: number;
  };
  lyrics: {
    language?: string;
    source: TKaraokeMakerSource;
    lines: IKaraokeMakerLine[];
  };
  melody: {
    source: TKaraokeMakerSource;
    octavePolicy: 'absolute' | 'nearest-target';
    notes: IKaraokeMakerNote[];
  };
  meta: {
    bpm?: number;
    gapMs: number;
    rightsConfirmed: boolean;
  };
  analysis: {
    waveform?: number[];
    lastRunAt?: string;
    vocalFocus: boolean;
  };
  provenance: IKaraokeMakerLicenseRecord[];
}

export interface IKaraokeMakerValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'empty-lyrics'
    | 'untimed-word'
    | 'invalid-word-time'
    | 'invalid-note-time'
    | 'overlapping-notes'
    | 'orphan-note';
  targetId?: string;
  message: string;
}

const finiteOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const confidenceOrUndefined = (value: unknown): number | undefined => {
  const finite = finiteOrUndefined(value);
  return finite === undefined ? undefined : Math.min(1, Math.max(0, finite));
};

const safeDate = (value: unknown, fallback: string): string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : fallback;

const safeSource = (value: unknown): TKaraokeMakerSource =>
  [
    'manual',
    'imported',
    'pitch-analysis',
    'basic-pitch',
    'whisper',
    'auto-align',
  ].includes(String(value))
    ? (value as TKaraokeMakerSource)
    : 'manual';

export const karaokeMakerId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

export const makerLinesFromPlainText = (
  text: string,
  source: TKaraokeMakerSource = 'manual',
): IKaraokeMakerLine[] =>
  text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5_000)
    .map((line) => {
      const isSection = SECTION_MARKER.test(line);
      return {
        id: karaokeMakerId('line'),
        kind: isSection ? ('section' as const) : ('lyrics' as const),
        tokens: (isSection ? [line] : line.split(/\s+/u))
          .filter(Boolean)
          .slice(0, 2_000)
          .map((word) => ({
            id: karaokeMakerId('word'),
            text: word,
            startsWord: true,
            source,
          })),
      };
    });

/**
 * Moves the complete authored performance on the audio timeline. Timed lyrics
 * and melody notes are shifted as one unit so their links cannot drift apart.
 * The effective shift is clamped at the beginning of the audio timeline.
 */
export const shiftKaraokeMakerTimeline = (
  project: IKaraokeMakerProject,
  requestedDeltaMs: number,
): IKaraokeMakerProject => {
  if (!Number.isFinite(requestedDeltaMs) || requestedDeltaMs === 0) {
    return project;
  }

  const timedStarts = [
    ...project.lyrics.lines.flatMap((line) => [
      ...(line.startMs === undefined ? [] : [line.startMs]),
      ...line.tokens.flatMap((token) =>
        token.startMs === undefined ? [] : [token.startMs],
      ),
    ]),
    ...project.melody.notes.map((note) => note.startMs),
  ];
  const earliest = timedStarts.length > 0 ? Math.min(...timedStarts) : 0;
  const deltaMs = Math.round(Math.max(requestedDeltaMs, -earliest));
  if (deltaMs === 0) {
    return project;
  }

  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line) => ({
        ...line,
        startMs:
          line.startMs === undefined ? undefined : line.startMs + deltaMs,
        endMs: line.endMs === undefined ? undefined : line.endMs + deltaMs,
        tokens: line.tokens.map((token) => ({
          ...token,
          startMs:
            token.startMs === undefined ? undefined : token.startMs + deltaMs,
          endMs: token.endMs === undefined ? undefined : token.endMs + deltaMs,
        })),
      })),
    },
    melody: {
      ...project.melody,
      notes: project.melody.notes.map((note) => ({
        ...note,
        startMs: note.startMs + deltaMs,
        endMs: note.endMs + deltaMs,
      })),
    },
    meta: {
      ...project.meta,
      gapMs: project.meta.gapMs + deltaMs,
    },
  };
};

/**
 * Moves one lyric anchor and everything authored after it without disturbing
 * the part of the song that has already been synchronized. Melody notes linked
 * to the affected words move with them; unlinked future notes use the selected
 * word's timestamp as their boundary. Backward movement is clamped so the
 * shifted block cannot cross the preceding lyric.
 */
export const shiftKaraokeMakerFromToken = (
  project: IKaraokeMakerProject,
  tokenId: string,
  requestedDeltaMs: number,
): IKaraokeMakerProject => {
  if (!Number.isFinite(requestedDeltaMs) || requestedDeltaMs === 0) {
    return project;
  }

  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  const anchorIndex = tokens.findIndex((token) => token.id === tokenId);
  if (anchorIndex < 0) {
    return project;
  }
  const affectedTokens = tokens.slice(anchorIndex);
  const affectedTokenIds = new Set(affectedTokens.map((token) => token.id));
  const anchorStartMs = affectedTokens.find(
    (token) => token.startMs !== undefined,
  )?.startMs;
  const affectedNotes = project.melody.notes.filter(
    (note) =>
      (note.tokenId !== undefined && affectedTokenIds.has(note.tokenId)) ||
      (note.tokenId === undefined &&
        anchorStartMs !== undefined &&
        note.startMs >= anchorStartMs),
  );
  const affectedStarts = [
    ...affectedTokens.flatMap((token) =>
      token.startMs === undefined ? [] : [token.startMs],
    ),
    ...affectedNotes.map((note) => note.startMs),
  ];
  if (!affectedStarts.length) {
    return project;
  }

  const previousEndMs = tokens
    .slice(0, anchorIndex)
    .reduce(
      (latest, token) => Math.max(latest, token.endMs ?? token.startMs ?? 0),
      0,
    );
  const earliestAffectedMs = Math.min(...affectedStarts);
  const minimumDeltaMs = previousEndMs - earliestAffectedMs;
  const deltaMs = Math.round(Math.max(requestedDeltaMs, minimumDeltaMs));
  if (deltaMs === 0) {
    return project;
  }

  const affectedNoteIds = new Set(affectedNotes.map((note) => note.id));
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line) => ({
        ...line,
        tokens: line.tokens.map((token) =>
          affectedTokenIds.has(token.id)
            ? {
                ...token,
                startMs:
                  token.startMs === undefined
                    ? undefined
                    : token.startMs + deltaMs,
                endMs:
                  token.endMs === undefined ? undefined : token.endMs + deltaMs,
                source: 'manual',
                timingLocked:
                  token.startMs !== undefined && token.endMs !== undefined
                    ? true
                    : token.timingLocked,
              }
            : token,
        ),
      })),
    },
    melody: {
      ...project.melody,
      notes: project.melody.notes.map((note) =>
        affectedNoteIds.has(note.id)
          ? {
              ...note,
              startMs: note.startMs + deltaMs,
              endMs: note.endMs + deltaMs,
              source: 'manual',
            }
          : note,
      ),
    },
  };
};

const makerLinesFromSong = (song: IKaraokeSong): IKaraokeMakerLine[] =>
  song.lines.map((line) => {
    const isSection =
      line.kind === 'section' ||
      SECTION_MARKER.test(
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
  const rawLines = Array.isArray(value.lyrics?.lines)
    ? value.lyrics.lines.slice(0, 5_000)
    : [];
  const lines: IKaraokeMakerLine[] = rawLines.map((line, lineIndex) => ({
    id:
      typeof line?.id === 'string' && line.id
        ? line.id.slice(0, 256)
        : `line-${lineIndex}`,
    kind:
      line?.kind === 'section' ||
      SECTION_MARKER.test(
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
      .map((token, tokenIndex) => ({
        id:
          typeof token?.id === 'string' && token.id
            ? token.id.slice(0, 256)
            : `word-${lineIndex}-${tokenIndex}`,
        text: typeof token?.text === 'string' ? token.text.slice(0, 2_000) : '',
        startsWord: token?.startsWord !== false,
        startMs: finiteOrUndefined(token?.startMs),
        endMs: finiteOrUndefined(token?.endMs),
        confidence: confidenceOrUndefined(token?.confidence),
        source: safeSource(token?.source),
        timingLocked: token?.timingLocked === true || undefined,
      }))
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
        targetMidi === undefined
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

const makePlayableLines = (project: IKaraokeMakerProject): IKaraokeLine[] => {
  const notesByToken = new Map<string, IKaraokeMakerNote[]>();
  project.melody.notes.forEach((note) => {
    if (!note.tokenId) {
      return;
    }
    const notes = notesByToken.get(note.tokenId) ?? [];
    notes.push(note);
    notesByToken.set(note.tokenId, notes);
  });
  return project.lyrics.lines.flatMap((line): IKaraokeLine[] => {
    const tokens: IKaraokeToken[] = [];
    line.tokens.forEach((word) => {
      const notes = (notesByToken.get(word.id) ?? []).sort(
        (left, right) => left.startMs - right.startMs,
      );
      if (!notes.length) {
        tokens.push({
          text: word.text,
          startsWord: word.startsWord,
          startMs: word.startMs,
          endMs: word.endMs,
        });
        return;
      }
      notes.forEach((note, index) =>
        tokens.push({
          text: index === 0 ? word.text : '',
          startsWord: index === 0 ? word.startsWord : false,
          startMs: note.startMs,
          endMs: note.endMs,
          targetMidi: note.targetMidi,
          kind: note.kind,
        }),
      );
    });
    if (!tokens.length) {
      return [];
    }
    const timed = tokens.filter((token) => token.startMs !== undefined);
    return [
      {
        id: line.id,
        kind: karaokeMakerLineIsSection(line) ? 'section' : 'lyrics',
        startMs: timed.length
          ? Math.min(...timed.map((token) => token.startMs as number))
          : line.startMs,
        endMs: timed.length
          ? Math.max(...timed.map((token) => token.endMs ?? token.startMs ?? 0))
          : line.endMs,
        tokens,
      },
    ];
  });
};

export const karaokeMakerProjectToSong = (
  project: IKaraokeMakerProject,
  audioAsset: IKaraokeAsset,
  sourceAssets: readonly IKaraokeAsset[] = [audioAsset],
): IKaraokeSong => {
  const lines = makePlayableLines(project);
  const notes = lines
    .flatMap((line) => line.tokens)
    .filter((token) => token.targetMidi !== undefined);
  const assets = sourceAssets.some((asset) => asset.role === 'audio')
    ? Array.from(sourceAssets)
    : [audioAsset, ...sourceAssets];
  return {
    id: project.id,
    title: project.title,
    artist: project.artist,
    durationMs: project.audio.durationMs,
    // Applying a draft changes only the normalized in-memory timing. Keep the
    // original lyrics/CDG/MIDI assets attached so the source remains available
    // for re-import, session restore, and explicit export. No source file is
    // written by this operation.
    assets,
    timingPrecision: notes.length ? 'syllable' : 'word',
    lines,
    pitch: notes.length
      ? {
          kind: 'notes',
          source: 'fluideq-maker',
          coordinateSystem: 'midi-semitones',
          octavePolicy: project.melody.octavePolicy,
          notes,
        }
      : { kind: 'none', reason: 'missing' },
    meta: {
      sourceFormat: 'fluideq-maker',
      gapMs: project.meta.gapMs,
      bpm: project.meta.bpm,
    },
  };
};

export const validateKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): IKaraokeMakerValidationIssue[] => {
  const issues: IKaraokeMakerValidationIssue[] = [];
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  if (!tokens.length) {
    issues.push({
      severity: 'error',
      code: 'empty-lyrics',
      message: 'Add or import lyrics before exporting.',
    });
  }
  tokens.forEach((token) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      issues.push({
        severity: 'warning',
        code: 'untimed-word',
        targetId: token.id,
        message: `“${token.text}” has no timing yet.`,
      });
    } else if (token.startMs < 0 || token.endMs <= token.startMs) {
      issues.push({
        severity: 'error',
        code: 'invalid-word-time',
        targetId: token.id,
        message: `“${token.text}” has an invalid time range.`,
      });
    }
  });
  const tokenIds = new Set(tokens.map((token) => token.id));
  const notes = [...project.melody.notes].sort(
    (left, right) => left.startMs - right.startMs,
  );
  notes.forEach((note, index) => {
    if (
      note.startMs < 0 ||
      note.endMs <= note.startMs ||
      !Number.isFinite(note.targetMidi)
    ) {
      issues.push({
        severity: 'error',
        code: 'invalid-note-time',
        targetId: note.id,
        message: 'A melody note has an invalid pitch or time range.',
      });
    }
    if (note.tokenId && !tokenIds.has(note.tokenId)) {
      issues.push({
        severity: 'warning',
        code: 'orphan-note',
        targetId: note.id,
        message: 'A melody note is not connected to a lyric.',
      });
    }
    const previous = notes[index - 1];
    if (previous && note.startMs < previous.endMs) {
      issues.push({
        severity: 'warning',
        code: 'overlapping-notes',
        targetId: note.id,
        message: 'Two melody notes overlap.',
      });
    }
  });
  return issues;
};
