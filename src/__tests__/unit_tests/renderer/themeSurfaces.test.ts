/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The theme colours the drawings read every frame.
 *
 * Asked of the computed style on every frame, each read made the browser
 * restyle the whole page there and then whenever anything had changed since
 * the last frame, which in the Studio was always. So the value is asked only
 * when the root has changed. What has to hold is both halves: the style is
 * not asked again for nothing, and every change that can move a surface —
 * the theme, a scene's tint on the root, a stylesheet — is still seen.
 */

import {
  readSurface,
  readTextInk,
  setThemeShade,
} from '../../../renderer/utils/theme';
import {
  OCEAN_SHADE,
  THEME_SHADE_MAX,
  themeShadeTokens,
} from '../../../renderer/utils/themeShade';

const root = document.documentElement;
let computed: jest.SpyInstance;

/** Lets the head observer's record run before the next read. */
const observed = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

beforeEach(() => {
  root.removeAttribute('style');
  computed = jest.spyOn(window, 'getComputedStyle');
});

afterEach(() => {
  computed.mockRestore();
});

it('asks the style once for repeated reads of an unchanged root', () => {
  root.style.setProperty('--text-faint', '#123456');
  expect(readTextInk()).toBe('#123456');
  const asked = computed.mock.calls.length;
  expect(readTextInk()).toBe('#123456');
  expect(readTextInk()).toBe('#123456');
  expect(computed.mock.calls.length).toBe(asked);
});

it('reads again when a tint rewrites the root inline style', () => {
  root.style.setProperty('--surface-panel', '#000001');
  expect(readSurface('--surface-panel', '#ffffff')).toBe('#000001');
  root.style.setProperty('--surface-panel', '#000002');
  expect(readSurface('--surface-panel', '#ffffff')).toBe('#000002');
});

it('reads again when the theme attribute changes', () => {
  const style = document.createElement('style');
  style.textContent =
    ':root { --dsp-sky: #111111; } :root[data-theme-shade="40"] { --dsp-sky: #222222; }';
  document.head.append(style);
  setThemeShade(0);
  expect(readSurface('--dsp-sky', '#ffffff')).toBe('#111111');
  setThemeShade(40);
  expect(readSurface('--dsp-sky', '#ffffff')).toBe('#222222');
  setThemeShade(0);
  style.remove();
});

// The drawings read the theme's own colours as the slider moves, each step
// at once, and the slider's ends and middle are the colours it promises.
it("follows the theme's slider step by step", () => {
  setThemeShade(0);
  expect(readSurface('--surface-panel', '#ffffff')).toBe('#0c0e12');
  setThemeShade(OCEAN_SHADE);
  expect(readSurface('--surface-panel', '#ffffff')).toBe('#1a3a4e');
  setThemeShade(THEME_SHADE_MAX);
  expect(readSurface('--surface-panel', '#ffffff')).toBe(
    themeShadeTokens(THEME_SHADE_MAX)['--surface-panel'],
  );
  setThemeShade(0);
});

it('reads again when a stylesheet is rewritten in place', async () => {
  const style = document.createElement('style');
  style.textContent = ':root { --meter-well: #333333; }';
  document.head.append(style);
  expect(readSurface('--meter-well', '#ffffff')).toBe('#333333');
  style.textContent = ':root { --meter-well: #444444; }';
  await observed();
  expect(readSurface('--meter-well', '#ffffff')).toBe('#444444');
  style.remove();
});

it('falls back when no stylesheet declares the surface', () => {
  expect(readSurface('--meter-unlit', '#1a3a4e')).toBe('#1a3a4e');
});
