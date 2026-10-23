/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { Translate } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { SCENE_PRICE_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import BuySceneDialog from './BuySceneDialog';
import { creditsText } from './credits';
import { addGalleryScene } from './galleryActions';
import { TASTE_SECONDS } from './SceneTaste';

interface ISceneGetProps {
  scene: IGalleryScene;
  name: string;
  /** `button small` on the scene's page, `button small subtle` on a card. */
  className: string;
}

/**
 * "Get · 1 credit": the way a scene becomes this account's. Opens the buy
 * dialog, and once the scene is bought puts it in the looks at once — a
 * scene paid for and then still to be added was one step too many.
 */
export default function SceneGet({ scene, name, className }: ISceneGetProps) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`${className} store-get`}
        onClick={() => setOpen(true)}
      >
        <Glyph name="credit" />
        {t('store.get', {
          credits: creditsText(t, locale, SCENE_PRICE_CREDITS),
        })}
      </button>
      {open && (
        <BuySceneDialog
          scene={scene}
          name={name}
          onClose={(bought) => {
            setOpen(false);
            if (bought) {
              addGalleryScene(scene, name).catch(() => undefined);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * The line a FluidEQ scene's card and page say beside it: free for everyone
 * when the admin made it so, yours once it is, and otherwise what getting it
 * does.
 */
export const officialLine = (
  t: Translate,
  owned: boolean,
  free: boolean,
): string => {
  if (free) {
    return t('store.scene.free');
  }
  return t(owned ? 'store.scene.yours' : 'store.scene.keep');
};

/**
 * Over a scene's stage once its taste is over, or when there was none to
 * give: what owning it does, and — after the taste — the way to get it.
 */
export function SceneLockedVeil({
  scene,
  name,
  tasted,
}: {
  scene: IGalleryScene;
  name: string;
  tasted: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className={`gallery-preview__plus${tasted ? ' is-tasted' : ''}`}>
      <Glyph name="credit" />
      <span className="gallery-preview__plus-text">
        {tasted
          ? t('store.scene.tasted', { seconds: TASTE_SECONDS })
          : t('store.scene.locked')}
      </span>
      {tasted && (
        <SceneGet scene={scene} name={name} className="button small" />
      )}
    </span>
  );
}
