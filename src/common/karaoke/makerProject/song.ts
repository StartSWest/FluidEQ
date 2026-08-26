/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Turning an editable project into something playable, and checking it first.
 *
 * One direction only. A project holds things a song has no use for — capture
 * intent, per-token sources, unlinked notes — and rebuilding one from a song
 * would be inventing the parts that were dropped.
 */
import {
  IKaraokeAsset,
  IKaraokeLine,
  IKaraokeSong,
  IKaraokeToken,
} from '../types';
import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerValidationIssue,
  karaokeMakerLineIsSection,
  karaokeMakerWordDurationIsPlausible,
} from './model';
import { karaokeTranslationLineBySource } from './translationSeed';

const playableWordWeight = (word: string): number =>
  Math.max(
    1,
    Array.from(word).filter((character) => /[\p{L}\p{N}]/u.test(character))
      .length,
  );

/**
 * Close only bounded detector holes for playback. A complete unmatched line
 * remains untimed, but a dropped short word between two real Whisper anchors
 * receives its share of that same vocal window. This keeps preview progress
 * continuous without painting supplied lyrics over instrumental sections.
 */
const makePlayableLyricTokens = (line: IKaraokeMakerLine): IKaraokeToken[] => {
  const tokens: IKaraokeToken[] = line.tokens.map((word) => ({
    text: word.text,
    startsWord: word.startsWord,
    startMs: word.startMs,
    endMs: word.endMs,
  }));
  if (karaokeMakerLineIsSection(line)) {
    return tokens;
  }
  const timedWordCount = tokens.filter(
    (token) =>
      token.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs,
  ).length;
  const hasStrongLineEvidence =
    timedWordCount >= Math.max(2, Math.ceil(tokens.length * 0.55));

  let missingStart = -1;
  for (let index = 0; index <= tokens.length; index += 1) {
    const token = tokens[index];
    const isTimed =
      token?.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs;
    if (!isTimed && index < tokens.length) {
      missingStart = missingStart < 0 ? index : missingStart;
    } else if (missingStart >= 0) {
      const missingEnd = index;
      const left = tokens[missingStart - 1];
      const right = tokens[missingEnd];
      if (
        hasStrongLineEvidence &&
        left?.endMs !== undefined &&
        right?.startMs !== undefined &&
        right.startMs > left.endMs
      ) {
        const missing = tokens.slice(missingStart, missingEnd);
        const availableMs = right.startMs - left.endMs;
        const maximumSafeMs = Math.max(2_500, missing.length * 1_200);
        if (
          availableMs >= missing.length * 20 &&
          availableMs <= maximumSafeMs
        ) {
          const weights = missing.map((word) => playableWordWeight(word.text));
          const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
          let consumedWeight = 0;
          missing.forEach((word, missingIndex) => {
            const startMs =
              (left.endMs as number) +
              (availableMs * consumedWeight) / totalWeight;
            consumedWeight += weights[missingIndex];
            const endMs =
              (left.endMs as number) +
              (availableMs * consumedWeight) / totalWeight;
            Object.assign(word, {
              startMs: Math.round(startMs),
              endMs: Math.max(Math.round(startMs) + 1, Math.round(endMs)),
            });
          });
        }
      }
      missingStart = -1;
    }
  }

  // The detector already rejects crossed evidence. Keep the preview robust to
  // an older draft by trimming only automatic-looking overlap in this copy.
  let previousEndMs: number | undefined;
  tokens.forEach((token) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      return;
    }
    const startMs = Math.max(previousEndMs ?? 0, token.startMs);
    if (token.endMs <= startMs) {
      token.startMs = undefined;
      token.endMs = undefined;
      return;
    }
    token.startMs = startMs;
    previousEndMs = token.endMs;
  });
  return tokens;
};

const makePlayableLines = (
  project: IKaraokeMakerProject,
  lines: readonly IKaraokeMakerLine[] = project.lyrics.lines,
): IKaraokeLine[] =>
  lines.flatMap((line): IKaraokeLine[] => {
    // Lyric progress must always use the repaired word timestamps. Melody
    // notes have their own pitch track and may cover only part of a word.
    // Replacing lyric tokens with those notes made the editor and preview show
    // different starts, endings and gaps for the exact same project.
    const tokens = makePlayableLyricTokens(line);
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

const makePlayablePitchNotes = (
  project: IKaraokeMakerProject,
): IKaraokeToken[] => {
  const wordsById = new Map(
    project.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const seenTokenIds = new Set<string>();
  return [...project.melody.notes]
    .filter((note) => note.tokenId && wordsById.has(note.tokenId))
    .sort((left, right) => left.startMs - right.startMs)
    .map((note) => {
      const word = note.tokenId ? wordsById.get(note.tokenId) : undefined;
      const beginsWord = Boolean(
        word && note.tokenId && !seenTokenIds.has(note.tokenId),
      );
      if (note.tokenId) {
        seenTokenIds.add(note.tokenId);
      }
      return {
        text: beginsWord ? (word?.text ?? '') : '',
        startsWord: beginsWord ? word?.startsWord : false,
        startMs: note.startMs,
        endMs: note.endMs,
        targetMidi: note.targetMidi,
        kind: note.kind,
      };
    });
};

/**
 * The lines to play, for a language.
 *
 * An absent or unknown language answers with the original rather than with
 * nothing: a song whose Spanish sheet was removed elsewhere must still play.
 */
export const sheetLines = (
  project: IKaraokeMakerProject,
  language: string | undefined,
): { lines: IKaraokeMakerLine[]; language: string | undefined } => {
  const sheet = language
    ? (project.lyrics.translations ?? []).find(
        (entry) => entry.language === language,
      )
    : undefined;
  return sheet
    ? { lines: sheet.lines, language: sheet.language }
    : { lines: project.lyrics.lines, language: project.lyrics.language };
};

/**
 * Every other language's lines, restamped with the original's own line ids.
 *
 * Each translated line gets a freshly generated id of its own, minted from the
 * paste it was seeded from, so copying the original line's id onto its partner
 * is what lets the player find "the Spanish line that goes under this English
 * line" with a single Map lookup by id — rather than assuming the two
 * playable-line arrays stay the same length after `makePlayableLines`
 * independently drops whichever ones came out empty on either side.
 *
 * Which line is whose partner is `karaokeTranslationLineBySource`'s decision
 * and not this function's: it used to be "the sheet line at the same index",
 * which stopped being true the moment `lyrics.lines` was replaced under a
 * sheet that outlived the replacement. Walking the original rather than the
 * sheet is what drops a translated line whose source is gone instead of
 * parking it under an unrelated one.
 */
const makePlayableTranslations = (
  project: IKaraokeMakerProject,
): { language: string; lines: IKaraokeLine[] }[] =>
  (project.lyrics.translations ?? []).map((sheet) => {
    const bySourceId = karaokeTranslationLineBySource(
      project.lyrics.lines,
      sheet.lines,
    );
    return {
      language: sheet.language,
      lines: makePlayableLines(
        project,
        project.lyrics.lines.flatMap((line): IKaraokeMakerLine[] => {
          const translated = bySourceId.get(line.id);
          return translated ? [{ ...translated, id: line.id }] : [];
        }),
      ),
    };
  });

export const karaokeMakerProjectToSong = (
  project: IKaraokeMakerProject,
  audioAsset: IKaraokeAsset,
  sourceAssets: readonly IKaraokeAsset[] = [audioAsset],
  options: { language?: string } = {},
): IKaraokeSong => {
  const chosen = sheetLines(project, options.language);
  const lines = makePlayableLines(project, chosen.lines);
  // Pitch notes are bound to the original's tokens and stay bound to them
  // regardless of the chosen language: the melody in project.melody is one
  // track shared by every lyric sheet, not per-language data.
  const notes = makePlayablePitchNotes(project);
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
    // Undefined rather than [] for a project with none, matching
    // `removeKaraokeTranslation`'s own convention: a song that never had a
    // translation and one that just lost its last both parse the same way,
    // and the player's picker reads `song.translations?.length` to decide
    // whether to show itself at all.
    //
    // Built unconditionally, independent of `options.language` above: the
    // two are different questions. `options.language` is which single sheet
    // this song's own `lines` plays as — unset for every real caller today,
    // per this function's own doc comment — while `translations` is every
    // *other* sheet available to show alongside whichever one that turned
    // out to be.
    translations: project.lyrics.translations?.length
      ? makePlayableTranslations(project)
      : undefined,
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
      language: chosen.language,
    },
  };
};

// Judges the sung original only. A translation may be empty or half-fitted at
// any time — that is a normal state of the work, not a defect in the project.
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
    } else if (
      !karaokeMakerWordDurationIsPlausible(
        token.text,
        token.endMs - token.startMs,
        token.source,
      )
    ) {
      issues.push({
        severity: 'error',
        code: 'invalid-word-time',
        targetId: token.id,
        message: `“${token.text}” lasts implausibly long and must be realigned.`,
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
    // Only a binding that points at a word which is no longer there. A note
    // with NO binding is an ordinary state — melody detected before the words
    // were timed, or every binding cleared by replacing the lyrics — and
    // counting those made the Maker's own "checks" total climb to one per
    // note during normal work. What that state really costs is words missing
    // from an export, and the UltraStar writer now counts those itself.
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
