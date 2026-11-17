/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * How much of a Plus scene shows through the EQ page's panels over it - the
 * bands' card, the tab row and the graph's legend - and how blurred (Ivan,
 * 2026-11-17: "make the EQ band transparent, and have a setting for blur and
 * transparency, for when those scenes are on"). One choice for every scene:
 * it is about the page standing on the picture, not about any one picture.
 *
 * Transparency stops at half (Ivan, same day: "transparency is the cap, not
 * the maximum transparency; 50% I think is fine"): past it the card's words
 * and knobs stand on the picture more than on the card, and a bright scene
 * swallows them. Both start at 0, the card's own face with nothing behind it,
 * which is what the page wore before the setting existed.
 */
export const SCENE_PANELS_MAX_SEE_THROUGH = 50;

/** Past this the picture is a flat wash and more costs frames for nothing. */
export const SCENE_PANELS_MAX_BLUR = 24;

/**
 * From here the panels' words carry the outline they wear on the picture
 * (`over-picture-text`): at a quarter of the scene through the card, a snow
 * field behind a light label leaves it under 3:1.
 */
const INK_FROM_SEE_THROUGH = 25;

const SEE_THROUGH_KEY = 'fluideq.scenePanelsSeeThrough';
const BLUR_KEY = 'fluideq.scenePanelsBlur';

const clamp = (value: number, high: number) =>
  Math.round(Math.min(high, Math.max(0, value)));

/** Unreadable or missing is 0: the panels as they were before. */
const readValue = (key: string, high: number) => {
  const value = Number(readStored(key));
  return Number.isFinite(value) ? clamp(value, high) : 0;
};

let seeThrough = readValue(SEE_THROUGH_KEY, SCENE_PANELS_MAX_SEE_THROUGH);
let blur = readValue(BLUR_KEY, SCENE_PANELS_MAX_BLUR);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** In percent of the scene through the panels, 0 to the cap. */
export const setScenePanelsSeeThrough = (next: number) => {
  const value = clamp(next, SCENE_PANELS_MAX_SEE_THROUGH);
  if (value === seeThrough) {
    return;
  }
  seeThrough = value;
  writeStored(SEE_THROUGH_KEY, String(value));
  notify();
};

/** In pixels of blur behind the panels. */
export const setScenePanelsBlur = (next: number) => {
  const value = clamp(next, SCENE_PANELS_MAX_BLUR);
  if (value === blur) {
    return;
  }
  blur = value;
  writeStored(BLUR_KEY, String(value));
  notify();
};

export const useScenePanelsSeeThrough = () =>
  useSyncExternalStore(
    subscribe,
    () => seeThrough,
    () => 0,
  );

export const useScenePanelsBlur = () =>
  useSyncExternalStore(
    subscribe,
    () => blur,
    () => 0,
  );

/**
 * The two values on the document's root, where the stylesheet reads them
 * (`App.scss`, `GraphCornerLegend.scss`): the panels' face as the share of the card's colour
 * left, the blur in pixels, and two marks - `has-scene-panel-glass` while any
 * of the scene comes through, which is also what runs the scene's layer on
 * down under the card (drawing those pixels only when they can be seen),
 * `has-scene-panel-blur` while a blur is chosen (a backdrop filter at 0px
 * still costs its compositing), and `has-scene-panel-ink` once the words
 * need their outline.
 */
export const useScenePanelsOnRoot = () => {
  const through = useScenePanelsSeeThrough();
  const blurred = useScenePanelsBlur();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scene-panel-face', `${100 - through}%`);
    root.style.setProperty('--scene-panel-blur', `${blurred}px`);
    root.classList.toggle('has-scene-panel-glass', through > 0);
    root.classList.toggle('has-scene-panel-blur', blurred > 0);
    root.classList.toggle(
      'has-scene-panel-ink',
      through >= INK_FROM_SEE_THROUGH,
    );
  }, [through, blurred]);
};
