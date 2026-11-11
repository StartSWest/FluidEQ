/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import alpine from '../../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import type { TranslationKey } from '../../../common/i18n';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * What the Studio's AI looks at before it calls a change done, in the shapes
 * its answers come back in: five frames along the music side by side under
 * their numbers and moments, with which way the picture moved and how evenly;
 * the scene in the standard graph, the ultra-wide graph and the Compact
 * player's whole column at one moment; and six moments of the test song from
 * silence to the drop, with the drop told apart and the night's darkness
 * measured. The pictures are scenes the app draws.
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

/** Five frames a quarter of a second apart, the picture panning right. */
const FRAMES = [0, 1, 2, 3, 4];

/** The test song's moments, each as bright as the scene is lit there. */
const MOMENTS: readonly { label: TranslationKey; light: number }[] = [
  { label: 'tour.watch.silence', light: 0.25 },
  { label: 'tour.watch.verse', light: 0.6 },
  { label: 'tour.watch.verse', light: 0.65 },
  { label: 'tour.watch.build', light: 0.85 },
  { label: 'tour.watch.drop', light: 1.35 },
  { label: 'tour.watch.verse', light: 0.7 },
];

export default function StudioWatchVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="watch-visual"
      role="img"
      aria-label={t('tour.watch.imageAlt')}
    >
      <section className="watch-visual__card">
        <span className="watch-visual__title">{t('tour.watch.frames')}</span>
        <span className="watch-visual__frames">
          {FRAMES.map((frame) => (
            <span key={frame} className="watch-visual__frame">
              <img
                src={alpine}
                alt=""
                style={{ objectPosition: `${30 + frame * 10}% 50%` }}
              />
              <small>
                {frame + 1} · {(frame * 0.25).toFixed(2)} s
              </small>
            </span>
          ))}
        </span>
        <span className="watch-visual__moves">
          <i />
          {t('tour.watch.moves')}
        </span>
      </section>

      <div className="watch-visual__row">
        <section className="watch-visual__card watch-visual__views">
          <span className="watch-visual__view">
            <img src={aurora} alt="" />
            <small>{t('tour.watch.standard')}</small>
          </span>
          <span className="watch-visual__view watch-visual__view--wide">
            <img src={aurora} alt="" />
            <small>{t('studio.size.ultraWide')}</small>
          </span>
          <span className="watch-visual__view watch-visual__view--column">
            <img src={aurora} alt="" />
            <small>{t('studio.size.player')}</small>
          </span>
        </section>

        <section className="watch-visual__card watch-visual__song">
          <span className="watch-visual__title">{t('tour.watch.song')}</span>
          <span className="watch-visual__moments">
            {MOMENTS.map((moment, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key -- a fixed run of six moments, two sharing a label
                key={index}
                className={`watch-visual__moment${
                  moment.label === 'tour.watch.drop' ? ' is-drop' : ''
                }`}
              >
                <img
                  src={aurora}
                  alt=""
                  style={{ filter: `brightness(${moment.light})` }}
                />
                <small>{t(moment.label)}</small>
              </span>
            ))}
          </span>
          <span className="watch-visual__checks">
            <span className="watch-visual__check">
              <Glyph name="check" />
              {t('tour.watch.dropShows')}
            </span>
            <span className="watch-visual__check watch-visual__night">
              <i />
              {t('tour.watch.night', { value: 2 })}
            </span>
          </span>
        </section>
      </div>
    </div>
  );
}
