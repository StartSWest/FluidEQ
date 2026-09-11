import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import type { IUsableMemberScene } from '../utils/memberScenes';
import {
  addGalleryScene,
  toggleGalleryLike,
  useAddingScenes,
} from './galleryActions';
import { categoryKey, LikeButton, ScenePicture } from './GalleryParts';
import type { IMakerRef } from './plusNavigation';

interface IGalleryCardProps {
  scene: IGalleryScene;
  /** The member's own account, to tell their scenes from everyone else's. */
  me: string | undefined;
  /** This scene in the member's looks, if it is there. */
  local: IUsableMemberScene | undefined;
  onOpen: (scene: IGalleryScene) => void;
  /** Absent on a maker's own page, where the name would lead back to it. */
  onMaker?: (maker: IMakerRef) => void;
}

/**
 * One scene in the gallery: its picture, what it is called and who made it,
 * how many members added it, the heart, and Add.
 *
 * The picture and the name both open the scene's page, where it plays; the
 * card itself plays nothing, so browsing downloads pictures and nothing else.
 * Add is the quiet style here — a grid of sixty loud buttons says nothing —
 * and the loud one on the scene's page.
 */
export default function GalleryCard({
  scene,
  me,
  local,
  onOpen,
  onMaker,
}: IGalleryCardProps) {
  const { t, locale } = useTranslation();
  const adding = useAddingScenes().has(scene.lookId);
  const name = resolveSceneName(scene, locale);
  const own = scene.authorId === me;
  const maker = scene.authorName ?? scene.authorHandle;
  const adds = new Intl.NumberFormat(locale, { notation: 'compact' }).format(
    scene.adds,
  );

  let addLabel = t('plus.card.add');
  let addState = '';
  if (local && local.version >= scene.version) {
    addLabel = t('plus.card.added');
    addState = ' is-done';
  } else if (local) {
    addLabel = t('plus.card.update');
  }

  return (
    <article className="gallery-card">
      <button
        type="button"
        className="gallery-card__thumb"
        aria-label={t('plus.card.open', { name })}
        onClick={() => onOpen(scene)}
      >
        <ScenePicture scene={scene} />
        <span className="gallery-card__tag">
          {t(categoryKey(scene.category))}
        </span>
      </button>
      <div className="gallery-card__body">
        <button
          type="button"
          className="gallery-card__name"
          title={name}
          onClick={() => onOpen(scene)}
        >
          {name}
        </button>
        {onMaker ? (
          <button
            type="button"
            className="gallery-card__by"
            onClick={() =>
              onMaker({
                authorId: scene.authorId,
                name: scene.authorName,
                handle: scene.authorHandle,
              })
            }
          >
            {own
              ? t('plus.card.byYou')
              : t('plus.card.by', { name: maker ?? t('plus.card.anonymous') })}
          </button>
        ) : (
          <span className="gallery-card__by gallery-card__by--plain">
            {t(categoryKey(scene.category))}
          </span>
        )}
        <div className="gallery-card__foot">
          <span className="gallery-card__adds">
            {t('plus.card.adds', { count: adds })}
          </span>
          <LikeButton
            scene={scene}
            name={name}
            own={own}
            onToggle={() => {
              toggleGalleryLike(scene).catch(() => undefined);
            }}
          />
          <button
            type="button"
            className={`button small subtle gallery-card__add${addState}${adding ? ' is-running' : ''}`}
            aria-busy={adding}
            disabled={addState !== '' || adding}
            onClick={() => {
              addGalleryScene(scene, name).catch(() => undefined);
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
