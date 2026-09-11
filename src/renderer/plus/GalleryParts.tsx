import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene, TPlusCategory } from 'common/plusGallery';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { useScenePicture } from './galleryStore';
import SwatchArt from './SwatchArt';

export const categoryKey = (category: TPlusCategory): TranslationKey =>
  `plus.category.${category}` as TranslationKey;

interface IScenePictureProps {
  scene: Pick<
    IGalleryScene,
    'lookId' | 'authorId' | 'sceneId' | 'version' | 'swatch'
  >;
  className?: string;
  /** Read by a screen reader; the picture is otherwise decoration. */
  label?: string;
}

/** A published scene's picture, over a cover drawn from its colours. */
export function ScenePicture({ scene, className, label }: IScenePictureProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const picture = useScenePicture(scene, element);
  return (
    <div
      ref={setElement}
      className={`gallery-picture${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <SwatchArt seed={scene.lookId} swatch={scene.swatch} />
      {picture && (
        <img
          className="gallery-picture__image"
          src={picture}
          alt=""
          draggable={false}
        />
      )}
    </div>
  );
}

interface ILikeButtonProps {
  scene: IGalleryScene;
  name: string;
  /** The member's own scene: the count, without the heart to press. */
  own: boolean;
  onToggle: () => void;
  className?: string;
}

/** The heart and the count, the same on a card and on a scene's page. */
export function LikeButton({
  scene,
  name,
  own,
  onToggle,
  className,
}: ILikeButtonProps) {
  const { t, locale } = useTranslation();
  const count = new Intl.NumberFormat(locale, { notation: 'compact' }).format(
    scene.likes,
  );
  const base = `gallery-like${scene.liked ? ' is-on' : ''}${own ? ' is-count' : ''}${className ? ` ${className}` : ''}`;
  if (own) {
    return (
      <span
        className={base}
        title={t('plus.like.own', { count: String(scene.likes) })}
      >
        <Glyph name="heart" />
        <span className="gallery-like__count">{count}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={base}
      aria-pressed={scene.liked}
      aria-label={t('plus.like.label', { name, count: String(scene.likes) })}
      title={t('plus.like.label', { name, count: String(scene.likes) })}
      onClick={onToggle}
    >
      <Glyph name="heart" />
      <span className="gallery-like__count">{count}</span>
    </button>
  );
}
