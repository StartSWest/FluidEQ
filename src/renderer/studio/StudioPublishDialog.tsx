import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLUS_CATEGORIES, type TPlusCategory } from 'common/plusGallery';
import type { IScenePack } from 'common/scenePacks';
import { formatPackBytes, scenePackSize } from 'common/scenePackSize';
import { versionToPublish } from 'common/sceneVersionNote';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import DialogFrame from '../components/DialogFrame';
import StudioPublishNote, { useOfferedNote } from './StudioPublishNote';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneTuning } from '../graph/useSceneRunner';
import MenuIcon from '../icons/MenuIcon';
import { categoryKey } from '../plus/GalleryParts';
import { refreshAddons, useAddonCapabilities } from '../addons';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import StudioPublishCamera from './StudioPublishCamera';
import StudioPublishCovers from './StudioPublishCovers';
import StudioPublishSize from './StudioPublishSize';
import type {
  IPublishDraft,
  IPreparedPublishPreview,
} from './useStudioPublish';
import type { IPublishPreview } from './usePublishVideo';
import '../styles/Gallery.scss';
import '../styles/StudioDialogs.scss';
import '../styles/StudioPublish.scss';

interface IStudioPublishDialogProps {
  /** The project, so the dialog's stage is its own. */
  identity: string;
  pack: IScenePack;
  name: string;
  draft: IPublishDraft;
  running: boolean;
  phase?: import('common/scenePreviewMedia').TScenePublishPhase;
  /** The Studio's settings, so the scene plays here as it does on the stage. */
  tuning: ISceneTuning;
  /** A caught moment, at the time of day the stage was showing. */
  onCapture: (frames: ISceneFrame[], daylight: number) => void;
  onChoose: (id: number) => void;
  /**
   * The first category, the one a card names, an optional second, and what
   * changed in this version, as typed.
   */
  onPublish: (
    category: TPlusCategory,
    category2: TPlusCategory | undefined,
    note: string | undefined,
    preview: IPreparedPublishPreview,
  ) => void;
  onCancel: () => void;
}

/**
 * Publishing a scene to the gallery: the scene itself, playing, to catch its
 * cover from — a picture the dialog opens with is there already, and every
 * capture joins it to choose between — then a category from the fixed list
 * and the three sentences that matter about what publishing means.
 *
 * The categories are chosen, never typed: nothing reaches the gallery that a
 * member wrote except the scene's own name, which the app already checked.
 * Up to two, because one made a maker choose between what a scene shows and
 * what it is — a skyline on a lake is Cities and Water. The first picked is
 * the one its card names, and the chips number themselves once there are two.
 * A third pick takes the second's place, so the first stays put. Publish is
 * disabled until one is picked; an update starts on the ones the scene has.
 *
 * An update also says which version is in the gallery now, and takes one line
 * about what changed — what listeners read on the scene's page and on the
 * notice when the look they use updates.
 */
export default function StudioPublishDialog({
  identity,
  pack,
  name,
  draft,
  running,
  phase,
  tuning,
  onCapture,
  onChoose,
  onPublish,
  onCancel,
}: IStudioPublishDialogProps) {
  const { t, locale } = useTranslation();
  const { publishesWithoutReview } = useAddonCapabilities();
  // The scene as it is built, which is what main weighs before it sends it
  // (`tooLargeToPublish`): past the limit, the press is held and says why.
  const size = useMemo(() => scenePackSize(pack), [pack]);
  const tooLarge = size.total > size.limit;
  const me = useAccount().identity?.id;
  // The scene the clip is stamped with, built exactly as main rebuilds it to
  // check the stamp (`previewMatchesSource`): the project as built, at the
  // version it goes out under. The Studio's settings are already in `pack`
  // (each one is saved into the project, and `source` re-records the clip
  // when the rebuilt pack arrives). It used to be passed back through
  // `normalizeScenePack`, the reader for a pack as stored, where palettes and
  // colours are entries of `params`; a built pack keeps them apart, so that
  // reader dropped them, and every scene with a palette, a colour or a
  // choice's option looks was refused as "changed after recording".
  const publicationPack = useMemo(
    () => ({ ...pack, version: versionToPublish(draft.held) }),
    [pack, draft.held],
  );
  const liveSource = useMemo(
    () =>
      JSON.stringify([
        identity,
        me,
        pack,
        tuning,
        versionToPublish(draft.held),
      ]),
    [identity, me, pack, tuning, draft.held],
  );
  // The clip, and the scene it shows, as they were when Publish was pressed,
  // held until the publication answers (Ivan, 2026-11-09: "is allowing me to
  // re record the demo until is not publised ... we alow it only once per
  // before plublising"). Publishing writes the version it goes out under
  // into the project, the project builds again, and a new pack is a new
  // `source`: the camera, keyed on it, started a new recording mid-publish.
  // Set during render, where the press's own update lands, so not one frame
  // passes with the new pack; given back when the publication answers, so a
  // failed one can be recorded again for the retry.
  const [pressed, setPressed] = useState<{
    source: string;
    pack: IScenePack;
    tuning: ISceneTuning;
  }>();
  if (running && pressed === undefined) {
    setPressed({ source: liveSource, pack, tuning });
  } else if (!running && pressed !== undefined) {
    setPressed(undefined);
  }
  const held = running ? pressed : undefined;
  const source = held?.source ?? liveSource;
  const cameraPack = held?.pack ?? pack;
  const cameraTuning = held?.tuning ?? tuning;
  const [preview, setPreview] = useState<IPublishPreview>();
  const previewReady = preview?.source === source;
  // Asked again on opening: an answer that failed earlier — offline at
  // launch — would say this account's scene waits for review when it does
  // not. The reply lands while the covers are drawn.
  useEffect(() => {
    refreshAddons(me);
  }, [me]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const [categories, setCategories] = useState<TPlusCategory[]>(() =>
    [draft.published?.category, draft.published?.category2].flatMap((entry) =>
      entry ? [entry] : [],
    ),
  );
  const [category, category2] = categories;
  const [note, setNote] = useOfferedNote(draft.suggestedNote);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // Said only once the press has been made, never on opening: a dialog that
  // is already red before anything has been done is shouting at somebody who
  // has done nothing wrong. A held button with the reason in a tooltip was
  // the other way round and nobody hovers a disabled button — so the press
  // goes through, and this is what it lands on.
  const [noteMissing, setNoteMissing] = useState(false);
  const pick = (entry: TPlusCategory) =>
    setCategories((current) => {
      if (current.includes(entry)) {
        return current.filter((chosen) => chosen !== entry);
      }
      return current.length < 2 ? [...current, entry] : [current[0], entry];
    });
  const cancel = useCallback(() => onCancel(), [onCancel]);
  const canCancel = !running || phase === 'preparing' || phase === 'uploading';
  useModalKeys(surfaceRef, firstRef, { busy: !canCancel, onCancel: cancel });

  const update = draft.published !== undefined;
  // A new version people already have goes out with a line saying what
  // changed, always: the update notice and the versions page are built around
  // it, and without one a listener is asked to take a new version on trust.
  // A first publication has nothing to be new against, so it is not asked.
  const needsNote = update && note.trim().length === 0;
  // A member's publication waits for the admin before anybody sees it
  // (server migration 0037), and the dialog says so before the press rather
  // than after it: the button sends it for review, and the first point says
  // what that means. An account whose publications go straight out
  // (`useAddonCapabilities`) is told so.
  const reviewed = !publishesWithoutReview;
  let publishHint: string | undefined;
  if (tooLarge) {
    publishHint = t('studio.publish.tooLarge', {
      limit: formatPackBytes(size.limit, locale),
    });
  } else if (!previewReady) {
    publishHint = t('studio.publish.videoRequired');
  } else if (!category) {
    publishHint = t('studio.publish.pickCategory');
  }
  let go: string;
  if (!draft.agreed) {
    go = t(reviewed ? 'studio.publish.agreeReview' : 'studio.publish.agree');
  } else if (update) {
    go = t(
      reviewed ? 'studio.publish.goReviewUpdate' : 'studio.publish.goUpdate',
    );
  } else {
    go = t(reviewed ? 'studio.publish.goReview' : 'studio.publish.go');
  }
  let buttonLabel = go;
  if (running) {
    buttonLabel = t(
      reviewed ? 'studio.publish.runningReview' : 'studio.publish.running',
    );
    if (phase === 'preparing' || phase === 'uploading') {
      buttonLabel = t('studio.publish.videoUploading');
    }
  }

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && canCancel) {
          cancel();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="studio-publish"
        icon={<MenuIcon name="upload" />}
        title={
          update
            ? t('studio.publish.titleUpdate', { name })
            : t('studio.publish.title', { name })
        }
        titleId="studio-publish-title"
        badge={
          <span className="dialog-frame__badge">
            {t('studio.publish.version', {
              // The number this publication will carry, not the one in the
              // project: a scene's content may only change under a higher
              // version, so publishing sets it, and the dialog has to say
              // which one is going out or it names the version being
              // replaced right beside the one it replaces. Above what the
              // scene was ever out at, too, when it was unpublished since.
              version: String(versionToPublish(draft.held)),
            })}
          </span>
        }
        description={
          draft.published &&
          t('studio.publish.publishedVersion', {
            version: String(draft.published.version),
          })
        }
        aria-busy={running}
        closeLabel={t('support.close')}
        // Away while the scene is being sent, as Escape and the backdrop are.
        onClose={canCancel ? cancel : undefined}
        // What publishing means, in the rail: read once and the same every
        // time, so the body is left to what is being decided now.
        rail={
          <ul className="studio-ticks">
            {reviewed && (
              <li>
                <MenuIcon name="check" />
                <span>
                  {update
                    ? t('studio.publish.pointReviewUpdate')
                    : t('studio.publish.pointReview')}
                </span>
              </li>
            )}
            <li>
              <MenuIcon name="check" />
              <span>{t('studio.publish.point1')}</span>
            </li>
            <li>
              <MenuIcon name="check" />
              <span>
                {update
                  ? t('studio.publish.point3Update')
                  : t('studio.publish.point3')}
              </span>
            </li>
          </ul>
        }
        footer={
          <>
            <button
              type="button"
              className="button small subtle"
              disabled={running}
              onClick={() => {
                // The terms open in the Account dialog, which would otherwise
                // appear underneath this one.
                cancel();
                requestAccountPanel('terms');
              }}
            >
              {t('studio.publish.read')}
            </button>
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                disabled={!canCancel}
                onClick={cancel}
              >
                {t('studio.publish.cancel')}
              </button>
              <button
                type="button"
                className={`button small${running ? ' is-running' : ''}`}
                aria-busy={running}
                disabled={!category || !previewReady || running || tooLarge}
                title={publishHint}
                onClick={() => {
                  if (
                    !category ||
                    running ||
                    !preview ||
                    !previewReady ||
                    tooLarge
                  ) {
                    return;
                  }
                  if (needsNote) {
                    setNoteMissing(true);
                    noteRef.current?.focus();
                    return;
                  }
                  onPublish(category, category2, update ? note : undefined, {
                    ...preview,
                    pack: publicationPack,
                    sourceVersion: pack.version,
                  });
                }}
              >
                {buttonLabel}
              </button>
            </div>
          </>
        }
      >
        <div className="studio-publish__body">
          <StudioPublishCamera
            initialFocusRef={firstRef}
            key={source}
            identity={identity}
            pack={cameraPack}
            name={name}
            locked={running}
            tuning={cameraTuning}
            onCapture={onCapture}
            source={source}
            onPreview={setPreview}
          />

          <StudioPublishCovers
            shots={draft.shots}
            chosen={draft.chosen}
            missed={draft.missed}
            locked={running}
            onChoose={onChoose}
          />

          <div className="studio-publish__category">
            <span
              className="gallery-dialog__label"
              id="studio-publish-category"
            >
              {t('studio.publish.category')}
            </span>
            <span className="studio-publish__category-hint">
              {t('studio.publish.categoryHint')}
            </span>
            <div
              className="gallery-chips"
              role="group"
              aria-labelledby="studio-publish-category"
            >
              {PLUS_CATEGORIES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={categories.includes(entry)}
                  className="gallery-chip"
                  disabled={running}
                  onClick={() => pick(entry)}
                >
                  {t(categoryKey(entry))}
                  {categories.length === 2 && categories.includes(entry) && (
                    <span className="studio-publish__order" aria-hidden="true">
                      {categories.indexOf(entry) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <StudioPublishSize size={size} />

          {update && (
            <StudioPublishNote
              note={note}
              setNote={setNote}
              running={running}
              missing={noteMissing}
              onFilled={() => setNoteMissing(false)}
              writing={draft.noteWriting === true}
              noteRef={noteRef}
            />
          )}
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
}
