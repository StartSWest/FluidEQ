import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLUS_CATEGORIES, type TPlusCategory } from 'common/plusGallery';
import type { IScenePack } from 'common/scenePacks';
import { scenePackSize } from 'common/scenePackSize';
import { versionToPublish, type TVersionNotes } from 'common/sceneVersionNote';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import ProfileNameForm from '../account/ProfileNameForm';
import { createProfile, usePublicIdentity } from '../plus/profileStore';
import DialogFrame from '../components/DialogFrame';
import StudioPublishNote, {
  FIRST_NOTE_WORDS,
  UPDATE_NOTE_WORDS,
  useOfferedLines,
} from './StudioPublishNote';
import { noteLocaleOf, sourceOf } from './publishNoteLines';
import usePublishNoteSend from './usePublishNoteSend';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneTuning } from '../graph/useSceneRunner';
import MenuIcon from '../icons/MenuIcon';
import { categoryKey } from '../plus/GalleryParts';
import { refreshAddons, useAddonCapabilities } from '../addons';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import StudioPublishCamera from './StudioPublishCamera';
import StudioPublishCovers from './StudioPublishCovers';
import StudioPublishHeld from './StudioPublishHeld';
import StudioPublishSize from './StudioPublishSize';
import StudioPublishTicks from './StudioPublishTicks';
import { callPart, missingParts, type TPublishPart } from './publishMissing';
import type {
  IPublishDraft,
  IPreparedPublishPreview,
} from './useStudioPublish';
import type { IPublishPreview } from './usePublishVideo';
import '../styles/Gallery.scss';
import '../styles/StudioDialogs.scss';
import '../styles/StudioPublish.scss';

/**
 * A saved name needs nothing more from the dialog: the store answers that
 * the account has one, and the form goes.
 */
const noop = () => undefined;

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
   * changed in this version, in every language it goes out in.
   */
  onPublish: (
    category: TPlusCategory,
    category2: TPlusCategory | undefined,
    note: TVersionNotes | undefined,
    preview: IPreparedPublishPreview,
  ) => void;
  /** The member's changed line handed to the chat to write in every language. */
  onTranslateNote: (line: string, from: string) => Promise<boolean>;
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
 * A third pick takes the second's place, so the first stays put. Until one is
 * picked the press goes to them (`publishMissing`); an update starts on the
 * ones the scene has.
 *
 * Every publication takes one line, a first version included (Ivan,
 * 2026-11-13: "notes needs to be exiged always", "even on first version"):
 * for a first version what the scene is, the first entry on its versions
 * page; for an update what changed, read on the scene's page and on the
 * notice when the look a listener uses updates. An update also says which
 * version is in the gallery now.
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
  onTranslateNote,
  onCancel,
}: IStudioPublishDialogProps) {
  const { t, locale } = useTranslation();
  const { publishesWithoutReview } = useAddonCapabilities();
  // The scene as it is built, which is what main weighs before it sends it
  // (`tooLargeToPublish`): past the limit, the press is held and says why.
  const size = useMemo(() => scenePackSize(pack), [pack]);
  const tooLarge = size.total > size.limit;
  const me = useAccount().identity?.id;
  const publicName = usePublicIdentity(me);
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
  const [noteLines, setNoteLines] = useOfferedLines(draft.suggestedNotes);
  const mine = noteLocaleOf(locale);
  const noteSend = usePublishNoteSend({
    draft,
    state: noteLines,
    setState: setNoteLines,
    mine,
    onTranslate: onTranslateNote,
  });
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
  // The scene's chat writing or translating the line: Send waits for it.
  const waiting = noteSend.translating !== undefined || noteSend.writing;
  // Every publication goes out with its line: what changed for an update,
  // which the update notice and the versions page are built around, and
  // what the scene is for a first version, the first entry on that page.
  const needsNote = !noteLines.lines[sourceOf(noteLines, mine)].trim();
  // A take of the preview being recorded or finished (`StudioPublishCamera`).
  const [recording, setRecording] = useState(false);
  // Send is never held for a missing part (Ivan, 2026-11-14: "enable the
  // button, so when they click they can tell which is the error"): a press
  // shows what is missing, now in the alert's voice, and goes to the first.
  // Only something under way holds it, and says what: sending, the chat
  // writing the line, a take being recorded.
  const [pressedMissing, setPressedMissing] = useState(false);
  const busy = running || waiting || recording;
  const missing = missingParts({
    name: publicName.missing,
    // A take under way is said on Send itself, not listed as missing.
    video: !previewReady && !recording,
    category: !category,
    size: tooLarge,
    note: needsNote && !waiting,
  });
  const call = (part: TPublishPart) => {
    if (part === 'note') {
      setNoteMissing(true);
    }
    callPart(
      surfaceRef.current,
      part,
      part === 'note' ? noteRef.current : null,
    );
  };
  // A member's publication waits for the admin before anybody sees it
  // (server migration 0037), and the dialog says so before the press rather
  // than after it: the button sends it for review, and the first point says
  // what that means. An account whose publications go straight out
  // (`useAddonCapabilities`) is told so.
  const reviewed = !publishesWithoutReview;
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
  } else if (noteSend.translating !== undefined) {
    buttonLabel = t('studio.publish.noteTranslating', {
      count: noteSend.translating,
    });
  } else if (noteSend.writing) {
    buttonLabel = t('studio.publish.writingButton');
  } else if (recording) {
    buttonLabel = t('studio.publish.recordingButton');
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
        rail={<StudioPublishTicks reviewed={reviewed} update={update} />}
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
            {/* A line of its own over the buttons, ending over the one it
                holds. The line's red word in its box still waits for the
                press (`noteMissing`), and while the chat writes it the box
                says so itself, with its working dots. */}
            {!running && (
              <StudioPublishHeld
                alert={pressedMissing}
                parts={missing}
                update={update}
                onCall={call}
              />
            )}
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                disabled={!canCancel}
                onClick={cancel}
              >
                {t('studio.publish.cancel')}
              </button>
              {/* The wait is the member's to end, never forced; ending it
                  sends nothing. */}
              {waiting && (
                <button
                  type="button"
                  className="button small subtle"
                  onClick={noteSend.stopWaiting}
                >
                  {t('studio.publish.noteStopWaiting')}
                </button>
              )}
              <button
                type="button"
                className={`button small${busy ? ' is-running' : ''}`}
                aria-busy={busy}
                disabled={busy}
                onClick={() => {
                  if (missing.length > 0) {
                    setPressedMissing(true);
                    call(missing[0]);
                    return;
                  }
                  if (!category || !preview) {
                    return;
                  }
                  const prepared = {
                    ...preview,
                    pack: publicationPack,
                    sourceVersion: pack.version,
                  };
                  noteSend.press((notes) =>
                    onPublish(category, category2, notes, prepared),
                  );
                }}
              >
                {buttonLabel}
              </button>
            </div>
          </>
        }
      >
        <div
          className={`studio-publish__body${publicName.missing ? ' studio-publish__body--named' : ''}`}
        >
          {/* The gallery credits a scene with a name and an @handle, and the
              server takes no publication without them (Ivan, 2026-11-12: "we
              need to force users to have a name and @username to publish",
              "once they provide it we dont ask more"): asked here, while the
              account has neither, and gone for good once it is saved. */}
          {publicName.missing && (
            <div className="studio-publish__name" data-publish-part="name">
              <ProfileNameForm save={createProfile} onSaved={noop} />
            </div>
          )}
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
            onRecording={setRecording}
          />

          <StudioPublishCovers
            shots={draft.shots}
            chosen={draft.chosen}
            missed={draft.missed}
            locked={running}
            onChoose={onChoose}
          />

          <div
            className="studio-publish__category"
            data-publish-part="category"
          >
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

          <StudioPublishNote
            words={update ? UPDATE_NOTE_WORDS : FIRST_NOTE_WORDS}
            state={noteLines}
            setState={setNoteLines}
            mine={mine}
            running={running}
            missing={noteMissing}
            onFilled={() => setNoteMissing(false)}
            writing={noteSend.writing}
            translating={noteSend.translating}
            asWritten={noteSend.asWritten}
            unreadable={draft.noteUnreadable === true}
            noteRef={noteRef}
          />
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
}
