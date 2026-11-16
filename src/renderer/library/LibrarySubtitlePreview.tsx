/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { CSSProperties } from 'react';
import {
  anchorOf,
  anchorPosition,
  SUBTITLE_ANCHORS,
  SUBTITLE_INK,
  SUBTITLE_SIZE_SCALE,
  type ISubtitleStyle,
} from '../../common/library/subtitleStyle';
import { useTranslation } from '../utils/I18nContext';
import { updateSubtitleStyle } from './subtitleStyleStore';

const PLACE_KEYS = {
  topLeft: 'library.subtitles.place.topLeft',
  topCentre: 'library.subtitles.place.topCentre',
  topRight: 'library.subtitles.place.topRight',
  middleLeft: 'library.subtitles.place.middleLeft',
  middleCentre: 'library.subtitles.place.middleCentre',
  middleRight: 'library.subtitles.place.middleRight',
  bottomLeft: 'library.subtitles.place.bottomLeft',
  bottomCentre: 'library.subtitles.place.bottomCentre',
  bottomRight: 'library.subtitles.place.bottomRight',
} as const;

/**
 * The captions as they will look, on a small screen of their own, and the
 * place to put them (Ivan, 2026-11-15: "make the subs UI better"). The
 * sample line is drawn with the film's own caption classes and the same
 * height-relative size, so the ink, the size, the outline or the box are
 * what the picture will show, at its proportion. The screen is the
 * position picker too: nine places to press, each a dot, the one in use
 * lit; a place dragged on the picture lights none and still shows where it
 * stands. Held inside the screen by its own size: a caption at the left
 * edge is flush with it, as `clampedCaptionCentre` holds it on the film.
 */
const LibrarySubtitlePreview = ({ style }: { style: ISubtitleStyle }) => {
  const { t } = useTranslation();
  const anchor = anchorOf(style.position);
  const { x, y } = style.position;
  const captionStyle = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    translate: `${-x * 100}% ${-y * 100}%`,
    '--caption-ink': SUBTITLE_INK[style.colour],
    '--caption-scale': SUBTITLE_SIZE_SCALE[style.size],
    '--caption-box-opacity': style.opacity,
  } as CSSProperties;

  return (
    <div
      className={`library-subtitle-preview${style.enabled ? '' : ' is-off'}`}
    >
      <div className="library-subtitle-preview__room" aria-hidden="true">
        <div
          className={`library-video-stage__caption is-${style.background}`}
          style={captionStyle}
        >
          <p className="library-video-stage__caption-line">
            {t('library.subtitles.sample')}
          </p>
        </div>
      </div>
      <div
        className="library-subtitle-preview__places"
        role="radiogroup"
        aria-label={t('library.subtitles.place')}
      >
        {SUBTITLE_ANCHORS.map((place) => (
          <button
            key={place}
            type="button"
            role="radio"
            aria-checked={anchor === place}
            aria-label={t(PLACE_KEYS[place])}
            title={t(PLACE_KEYS[place])}
            className={`library-subtitle-preview__place${
              anchor === place ? ' is-selected' : ''
            }`}
            // A named place replaces one dragged by hand.
            onClick={() =>
              updateSubtitleStyle({ position: anchorPosition(place) })
            }
          >
            <span className="library-subtitle-preview__dot" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default LibrarySubtitlePreview;
