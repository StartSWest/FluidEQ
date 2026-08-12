/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  KARAOKE_MAKER_EXTENSION,
  karaokeMakerLineIsSection,
  serializeKaraokeMakerProject,
} from './makerProject';

export type TKaraokeMakerExportFormat =
  'project' | 'ultrastar' | 'lrc' | 'elrc';

export interface IKaraokeMakerExport {
  format: TKaraokeMakerExportFormat;
  extension: string;
  mimeType: string;
  contents: string;
}

const safeFileStem = (value: string): string =>
  Array.from(value.normalize('NFKD'))
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'karaoke';

export const karaokeMakerExportFileName = (
  project: IKaraokeMakerProject,
  format: TKaraokeMakerExportFormat,
): string => {
  const stem = safeFileStem(
    project.artist ? `${project.artist} - ${project.title}` : project.title,
  );
  let extension: string = format;
  if (format === 'project') {
    extension = KARAOKE_MAKER_EXTENSION;
  } else if (format === 'ultrastar') {
    extension = 'txt';
  }
  return `${stem}.${extension}`;
};

const lrcTimestamp = (timeMs: number, enhanced = false): string => {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const fraction = enhanced
    ? String(Math.floor(safe % 1_000)).padStart(3, '0')
    : String(Math.floor((safe % 1_000) / 10)).padStart(2, '0');
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}.${fraction}`;
};

const lyricTokenSuffix = (
  project: IKaraokeMakerProject,
  lineIndex: number,
  tokenIndex: number,
): string => {
  const next = project.lyrics.lines[lineIndex]?.tokens[tokenIndex + 1];
  return next?.startsWord ? ' ' : '';
};

export const exportKaraokeMakerLrc = (
  project: IKaraokeMakerProject,
  enhanced: boolean,
): string => {
  const rows = [
    `[ti:${project.title}]`,
    ...(project.artist ? [`[ar:${project.artist}]`] : []),
    '[by:FluidEQ Karaoke Maker]',
  ];
  project.lyrics.lines.forEach((line, lineIndex) => {
    if (karaokeMakerLineIsSection(line)) {
      if (line.startMs !== undefined) {
        rows.push(
          `[${lrcTimestamp(line.startMs)}]${line.tokens
            .map((token) => token.text)
            .join(' ')}`,
        );
      }
      return;
    }
    const timed = line.tokens.filter((token) => token.startMs !== undefined);
    if (!timed.length) {
      return;
    }
    const lineStart = Math.min(
      ...timed.map((token) => token.startMs as number),
    );
    let text = line.tokens
      .map(
        (token, tokenIndex) =>
          `${token.text}${lyricTokenSuffix(project, lineIndex, tokenIndex)}`,
      )
      .join('');
    if (enhanced) {
      text = line.tokens
        .map((token, tokenIndex) => {
          const suffix = lyricTokenSuffix(project, lineIndex, tokenIndex);
          if (token.startMs === undefined) {
            return `${token.text}${suffix}`;
          }
          return `<${lrcTimestamp(token.startMs, true)}>${token.text}${suffix}`;
        })
        .join('');
    }
    rows.push(`[${lrcTimestamp(lineStart)}]${text}`);
  });
  return `${rows.join('\n')}\n`;
};

const noteTick = (timeMs: number, bpm: number, gapMs: number): number =>
  Math.max(0, Math.round(((timeMs - gapMs) * bpm * 4) / 60_000));

const noteRows = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerNote[],
  bpm: number,
): string[] => {
  const tokens = new Map(
    project.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const lineByToken = new Map(
    project.lyrics.lines.flatMap((line, lineIndex) =>
      line.tokens.map((token) => [token.id, lineIndex] as const),
    ),
  );
  const firstNoteByToken = new Set<string>();
  const rows: string[] = [];
  let previousLineIndex: number | undefined;
  notes.forEach((note) => {
    const start = noteTick(note.startMs, bpm, project.meta.gapMs);
    const end = noteTick(note.endMs, bpm, project.meta.gapMs);
    const duration = Math.max(1, end - start);
    let marker = ':';
    if (note.kind === 'golden') {
      marker = '*';
    } else if (note.kind === 'free') {
      marker = 'F';
    }
    const token = note.tokenId ? tokens.get(note.tokenId) : undefined;
    const isFirst = Boolean(
      note.tokenId && !firstNoteByToken.has(note.tokenId),
    );
    if (note.tokenId) {
      firstNoteByToken.add(note.tokenId);
    }
    const lineIndex = note.tokenId ? lineByToken.get(note.tokenId) : undefined;
    if (
      lineIndex !== undefined &&
      previousLineIndex !== undefined &&
      lineIndex !== previousLineIndex
    ) {
      rows.push('-');
    }
    if (lineIndex !== undefined) {
      previousLineIndex = lineIndex;
    }
    const lyric =
      token && isFirst ? `${token.startsWord ? ' ' : ''}${token.text}` : '~';
    const relativePitch = Math.round(note.targetMidi - 60);
    rows.push(`${marker} ${start} ${duration} ${relativePitch} ${lyric}`);
  });
  return rows;
};

export const exportKaraokeMakerUltraStar = (
  project: IKaraokeMakerProject,
): string => {
  if (!project.melody.notes.length) {
    throw new Error('UltraStar export needs at least one melody note.');
  }
  const bpm = project.meta.bpm && project.meta.bpm > 0 ? project.meta.bpm : 120;
  const notes = [...project.melody.notes].sort(
    (left, right) => left.startMs - right.startMs,
  );
  const rows = [
    `#TITLE:${project.title}`,
    ...(project.artist ? [`#ARTIST:${project.artist}`] : []),
    `#MP3:${project.audio.name}`,
    `#BPM:${bpm}`,
    `#GAP:${Math.round(project.meta.gapMs)}`,
    '#CREATOR:FluidEQ Karaoke Maker',
    ...noteRows(project, notes, bpm),
    'E',
  ];
  return `${rows.join('\n')}\n`;
};

export const exportKaraokeMaker = (
  project: IKaraokeMakerProject,
  format: TKaraokeMakerExportFormat,
): IKaraokeMakerExport => {
  if (format === 'project') {
    return {
      format,
      extension: KARAOKE_MAKER_EXTENSION,
      mimeType: 'application/json',
      contents: serializeKaraokeMakerProject(project),
    };
  }
  if (format === 'ultrastar') {
    return {
      format,
      extension: 'txt',
      mimeType: 'text/plain',
      contents: exportKaraokeMakerUltraStar(project),
    };
  }
  return {
    format,
    extension: format,
    mimeType: 'text/plain',
    contents: exportKaraokeMakerLrc(project, format === 'elrc'),
  };
};
