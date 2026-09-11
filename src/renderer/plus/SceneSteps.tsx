import { useEffect } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { useGalleryList, type TListQuery } from './galleryStore';
import { openGalleryPage } from './plusNavigation';

interface ISceneStepsProps {
  scene: IGalleryScene;
  /** The list the scene was opened from. */
  from: TListQuery;
  /** A dialog is open over the page: the arrow keys are not ours. */
  paused: boolean;
}

/** Keys the arrows answer to, unless the member is typing somewhere. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const Chevron = ({ back }: { back: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d={back ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} />
  </svg>
);

/**
 * The scene before and after this one, in the list it was opened from: two
 * arrows on the stage and the arrow keys, so looking through the gallery is
 * one scene after another rather than back to the grid every time. Back is
 * the gallery in one press however many steps were taken.
 *
 * Near the end of what is loaded the next page of the list is asked for, so
 * the last arrow is never a dead end while there is more to see.
 */
export default function SceneSteps({ scene, from, paused }: ISceneStepsProps) {
  const { t, locale } = useTranslation();
  const { list, loadMore } = useGalleryList(from);
  const at = list.scenes.findIndex((entry) => entry.lookId === scene.lookId);
  const previous = at > 0 ? list.scenes[at - 1] : undefined;
  const next =
    at >= 0 && at < list.scenes.length - 1 ? list.scenes[at + 1] : undefined;
  const nearEnd = at >= 0 && at >= list.scenes.length - 2;

  useEffect(() => {
    if (nearEnd && list.more && !list.loading) {
      loadMore();
    }
    // loadMore is rebuilt every render; what decides is the three facts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearEnd, list.more, list.loading]);

  const step = (to: IGalleryScene | undefined) => {
    if (to) {
      openGalleryPage({ kind: 'scene', scene: to, from });
    }
  };

  useEffect(() => {
    if (paused) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented ||
        isTyping(event.target)
      ) {
        return;
      }
      const to =
        (event.key === 'ArrowLeft' && previous) ||
        (event.key === 'ArrowRight' && next) ||
        undefined;
      if (to) {
        event.preventDefault();
        openGalleryPage({ kind: 'scene', scene: to, from });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paused, previous, next, from]);

  if (at < 0) {
    return null;
  }

  return (
    <>
      {previous && (
        <button
          type="button"
          className="gallery-step gallery-step--back"
          aria-label={t('plus.scene.previous', {
            name: resolveSceneName(previous, locale),
          })}
          title={resolveSceneName(previous, locale)}
          onClick={() => step(previous)}
        >
          <Chevron back />
        </button>
      )}
      {next && (
        <button
          type="button"
          className="gallery-step gallery-step--next"
          aria-label={t('plus.scene.next', {
            name: resolveSceneName(next, locale),
          })}
          title={resolveSceneName(next, locale)}
          onClick={() => step(next)}
        >
          <Chevron back={false} />
        </button>
      )}
    </>
  );
}
