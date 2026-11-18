/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { CSSProperties } from 'react';
import SceneLookIcon from '../icons/SceneLookIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneTintSwatch } from '../utils/sceneTint';
import { useRememberedSceneSky } from '../utils/sceneTintStore';

interface ISceneLoadingProps {
  lookId: string;
  /** The scene's picker colours, for its icon in the middle of the ring. */
  swatch: string[];
  /** The panel's size where it is known; absent, it fills its parent. */
  width?: number;
  height?: number;
}

/**
 * What the graph shows while a Plus scene is on its way: the ring turning
 * round the scene's icon where the scene is about to be, until its first
 * frame. Shown only until then; the ground under it is the plot's to put up
 * or not (`SceneLoadingFloor`).
 *
 * No picture of the scene stands in for it here, unlike the scene's page in
 * the gallery. A picture is framed for a card, and the graph draws the scene
 * to its own band: Neon City's buildings showed low in the picture and then
 * jumped up as the scene took over. The same ring and the same fade for
 * every scene is calmer than a likeness that moves.
 *
 * The ground used to be the colour measured for the window's tint darkened to
 * a scene's ground, and black for a scene never measured — a dark sheet
 * opening in the middle of the open floor for as long as the scene took to
 * load. It is the app's floor now, and only the ring keeps the scene's own
 * hue, lit round its icon.
 */
export default function SceneLoading({
  lookId,
  swatch,
  width,
  height,
}: ISceneLoadingProps) {
  const { t } = useTranslation();
  const sky = useRememberedSceneSky(lookId);
  const colours = {
    width,
    height,
    ...(sky ? { '--scene-ring': sceneTintSwatch(sky) } : {}),
  } as CSSProperties;
  return (
    <div
      className="chart-scene-loading"
      style={colours}
      role="status"
      aria-live="polite"
    >
      <span className="chart-scene-loading__status">
        <span className="chart-scene-loading__ring" aria-hidden="true">
          <SceneLookIcon
            className="chart-scene-loading__icon"
            swatch={swatch}
            lookId={lookId}
          />
        </span>
        <span className="chart-scene-loading__label">
          {t('graph.scene.loading')}
        </span>
      </span>
    </div>
  );
}
