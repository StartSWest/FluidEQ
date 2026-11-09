/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  cameraKeyForHelper,
  cameraKeyOfCode,
  DEFAULT_SCENE_CAMERA_CONTROL,
  isSceneCameraControl,
  normalizeSceneCameraControl,
  printedKey,
} from '../../../common/sceneCameraControl';

/**
 * How a scene's camera is moved, as the window stores it and main checks
 * it: Ctrl, Alt, Shift or a key of the keyboard's own, and a drag or the
 * mouse moving alone.
 */

describe('the keys a camera may be moved with', () => {
  it('takes either side of a modifier by its name', () => {
    expect(cameraKeyOfCode('ControlRight')).toBe('ctrl');
    expect(cameraKeyOfCode('AltLeft')).toBe('alt');
    expect(cameraKeyOfCode('ShiftRight')).toBe('shift');
  });

  it('takes a letter, a digit or plain punctuation, by its place', () => {
    expect(cameraKeyOfCode('KeyZ')).toBe('code:KeyZ');
    expect(cameraKeyOfCode('Digit4')).toBe('code:Digit4');
    expect(cameraKeyOfCode('Numpad7')).toBe('code:Numpad7');
    expect(cameraKeyOfCode('Backquote')).toBe('code:Backquote');
  });

  // Ivan, 2026-11-09: "allow a secure commands on the scene so no hacker can
  // run command or things malicious on scenes".
  it('refuses every key a command of the app or of Windows answers', () => {
    [
      'Escape',
      'Tab',
      'Enter',
      'Backspace',
      'Space',
      'F1',
      'F4',
      'F5',
      'F10',
      'F11',
      'F12',
      'ArrowUp',
      'Home',
      'Delete',
      'Minus',
      'Equal',
      'NumpadAdd',
      'NumpadSubtract',
      'CapsLock',
      'MetaLeft',
      'ContextMenu',
      'PrintScreen',
      'Unidentified',
    ].forEach((code) => expect(cameraKeyOfCode(code)).toBeUndefined());
  });
});

describe('the stored choice', () => {
  it('reads what was stored, and the default for anything else', () => {
    const chosen = {
      key: 'code:KeyQ',
      move: 'move',
      follow: true,
      orbit: 'slow',
    };
    expect(isSceneCameraControl(chosen)).toBe(true);
    expect(normalizeSceneCameraControl(chosen)).toEqual(chosen);
    [undefined, null, 'ctrl', { key: 'meta', move: 'fling', orbit: 9 }].forEach(
      (raw) =>
        expect(normalizeSceneCameraControl(raw)).toEqual(
          DEFAULT_SCENE_CAMERA_CONTROL,
        ),
    );
  });

  // A choice stored before the lean and the orbit existed keeps its key and
  // its way, and starts with both off; a refused key alone falls back alone.
  it('keeps each part it can read, and fills the rest from the default', () => {
    expect(
      normalizeSceneCameraControl({ key: 'code:KeyQ', move: 'move' }),
    ).toEqual({
      key: 'code:KeyQ',
      move: 'move',
      follow: false,
      orbit: 'off',
    });
    expect(
      normalizeSceneCameraControl({
        key: 'code:Escape',
        move: 'move',
        follow: true,
      }),
    ).toEqual({ key: 'ctrl', move: 'move', follow: true, orbit: 'off' });
  });

  it('takes from the window only a choice whole in every part', () => {
    expect(isSceneCameraControl({ key: 'ctrl', move: 'drag' })).toBe(false);
    expect(
      isSceneCameraControl({
        key: 'ctrl',
        move: 'drag',
        follow: 'yes',
        orbit: 'off',
      }),
    ).toBe(false);
  });

  it('starts as it always was: Ctrl and a drag, nothing moving by itself', () => {
    expect(DEFAULT_SCENE_CAMERA_CONTROL).toEqual({
      key: 'ctrl',
      move: 'drag',
      follow: false,
      orbit: 'off',
    });
  });
});

describe("the desktop helper's word for a key", () => {
  it('names a modifier, and gives any other key its place on the keyboard', () => {
    expect(cameraKeyForHelper('alt')).toBe('alt');
    expect(cameraKeyForHelper('code:KeyA')).toBe('scan:0x1e');
    // An extended key carries 0xE0 in its high byte, as Windows numbers it.
    expect(cameraKeyForHelper('code:NumpadDivide')).toBe('scan:0xe035');
  });
});

describe('a key as it is written on it', () => {
  it('prints a letter and a digit, and leaves punctuation to its code', () => {
    expect(printedKey('KeyQ')).toBe('Q');
    expect(printedKey('Digit7')).toBe('7');
    expect(printedKey('Numpad3')).toBe('3');
    expect(printedKey('Backquote')).toBeUndefined();
  });
});
