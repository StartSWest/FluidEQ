import { useEffect, useState } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { ILikeStatus } from 'main/memberScenes/social';
import { useTranslation } from '../utils/I18nContext';
import {
  fetchMemberSceneLikes,
  likeMemberSceneLook,
  type IUsableMemberScene,
} from '../utils/memberScenes';

interface ISceneLikeButtonProps {
  scene: IUsableMemberScene;
}

const Heart = () => (
  <svg className="graph-like__heart" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 13.6S2.2 10 2.2 6.1A2.9 2.9 0 0 1 8 4.6a2.9 2.9 0 0 1 5.8 1.5C13.8 10 8 13.6 8 13.6z" />
  </svg>
);

/**
 * The heart on a member's scene, in the graph's option bar — the row that is
 * on screen in the normal view and in full screen alike, and fades with it.
 *
 * It takes the place of the design button, which a scene has no use for, so
 * the row is no wider with a scene playing than with a look. A like is points
 * for the author on the leaderboard: a member's own scene shows its count and
 * cannot be pressed. Nobody is shown who liked what; the count is all there
 * is. Hovering names the scene and who made it.
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
