/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the viewer moves a 3D scene's camera (Ivan, 2026-11-09: "we should be
 * able to set the combination that moves the scene ... they can change the
 * control or if to click and drag to move or just move mouse with that
 * control or what ever key pressed"): the key held for it, and whether that
 * key and a drag turn the scene or that key and the mouse moving alone. The
 * wheel with the same key moves in and out either way; a plain click, press
 * or wheel stays the scene's own and the panel's (`sceneInteraction.ts`).
 *
 * One setting for every surface - the graph, the Studio's stage, the
 * gallery's preview and the desktop background - kept by the window and
 * told to main, which keeps it for the desktop's pages and its helper.
 */

/**
 * The key: Ctrl (with ⌘ on a Mac, as before there was a choice), Alt, Shift,
 * or any other key, as the keyboard's own code for where it sits
 * (`KeyboardEvent.code`, `code:KeyZ`), so a letter is the same key whatever
 * the layout types on it.
 */
export type TSceneCameraKey = 'ctrl' | 'alt' | 'shift' | `code:${string}`;
/** Hold the key and drag, or hold the key and just move the mouse. */
export type TSceneCameraMove = 'drag' | 'move';

export interface ISceneCameraControl {
  key: TSceneCameraKey;
  move: TSceneCameraMove;
}

export const SCENE_CAMERA_MODIFIERS = ['ctrl', 'alt', 'shift'] as const;
export const SCENE_CAMERA_MOVES: readonly TSceneCameraMove[] = ['drag', 'move'];

/** What every install starts with: what the app did before the choice. */
export const DEFAULT_SCENE_CAMERA_CONTROL: ISceneCameraControl = {
  key: 'ctrl',
  move: 'drag',
};

/**
 * The keys that may be the camera's, besides the three modifiers, and where
 * each sits on the keyboard: its scan code, as Windows numbers it (0xE0 in
 * the high byte for the extended keys). The scan code is what main hands the
 * desktop helper, which asks Windows for the key at that place
 * (`MapVirtualKey`), so a letter chosen in the window is the same key over
 * the desktop on any layout.
 *
 * The letters, the digits and the plain punctuation, which no command of
 * the app's or of Windows answers on its own, and nothing else (Ivan,
 * 2026-11-09: "allow a secure commands on the scene so no hacker can run
 * command or things malicious on scenes"): not Esc, Tab, Enter or Backspace,
 * which close, move and type; not Space, which steps to the next look; not
 * the arrows, Home, End, Page Up and Down, Insert and Delete, which move
 * through the app's lists and fields; not the function keys - F1 opens the
 * guide, F10 a menu, F11 and F12 are Windows' and Chromium's; not - and = or
 * the keypad's + and -, which zoom the karaoke maker and the framing view;
 * not the lock keys, the Windows key, the menu key, Print Screen or Pause. A
 * binding is one key alone, never a combination, so Ctrl+W or Alt+F4 cannot
 * be one. And it is the app's only: a scene never reads it (`sceneInteraction`
 * hands a scene its pointer and its camera, nothing of the keyboard).
 */
const SCAN_CODES: Readonly<Record<string, number>> = {
  KeyQ: 0x10,
  KeyW: 0x11,
  KeyE: 0x12,
  KeyR: 0x13,
  KeyT: 0x14,
  KeyY: 0x15,
  KeyU: 0x16,
  KeyI: 0x17,
  KeyO: 0x18,
  KeyP: 0x19,
  KeyA: 0x1e,
  KeyS: 0x1f,
  KeyD: 0x20,
  KeyF: 0x21,
  KeyG: 0x22,
  KeyH: 0x23,
  KeyJ: 0x24,
  KeyK: 0x25,
  KeyL: 0x26,
  KeyZ: 0x2c,
  KeyX: 0x2d,
  KeyC: 0x2e,
  KeyV: 0x2f,
  KeyB: 0x30,
  KeyN: 0x31,
  KeyM: 0x32,
  Digit1: 0x02,
  Digit2: 0x03,
  Digit3: 0x04,
  Digit4: 0x05,
  Digit5: 0x06,
  Digit6: 0x07,
  Digit7: 0x08,
  Digit8: 0x09,
  Digit9: 0x0a,
  Digit0: 0x0b,
  Backquote: 0x29,
  BracketLeft: 0x1a,
  BracketRight: 0x1b,
  Semicolon: 0x27,
  Quote: 0x28,
  Backslash: 0x2b,
  IntlBackslash: 0x56,
  Comma: 0x33,
  Period: 0x34,
  Slash: 0x35,
  Numpad0: 0x52,
  Numpad1: 0x4f,
  Numpad2: 0x50,
  Numpad3: 0x51,
  Numpad4: 0x4b,
  Numpad5: 0x4c,
  Numpad6: 0x4d,
  Numpad7: 0x47,
  Numpad8: 0x48,
  Numpad9: 0x49,
  NumpadDecimal: 0x53,
  NumpadMultiply: 0x37,
  NumpadDivide: 0xe035,
};

/** The modifier a key code is, when it is one of the three. */
const MODIFIER_OF_CODE: Readonly<Record<string, TSceneCameraKey>> = {
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  AltLeft: 'alt',
  AltRight: 'alt',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
};

/**
 * The camera key a key press asks for, when it may be one: either Ctrl, Alt
 * or Shift by name, whichever side, or the key's own code (`SCAN_CODES`).
 */
export const cameraKeyOfCode = (code: string): TSceneCameraKey | undefined => {
  const modifier = MODIFIER_OF_CODE[code];
  if (modifier) {
    return modifier;
  }
  if (SCAN_CODES[code] === undefined) {
    return undefined;
  }
  return `code:${code}`;
};

/** The key code of a key that is not one of the three modifiers. */
export const codeOfCameraKey = (key: TSceneCameraKey): string | undefined =>
  key.startsWith('code:') ? key.slice('code:'.length) : undefined;

/**
 * What main tells the desktop helper to read for `key`: a modifier by name,
 * or the place of any other key on the keyboard (`scan:0x1e`), which the
 * helper turns into the key that sits there now.
 */
export const cameraKeyForHelper = (key: TSceneCameraKey): string => {
  const code = codeOfCameraKey(key);
  if (code === undefined) {
    return key;
  }
  const scan = SCAN_CODES[code];
  return scan === undefined ? 'ctrl' : `scan:0x${scan.toString(16)}`;
};

const isCameraKey = (raw: unknown): raw is TSceneCameraKey => {
  if (typeof raw !== 'string') {
    return false;
  }
  if ((SCENE_CAMERA_MODIFIERS as readonly string[]).includes(raw)) {
    return true;
  }
  const code = codeOfCameraKey(raw as TSceneCameraKey);
  return code !== undefined && cameraKeyOfCode(code) === raw;
};

export const isSceneCameraControl = (
  raw: unknown,
): raw is ISceneCameraControl =>
  typeof raw === 'object' &&
  raw !== null &&
  isCameraKey((raw as { key?: unknown }).key) &&
  SCENE_CAMERA_MOVES.includes((raw as { move?: unknown }).move as never);

/** What was stored, or the default where it is anything but a choice. */
export const normalizeSceneCameraControl = (
  raw: unknown,
): ISceneCameraControl =>
  isSceneCameraControl(raw)
    ? { key: raw.key, move: raw.move }
    : DEFAULT_SCENE_CAMERA_CONTROL;

export const sameSceneCameraControl = (
  left: ISceneCameraControl,
  right: ISceneCameraControl,
) => left.key === right.key && left.move === right.move;

/**
 * A key code as it is written on the key, where that is plain: the letter
 * or the digit. Undefined for the punctuation, which is shown by its code.
 */
export const printedKey = (code: string): string | undefined => {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return letter[1];
  }
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) {
    return digit[1];
  }
  return undefined;
};
