import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { isNewScene, isNewSceneVersion } from 'common/sceneVersionNote';
import { absoluteTime, relativeTime } from '../forum/forumTime';
import { useTranslation } from '../utils/I18nContext';
import {
  addGalleryScene,
  removeGalleryScene,
  useAddingScenes,
} from './galleryActions';
import {
  categoryKey,
  OfficialBadge,
  SceneHeart,
  ScenePicture,
} from './GalleryParts';
import { useOnePlaying, useTileAttention } from '../utils/onePlaying';
import { useKnownWithoutClip, useSceneClip } from './cardClip';
import SceneClip from './SceneClip';
import GalleryMoveTag from './GalleryMoveTag';
import { FLUIDEQ_MAKER, type IMakerRef } from './plusNavigation';
import { officialLine } from './SceneGet';
import SceneGetPlusFirst from './SceneGetPlusFirst';
import { galleryCameraOf } from './sceneMoveGestures';
import { useMoveTip } from './SceneMoveTip';
import { useKeepsLook, useOwnsLook } from './sceneStore';
import type { TGalleryLocalScene } from './useGalleryLocalScenes';

interface IGalleryCardProps {
  scene: IGalleryScene;
  /** The member's own account, to tell their scenes from everyone else's. */
  me: string | undefined;
  /** This scene in the member's looks, if it is there. */
  local: Pick<TGalleryLocalScene, 'version' | 'camera'> | undefined;
  onOpen: (scene: IGalleryScene) => void;
  /** Absent on a maker's own page, where the name would lead back to it. */
  onMaker?: (maker: IMakerRef) => void;
}

/**
 * One scene in the gallery: its picture, what it is called and who made it,
 * how many members added it, the heart, and Add.
 *
 * The picture and the name both open the scene's page, where it plays. The
 * card itself never runs the scene: hovered or focused, its picture plays
 * the scene's published clip instead, fetched only then, and only the one
 * card the pointer or the keyboard is on plays (`onePlaying.ts`).
 * Add — or Get, for a scene this account does not own yet — is the quiet
 * style here, since a grid of sixty loud buttons says nothing, and the loud
 * one on the scene's page.
 */
export default function GalleryCard({
  scene,
  me,
  local,
  onOpen,
  onMaker,
}: IGalleryCardProps) {
  const { t, locale } = useTranslation();
  const owned = useOwnsLook(scene.lookId);
  // Kept for good - its own, or got with a credit - as against playing only
  // while Plus lasts: only a kept scene says "Yours for good" (owned wins).
  const keeps = useKeepsLook(scene.lookId);
  // FluidEQ's own count no adds (`ScenePage`), so their line says whether
  // the scene is this account's or what getting it does.
  const officialLabel = officialLine(t, keeps);
  const adding = useAddingScenes().has(scene.lookId);
  const name = resolveSceneName(scene, locale);
  const own = scene.authorId === me;
  // A helper account's scene is FluidEQ's (premium 0121): named, badged and
  // linked as FluidEQ's own, to its own account too.
  const byFluidEQ = scene.official === true || scene.fromFluidEQ === true;
  const maker = scene.authorName ?? scene.authorHandle;
  const adds = new Intl.NumberFormat(locale, { notation: 'compact' }).format(
    scene.adds,
  );
  const addsLine = scene.official
    ? officialLabel
    : t('plus.card.adds', { count: adds });
  // The scene's published clip over its picture while this is the one card
  // in the window that plays - the pointer or the keyboard on it
  // (`onePlaying.ts`). The picture holds the card's size from the first
  // frame and stays under the clip until its first frame is painted
  // (`SceneClip`); a scene with no clip keeps its picture and does not take
  // the turn from one that has.
  const { attention, handlers } = useTileAttention();
  const withoutClip = useKnownWithoutClip(scene, me);
  const playing = useOnePlaying(attention && !withoutClip);
  const clip = useSceneClip(scene, me, playing);
  // A scene its viewer can turn says so on its card, and how.
  const camera = galleryCameraOf(scene, local);
  const moveTip = useMoveTip();

  let addLabel = t('plus.card.add');
  let addState = '';
  if (local && local.version >= scene.version) {
    addLabel = t('plus.card.added');
    addState = ' is-done';
  } else if (local) {
    addLabel = t('plus.card.updateTo', { version: String(scene.version) });
  }
  const now = Date.now();
  // A scene that is itself new this week says so rather than "New version":
  // it is the arrival that is news, not which version it arrived at.
  const isNew = isNewScene(scene, now);
  const isNewVersion = !isNew && isNewSceneVersion(scene, now);

  return (
    // The whole card answers the pointer and the keyboard, not the picture
    // alone: a hand resting on the name or the heart is still on the card.
    // Focus moving between the card's own controls is not leaving it.
    <article
      className="gallery-card"
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
    >
      <button
        type="button"
        className="gallery-card__thumb"
        aria-label={t('plus.card.open', { name })}
        aria-describedby={camera ? moveTip.id : undefined}
        onClick={() => onOpen(scene)}
      >
        <ScenePicture scene={scene} />
        {clip && <SceneClip url={clip} className="gallery-card__clip" />}
        <span className="gallery-card__tag">
          {t(categoryKey(scene.category))}
        </span>
        {isNew && (
          <span className="gallery-card__new">{t('plus.card.newScene')}</span>
        )}
        {isNewVersion && (
          <span className="gallery-card__new">{t('plus.version.new')}</span>
        )}
      </button>
      <div className="gallery-card__body">
        {/* The name, and at the row's far end the 3D label, which the name
            gives way to: the label is short and says what the name cannot. */}
        <div className="gallery-card__title">
          <button
            type="button"
            className="gallery-card__name"
            title={name}
            onClick={() => onOpen(scene)}
          >
            {name}
          </button>
          {camera && <GalleryMoveTag limits={camera} tip={moveTip} />}
        </div>
        <span className="gallery-card__byline">
          {onMaker ? (
            <button
              type="button"
              className="gallery-card__by"
              onClick={() =>
                onMaker(
                  scene.fromFluidEQ
                    ? FLUIDEQ_MAKER
                    : {
                        authorId: scene.authorId,
                        name: scene.authorName,
                        handle: scene.authorHandle,
                      },
                )
              }
            >
              {own && !scene.fromFluidEQ
                ? t('plus.card.byYou')
                : t('plus.card.by', {
                    name: maker ?? t('plus.card.anonymous'),
                  })}
            </button>
          ) : (
            <span className="gallery-card__by gallery-card__by--plain">
              {t(categoryKey(scene.category))}
            </span>
          )}
          {/* Beside the maker's name only. Where a card shows its category
              instead — the maker's own page, "More by" — the page around it
              already says whose these are. */}
          {byFluidEQ && onMaker && <OfficialBadge />}
        </span>
        {/* Which version this is and when it came, on every card in the same
            place; a copy of it older than this one says which it is. */}
        <span
          className="gallery-card__version"
          title={absoluteTime(scene.updatedAt, locale)}
        >
          {t('plus.version.line', {
            version: String(scene.version),
            when: relativeTime(scene.updatedAt, locale),
          })}
          {local && local.version < scene.version && (
            <span className="gallery-card__version-yours">
              {t('plus.version.youHave', { version: String(local.version) })}
            </span>
          )}
          {/* The facts on one line, as a Library tile has its year, songs
              and length: at the foot beside the heart and Add, the count
              was cut to "1,2 mil la añadie…" on every card. */}
          <span className="gallery-card__adds" title={addsLine}>
            {addsLine}
          </span>
        </span>
        <div className="gallery-card__foot">
          <span className="gallery-card__controls">
            <SceneHeart scene={scene} name={name} own={own} />
            {!owned && (
              <SceneGetPlusFirst
                scene={scene}
                name={name}
                className="button small subtle gallery-card__get"
              />
            )}
            {owned && (
              <button
                type="button"
                className={`button small subtle gallery-card__add${addState}${adding ? ' is-running' : ''}`}
                aria-busy={adding}
                disabled={adding}
                aria-label={addState ? t('plus.card.remove') : undefined}
                title={addState ? t('plus.card.remove') : undefined}
                onClick={() => {
                  const action = addState
                    ? removeGalleryScene
                    : addGalleryScene;
                  action(scene, name).catch(() => undefined);
                }}
              >
                <span className="gallery-card__add-label">{addLabel}</span>
                {addState && (
                  <span
                    className="gallery-card__remove-label"
                    aria-hidden="true"
                  >
                    {t('plus.card.remove')}
                  </span>
                )}
              </button>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
