/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { FLUID_ENGINE_PROGRAMME_FILENAME } from '../common/audioEngine';
import type { IEngineHealth } from '../common/engineHealth';
import { createSongLevelStore, SONG_LEVELS_FILENAME } from './songLevels';
import { createSongProgramme, songIdentity } from './songProgramme';
import type { ISystemMediaSnapshot } from './systemMedia';

/**
 * What `native/tray-host/tests/song_teller_test.cpp` holds the tray's song
 * telling to, written by `generate-sound-hops-fixture.ts` into
 * `song_teller_fixture.h`: a script of songs, outputs and the engine's
 * reports played through main's own `createSongProgramme` and
 * `createSongLevelStore`, with every file main wrote after each step and
 * the levels it kept at the end. The tray plays the same script and must
 * write the same files and keep the same levels.
 */

const G1 = '{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}';
const G2 = '{0E9D8C7B-6A5F-4E3D-2C1B-0A9F8E7D6C5B}';
const G3 = '{AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE}';

const SONGS = {
  A: { app: 'Spotify.exe', title: 'Song A', artist: 'Band' },
  B: { app: 'Chrome', title: 'Song B', artist: '' },
} as const;
type TSong = keyof typeof SONGS;
const idOf = (song: TSong) => songIdentity(SONGS[song]);

/** Main 0, media 1, health 2, reflush 3. */
type TStep =
  | { kind: 'main'; endpoint?: string }
  | { kind: 'media'; song?: TSong }
  | {
      kind: 'health';
      outputs: {
        endpoint: string;
        finished?: { id: string; seconds: number; level: number; peak: number };
      }[];
    }
  | { kind: 'reflush' };

const STEPS: TStep[] = [
  { kind: 'main', endpoint: G1 },
  { kind: 'health', outputs: [{ endpoint: G2 }] },
  { kind: 'media', song: 'A' },
  { kind: 'media', song: 'A' },
  {
    kind: 'health',
    outputs: [
      {
        endpoint: G1,
        finished: { id: idOf('A'), seconds: 200, level: -12.345, peak: -1.2 },
      },
    ],
  },
  {
    kind: 'health',
    outputs: [
      {
        endpoint: G1,
        finished: { id: idOf('A'), seconds: 200, level: -12.345, peak: -1.2 },
      },
    ],
  },
  {
    kind: 'health',
    outputs: [
      {
        endpoint: G2,
        finished: { id: idOf('A'), seconds: 20, level: -5, peak: 0 },
      },
    ],
  },
  { kind: 'health', outputs: [{ endpoint: G3 }, { endpoint: 'not-a-guid' }] },
  { kind: 'media' },
  { kind: 'media', song: 'B' },
  {
    kind: 'health',
    outputs: [
      {
        endpoint: G1,
        finished: { id: idOf('B'), seconds: 100, level: -20.125, peak: -3 },
      },
    ],
  },
  {
    kind: 'health',
    outputs: [
      {
        endpoint: G1,
        finished: { id: idOf('A'), seconds: 300, level: -15, peak: -0.5 },
      },
      {
        endpoint: G3,
        finished: { id: 'nothexatall!!!!!', seconds: 90, level: -9, peak: -1 },
      },
    ],
  },
  { kind: 'main', endpoint: G2 },
  { kind: 'media', song: 'B' },
  { kind: 'reflush' },
];

type TWrite = [name: string, contents: string];
type TKept = [
  key: string,
  level: number,
  peak: number,
  seconds: number,
  heardAt: number,
];

const byName = ([a]: TWrite, [b]: TWrite) => (a < b ? -1 : Number(a > b));

/** The script through main's own code, its clock counting in seconds. */
const runMain = async (): Promise<{ writes: TWrite[][]; kept: TKept[] }> => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-teller-'));
  try {
    let clock = 0;
    const store = createSongLevelStore(folder, () => {
      clock += 1000;
      return clock;
    });
    let main: string | undefined;
    let wrote: TWrite[] = [];
    const programme = createSongProgramme({
      store,
      mainEndpoint: () => main,
      fileName: FLUID_ENGINE_PROGRAMME_FILENAME,
      resolveConfigDir: () => Promise.resolve('engine'),
      write: (filePath, contents) => {
        wrote.push([path.basename(filePath), contents]);
        return Promise.resolve();
      },
      watchEngine: () => Promise.resolve(),
    });
    let playing: ISystemMediaSnapshot | undefined;
    // The song already named, read again: it says nothing new, and its
    // promise is the queue's, so what was written by then is the step's.
    const settle = () => programme.onMedia(playing);
    const writes: TWrite[][] = [];
    const play = async (step: TStep) => {
      wrote = [];
      if (step.kind === 'main') {
        main = step.endpoint;
      } else if (step.kind === 'media') {
        playing = step.song
          ? (SONGS[step.song] as unknown as ISystemMediaSnapshot)
          : undefined;
        await programme.onMedia(playing);
      } else if (step.kind === 'health') {
        programme.onHealth({
          outputs: step.outputs.map(({ endpoint, finished }) => ({
            endpoint,
            ...(finished
              ? {
                  lastSong: {
                    id: finished.id,
                    seconds: finished.seconds,
                    levelLufs: finished.level,
                    peakDb: finished.peak,
                  },
                }
              : {}),
          })),
        } as unknown as IEngineHealth);
        await settle();
      } else {
        await programme.reflush();
      }
      writes.push([...wrote].sort(byName));
    };
    // One step after another: each step's files are its own.
    await STEPS.reduce(
      (previous, step) => previous.then(() => play(step)),
      Promise.resolve(),
    );
    const saved = JSON.parse(
      readFileSync(path.join(folder, SONG_LEVELS_FILENAME), 'utf8'),
    ) as { songs: Record<string, Record<string, number>> };
    const kept = Object.entries(saved.songs)
      .map(([key, entry]): TKept => [
        key,
        entry.levelLufs,
        entry.peakDb,
        entry.seconds,
        entry.heardAt,
      ])
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)));
    return { writes, kept };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
};

/** UTF-8 bytes as a C string: printable ASCII as itself, the rest in octal. */
const cText = (value: string) =>
  `"${[...new TextEncoder().encode(value)]
    .map((byte) =>
      byte >= 0x20 && byte < 0x7f && byte !== 0x22 && byte !== 0x5c
        ? String.fromCharCode(byte)
        : `\\${byte.toString(8).padStart(3, '0')}`,
    )
    .join('')}"`;

/** A double as C++ reads it back exactly. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

const STEP_KINDS = { main: 0, media: 1, health: 2, reflush: 3 } as const;

const stepRow = (step: TStep): string => {
  if (step.kind === 'main') {
    return `{${STEP_KINDS.main}, ${cText(step.endpoint ?? '')}, {}}`;
  }
  if (step.kind === 'media') {
    return `{${STEP_KINDS.media}, ${cText(step.song ? idOf(step.song) : '')}, {}}`;
  }
  if (step.kind === 'reflush') {
    return `{${STEP_KINDS.reflush}, "", {}}`;
  }
  return `{${STEP_KINDS.health}, "", {${step.outputs
    .map(({ endpoint, finished }) =>
      finished
        ? `{${cText(endpoint)}, true, ${cText(finished.id)}, ${cDouble(finished.seconds)}, ${cDouble(finished.level)}, ${cDouble(finished.peak)}}`
        : `{${cText(endpoint)}, false, "", 0.0, 0.0, 0.0}`,
    )
    .join(', ')}}}`;
};

export const songTellerFixture = async (): Promise<string> => {
  const { writes, kept } = await runMain();
  return [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/main/songTellerFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    '#include <vector>',
    '',
    'namespace feq::tray::fixture {',
    '',
    'struct Output {',
    '  const char* endpoint;',
    '  bool finished;',
    '  const char* id;',
    '  double seconds;',
    '  double level;',
    '  double peak;',
    '};',
    '',
    '// Main 0 (an endpoint, empty for none), media 1 (an identity, empty for',
    '// none), health 2 (its outputs), reflush 3.',
    'struct Step {',
    '  int kind;',
    '  const char* text;',
    '  std::vector<Output> outputs;',
    '};',
    '',
    `inline const std::vector<Step> kSteps = {`,
    ...STEPS.map((step) => `    ${stepRow(step)},`),
    '};',
    '',
    "// Each step's files, by name.",
    'struct Write {',
    '  const char* name;',
    '  const char* contents;',
    '};',
    'inline const std::vector<std::vector<Write>> kWrites = {',
    ...writes.map(
      (step) =>
        `    {${step.map(([name, contents]) => `{${cText(name)}, ${cText(contents)}}`).join(', ')}},`,
    ),
    '};',
    '',
    '// The levels kept at the end, by key.',
    'struct Kept {',
    '  const char* key;',
    '  double level;',
    '  double peak;',
    '  double seconds;',
    '  double heard_at;',
    '};',
    'inline const std::vector<Kept> kKept = {',
    ...kept.map(
      ([key, level, peak, seconds, heardAt]) =>
        `    {${cText(key)}, ${cDouble(level)}, ${cDouble(peak)}, ${cDouble(seconds)}, ${cDouble(heardAt)}},`,
    ),
    '};',
    '',
    '}  // namespace feq::tray::fixture',
    '',
  ].join('\n');
};
