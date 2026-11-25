/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { ISceneWindowColours } from '../../../../common/sceneWindowColours';
import WindowColourFinder from '../../WindowColourFinder';
import WindowColourSwatches from '../../WindowColourSwatches';
import WindowColoursPreview from '../../WindowColoursPreview';
import { useTranslation } from '../../../utils/I18nContext';
import useTourFrames from '../useTourFrames';
import alpine from '../../../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../../../assets/tour/scene-aurora.jpg';
import neonCity from '../../../../../assets/tour/scene-neon-city.jpg';

const nothing = () => undefined;
const TURN_SECONDS = 4;

/**
 * Three of FluidEQ's own scenes, as the graph drew them (the tour's
 * captures), each with window colours read off its picture by eye: the
 * colours a scene lends are the scene's, and these are made up for the
 * picture, never read from the reader's settings.
 */
const SCENES: readonly {
  name: string;
  still: string;
  colours: ISceneWindowColours;
}[] = [
  {
    name: 'Alpine',
    still: alpine,
    colours: { surface: '#101a2e', accent: '#8b7dff', glow: '#4ad8ff' },
  },
  {
    name: 'Aurora',
    still: aurora,
    colours: { surface: '#071c22', accent: '#3ff0b0', glow: '#7aa8ff' },
  },
  {
    name: 'Neon City',
    still: neonCity,
    colours: { surface: '#190f26', accent: '#ff4fa8', glow: '#46d6ff' },
  },
];

/**
 * Window colours on the graph's look menu, a scene at a time: the scene on
 * the left, and on the right the colours it lends the window, the button
 * that finds them again, and the small window they make — Window colours'
 * own parts (`WindowColourSwatches`, `WindowColourFinder`,
 * `WindowColoursPreview`), in its section's markup, because the section
 * itself reads and writes the reader's own colours for the scene playing.
 */
export default function ColoursLive() {
  const { t } = useTranslation();
  const [at, setAt] = useState(0);
  useTourFrames(
    (seconds) => {
      const next = Math.floor(seconds / TURN_SECONDS) % SCENES.length;
      setAt((before) => (before === next ? before : next));
    },
    { fps: 4, still: 0 },
  );
  const scene = SCENES[at];

  return (
    <div className="tour-live26-colours">
      <div className="tour-live26-colours__stage">
        {SCENES.map((one, index) => (
          <img
            key={one.name}
            src={one.still}
            alt=""
            width={960}
            height={540}
            className={index === at ? 'is-shown' : undefined}
          />
        ))}
        <span className="tour-live26-colours__name">{scene.name}</span>
      </div>
      <section className="scene-window-colours">
        <div className="scene-window-colours__head">
          <span className="scene-window-colours__title">
            {t('graph.sceneColours.title', { name: scene.name })}
          </span>
          <span className="scene-window-colours__badge">
            {t('graph.sceneColours.own')}
          </span>
        </div>
        <WindowColourSwatches
          colours={scene.colours}
          own={scene.colours}
          named
          onChange={nothing}
          onCommit={nothing}
        />
        <WindowColourFinder
          finding={{ kind: 'found' }}
          source={t('graph.sceneColours.sourcePalette')}
          onFind={nothing}
        />
        <WindowColoursPreview colours={scene.colours} named />
        <div className="scene-window-colours__actions">
          <span className="button small subtle">
            {t('graph.sceneColours.reset')}
          </span>
        </div>
      </section>
    </div>
  );
}
