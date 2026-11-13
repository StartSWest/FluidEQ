import { useEffect, useState } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { isNewScene, isNewSceneVersion } from 'common/sceneVersionNote';
import { absoluteTime, relativeTime } from '../forum/forumTime';
import { useTranslation } from '../utils/I18nContext';
import type { IUsableMemberScene } from '../utils/memberScenes';
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
import { claimCardClip, releaseCardClip, useCardClip } from './cardClip';
import GalleryCardClip from './GalleryCardClip';
import type { IMakerRef } from './plusNavigation';
import SceneGet, { officialLine } from './SceneGet';
import { useOwnsLook, useSceneStore } from './sceneStore';

interface IGalleryCardProps {
  scene: IGalleryScene;
  /** The member's own account, to tell their scenes from everyone else's. */
  me: string | undefined;
  /** This scene in the member's looks, if it is there. */
  local: Pick<IUsableMemberScene, 'version'> | undefined;
  onOpen: (scene: IGalleryScene) => void;
  /** Absent on a maker's own page, where the name would lead back to it. */
  onMaker?: (maker: IMakerRef) => void;
}

/**
 * One scene in the gallery: its picture, what it is called and who made it,
 * how many members added it, the heart, and Add.
 *
 * The picture and the name both open the scene's page, where it plays. The
 * card itself never runs the scene: hovered or focused, its picture plays the
 * scene's published clip instead, fetched only then (`cardClip.ts`), so
 * browsing downloads pictures and the one clip being looked at.
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
  // FluidEQ's own count no adds (`ScenePage`), so their line says whether
  // the scene is this account's or what getting it does.
  const free = useSceneStore().store?.free?.includes(scene.sceneId) ?? false;
  const officialLabel = officialLine(t, owned, free);
  const adding = useAddingScenes().has(scene.lookId);
  const name = resolveSceneName(scene, locale);
  const own = scene.authorId === me;
  const maker = scene.authorName ?? scene.authorHandle;
  const adds = new Intl.NumberFormat(locale, { notation: 'compact' }).format(
    scene.adds,
  );
  // This card's token for the one playing slot, and whether the pointer or
  // the keyboard is on its picture.
  const [card] = useState(() => Symbol(scene.lookId));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const wanted = hovered || focused;
  const clip = useCardClip(scene, me, card, wanted);

  useEffect(() => {
    if (wanted) {
      claimCardClip(card);
    } else {
      releaseCardClip(card);
    }
  }, [wanted, card]);
  useEffect(() => () => releaseCardClip(card), [card]);

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
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) {
          setFocused(false);
        }
      }}
    >
      <button
        type="button"
        className="gallery-card__thumb"
        aria-label={t('plus.card.open', { name })}
        onClick={() => onOpen(scene)}
      >
        <ScenePicture scene={scene} />
        {clip && <GalleryCardClip url={clip} />}
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
        <button
          type="button"
          className="gallery-card__name"
          title={name}
          onClick={() => onOpen(scene)}
        >
          {name}
        </button>
        <span className="gallery-card__byline">
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
          {scene.official && onMaker && <OfficialBadge />}
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
        </span>
        <div className="gallery-card__foot">
          <span className="gallery-card__adds">
            {scene.official
              ? officialLabel
              : t('plus.card.adds', { count: adds })}
          </span>
          <span className="gallery-card__controls">
            <SceneHeart scene={scene} name={name} own={own} />
            {!owned && (
              <SceneGet
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
