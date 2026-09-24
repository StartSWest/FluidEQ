/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { FILL_TEXTURES, type TFillTexture } from 'common/graphTextures';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { texturePreviewUrl } from '../graph/fillTextures';
import { TextureError, tileFromFile } from '../graph/textureUpload';

interface ILookTextureRowProps {
  texture: TFillTexture;
  image?: string;
  onChange: (next: { texture: TFillTexture; textureImage?: string }) => void;
}

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
        onChange({ texture: 'image', textureImage: tile });
      } catch (error) {
        const reason =
          error instanceof TextureError && error.reason === 'tooBig'
            ? 'look.texture.tooBig'
            : 'look.texture.unreadable';
        setFailure(t(reason as TranslationKey));
      }
    },
    [onChange, t],
  );

  return (
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
          takeFile(file).catch(() => setFailure(t('look.texture.unreadable')));
        }}
      />
      {failure ? (
        <span className="look-designer__hint is-warning">{failure}</span>
      ) : null}
    </div>
  );
};

export default LookTextureRow;
