/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { type ReactNode, useCallback, useRef, useState } from 'react';
import type { ILookTuning } from 'common/customLooks';
import {
  FILL_TEXTURES,
  MAX_PATTERN_SIZE,
  MAX_TEXTURE_SIZE,
  MIN_PATTERN_SIZE,
  MIN_TEXTURE_SIZE,
  TEXTURE_FITS,
  type TFillTexture,
  type TTextureFit,
} from 'common/graphTextures';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { texturePreviewUrl } from '../graph/fillTextures';
import { TextureError, tileFromFile } from '../graph/textureUpload';
import { SettingRow, SettingSlider } from './LookDesignerParts';

type TTexturePatch = Partial<
  Pick<
    ILookTuning,
    'texture' | 'textureImage' | 'textureFit' | 'textureSize' | 'patternSize'
  >
>;

interface ILookTextureRowProps {
  texture: TFillTexture;
  image?: string;
  fit: TTextureFit;
  /** A tiled picture's height. */
  pictureSize: number;
  /** A pattern's tile side, a setting of its own (`PATTERN_TILE`). */
  patternSize: number;
  onChange: (next: TTexturePatch) => void;
}

/** Each fit's name, spelled out so the dictionaries' check can find them. */
const FIT_LABEL: Record<TTextureFit, TranslationKey> = {
  cover: 'look.texture.fit.cover',
  tile: 'look.texture.fit.tile',
};

/** The tile slider's step: fine enough to match a picture to the bars. */
const SIZE_STEP = 8;

/**
 * The same slider's step over a pattern. Its range is a tenth of a
 * picture's, and at 8 the smallest sizes would be a single doubling apart;
 * at 4 the slider's travel still moves a few pixels for each step.
 */
const PATTERN_STEP = 4;

/** The one "Tile size" slider, whichever of the two sizes it is moving. */
interface ITileSize {
  min: number;
  max: number;
  step: number;
  value: number;
  patch: (value: number) => TTexturePatch;
}

/**
 * What the size slider moves for this texture, or nothing where there is no
 * tile: a plain fill, a picture not chosen yet, a picture over the whole plot.
 * One control under one name for both, so a pattern's tile and a picture's
 * are grown the same way; each moves its own stored size, and going from
 * one to the other shows the size that one was left at.
 */
const tileSizeOf = (
  texture: TFillTexture,
  isPicture: boolean,
  {
    fit,
    pictureSize,
    patternSize,
  }: Pick<ILookTextureRowProps, 'fit' | 'pictureSize' | 'patternSize'>,
): ITileSize | undefined => {
  if (texture === 'none') {
    return undefined;
  }
  if (texture !== 'image') {
    return {
      min: MIN_PATTERN_SIZE,
      max: MAX_PATTERN_SIZE,
      step: PATTERN_STEP,
      value: patternSize,
      patch: (value) => ({ patternSize: value }),
    };
  }
  return isPicture && fit === 'tile'
    ? {
        min: MIN_TEXTURE_SIZE,
        max: MAX_TEXTURE_SIZE,
        step: SIZE_STEP,
        value: pictureSize,
        patch: (value) => ({ textureSize: value }),
      }
    : undefined;
};

/**
 * The pattern printed inside a filled figure, and where a picture is chosen.
 *
 * Each pattern is shown behind its own name rather than beside it. A row of
 * twelve words says nothing about what any of them draws, and a swatch large
 * enough to read would take the row onto a third line in the languages that
 * spell these out — measured at the panel's own width, which is where the
 * accent row had already been caught overflowing.
 */
const LookTextureRow = ({
  texture,
  image,
  fit,
  pictureSize,
  patternSize,
  onChange,
}: ILookTextureRowProps): ReactNode => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string>('');

  const choose = useCallback(
    (choice: TFillTexture) => {
      setFailure('');
      if (choice === 'image' && !image) {
        // Nothing to draw yet, so the choice and the file dialog are one
        // press: picking "Picture" and then finding a second button is a
        // dead end somebody has to be told the way out of.
        onChange({ texture: 'image', textureImage: undefined });
        fileRef.current?.click();
        return;
      }
      onChange({ texture: choice, textureImage: image });
    },
    [image, onChange],
  );

  const takeFile = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }
      setFailure('');
      try {
        const tile = await tileFromFile(file);
        // A first picture lies over the whole figure: a photograph chosen
        // for a look reads as itself there, and as wallpaper tiled. A
        // picture replacing another keeps the fit somebody already chose.
        onChange(
          image
            ? { texture: 'image', textureImage: tile }
            : { texture: 'image', textureImage: tile, textureFit: 'cover' },
        );
      } catch (error) {
        const reason =
          error instanceof TextureError && error.reason === 'tooBig'
            ? 'look.texture.tooBig'
            : 'look.texture.unreadable';
        setFailure(t(reason as TranslationKey));
      }
    },
    [image, onChange, t],
  );

  const isPicture = texture === 'image' && image !== undefined;
  const tileSize = tileSizeOf(texture, isPicture, {
    fit,
    pictureSize,
    patternSize,
  });

  return (
    <>
      <div className="look-designer__row">
        <span className="look-designer__caption">
          <span>{t('look.textureStyle')}</span>
          <span className="look-designer__value">
            {t(`look.texture.${texture}` as TranslationKey)}
          </span>
        </span>
        <div
          className="look-designer__choice look-designer__choice--wrap"
          role="group"
          aria-label={t('look.textureStyle')}
        >
          {FILL_TEXTURES.map((choice) => {
            const preview =
              choice === 'image' ? (image ?? '') : texturePreviewUrl(choice);
            return (
              <button
                key={choice}
                type="button"
                className={`look-designer__pill look-designer__pill--texture${
                  texture === choice ? ' is-on' : ''
                }`}
                aria-pressed={texture === choice}
                onClick={() => choose(choice)}
              >
                {preview ? (
                  <span
                    aria-hidden
                    className="look-designer__tile"
                    style={{ backgroundImage: `url(${preview})` }}
                  />
                ) : null}
                <span className="look-designer__pillLabel">
                  {t(`look.texture.${choice}` as TranslationKey)}
                </span>
              </button>
            );
          })}
          {texture === 'image' && image ? (
            <button
              type="button"
              className="look-designer__pill look-designer__pill--quiet"
              onClick={() => fileRef.current?.click()}
            >
              {t('look.texture.replace')}
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="look-designer__file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice in a row still fires.
            event.target.value = '';
            takeFile(file).catch(() =>
              setFailure(t('look.texture.unreadable')),
            );
          }}
        />
        {failure ? (
          <span className="look-designer__hint is-warning">{failure}</span>
        ) : null}
      </div>
      {/* How the picture lies, only while there is a picture: a pattern is
        a material and always tiles, at the size the slider below gives it. */}
      {isPicture ? (
        <div className="look-designer__row">
          <span className="look-designer__caption">
            <span>{t('look.texture.fit')}</span>
          </span>
          <div
            className="look-designer__choice"
            role="group"
            aria-label={t('look.texture.fit')}
          >
            {TEXTURE_FITS.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`look-designer__pill${fit === choice ? ' is-on' : ''}`}
                aria-pressed={fit === choice}
                onClick={() => onChange({ textureFit: choice })}
              >
                {t(FIT_LABEL[choice])}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {tileSize ? (
        <SettingRow
          id="look-designer-tile-size"
          label={t('look.texture.tileSize')}
          value={`${tileSize.value} px`}
        >
          <SettingSlider
            id="look-designer-tile-size"
            min={tileSize.min}
            max={tileSize.max}
            step={tileSize.step}
            value={tileSize.value}
            onChange={(value) => onChange(tileSize.patch(value))}
          />
        </SettingRow>
      ) : null}
    </>
  );
};

export default LookTextureRow;
