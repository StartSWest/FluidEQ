/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSceneColumnHead } from '../utils/sceneCover';
import { createHeadInkFollower, type TSceneProbeRect } from './sceneHeadInk';
import type { ISceneRunnerProbe } from './sceneRunnerTypes';

/**
 * The ink the EQ head's words wear over the graph's scene, while the scene
 * is drawn on the column's layer behind the head (`SceneColumnLayer.tsx`):
 * the strip behind the head is read on the scene's own frames, and a bright
 * one marks the root `data-scene-head-ink="dark"`, which the head's styles
 * answer (`App.scss`, `.center-head--eq`). Nothing is marked, and nothing is
 * read, with the scene anywhere else or no scene at all.
 *
 * On the root, as `is-scene-column` is, rather than on the head: the head is
 * App's, several components away, and the mark changes only when the ink
 * does — written straight to the DOM from the reading, never through a
 * render.
 *
 * `cover`: the column layer's size in CSS pixels while the scene is drawn
 * on it, which the scene's canvas fills; undefined anywhere else.
 */
export default function useSceneHeadInk(
  cover: { width: number; height: number } | undefined,
): ISceneRunnerProbe | undefined {
  const head = useSceneColumnHead();
  const [follower] = useState(createHeadInkFollower);
  const width = cover?.width ?? 0;
  const height = cover?.height ?? 0;

  const rect = useMemo<TSceneProbeRect | undefined>(() => {
    if (!cover || !head || width <= 0 || height <= 0) {
      return undefined;
    }
    const left = Math.max(0, head.left / width);
    const top = Math.max(0, head.top / height);
    const right = Math.min(1, (head.left + head.width) / width);
    const bottom = Math.min(1, (head.top + head.height) / height);
    return right > left && bottom > top
      ? [left, top, right, bottom]
      : undefined;
  }, [cover, head, width, height]);

  const heard = useCallback(
    (luminance: number) => {
      const root = document.documentElement;
      const dark = follower.hear(luminance) === 'dark';
      if (dark !== (root.dataset.sceneHeadInk === 'dark')) {
        if (dark) {
          root.dataset.sceneHeadInk = 'dark';
        } else {
          delete root.dataset.sceneHeadInk;
        }
      }
    },
    [follower],
  );

  // Read only while there is a strip to read; when it goes the head's own
  // ink comes back and the next scene starts from it.
  const reading = rect !== undefined;
  useEffect(() => {
    if (!reading) {
      return undefined;
    }
    return () => {
      delete document.documentElement.dataset.sceneHeadInk;
      follower.reset();
    };
  }, [reading, follower]);

  return useMemo(() => (rect ? { rect, heard } : undefined), [rect, heard]);
}
