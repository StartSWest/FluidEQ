import { useEffect, useState } from 'react';
import { resolveSceneName, type TLocalizedName } from 'common/scenePacks';
import type { ILikeStatus } from 'main/memberScenes/social';
import { patchGalleryScene } from '../plus/galleryStore';
import { useTranslation } from '../utils/I18nContext';
import {
  fetchMemberSceneLikes,
  likeMemberSceneLook,
} from '../utils/memberScenes';

/**
 * A scene a like can thank: one of FluidEQ's own, filed by the server under
 * the FluidEQ author (`likedSceneOf`), or a member's.
 */
export interface ILikedScene {
  lookId: string;
  names: TLocalizedName;
  /** The member's own scene: its count, never a like of their own. */
  own: boolean;
  authorName?: string | null;
}

interface ISceneLikeButtonProps {
  scene: ILikedScene;
}

const Heart = () => (
  <svg className="graph-like__heart" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 13.6S2.2 10 2.2 6.1A2.9 2.9 0 0 1 8 4.6a2.9 2.9 0 0 1 5.8 1.5C13.8 10 8 13.6 8 13.6z" />
  </svg>
);

/**
 * The heart on a scene, in the credit of the graph's gallery (`GraphGallery`)
 * — FluidEQ's own scenes and members' alike (Ivan, 2026-11-19: "I should be
 * able to like it there by clicking the heart", "solo las plus"), never a
 * standard look. It was members' scenes only.
 *
 * A like is for the author: a member's own scene shows its count and cannot
 * be pressed. Nobody is shown who liked what; the count is all there is.
 * Hovering names the scene and who made it. A like given here is the same
 * like the Scenes gallery shows, so its lists take the answer too.
 */
export default function SceneLikeButton({ scene }: ISceneLikeButtonProps) {
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<ILikeStatus>();
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const { lookId, own } = scene;

  useEffect(() => {
    let current = true;
    setStatus(undefined);
    setOffline(false);
    fetchMemberSceneLikes(lookId)
      .then((answer) => {
        if (current) {
          setStatus(answer);
          setOffline(answer === undefined);
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setOffline(true);
        }
      });
    return () => {
      current = false;
    };
  }, [lookId]);

  const name = resolveSceneName(scene, locale);
  const byline = own
    ? name
    : `${name} · ${t('graph.member.by', {
        name: scene.authorName || t('graph.member.anonymous'),
      })}`;

  if (own) {
    return status ? (
      <button
        type="button"
        className="graph-solo graph-like is-count"
        disabled
        aria-label={t('graph.member.likes', { count: status.likes })}
        title={`${byline} · ${t('graph.member.likes', { count: status.likes })}`}
      >
        <Heart />
        {status.likes}
      </button>
    ) : null;
  }

  const toggle = () => {
    if (!status || busy) {
      return;
    }
    const liked = !status.liked;
    // Shown at once; the server's answer replaces it a moment later.
    setStatus({
      liked,
      likes: Math.max(0, status.likes + (liked ? 1 : -1)),
    });
    setBusy(true);
    likeMemberSceneLook(lookId, liked)
      .then((answer) => {
        if (answer) {
          setStatus(answer);
          setOffline(false);
          patchGalleryScene(lookId, {
            liked: answer.liked,
            likes: answer.likes,
          });
        } else {
          setStatus(status);
          setOffline(true);
        }
        return undefined;
      })
      .catch(() => {
        setStatus(status);
        setOffline(true);
      })
      .finally(() => setBusy(false));
  };

  return (
    <button
      type="button"
      className={`graph-solo graph-like${status?.liked ? ' is-on' : ''}`}
      aria-pressed={status?.liked ?? false}
      aria-label={
        status?.liked
          ? t('graph.member.unlike')
          : t('graph.member.like', { name })
      }
      title={offline ? t('graph.member.likeOffline') : byline}
      disabled={!status}
      onClick={toggle}
    >
      <Heart />
      {status ? status.likes : '–'}
    </button>
  );
}
