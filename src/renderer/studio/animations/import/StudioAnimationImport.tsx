/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Translate, TranslationKey } from 'common/i18n';
import { ANIMATION_NAME, MAX_ANIMATIONS } from 'common/studioAnimation';
import Glyph from '../../../community/Glyph';
import DialogFrame from '../../../components/DialogFrame';
import { useTranslation } from '../../../utils/I18nContext';
import useModalKeys from '../../../utils/useModalKeys';
import Switch from '../../../widgets/Switch';
import AnimationView from '../AnimationView';
import useAnimationPlayer from '../useAnimationPlayer';
import type { IViewedAnimation } from '../useStudioAnimations';
import { addImport, type TImportAddFailure } from './importAdd';
import type { IChosenFile, TImportKind } from './importFiles';
import ImportGridPicker from './ImportGridPicker';
import useAnimationImport, {
  regrid,
  usePreview,
  type IImportClipChoice,
  type TImportState,
} from './useAnimationImport';
import '../../../styles/StudioChat.scss';
import '../../../styles/StudioDialogs.scss';
import '../../../styles/StudioAnimationImport.scss';

interface IStudioAnimationImportProps {
  files: readonly IChosenFile[];
  /** The scene's animations' names: an import never takes one. */
  taken: ReadonlySet<string>;
  onChooseAgain: () => void;
  /** The animations now in the scene, the first to be opened. */
  onAdded: (names: string[]) => void;
  onClose: () => void;
}

/** The refusal's words, with what they name filled in. */
const refusalText = (
  t: Translate,
  refusal: Extract<TImportState, { phase: 'refused' }>['refusal'],
) => {
  switch (refusal.refused) {
    case 'too-large':
      return t('studio.animationImport.refused.tooLarge', {
        file: refusal.file,
      });
    case 'too-many':
      return t('studio.animationImport.refused.tooMany', {
        most: refusal.most,
      });
    case 'unreadable':
      return t('studio.animationImport.refused.unreadable', {
        file: refusal.file,
      });
    case 'no-frames':
      return t('studio.animationImport.refused.noFrames', {
        file: refusal.file,
      });
    default:
      return t('studio.animationImport.refused.mixed');
  }
};

const KIND_KEYS: Record<TImportKind['kind'], TranslationKey> = {
  grid: 'studio.animationImport.kind.grid',
  atlas: 'studio.animationImport.kind.atlas',
  animated: 'studio.animationImport.kind.animated',
  aseprite: 'studio.animationImport.kind.aseprite',
  sequence: 'studio.animationImport.kind.sequence',
};

const FAILURE_KEYS: Record<TImportAddFailure, TranslationKey> = {
  closed: 'studio.animationImport.failed.closed',
  invalid: 'studio.animationImport.failed.write',
  failed: 'studio.animationImport.failed.write',
  taken: 'studio.animationImport.nameTaken',
  full: 'studio.animationImport.failed.full',
};

/**
 * One animation's preview: the tab's own view and player, so it plays as
 * it will once added. The speed and ground it is left on are what is
 * added (`onPlayed`), and coming back to it starts it on them again.
 */
function ImportPreview({
  viewed,
  start,
  onPlayed,
}: {
  viewed: IViewedAnimation;
  start: Pick<IImportClipChoice, 'fps' | 'ground'>;
  onPlayed: (fps: number, ground: IImportClipChoice['ground']) => void;
}) {
  const player = useAnimationPlayer(viewed);
  const started = useRef(false);
  const { setFps, setGround } = player;
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    if (start.fps !== undefined) {
      setFps(start.fps);
    }
    if (start.ground !== undefined) {
      setGround(start.ground);
    }
  }, [start, setFps, setGround]);
  useEffect(() => {
    if (started.current) {
      onPlayed(player.fps, player.ground);
    }
  }, [player.fps, player.ground, onPlayed]);
  return <AnimationView viewed={viewed} player={player} />;
}

/**
 * An animation brought in from outside (Ivan, 2026-11-09: "we need to be
 * able to import all animation styles, standard ones like sheets and
 * others that most used"): a sprite sheet cut by its grid, a sheet with
 * its TexturePacker, Phaser or Aseprite JSON, an animated GIF, PNG or WebP,
 * or one picture a frame. Each is laid into the scene's own sheet and
 * played before it is added, so the scene and its chat read one kind of
 * animation whatever it came from.
 */
export default function StudioAnimationImport({
  files,
  taken,
  onChooseAgain,
  onAdded,
  onClose,
}: IStudioAnimationImportProps) {
  const { t } = useTranslation();
  const id = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { state, setState } = useAnimationImport(files, taken);
  const [clip, setClip] = useState(0);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<{
    name: string;
    reason: TImportAddFailure;
  }>();
  useModalKeys(surfaceRef, closeRef, { busy: adding, onCancel: onClose });

  const ready = state.phase === 'ready' ? state : undefined;
  const choices = ready?.choices ?? [];
  const choice = choices[clip];
  const { viewed } = usePreview(ready?.decoded, clip, choice);

  const update = (index: number, change: Partial<IImportClipChoice>) =>
    setState((was) =>
      was.phase === 'ready'
        ? {
            ...was,
            choices: was.choices.map((each, at) =>
              at === index ? { ...each, ...change } : each,
            ),
          }
        : was,
    );
  // Stable, so the preview does not report on every render.
  const playedRef = useRef(clip);
  playedRef.current = clip;
  const [onPlayed] = useState(
    () => (fps: number, ground: IImportClipChoice['ground']) =>
      update(playedRef.current, { fps, ground }),
  );

  const nameProblem = (index: number): string | undefined => {
    const { name } = choices[index];
    if (!ANIMATION_NAME.test(name)) {
      return t('studio.animationImport.nameRule');
    }
    const twice = choices.some(
      (other, at) => at !== index && other.include && other.name === name,
    );
    return taken.has(name) || twice
      ? t('studio.animationImport.nameTaken', { name })
      : undefined;
  };
  const included = choices.filter(({ include }) => include);
  const full = taken.size + included.length > MAX_ANIMATIONS;
  const addable =
    !adding &&
    included.length > 0 &&
    !full &&
    choices.every((each, index) => !each.include || !nameProblem(index));

  const add = () => {
    if (!ready || !addable) {
      return;
    }
    setAdding(true);
    setFailure(undefined);
    addImport(ready.decoded, ready.choices)
      .then((outcome) => {
        setAdding(false);
        if (outcome.ok) {
          onAdded(outcome.added);
          return undefined;
        }
        // Those added are in the scene: they are not offered again.
        setState((was) =>
          was.phase === 'ready'
            ? {
                ...was,
                choices: was.choices.map((each) =>
                  outcome.added.includes(each.name)
                    ? { ...each, include: false }
                    : each,
                ),
              }
            : was,
        );
        setFailure({ name: outcome.name, reason: outcome.reason });
        return undefined;
      })
      .catch(() => {
        setAdding(false);
        setFailure({ name: choice?.name ?? '', reason: 'failed' });
      });
  };

  const rail = ready && choice && (
    <div className="studio-animation-import__settings">
      <p className="dialog-frame__rail-text">{t(KIND_KEYS[ready.kind])}</p>
      {ready.kind === 'grid' && ready.decoded.grid && files[0] && (
        <ImportGridPicker
          picture={files[0].bytes}
          width={ready.decoded.image.width}
          height={ready.decoded.image.height}
          grid={ready.decoded.grid}
          count={ready.decoded.frames.length}
          onChange={(grid, count) =>
            setState((was) =>
              was.phase === 'ready'
                ? { ...was, decoded: regrid(was.decoded, grid, count) }
                : was,
            )
          }
        />
      )}
      {choices.length > 1 && (
        <div className="studio-new__field">
          <span className="studio-new__label" id={`${id}-clips`}>
            {t('studio.animationImport.clips')}
          </span>
          <div
            className="studio-segments"
            role="group"
            aria-labelledby={`${id}-clips`}
          >
            {choices.map((each, index) => (
              <button
                key={each.name + String(index)}
                type="button"
                className={`studio-segment${each.include ? '' : ' is-left-out'}`}
                aria-pressed={index === clip}
                onClick={() => setClip(index)}
              >
                {each.name}
              </button>
            ))}
          </div>
          <div className="studio-animation-import__switch">
            <Switch
              id={`${id}-include`}
              isOn={choice.include}
              isDisabled={adding}
              ariaLabel={t('studio.animationImport.include')}
              handleToggle={() => update(clip, { include: !choice.include })}
            />
            <span>{t('studio.animationImport.include')}</span>
          </div>
        </div>
      )}
      <div className="studio-new__field">
        <label htmlFor={`${id}-name`} className="studio-new__label">
          {t('studio.animationImport.name')}
        </label>
        <input
          id={`${id}-name`}
          className="studio-new__input"
          type="text"
          value={choice.name}
          maxLength={40}
          spellCheck={false}
          disabled={adding || !choice.include}
          aria-invalid={choice.include && nameProblem(clip) !== undefined}
          onChange={(event) =>
            update(clip, { name: event.target.value.toLowerCase() })
          }
        />
        {choice.include && nameProblem(clip) && (
          <p className="studio-notice" role="alert">
            {nameProblem(clip)}
          </p>
        )}
      </div>
      <div className="studio-animation-import__switch">
        <Switch
          id={`${id}-loop`}
          isOn={choice.loop}
          isDisabled={adding}
          ariaLabel={t('studio.animationImport.loop')}
          handleToggle={() => update(clip, { loop: !choice.loop })}
        />
        <span>{t('studio.animationImport.loop')}</span>
      </div>
      {full && (
        <p className="studio-notice" role="alert">
          {t('studio.animationImport.failed.full', { most: MAX_ANIMATIONS })}
        </p>
      )}
      {failure && (
        <p className="studio-notice" role="alert">
          {t(FAILURE_KEYS[failure.reason], {
            name: failure.name,
            most: MAX_ANIMATIONS,
          })}
        </p>
      )}
    </div>
  );

  return createPortal(
    <div
      className="studio-share-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !adding) {
          onClose();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="studio-animation-import"
        icon={<Glyph name="upload" />}
        title={t('studio.animationImport.title')}
        titleId={`${id}-title`}
        description={t('studio.animationImport.lead')}
        rail={rail}
        closeLabel={t('studio.animationImport.cancel')}
        closeRef={closeRef}
        onClose={adding ? undefined : onClose}
        aria-busy={adding || state.phase === 'reading'}
        footer={
          <>
            {choice && (
              <p className="dialog-frame__note">
                {t('studio.animationImport.saved', {
                  file: `art/${choice.name}.png`,
                })}
              </p>
            )}
            <div className="dialog-frame__actions">
              <button
                type="button"
                className="button small subtle"
                disabled={adding}
                onClick={onClose}
              >
                {t('studio.animationImport.cancel')}
              </button>
              {state.phase === 'refused' ? (
                <button
                  type="button"
                  className="button small"
                  onClick={onChooseAgain}
                >
                  {t('studio.animationImport.again')}
                </button>
              ) : (
                <button
                  type="button"
                  className={`button small${adding ? ' is-running' : ''}`}
                  aria-busy={adding}
                  disabled={!addable}
                  onClick={add}
                >
                  {included.length > 1
                    ? t('studio.animationImport.addCount', {
                        count: included.length,
                      })
                    : t('studio.animationImport.add')}
                </button>
              )}
            </div>
          </>
        }
      >
        <div className="studio-animation-import__body">
          {state.phase === 'reading' && (
            <p className="studio-animation-import__status" role="status">
              <span className="studio-chat__spinner" aria-hidden="true" />
              {t('studio.animationImport.reading', { file: state.file })}
            </p>
          )}
          {state.phase === 'refused' && (
            <p className="studio-notice" role="alert">
              {refusalText(t, state.refusal)}
            </p>
          )}
          {viewed && choice && (
            <ImportPreview
              key={clip}
              viewed={viewed}
              start={{ fps: choice.fps, ground: choice.ground }}
              onPlayed={onPlayed}
            />
          )}
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
}
