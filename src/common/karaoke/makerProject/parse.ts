/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Turning JSON off disk back into a project.
 *
 * Split out of `project.ts`, which creates, imports and serialises a project
 * the app already trusts. This file trusts nothing: the JSON may have been
 * written by an older version, hand-edited, or truncated, and every field it
 * takes has to survive being absent, wrong-typed or hostile.
 */
import {
  confidenceOrUndefined,
  finiteOrUndefined,
  IKaraokeMakerLicenseRecord,
  IKaraokeMakerLine,
  IKaraokeMakerLyricSheet,
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

// The shape `sanitiseMakerLines` trusts nothing about: raw JSON off disk,
// read defensively field by field below.
type TRawKaraokeMakerLine = {
  id?: unknown;
  kind?: unknown;
  startMs?: unknown;
  endMs?: unknown;
  tokens?: unknown;
};
type TRawKaraokeMakerToken = {
  id?: unknown;
  text?: unknown;
  startsWord?: unknown;
  source?: unknown;
  startMs?: unknown;
  endMs?: unknown;
  confidence?: unknown;
  timingLocked?: unknown;
};

/**
 * The same length caps, section re-derivation and token guards for a set of
 * raw lines, whichever lyric sheet they came from — the original or a
 * translation. `clearedAutomaticTokenIds` is written to, not read, here; the
 * caller reads it back to drop melody notes orphaned by a token whose
 * automatic timing this pass just erased.
 */
const sanitiseMakerLines = (
  rawLines: readonly unknown[],
  legacyWhisperAlignment: boolean,
  clearedAutomaticTokenIds: Set<string> = new Set<string>(),
): IKaraokeMakerLine[] =>
  rawLines.map((rawLine, lineIndex) => {
    const line = rawLine as TRawKaraokeMakerLine | null | undefined;
    return {
      id:
        typeof line?.id === 'string' && line.id
          ? line.id.slice(0, 256)
          : `line-${lineIndex}`,
      kind:
        line?.kind === 'section' ||
        isKaraokeSectionText(
          (Array.isArray(line?.tokens) ? line.tokens : [])
            .map((rawToken) =>
              String(
                (rawToken as TRawKaraokeMakerToken | null | undefined)?.text ??
                  '',
              ),
            )
            .join(' ')
            .trim(),
        )
          ? 'section'
          : 'lyrics',
      startMs: finiteOrUndefined(line?.startMs),
      endMs: finiteOrUndefined(line?.endMs),
      tokens: (Array.isArray(line?.tokens) ? line.tokens : [])
        .slice(0, 2_000)
        .map((rawToken, tokenIndex) => {
          const token = rawToken as TRawKaraokeMakerToken | null | undefined;
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
              !karaokeMakerWordDurationIsPlausible(
                text,
                endMs - startMs,
                source,
              ))
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
    };
  });

/** Parse an untrusted project without allowing unbounded arrays into the UI. */
export const parseKaraokeMakerProject = (
  contents: string,
): IKaraokeMakerProject => {
  const value = JSON.parse(contents) as Partial<IKaraokeMakerProject>;
  // Version 1 predates `lyrics.translations`. The field is additive, so an
  // old draft has nothing in it the new shape cannot represent — it loads
  // with no translations rather than being refused outright. Widened to
  // `number` because the declared type is the single literal 2, which the
  // compiler otherwise refuses to compare against the retired literal 1.
  const { version } = value;
  const rawVersion = version as number | undefined;
  if (rawVersion !== 1 && rawVersion !== KARAOKE_MAKER_PROJECT_VERSION) {
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
  const lines = sanitiseMakerLines(
    rawLines,
    legacyWhisperAlignment,
    clearedAutomaticTokenIds,
  );
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
      translations: Array.isArray(value.lyrics?.translations)
        ? value.lyrics.translations
            // A cap, because this array is reachable from a file on disk.
            .slice(0, 32)
            .flatMap((sheet: unknown): IKaraokeMakerLyricSheet[] => {
              const language =
                typeof (sheet as { language?: unknown })?.language === 'string'
                  ? String((sheet as { language: string }).language).slice(
                      0,
                      64,
                    )
                  : '';
              if (!language) {
                return [];
              }
              const rawSheetLines = (sheet as { lines?: unknown }).lines;
              return [
                {
                  language,
                  source: safeSource((sheet as { source?: unknown }).source),
                  lines: sanitiseMakerLines(
                    Array.isArray(rawSheetLines) ? rawSheetLines : [],
                    legacyWhisperAlignment,
                  ),
                },
              ];
            })
        : undefined,
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
