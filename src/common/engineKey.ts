/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The on/off key: FluidEQ's power switch on a key the listener picks, held
 * system-wide so it works from any program, a full-screen game included
 * (Ivan, 2026-11-04: "is just off fluid engine and on again nothing else").
 * Pressing it is the switch: nothing is processed while off, and on brings
 * back the same sound; no profile, preset or game sound changes.
 *
 * No key until one is picked. Any key held system-wide is taken from every
 * other program, so none is taken by default.
 */

export const ENGINE_KEY_GET = 'engine-key-get';
export const ENGINE_KEY_SET = 'engine-key-set';
export const ENGINE_KEY_PRESSED = 'engine-key-pressed';

/** Why a key cannot be the on/off key. */
export type TEngineKeyProblem = 'invalid' | 'modifier' | 'altgr' | 'taken';

export type TEngineKeyAnswer =
  { ok: true; accelerator: string } | { ok: false; problem: TEngineKeyProblem };

/** Electron's names, in the order an accelerator is written in. */
const MODIFIERS = ['Control', 'Alt', 'Shift', 'Super'] as const;
type TModifier = (typeof MODIFIERS)[number];

const isModifier = (part: string): part is TModifier =>
  (MODIFIERS as readonly string[]).includes(part);

const LETTER_OR_DIGIT = /^[A-Z0-9]$/;
const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

/**
 * Why `accelerator` cannot be the key, or undefined when it can.
 *
 * - `modifier`: a letter or digit alone or with Shift alone is typing, and an
 *   F1 to F12 alone is a key programs already use (F12 is Steam's
 *   screenshot). F13 to F24, which no keyboard types with, may stand alone.
 * - `altgr`: Windows sends Ctrl + Alt for AltGr, so Ctrl + Alt with a letter
 *   or digit is how a German, Spanish or French keyboard types € @ [ ] — held
 *   system-wide it would stop those characters being typed anywhere.
 */
export const engineKeyProblem = (
  accelerator: string,
): TEngineKeyProblem | undefined => {
  const parts = accelerator.split('+');
  const key = parts.pop() ?? '';
  const isLetterOrDigit = LETTER_OR_DIGIT.test(key);
  const functionKey = FUNCTION_KEY.exec(key);
  if (
    (!isLetterOrDigit && !functionKey) ||
    !parts.every(isModifier) ||
    // Each once, in Electron's order: one spelling for one key.
    parts.join('+') !==
      MODIFIERS.filter((modifier) => parts.includes(modifier)).join('+')
  ) {
    return 'invalid';
  }
  const lone =
    parts.length === 0 || (parts.length === 1 && parts[0] === 'Shift');
  if (lone && !(functionKey && Number(functionKey[1]) >= 13)) {
    return 'modifier';
  }
  if (isLetterOrDigit && parts.includes('Control') && parts.includes('Alt')) {
    return 'altgr';
  }
  return undefined;
};

/** What a key press says, the part of a keyboard event that is read. */
export interface IKeyPress {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * The accelerator a key press makes, or undefined while only modifiers are
 * down or the key is one the on/off key cannot be. Read from the key's place
 * on the keyboard (`code`), not what it types, so a layout's AltGr or dead
 * keys do not change which key was meant.
 */
export const acceleratorOfKey = (press: IKeyPress): string | undefined => {
  const letter = /^Key([A-Z])$/.exec(press.code);
  const digit = /^Digit([0-9])$/.exec(press.code);
  const functionKey = /^(F[0-9]{1,2})$/.exec(press.code);
  const key = letter?.[1] ?? digit?.[1] ?? functionKey?.[1];
  if (key === undefined) {
    return undefined;
  }
  const down: Record<TModifier, boolean> = {
    Control: press.ctrlKey,
    Alt: press.altKey,
    Shift: press.shiftKey,
    Super: press.metaKey,
  };
  return [...MODIFIERS.filter((modifier) => down[modifier]), key].join('+');
};

/** The key as it is written on the keys, one name a key. */
export const engineKeyNames = (accelerator: string, isMac: boolean): string[] =>
  accelerator.split('+').map((part) => {
    if (part === 'Control') {
      return isMac ? '⌃' : 'Ctrl';
    }
    if (part === 'Alt') {
      return isMac ? '⌥' : 'Alt';
    }
    if (part === 'Shift') {
      return isMac ? '⇧' : 'Shift';
    }
    if (part === 'Super') {
      return isMac ? '⌘' : 'Win';
    }
    return part;
  });
