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

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../common/i18n';
import {
  anchorOf,
  anchorPosition,
  SUBTITLE_ANCHORS,
  SUBTITLE_BACKGROUNDS,
  SUBTITLE_COLOURS,
  SUBTITLE_INK,
  SUBTITLE_OPACITIES,
  SUBTITLE_SIZES,
  type TSubtitleBackground,
  type TSubtitleSize,
} from '../../common/library/subtitleStyle';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import SegmentedControl from '../widgets/SegmentedControl';
import Switch from '../widgets/Switch';
import {
  setCaptionsMoving,
  updateSubtitleStyle,
  useCaptionsMoving,
  useSubtitleStyle,
} from './subtitleStyleStore';

const SIZE_KEYS: Record<TSubtitleSize, TranslationKey> = {
  s: 'library.subtitles.size.s',
  m: 'library.subtitles.size.m',
  l: 'library.subtitles.size.l',
  xl: 'library.subtitles.size.xl',
};

const COLOUR_KEYS = {
  white: 'library.subtitles.colour.white',
  yellow: 'library.subtitles.colour.yellow',
  cyan: 'library.subtitles.colour.cyan',
  green: 'library.subtitles.colour.green',
  pink: 'library.subtitles.colour.pink',
} as const;

const BACKGROUND_KEYS: Record<TSubtitleBackground, TranslationKey> = {
  none: 'library.subtitles.background.none',
  outline: 'library.subtitles.background.outline',
  box: 'library.subtitles.background.box',
};

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

/** A setting's name over its control, so a long translation never squeezes
 * the control beside it in a narrow pane. */
const Setting = ({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) => (
  <div className="library-subtitles__setting">
    <span className="library-subtitles__label">{label}</span>
    {children}
  </div>
);

/**
 * How the captions over a film look and where they stand (Ivan,
 * 2026-11-15: "the list of imported subs and the settings"): on or off,
 * size, ink, background and the box's opacity, one of nine places or one
 * dragged on the picture. One style for every film, kept per viewer
 * (`subtitleStyleStore`). The app's own controls throughout: the switch,
 * the segmented tracks, and the scene picker's colour chip for the inks.
 */
const LibrarySubtitleSettings = () => {
  const { t, locale } = useTranslation();
  const style = useSubtitleStyle();
  const isMoving = useCaptionsMoving();
  const anchor = anchorOf(style.position);
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });

  return (
    <section className="library-lyrics-finder__group library-subtitles__settings">
      <h3 className="library-pane__heading">
        {t('library.subtitles.settings')}
      </h3>
      <div className="library-subtitles__setting is-inline">
        <label
          className="library-subtitles__label"
          htmlFor="library-captions-on"
        >
          {t('library.subtitles.show')}
        </label>
        <Switch
          id="library-captions-on"
          isOn={style.enabled}
          isDisabled={false}
          ariaLabel={t('library.subtitles.show')}
          handleToggle={() => updateSubtitleStyle({ enabled: !style.enabled })}
        />
      </div>
      <Setting label={t('library.subtitles.size')}>
        <SegmentedControl
          name={t('library.subtitles.size')}
          value={style.size}
          options={SUBTITLE_SIZES.map((size) => ({
            value: size,
            label: t(SIZE_KEYS[size]),
          }))}
          onChange={(next) => {
            const size = SUBTITLE_SIZES.find((entry) => entry === next);
            if (size !== undefined) {
              updateSubtitleStyle({ size });
            }
          }}
        />
      </Setting>
      <Setting label={t('library.subtitles.colour')}>
        <div
          className="segmented library-subtitles__inks"
          role="radiogroup"
          aria-label={t('library.subtitles.colour')}
        >
          {SUBTITLE_COLOURS.map((colour) => (
            <button
              key={colour}
              type="button"
              role="radio"
              aria-checked={style.colour === colour}
              aria-label={t(COLOUR_KEYS[colour])}
              title={t(COLOUR_KEYS[colour])}
              className={`segmented__option${
                style.colour === colour ? ' is-selected' : ''
              }`}
              onClick={() => updateSubtitleStyle({ colour })}
            >
              <span
                className="scene-choice__swatch"
                style={{ background: SUBTITLE_INK[colour] }}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </Setting>
      <Setting label={t('library.subtitles.background')}>
        <SegmentedControl
          name={t('library.subtitles.background')}
          value={style.background}
          options={SUBTITLE_BACKGROUNDS.map((background) => ({
            value: background,
            label: t(BACKGROUND_KEYS[background]),
          }))}
          onChange={(next) => {
            const background = SUBTITLE_BACKGROUNDS.find(
              (entry) => entry === next,
            );
            if (background !== undefined) {
              updateSubtitleStyle({ background });
            }
          }}
        />
      </Setting>
      {/* Only the box has a fill to be seen through. */}
      {style.background === 'box' && (
        <Setting label={t('library.subtitles.opacity')}>
          <SegmentedControl
            name={t('library.subtitles.opacity')}
            value={String(style.opacity)}
            options={SUBTITLE_OPACITIES.map((opacity) => ({
              value: String(opacity),
              label: percent.format(opacity),
            }))}
            onChange={(next) => {
              const opacity = SUBTITLE_OPACITIES.find(
                (entry) => String(entry) === next,
              );
              if (opacity !== undefined) {
                updateSubtitleStyle({ opacity });
              }
            }}
          />
        </Setting>
      )}
      <Setting label={t('library.subtitles.place')}>
        <div className="library-subtitles__place">
          <div
            className="segmented library-subtitles__anchors"
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
                className={`segmented__option${
                  anchor === place ? ' is-selected' : ''
                }`}
                // A named place replaces one dragged by hand.
                onClick={() =>
                  updateSubtitleStyle({ position: anchorPosition(place) })
                }
              >
                <span className="library-subtitles__anchor-dot" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`button small${isMoving ? '' : ' subtle'}`}
            aria-pressed={isMoving}
            onClick={() => setCaptionsMoving(!isMoving)}
          >
            <MenuIcon name={isMoving ? 'check' : 'bothWays'} />
            {t(
              isMoving
                ? 'library.subtitles.moveDone'
                : 'library.subtitles.move',
            )}
          </button>
        </div>
      </Setting>
    </section>
  );
};

export default LibrarySubtitleSettings;
