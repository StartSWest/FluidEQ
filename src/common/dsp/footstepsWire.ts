/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFootstepsSettings } from './footsteps';

/**
 * The Game filter on the rack's line: tag, schema, field count, then its
 * switch, Isolate, Lift and Calm, and from schema 2 Heavy, Environment,
 * Voices and Duck (`FEQ_CHAIN_FOOTSTEPS_*` and `FEQ_CHAIN_GAME_*` in
 * `fluideq/chain.h`).
 *
 * A trailer of its own rather than words in the lead, and written only
 * while the stage is on: every engine before 1.25 refuses a line longer
 * than it knows and bypasses the whole rack, so a rack without the filter
 * is the line it always was, and one with it reaches an older engine
 * without the trailer (`withoutFootsteps` in `chainWire.ts`,
 * `ENGINE_FOOTSTEPS_SINCE`). Engine 1.25 knows schema 1 only and refuses 2
 * the same way, so it is written the first four fields (`footstepsAlone`,
 * `ENGINE_GAME_SINCE`). It stands after the game word and the Room's
 * trailer, before the preset's curve.
 */
export const CHAIN_FOOTSTEPS_TAG = 1179602772; // ASCII FOOT
export const CHAIN_FOOTSTEPS_SCHEMA = 1;
export const CHAIN_FOOTSTEPS_FIELDS = 4;
export const CHAIN_FOOTSTEPS_TRAILER = 7;
export const CHAIN_GAME_SCHEMA = 2;
export const CHAIN_GAME_FIELDS = 8;
export const CHAIN_GAME_TRAILER = 11;

export const footstepsTrailer = (footsteps: IFootstepsSettings): number[] => [
  CHAIN_FOOTSTEPS_TAG,
  CHAIN_GAME_SCHEMA,
  CHAIN_GAME_FIELDS,
  footsteps.enabled ? 1 : 0,
  footsteps.isolate ? 1 : 0,
  footsteps.lift,
  footsteps.calm,
  footsteps.heavy ? 1 : 0,
  footsteps.environment,
  footsteps.voices,
  footsteps.duck ? 1 : 0,
];

const isUnit = (value: number): boolean => value >= 0 && value <= 1;
const isFlag = (value: number): boolean => value === 0 || value === 1;

/**
 * How long the trailer at `at` is by its schema: the Game filter's 11, the
 * Footsteps alone of 1.25's 7, or 0 where none stands.
 */
export const footstepsTrailerLength = (
  values: readonly number[],
  at: number,
): number => {
  if (values[at] !== CHAIN_FOOTSTEPS_TAG) {
    return 0;
  }
  return values[at + 1] === CHAIN_GAME_SCHEMA
    ? CHAIN_GAME_TRAILER
    : CHAIN_FOOTSTEPS_TRAILER;
};

/** The trailer at `at`, with every value one the engine accepts. */
export const isFootstepsTrailer = (
  value: readonly number[],
  at: number,
): boolean => {
  const length = footstepsTrailerLength(value, at);
  if (length === 0 || value.length < at + length) {
    return false;
  }
  const [, schema, fields, enabled, isolate, lift, calm, ...game] = value.slice(
    at,
    at + length,
  );
  const common =
    isFlag(enabled) && isFlag(isolate) && isUnit(lift) && isUnit(calm);
  if (schema === CHAIN_FOOTSTEPS_SCHEMA) {
    return common && fields === CHAIN_FOOTSTEPS_FIELDS;
  }
  const [heavy, environment, voices, duck] = game;
  return (
    common &&
    fields === CHAIN_GAME_FIELDS &&
    isFlag(heavy) &&
    environment >= -1 &&
    environment <= 1 &&
    isUnit(voices) &&
    isFlag(duck)
  );
};

/**
 * The line without the trailer that starts at `at`, everything after it
 * kept. The game word at `gameWord` goes too when it was written only for
 * the trailer to stand after — off, and with nothing behind it once the
 * trailer is gone — because an engine older than game mode refuses that
 * word as well.
 */
export const dropFootsteps = (
  values: readonly number[],
  at: number,
  gameWord: number,
): number[] => {
  const line = [
    ...values.slice(0, at),
    ...values.slice(at + footstepsTrailerLength(values, at)),
  ];
  return line.length === gameWord + 1 && line[gameWord] === 0
    ? line.slice(0, -1)
    : line;
};

/**
 * The Game filter's trailer at `at` as Footsteps alone, for engine 1.25:
 * its switch, Isolate, Lift and Calm, and none of Environment, Dialogue or
 * Heavy, which that engine would refuse the whole rack over.
 */
export const footstepsAlone = (
  values: readonly number[],
  at: number,
): number[] =>
  footstepsTrailerLength(values, at) === CHAIN_GAME_TRAILER
    ? [
        ...values.slice(0, at),
        CHAIN_FOOTSTEPS_TAG,
        CHAIN_FOOTSTEPS_SCHEMA,
        CHAIN_FOOTSTEPS_FIELDS,
        ...values.slice(at + 3, at + CHAIN_FOOTSTEPS_TRAILER),
        ...values.slice(at + CHAIN_GAME_TRAILER),
      ]
    : [...values];
