/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { CSSProperties } from 'react';
import SceneLookIcon from '../icons/SceneLookIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneSkyColour, sceneTintSwatch } from '../utils/sceneTint';
import { useRememberedSceneSky } from '../utils/sceneTintStore';

interface ISceneLoadingProps {
  lookId: string;
  /** The scene's picker colours, for its icon in the middle of the ring. */
  swatch: string[];
  /** The scene has drawn its first frame: the backdrop fades and the ring goes. */
  settled: boolean;
  width: number;
  height: number;
}

/**
 * What the graph shows while a Plus scene is on its way: a dark ground in the
 * scene's own hue where the scene is about to be, and the ring turning round
 * the scene's icon in the middle of it, until the scene fades in.
 *
 * No picture of the scene stands in for it here, unlike the scene's page in
 * the gallery. A picture is framed for a card, and the graph draws the scene
 * to its own band: Neon City's buildings showed low in the picture and then
 * jumped up as the scene took over. The same ring and the same fade for
 * every scene is calmer than a likeness that moves.
 *
 * The colour is the one measured for the window's tint, darkened to a
 * scene's ground, so a scene chosen before waits on its own hue; a scene
 * never measured waits on black, which is what every scene is drawn against.
 *
 * The backdrop outlives the loading: it stays under the canvas while the
 * scene fades in over its first quarter second, and fades out after it, so
 * nothing but the scene's own colour is ever behind a half-drawn scene.
 */
export default function SceneLoading({
  lookId,
  swatch,
  settled,
  width,
  height,
}: ISceneLoadingProps) {
  const { t } = useTranslation();
  const sky = useRememberedSceneSky(lookId);
  const colours = {
    width,
    height,
    ...(sky
      ? {
          '--scene-sky': sceneSkyColour(sky),
          '--scene-ring': sceneTintSwatch(sky),
        }
      : {}),
  } as CSSProperties;
  return (
    <>
      <div
        className={`chart-scene-backdrop${settled ? ' is-settled' : ''}`}
        style={colours}
        aria-hidden="true"
      />
      {!settled && (
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
              />
            </span>
            <span className="chart-scene-loading__label">
              {t('graph.scene.loading')}
            </span>
          </span>
        </div>
      )}
    </>
  );
}
