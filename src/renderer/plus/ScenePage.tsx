import { useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import type { TGallerySceneFailure } from 'main/ipc/plusGallery';
import Avatar from '../community/Avatar';
import Glyph from '../community/Glyph';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';
import { useTranslation } from '../utils/I18nContext';
import { setGraphLook } from '../utils/graphStyle';
import { useUsableMemberScenes } from '../utils/memberScenes';
import GalleryCard from './GalleryCard';
import {
  addGalleryScene,
  toggleGalleryLike,
  useAddingScenes,
} from './galleryActions';
import { categoryKey, LikeButton, ScenePicture } from './GalleryParts';
import { useGalleryList, useGalleryScene } from './galleryStore';
import { openGalleryPage, type IMakerRef } from './plusNavigation';
import ReportDialog from './ReportDialog';
import ScenePreview, { type TPreviewTrouble } from './ScenePreview';

/** Cards under "More by": one row on a wide pane, two on a narrow one. */
const MORE_BY = 4;

const PREVIEW_FAILURES: Record<
  Exclude<TGallerySceneFailure, 'not-entitled'> | TPreviewTrouble,
  TranslationKey
> = {
  unavailable: 'plus.scene.unavailable',
  blocked: 'plus.scene.blocked',
  changed: 'plus.scene.changed',
  heavy: 'plus.scene.heavy',
  compile: 'plus.scene.broken',
};

type TPreview =
  | { state: 'loading' }
  | { state: 'ready'; pack: IScenePack }
  | { state: 'failed'; key: TranslationKey };

interface IScenePageProps {
  scene: IGalleryScene;
  me: string | undefined;
  onShowGraph: () => void;
}

/**
 * One published scene: playing, big, on the member's own music, with who made
 * it, how it is liked, Add, and the rest of its maker's work under it.
 *
 * The scene file is downloaded and verified in the main process before a byte
 * of it reaches here, exactly as Add would verify it; the page then plays the
 * pack it was handed and nothing else. Add reuses that same download.
 */
export default function ScenePage({
  scene: opened,
  me,
  onShowGraph,
}: IScenePageProps) {
  const { t, locale } = useTranslation();
  const scene = useGalleryScene(opened);
  const adding = useAddingScenes().has(scene.lookId);
  const localScenes = useUsableMemberScenes();
  const localById = useMemo(
    () => new Map(localScenes.map((entry) => [entry.lookId, entry])),
    [localScenes],
  );
  const local = localById.get(scene.lookId);
  const [preview, setPreview] = useState<TPreview>({ state: 'loading' });
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const name = resolveSceneName(scene, locale);
  const own = scene.authorId === me;
  const makerName = own
    ? t('plus.card.byYou')
    : t('plus.card.by', {
        name:
          scene.authorName ?? scene.authorHandle ?? t('plus.card.anonymous'),
      });
  const maker: IMakerRef = {
    authorId: scene.authorId,
    name: scene.authorName,
    handle: scene.authorHandle,
  };
  const numbers = new Intl.NumberFormat(locale);

  useEffect(() => {
    let cancelled = false;
    setPreview({ state: 'loading' });
    setReported(false);
    if (!isSceneRenderingAvailable()) {
      setPreview({ state: 'failed', key: 'plus.scene.cannotDraw' });
      return undefined;
    }
    window.electron?.ipcRenderer
      ?.previewGalleryScene?.(opened.authorId, opened.sceneId, opened.version)
      .then((outcome) => {
        if (cancelled) {
          return undefined;
        }
        if (outcome.ok) {
          setPreview({ state: 'ready', pack: outcome.pack });
        } else {
          setPreview({
            state: 'failed',
            key:
              outcome.reason === 'not-entitled'
                ? 'plus.scene.unavailable'
                : PREVIEW_FAILURES[outcome.reason],
          });
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ state: 'failed', key: 'plus.scene.unavailable' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [opened.authorId, opened.sceneId, opened.version]);

  const moreBy = useGalleryList({ sort: 'liked', authorId: scene.authorId });
  const others = useMemo(
    () =>
      moreBy.list.scenes
        .filter((entry) => entry.lookId !== scene.lookId)
        .slice(0, MORE_BY),
    [moreBy.list.scenes, scene.lookId],
  );

  const current = local !== undefined && local.version >= scene.version;
  let primary = (
    <button
      type="button"
      className={`button small${adding ? ' is-running' : ''}`}
      aria-busy={adding}
      disabled={adding || preview.state === 'failed'}
      onClick={() => {
        addGalleryScene(scene, name).catch(() => undefined);
      }}
    >
      {local ? t('plus.scene.update') : t('plus.scene.add')}
    </button>
  );
  if (current) {
    primary = (
      <button
        type="button"
        className="button small"
        onClick={() => {
          setGraphLook(scene.lookId);
          onShowGraph();
        }}
      >
        {t('plus.scene.play')}
      </button>
    );
  }

  return (
    <div className="gallery-page gallery-scene">
      <div className="gallery-scene__main">
        <div className="gallery-preview">
          {preview.state === 'ready' ? (
            <ScenePreview
              identity={`${scene.lookId}@${preview.pack.version}`}
              pack={preview.pack}
              label={t('plus.scene.playing')}
              onTrouble={(trouble) =>
                setPreview({ state: 'failed', key: PREVIEW_FAILURES[trouble] })
              }
            />
          ) : (
            <ScenePicture scene={scene} className="gallery-preview__still" />
          )}
          {preview.state === 'ready' && (
            <span className="gallery-preview__tag">
              <span className="gallery-preview__live" aria-hidden="true" />
              {t('plus.scene.playing')}
            </span>
          )}
          {preview.state === 'loading' && (
            <span className="gallery-preview__veil" role="status">
              <span className="gallery-preview__spinner" aria-hidden="true" />
              {t('plus.scene.loading')}
            </span>
          )}
          {preview.state === 'failed' && (
            <span
              className="gallery-preview__veil gallery-preview__veil--failed"
              role="alert"
            >
              {t(preview.key)}
            </span>
          )}
        </div>
      </div>

      <aside className="gallery-scene__info">
        <h3 className="gallery-scene__name">{name}</h3>
        <div className="gallery-scene__byline">
          <button
            type="button"
            className="gallery-scene__maker"
            onClick={() => openGalleryPage({ kind: 'maker', maker })}
          >
            <Avatar
              handle={scene.authorHandle ?? scene.authorId}
              displayName={scene.authorName ?? undefined}
            />
            <span>{makerName}</span>
          </button>
          <span className="gallery-pill">{t(categoryKey(scene.category))}</span>
        </div>

        <dl className="gallery-figures">
          <div>
            <dt>{t('plus.scene.likes')}</dt>
            <dd>{numbers.format(scene.likes)}</dd>
          </div>
          <div>
            <dt>{t('plus.scene.week')}</dt>
            <dd>{numbers.format(scene.likesWeek)}</dd>
          </div>
          <div>
            <dt>{t('plus.scene.adds')}</dt>
            <dd>{numbers.format(scene.adds)}</dd>
          </div>
        </dl>

        <div className="gallery-scene__actions">
          {primary}
          <LikeButton
            scene={scene}
            name={name}
            own={own}
            className="gallery-like--large"
            onToggle={() => {
              toggleGalleryLike(scene).catch(() => undefined);
            }}
          />
        </div>
        {current && (
          <p className="gallery-scene__have">
            <Glyph name="shield" />
            {own ? t('plus.scene.inLooksOwn') : t('plus.scene.inLooks')}
          </p>
        )}
        <p className="gallery-fine">{t('plus.scene.fine')}</p>
        {!own && (
          <button
            type="button"
            className="gallery-scene__report"
            disabled={reported}
            onClick={() => setReporting(true)}
          >
            <Glyph name="report" />
            {reported ? t('plus.scene.reported') : t('plus.scene.report')}
          </button>
        )}
      </aside>

      {others.length > 0 && (
        <section className="gallery-scene__more">
          <h4 className="gallery-section-title">
            {own
              ? t('plus.scene.moreByYou')
              : t('plus.scene.moreBy', {
                  name:
                    scene.authorName ??
                    scene.authorHandle ??
                    t('plus.card.anonymous'),
                })}
          </h4>
          <div className="gallery-grid gallery-grid--row">
            {others.map((entry) => (
              <GalleryCard
                key={entry.lookId}
                scene={entry}
                me={me}
                local={localById.get(entry.lookId)}
                onOpen={(next) =>
                  openGalleryPage({ kind: 'scene', scene: next })
                }
              />
            ))}
          </div>
        </section>
      )}

      {reporting && (
        <ReportDialog
          scene={scene}
          name={name}
          onClose={(sent) => {
            setReporting(false);
            if (sent) {
              setReported(true);
            }
          }}
        />
      )}
    </div>
  );
}
