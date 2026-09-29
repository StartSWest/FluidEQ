/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import Glyph, { type TCommunityGlyph } from '../../community/Glyph';
import BrandMark from '../../icons/BrandMark';
import { useTranslation } from '../../utils/I18nContext';
import sceneAlpine from '../../../../assets/tour/scene-alpine.jpg';
import sceneAurora from '../../../../assets/tour/scene-aurora.jpg';
import sceneBloom from '../../../../assets/tour/scene-bloom.jpg';
import sceneChrome from '../../../../assets/tour/scene-chrome.jpg';
import sceneNeonCity from '../../../../assets/tour/scene-neon-city.jpg';

/**
 * The pictures on the 1.7 headline slides.
 *
 * Every picture of a scene is a real frame of it: the gallery's own published
 * covers. What is drawn here — the graph the scene plays on, the Plus tab in
 * miniature, a monitor, the monitor map — is the setting they are shown in,
 * with the app's own words in the reader's language, not a stand-in for the
 * scenes. The graph used to be a capture of the 1.8 window, and read as
 * another app once the window changed around it.
 *
 * Each one is composed to be about as tall as it is wide, because that is the
 * shape the slide gives it beside the text, from a 1440-wide window up to a
 * 4K one. A capture of the whole Plus tab shrank to an unreadable strip there.
 */

/** The Plus tab's rail, in the order `CommunityPanel` lists it. */
const PLACES: {
  glyph: TCommunityGlyph;
  name: TranslationKey;
  blurb: TranslationKey;
}[] = [
  {
    glyph: 'board',
    name: 'leaderboard.title',
    blurb: 'leaderboard.rail.blurb',
  },
  {
    glyph: 'looks',
    name: 'plus.visualizers.title',
    blurb: 'plus.visualizers.blurb',
  },
  { glyph: 'studio', name: 'studio.title', blurb: 'studio.rail.blurb' },
  { glyph: 'lighting', name: 'lighting.title', blurb: 'lighting.rail.blurb' },
];

/** Each scene under the name it is published with in the reader's language. */
const CARDS: { name: TranslationKey; src: string }[] = [
  { name: 'tour.scene.aurora', src: sceneAurora },
  { name: 'tour.scene.alpine', src: sceneAlpine },
  { name: 'tour.scene.neonCity', src: sceneNeonCity },
  { name: 'tour.scene.bloom', src: sceneBloom },
  { name: 'tour.scene.chrome', src: sceneChrome },
];

/** The Plus tab in miniature: its places down the side, the gallery open. */
export function PlusVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="plus-visual"
      role="img"
      aria-label={t('tour.plus.imageAlt')}
    >
      <div className="plus-visual__rail">
        <span className="plus-visual__title">{t('tabs.plus')}</span>
        <ul className="plus-visual__places">
          {PLACES.map((place) => (
            <li
              key={place.glyph}
              className={place.glyph === 'looks' ? 'is-active' : undefined}
            >
              <span className="plus-visual__mark">
                <Glyph name={place.glyph} />
              </span>
              <span className="plus-visual__place">
                <strong>{t(place.name)}</strong>
                <span>{t(place.blurb)}</span>
              </span>
            </li>
          ))}
        </ul>
        <span className="plus-visual__member">
          <BrandMark className="plus-visual__brand" />
          <span>{t('plus.official.included')}</span>
        </span>
      </div>

      <div className="plus-visual__gallery">
        <span className="plus-visual__title">
          {t('plus.visualizers.title')}
        </span>
        <ul className="plus-visual__cards">
          {CARDS.map((card) => (
            <li key={card.name}>
              <img src={card.src} alt="" />
              <span className="plus-visual__card-text">
                <strong>{t(card.name)}</strong>
                <span>{t('plus.official.badge')}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Keyed by scene, not by picture: a bundler may give two pictures one URL. */
const FILMSTRIP = [
  { scene: 'aurora', src: sceneAurora },
  { scene: 'bloom', src: sceneBloom },
  { scene: 'neon-city', src: sceneNeonCity },
  { scene: 'chrome', src: sceneChrome },
];

/**
 * The EQ over the scene, on a 0..100 box with gain up: a warm low end, a dip
 * in the low mids, presence and air — and the band points it passes through.
 */
const EQ_POINTS = [
  { x: 9, y: 38 },
  { x: 24, y: 46 },
  { x: 42, y: 57 },
  { x: 61, y: 50 },
  { x: 78, y: 44 },
  { x: 92, y: 36 },
];

const EQ_CURVE = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 60; step += 1) {
    const x = step / 60;
    const bass = 14 * Math.exp(-(((x - 0.1) / 0.12) ** 2));
    const dip = 7 * Math.exp(-(((x - 0.42) / 0.13) ** 2));
    const presence = 3 * Math.exp(-(((x - 0.72) / 0.1) ** 2));
    const air = 10 / (1 + Math.exp(-(x - 0.88) * 18));
    const y = 50 - bass + dip - presence - air;
    points.push(`${(x * 100).toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
})();

/** Alpine playing under the EQ curve on the graph, and more scenes beside it. */
export function VisualizersVisual() {
  const { t } = useTranslation();
  return (
    <div className="visualizers-visual">
      <div
        className="visualizers-visual__stage"
        role="img"
        aria-label={t('tour.visualizers.imageAlt')}
      >
        <img className="visualizers-visual__scene" src={sceneAlpine} alt="" />
        <svg
          className="visualizers-visual__curve"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline points={EQ_CURVE} />
        </svg>
        {EQ_POINTS.map((point) => (
          <span
            key={point.x}
            className="visualizers-visual__point"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        ))}
        <span className="visualizers-visual__name">
          {t('tour.scene.alpine')}
          <span className="visualizers-visual__badge">
            {t('graph.scene.badge')}
          </span>
        </span>
      </div>
      <ul className="visualizers-visual__strip" aria-hidden="true">
        {FILMSTRIP.map((frame) => (
          <li key={frame.scene}>
            <img src={frame.src} alt="" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The monitor map's screens, each with its own scene; the middle one is set. */
const MONITORS = [
  { number: 1, src: sceneAurora },
  { number: 2, src: sceneAlpine },
  { number: 3, src: sceneNeonCity },
];

const SELECTED_MONITOR = 2;

/**
 * Alpine behind a desktop's icons and taskbar, and under it the map of
 * monitors a desktop background is set from, a scene on each.
 */
export function DesktopVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="desktop-visual"
      role="img"
      aria-label={t('tour.desktop.imageAlt')}
    >
      <div className="desktop-visual__monitor">
        <div className="desktop-visual__screen">
          <img src={sceneAlpine} alt="" />
          <span className="desktop-visual__icons">
            <i />
            <i />
            <i />
          </span>
          <span className="desktop-visual__taskbar">
            <i className="desktop-visual__start" />
            <i />
            <i />
            <i className="desktop-visual__app" />
            <i />
          </span>
        </div>
        <span className="desktop-visual__neck" />
        <span className="desktop-visual__foot" />
      </div>

      <div className="desktop-visual__map">
        <span className="desktop-visual__map-title">
          {t('wallpaper.monitors')}
        </span>
        <ul>
          {MONITORS.map((monitor) => (
            <li
              key={monitor.number}
              className={
                monitor.number === SELECTED_MONITOR ? 'is-selected' : undefined
              }
            >
              <img src={monitor.src} alt="" />
              <span className="desktop-visual__number">{monitor.number}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="desktop-visual__modes">
        <li>
          <Glyph name="music" className="desktop-visual__glyph" />
          <span>{t('wallpaper.motion.music')}</span>
        </li>
        <li>
          <Glyph name="calm" className="desktop-visual__glyph" />
          <span>{t('wallpaper.motion.calm')}</span>
        </li>
      </ul>
    </div>
  );
}
