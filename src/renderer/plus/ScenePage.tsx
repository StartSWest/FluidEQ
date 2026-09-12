import { useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import type { TGallerySceneFailure } from 'main/ipc/plusGallery';
import { requestAccountPanel } from '../account/accountPanel';
import Avatar from '../community/Avatar';
import Glyph from '../community/Glyph';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';
import { useTranslation } from '../utils/I18nContext';
import { setGraphLook } from '../utils/graphStyle';
import useGalleryLocalScenes from './useGalleryLocalScenes';
import GalleryCard from './GalleryCard';
import { addGalleryScene, useAddingScenes } from './galleryActions';
import {
  categoryKey,
  SceneHeart,
  ScenePicture,
  usePlusEntitled,
} from './GalleryParts';
import {
  useGalleryList,
  useGalleryScene,
  type TListQuery,
} from './galleryStore';
import { openGalleryPage, type IMakerRef } from './plusNavigation';
import ReportDialog from './ReportDialog';
import ScenePreview, { type TPreviewTrouble } from './ScenePreview';
import SceneSteps from './SceneSteps';
import SceneTaste from './SceneTaste';

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
  /** No Plus: the scene plays for a taste of it. */
  | { state: 'taste'; pack: IScenePack }
  | { state: 'failed'; key: TranslationKey }
  /**
   * No Plus: the picture, and what Plus would do with it — once the taste
   * is over, or when there was none to give.
   */
  | { state: 'plus'; tasted: boolean };

interface IScenePageProps {
  scene: IGalleryScene;
  /** The list it was opened from, for stepping to the next one. */
  from?: TListQuery;
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
 *
 * Without Plus the scene plays for ten seconds (see `SceneTaste`) so the
 * member sees what it does, then its picture stays with the way into Plus
 * beside it; the one loud button on the page is that way in.
 */
export default function ScenePage({
  scene: opened,
  from: openedFrom,
  me,
  onShowGraph,
}: IScenePageProps) {
  const { t, locale } = useTranslation();
  const entitled = usePlusEntitled();
  const scene = useGalleryScene(opened);
  const adding = useAddingScenes().has(scene.lookId);
  const localById = useGalleryLocalScenes();
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
    setReported(false);
    setPreview({ state: 'loading' });
    if (!isSceneRenderingAvailable()) {
      setPreview(
        entitled
          ? { state: 'failed', key: 'plus.scene.cannotDraw' }
          : { state: 'plus', tasted: false },
      );
      return undefined;
    }
    window.electron?.ipcRenderer
      ?.previewGalleryScene?.(
        opened.authorId,
        opened.sceneId,
        opened.version,
        opened.updatedAt,
      )
      .then((outcome) => {
        if (cancelled) {
          return undefined;
        }
        if (outcome.ok) {
          setPreview({
            state: entitled ? 'ready' : 'taste',
            pack: outcome.pack,
          });
        } else if (outcome.reason === 'not-entitled') {
          setPreview({ state: 'plus', tasted: false });
        } else {
          setPreview({
            state: 'failed',
            key: PREVIEW_FAILURES[outcome.reason],
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
  }, [
    opened.authorId,
    opened.sceneId,
    opened.version,
    opened.updatedAt,
    entitled,
  ]);

  const makerQuery = useMemo(
    () => ({ sort: 'liked', authorId: scene.authorId }) as const,
    [scene.authorId],
  );
  const moreBy = useGalleryList(makerQuery);
  // Opened from a card: step through that card's list. Opened any other
  // way, through its maker's.
  const from = openedFrom ?? makerQuery;
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
  if (!entitled) {
    primary = (
      <button
        type="button"
        className="button small"
        onClick={() => requestAccountPanel('subscribe')}
      >
        <Glyph name="plus" />
        {t('plus.scene.getPlus')}
      </button>
    );
  } else if (current) {
    primary = (
      <button
        type="button"
        className="button small"
        disabled={adding || preview.state !== 'ready'}
        aria-busy={adding}
        onClick={() => {
          addGalleryScene(scene, name)
            .then((ok) => {
              if (ok) {
                setGraphLook(local.lookId);
                onShowGraph();
              }
              return undefined;
            })
            .catch(() => undefined);
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
          {preview.state === 'ready' && (
            <ScenePreview
              identity={`${scene.lookId}@${preview.pack.version}`}
              pack={preview.pack}
              label={t('plus.scene.playing')}
              onTrouble={(trouble) =>
                setPreview({ state: 'failed', key: PREVIEW_FAILURES[trouble] })
              }
            />
          )}
          {preview.state === 'taste' && (
            <SceneTaste
              identity={`${scene.lookId}@${preview.pack.version}`}
              pack={preview.pack}
              onTrouble={(trouble) =>
                setPreview({ state: 'failed', key: PREVIEW_FAILURES[trouble] })
              }
              onOver={() => setPreview({ state: 'plus', tasted: true })}
            />
          )}
          {preview.state !== 'ready' && preview.state !== 'taste' && (
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
          <SceneSteps scene={scene} from={from} paused={reporting} />
          {preview.state === 'plus' && (
            <span
              className={`gallery-preview__plus${preview.tasted ? ' is-tasted' : ''}`}
            >
              <Glyph name="plus" />
              <span className="gallery-preview__plus-text">
                {t(
                  preview.tasted
                    ? 'plus.scene.keepWatching'
                    : 'plus.scene.plusPlays',
                )}
              </span>
              {preview.tasted && (
                <button
                  type="button"
                  className="button small"
                  onClick={() => requestAccountPanel('subscribe')}
                >
                  {t('plus.gate.cta')}
                </button>
              )}
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

        {scene.official ? (
          <p className="gallery-pill">{t('plus.official.included')}</p>
        ) : (
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
        )}

        <div className="gallery-scene__actions">
          {primary}
          <SceneHeart
            scene={scene}
            name={name}
            own={own}
            className="gallery-like--large"
          />
        </div>
        {current && (
          <p className="gallery-scene__have">
            <Glyph name="shield" />
            {own ? t('plus.scene.inLooksOwn') : t('plus.scene.inLooks')}
          </p>
        )}
        <p className="gallery-fine">{t('plus.scene.fine')}</p>
        {!own && !scene.official && (
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
                  openGalleryPage({
                    kind: 'scene',
                    scene: next,
                    from: makerQuery,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {reporting && !scene.official && (
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
