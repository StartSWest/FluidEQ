/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import alpine from '../../../../assets/tour/scene-alpine.jpg';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * One scene, Alpine as the app draws it, on the Studio's stage in the three
 * shapes it can be tried in: the stage itself, zooming in while the frame
 * that marks what the AI is shown follows it; the ultra-wide graph, five
 * and a half times as wide as it is tall, with the graph's wave over it;
 * and the Compact player's column with the player's panel laid on top. On
 * the stage's plate the one press that swaps the music for Calm, and the
 * line that says the demo song is playing while nothing else is.
 *
 * One loop of CSS (`_tour-release24.scss`).
 */

/** The graph's wave across the ultra-wide strip, as a smooth path. */
const WAVE =
  'M0 30 C 8 22, 14 18, 22 24 S 36 34, 44 26 S 58 12, 66 20 S 80 34, 88 26 S 96 18, 100 22';

export default function StudioStageVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="stage-visual"
      role="img"
      aria-label={t('tour.stage.imageAlt')}
    >
      <div className="stage-visual__main">
        <div className="stage-visual__stage">
          <img className="stage-visual__scene" src={alpine} alt="" />
          <span className="stage-visual__seen">
            <span className="stage-visual__seen-tag">
              <Glyph name="camera" />
              {t('tour.stage.agentSees')}
            </span>
          </span>
          <span className="stage-visual__zoom">
            <Glyph name="zoom-in" />
            <span className="stage-visual__zoom-a">100%</span>
            <span className="stage-visual__zoom-b">160%</span>
          </span>
          <span className="stage-visual__plate">
            <span className="stage-visual__status">
              <i />
              {t('studio.stage.demoSong')}
            </span>
            <span className="stage-visual__swap">
              <span className="stage-visual__music">
                <Glyph name="music" />
                {t('studio.stage.music')}
              </span>
              <span className="stage-visual__calm">
                <Glyph name="calm" />
                {t('studio.stage.calm')}
              </span>
            </span>
          </span>
        </div>

        <figure className="stage-visual__shape">
          <div className="stage-visual__wide">
            <img src={alpine} alt="" />
            <svg
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className="stage-visual__wave" d={WAVE} />
            </svg>
          </div>
          <figcaption>{t('studio.size.ultraWide')}</figcaption>
        </figure>
      </div>

      <figure className="stage-visual__shape stage-visual__player-shape">
        <div className="stage-visual__player">
          <img src={alpine} alt="" />
          <span className="stage-visual__panel">
            <span className="stage-visual__song">
              <strong>{t('studio.stage.demoSong')}</strong>
              <small>FluidEQ</small>
            </span>
            <span className="stage-visual__transport">
              <Glyph name="previous" />
              <i className="stage-visual__play" />
              <Glyph name="next" />
            </span>
            <span className="stage-visual__bar">
              <i />
            </span>
          </span>
        </div>
        <figcaption>
          {t('studio.size.player')} · {t('studio.size.playerParts')}
        </figcaption>
      </figure>
    </div>
  );
}
