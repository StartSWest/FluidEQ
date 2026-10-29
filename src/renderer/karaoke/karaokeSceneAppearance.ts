/* FluidEQ — GPL-3.0-or-later */
import { useEffect, useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../utils/graphStorage';
import { MAX_OVERLAY_BLUR, getOverlayBlur } from '../utils/graphOverlay';

const OPACITY_KEY = 'fluideq-karaoke-scene-opacity';
const BLUR_KEY = 'fluideq-karaoke-scene-blur';
const read = (key: string, max: number) => {
  const stored = readStored(key);
  if (stored === null) {
    return undefined;
  }
  const value = Number(stored);
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : undefined;
};
let opacity = read(OPACITY_KEY, 1);
const storedBlur = read(BLUR_KEY, MAX_OVERLAY_BLUR);
// Compatibility is a one-time seed, never a subscription to another picture.
let blur = storedBlur ?? getOverlayBlur();
let needsBlurSeed = storedBlur === undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => listeners.forEach((listener) => listener());
const getOpacity = () => opacity ?? 1;
const getBlur = () => blur;
const persistBlurSeed = () => {
  if (!needsBlurSeed) {
    return;
  }
  needsBlurSeed = false;
  writeStored(BLUR_KEY, String(blur));
};
export const setKaraokeSceneOpacity = (next: number) => {
  if (!Number.isFinite(next)) {
    return;
  }
  opacity = Math.min(1, Math.max(0, next));
  writeStored(OPACITY_KEY, String(opacity));
  notify();
};
export const setKaraokeSceneBlur = (next: number) => {
  if (!Number.isFinite(next)) {
    return;
  }
  blur = Math.min(MAX_OVERLAY_BLUR, Math.max(0, Math.round(next)));
  needsBlurSeed = false;
  writeStored(BLUR_KEY, String(blur));
  notify();
};
/** Persist the compatibility seed on first use, so a reload cannot recouple it. */
export const useKaraokeSceneAppearance = () => {
  useEffect(persistBlurSeed, []);
  const sceneOpacity = useSyncExternalStore(subscribe, getOpacity, getOpacity);
  const sceneBlur = useSyncExternalStore(subscribe, getBlur, getBlur);
  return { opacity: sceneOpacity, blur: sceneBlur };
};
