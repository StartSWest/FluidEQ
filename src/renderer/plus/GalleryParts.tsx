import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene, TPlusCategory } from 'common/plusGallery';
import { useEntitlement } from '../account/entitlementStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { toggleGalleryLike } from './galleryActions';
import { useScenePicture } from './scenePictures';

export const categoryKey = (category: TPlusCategory): TranslationKey =>
  `plus.category.${category}` as TranslationKey;

/**
 * Every category a scene is filed under, named, first first: "Cities · Water".
 * For the places with room to say both; a card's tag names the first alone.
 */
export const categoriesLabel = (
  t: (key: TranslationKey) => string,
  scene: { category: TPlusCategory; category2?: TPlusCategory },
) =>
  [scene.category, scene.category2]
    .flatMap((category) => (category ? [t(categoryKey(category))] : []))
    .join(' · ');

/**
 * Whether this member has Plus. Anybody signed in browses the gallery; what
 * downloads a scene — playing it on its page, Add — and liking are Plus.
 */
export const usePlusEntitled = () => useEntitlement().state !== 'none';

/**
 * The tag that says a scene, or a maker's page, is FluidEQ's own. The same
 * small mark the board gives a role, so hierarchy shows the same way in both
 * places: as a tag on the name, never as a colour on the whole row.
 */
export function OfficialBadge() {
  const { t } = useTranslation();
  return (
    <span className="community__role gallery-official">
      <Glyph name="check" />
      {t('plus.official.badge')}
    </span>
  );
}

interface IScenePictureProps {
  scene: Pick<IGalleryScene, 'lookId' | 'authorId' | 'sceneId' | 'version'> &
    Partial<Pick<IGalleryScene, 'updatedAt'>>;
  className?: string;
  /** Read by a screen reader; the picture is otherwise decoration. */
  label?: string;
}

/**
 * A scene's picture: always the real scene — the frame its maker took, or
 * one drawn from the scene itself (see `scenePictures`). A shimmer while it
 * comes; a quiet tile when nothing could be had.
 */
export function ScenePicture({ scene, className, label }: IScenePictureProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const picture = useScenePicture(scene, element);
  return (
    <div
      ref={setElement}
      className={`gallery-picture gallery-picture--${picture.state}${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {picture.state === 'ready' && (
        <img
          className="gallery-picture__image"
          src={picture.url}
          alt=""
          draggable={false}
        />
      )}
      {picture.state === 'none' && (
        <span className="gallery-picture__none" aria-hidden="true">
          <Glyph name="looks" />
        </span>
      )}
    </div>
  );
}

const useLikeCount = (likes: number) => {
  const { locale } = useTranslation();
  return new Intl.NumberFormat(locale, { notation: 'compact' }).format(likes);
};

interface ILikeButtonProps {
  scene: IGalleryScene;
  name: string;
  onToggle: () => void;
  className?: string;
}

/** The heart and the count, the same on a card and on a scene's page. */
export function LikeButton({
  scene,
  name,
  onToggle,
  className,
}: ILikeButtonProps) {
  const { t } = useTranslation();
  const count = useLikeCount(scene.likes);
  const label = t('plus.like.label', { name, count: String(scene.likes) });
  return (
    <button
      type="button"
      className={`gallery-like${scene.liked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={scene.liked}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <Glyph name="heart" />
      <span className="gallery-like__count">{count}</span>
    </button>
  );
}

interface ILikeCountProps {
  scene: IGalleryScene;
  /** The line saying why there is no heart to press here. */
  title: string;
  className?: string;
}

/**
 * The count without the heart to press: on the member's own scene, and for
 * a member without Plus, where liking is not theirs to do.
 */
export function LikeCount({ scene, title, className }: ILikeCountProps) {
  const count = useLikeCount(scene.likes);
  return (
    <span
      className={`gallery-like is-count${className ? ` ${className}` : ''}`}
      title={title}
    >
      <Glyph name="heart" />
      <span className="gallery-like__count">{count}</span>
    </span>
  );
}

interface ISceneHeartProps {
  scene: IGalleryScene;
  name: string;
  own: boolean;
  className?: string;
}

/** A scene's heart as this member can use it. */
export function SceneHeart({ scene, name, own, className }: ISceneHeartProps) {
  const { t } = useTranslation();
  const entitled = usePlusEntitled();
  const count = String(scene.likes);
  if (scene.official) {
    return null;
  }
  if (own || !entitled) {
    return (
      <LikeCount
        scene={scene}
        className={className}
        title={
          own
            ? t('plus.like.own', { count })
            : t('plus.like.plusOnly', { count })
        }
      />
    );
  }
  return (
    <LikeButton
      scene={scene}
      name={name}
      className={className}
      onToggle={() => {
        toggleGalleryLike(scene).catch(() => undefined);
      }}
    />
  );
}
