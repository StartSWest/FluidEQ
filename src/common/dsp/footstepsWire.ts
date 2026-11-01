/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFootstepsSettings } from './footsteps';

/**
 * Footsteps on the rack's line: tag, schema, field count, then its switch,
 * Isolate, Lift and Calm (`FEQ_CHAIN_FOOTSTEPS_*` in `fluideq/chain.h`).
 *
 * A trailer of its own rather than words in the lead, and written only
 * while the stage is on: every engine before 1.25 refuses a line longer
 * than it knows and bypasses the whole rack, so a rack without Footsteps is
 * the line it always was, and one with it reaches an older engine without
 * the trailer (`withoutFootsteps` in `chainWire.ts`, `ENGINE_FOOTSTEPS_SINCE`).
 * It stands after the game word and the Room's trailer, before the preset's
 * curve.
 */
export const CHAIN_FOOTSTEPS_TAG = 1179602772; // ASCII FOOT
export const CHAIN_FOOTSTEPS_SCHEMA = 1;
export const CHAIN_FOOTSTEPS_FIELDS = 4;
export const CHAIN_FOOTSTEPS_TRAILER = 7;

export const footstepsTrailer = (footsteps: IFootstepsSettings): number[] => [
  CHAIN_FOOTSTEPS_TAG,
  CHAIN_FOOTSTEPS_SCHEMA,
  CHAIN_FOOTSTEPS_FIELDS,
  footsteps.enabled ? 1 : 0,
  footsteps.isolate ? 1 : 0,
  footsteps.lift,
  footsteps.calm,
];

const isUnit = (value: number): boolean => value >= 0 && value <= 1;

/** The trailer at `at`, with every value one the engine accepts. */
export const isFootstepsTrailer = (
  value: readonly number[],
  at: number,
): boolean => {
  if (value.length < at + CHAIN_FOOTSTEPS_TRAILER) {
    return false;
  }
  const [tag, schema, fields, enabled, isolate, lift, calm] = value.slice(
    at,
    at + CHAIN_FOOTSTEPS_TRAILER,
  );
  return (
    tag === CHAIN_FOOTSTEPS_TAG &&
    schema === CHAIN_FOOTSTEPS_SCHEMA &&
    fields === CHAIN_FOOTSTEPS_FIELDS &&
    (enabled === 0 || enabled === 1) &&
    (isolate === 0 || isolate === 1) &&
    isUnit(lift) &&
    isUnit(calm)
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
    ...values.slice(at + CHAIN_FOOTSTEPS_TRAILER),
  ];
  return line.length === gameWord + 1 && line[gameWord] === 0
    ? line.slice(0, -1)
    : line;
};
