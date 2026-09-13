import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { memberLookId } from 'common/memberScenes';
import { FLUIDEQ_CREATOR_ID, type IPublishedScene } from 'common/plusGallery';
import { premiumLookId, resolveSceneName } from 'common/scenePacks';
import type { TMineOutcome } from 'main/ipc/plusPublishing';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { setGalleryNotice } from './galleryActions';
import GalleryListNotice from './GalleryListNotice';
import { markGalleryStale } from './galleryStore';
import { categoryKey, ScenePicture } from './GalleryParts';
import { openPlusPlace } from './plusNavigation';

type TMineFailure = Extract<TMineOutcome, { ok: false }>['reason'];

const MINE_ERRORS: Record<TMineFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
};

type TMine =
  | { state: 'loading' }
  | { state: 'ready'; scenes: IPublishedScene[] }
  | { state: 'failed'; key: TranslationKey };

interface IYourScenesProps {
  me: string | undefined;
}

const publicationId = (scene: IPublishedScene) =>
  scene.official ? premiumLookId(scene.sceneId) : scene.sceneId;

/**
 * The scenes this member has published: how each is doing, and the way to
 * take it down. Works with or without Plus — a membership that ended must
 * still be able to take its work out of the gallery.
 *
 * Publishing and updating happen in the Studio, from the project itself,
 * which is the only place the scene's files are.
 */
export default function YourScenes({ me }: IYourScenesProps) {
  const { t, locale } = useTranslation();
  const [mine, setMine] = useState<TMine>({ state: 'loading' });
  const [confirming, setConfirming] = useState<string>();
  const [working, setWorking] = useState<string>();
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const numbers = new Intl.NumberFormat(locale);

  const load = useCallback(() => {
    setMine({ state: 'loading' });
    window.electron?.ipcRenderer
      ?.myPublishedScenes?.()
      .then((outcome) => {
        setMine(
          outcome.ok
            ? { state: 'ready', scenes: outcome.scenes }
            : { state: 'failed', key: MINE_ERRORS[outcome.reason] },
        );
        return undefined;
      })
      .catch(() =>
        setMine({ state: 'failed', key: 'plus.gallery.error.offline' }),
      );
  }, []);

  useEffect(load, [load]);

  // Said through the gallery's own line, which is shown under the gallery's
  // head: a scene taken down from far down this list answered at the top of
  // the list, out of sight.
  const unpublish = (scene: IPublishedScene, name: string) => {
    setWorking(publicationId(scene));
    setGalleryNotice(undefined);
    window.electron?.ipcRenderer
      ?.unpublishScene?.(publicationId(scene))
      .then((outcome) => {
        setWorking(undefined);
        setConfirming(undefined);
        if (!outcome.ok) {
          setGalleryNotice({ ok: false, key: 'plus.mine.failed' });
          return undefined;
        }
        setGalleryNotice({
          ok: true,
          key: 'plus.mine.unpublished',
          vars: { name },
        });
        setMine((current) =>
          current.state === 'ready'
            ? {
                state: 'ready',
                scenes: current.scenes.filter(
                  (entry) => publicationId(entry) !== publicationId(scene),
                ),
              }
            : current,
        );
        markGalleryStale();
        return undefined;
      })
      .catch(() => {
        setWorking(undefined);
        setGalleryNotice({ ok: false, key: 'plus.mine.failed' });
      });
  };

  return (
    <div className="gallery-page gallery-mine">
      <div className="gallery-mine__intro">
        <p className="gallery-fine">{t('plus.mine.hint')}</p>
        <button
          type="button"
          className="button small subtle"
          onClick={() => openPlusPlace('studio')}
        >
          <Glyph name="studio" />
          {t('plus.mine.openStudio')}
        </button>
      </div>

      {mine.state === 'failed' && (
        <GalleryListNotice text={t(mine.key)} onRetry={load} />
      )}

      {mine.state === 'loading' && (
        <div
          className="gallery-rows"
          role="status"
          aria-label={t('plus.gallery.loading')}
        >
          {[0, 1].map((index) => (
            <span
              key={index}
              className="gallery-row gallery-row--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {mine.state === 'ready' && mine.scenes.length === 0 && (
        <div className="community__empty gallery-empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="upload" />
          </span>
          <p className="community__empty-title">{t('plus.mine.empty')}</p>
        </div>
      )}

      {mine.state === 'ready' && mine.scenes.length > 0 && (
        <ul className="gallery-rows">
          {mine.scenes.map((scene) => {
            const name = resolveSceneName(scene, locale);
            const busy = working === publicationId(scene);
            return (
              <li
                key={publicationId(scene)}
                className={`gallery-row${scene.blocked ? ' is-blocked' : ''}${confirming === publicationId(scene) ? ' is-confirming' : ''}`}
              >
                <ScenePicture
                  className="gallery-row__picture"
                  scene={{
                    lookId: scene.official
                      ? premiumLookId(scene.sceneId)
                      : memberLookId(me ?? '', scene.sceneId),
                    authorId: scene.official ? FLUIDEQ_CREATOR_ID : (me ?? ''),
                    sceneId: scene.sceneId,
                    version: scene.version,
                    updatedAt: scene.updatedAt,
                  }}
                />
                <span className="gallery-row__text">
                  <span className="gallery-row__name">{name}</span>
                  <span className="gallery-row__meta">
                    {t(categoryKey(scene.category))} ·{' '}
                    {t('plus.mine.version', { version: String(scene.version) })}{' '}
                    ·{' '}
                    {scene.updatedAt === scene.publishedAt
                      ? t('plus.mine.published', {
                          date: dates.format(new Date(scene.publishedAt)),
                        })
                      : t('plus.mine.updated', {
                          date: dates.format(new Date(scene.updatedAt)),
                        })}
                  </span>
                  {scene.official && (
                    <span className="gallery-pill gallery-row__official">
                      <Glyph name="plus" />
                      {t('plus.official.author')}
                    </span>
                  )}
                  {scene.blocked && (
                    <span className="gallery-row__blocked">
                      {t('plus.mine.blocked')}
                    </span>
                  )}
                </span>
                {!scene.official && (
                  <dl className="gallery-row__numbers">
                    <div>
                      <dt>{t('plus.scene.likes')}</dt>
                      <dd>{numbers.format(scene.likes)}</dd>
                    </div>
                    <div>
                      <dt>{t('plus.scene.adds')}</dt>
                      <dd>{numbers.format(scene.adds)}</dd>
                    </div>
                  </dl>
                )}
                <span className="gallery-row__actions">
                  {confirming === publicationId(scene) ? (
                    <>
                      <span className="gallery-row__confirm">
                        {t('plus.mine.confirm')}
                      </span>
                      <button
                        type="button"
                        className="button small subtle"
                        disabled={busy}
                        onClick={() => setConfirming(undefined)}
                      >
                        {t('plus.mine.confirmNo')}
                      </button>
                      <button
                        type="button"
                        className={`button small gallery-danger${busy ? ' is-running' : ''}`}
                        aria-busy={busy}
                        onClick={() => {
                          if (!busy) {
                            unpublish(scene, name);
                          }
                        }}
                      >
                        {t('plus.mine.confirmYes')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button small subtle"
                      onClick={() => setConfirming(publicationId(scene))}
                    >
                      {t('plus.mine.unpublish')}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
