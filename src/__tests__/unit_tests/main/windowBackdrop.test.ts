/** @jest-environment node */
import type { BrowserWindow } from 'electron';
import {
  applyWindowBackdrop,
  setWindowFloor,
  windowFloorColour,
} from '../../../main/windowBackdrop';

const fakeWindow = (isFullScreen: boolean) => {
  const materials: string[] = [];
  const colours: string[] = [];
  const win = {
    isDestroyed: () => false,
    isFullScreen: () => isFullScreen,
    setBackgroundMaterial: (material: string) => {
      materials.push(material);
    },
    setBackgroundColor: (colour: string) => {
      colours.push(colour);
    },
  };
  return { win: win as unknown as BrowserWindow, materials, colours };
};

describe('what the window stands on', () => {
  it('is the theme floor under a material, and black with none, full screen', () => {
    const floor = windowFloorColour();
    const windowed = fakeWindow(false);
    applyWindowBackdrop(windowed.win);
    expect(windowed.materials).toEqual(['acrylic']);
    expect(windowed.colours).toEqual([floor]);

    const full = fakeWindow(true);
    applyWindowBackdrop(full.win);
    expect(full.materials).toEqual(['none']);
    expect(full.colours).toEqual(['#000000']);
  });

  it('takes the state it is told over the one the window reports', () => {
    // Raised from the window's own transition events, which on Windows fire
    // before the window has changed: what it reports there is the old state.
    const still = fakeWindow(false);
    applyWindowBackdrop(still.win, true);
    expect(still.materials).toEqual(['none']);
    expect(still.colours).toEqual(['#000000']);
  });

  it('keeps a full screen black when the theme changes under it', () => {
    const before = windowFloorColour();
    const full = fakeWindow(true);
    setWindowFloor('#f4f4f4', full.win);
    expect(full.colours).toEqual([]);
    // Remembered for the way out, all the same.
    expect(windowFloorColour()).toBe('#f4f4f4');
    setWindowFloor(before, null);
  });

  it('accepts only a plain six-digit colour', () => {
    const before = windowFloorColour();
    const win = fakeWindow(false);
    setWindowFloor('red', win.win);
    setWindowFloor('#fff', win.win);
    setWindowFloor('#ffffff; background: url(x)', win.win);
    expect(win.colours).toEqual([]);
    expect(windowFloorColour()).toBe(before);
  });
});
