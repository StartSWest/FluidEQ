import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import { MAX_MEMBER_NAME_LENGTH } from 'common/memberScenes';
import type { TNewProjectResult } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import holdFocusReturn from '../utils/focusReturn';
import { chooseStudioProjectsRoot, createStudioProject } from './studioStore';
import { useStudioAgentHold } from './studioAgentHold';
import '../styles/StudioDialogs.scss';

const REFUSALS: Record<
  Exclude<TNewProjectResult, 'written'>,
  TranslationKey
> = {
  exists: 'studio.new.exists',
  invalid: 'studio.new.invalid',
  failed: 'studio.new.failed',
  'plus-only': 'studio.plus.oneProject',
};

interface IStudioNewProjectDialogProps {
  /** The projects folder the new one goes in, as the main process names it. */
  root: string;
  onClose: () => void;
}

/**
 * "New project": a name, and where it will go.
 *
 * The member names the project and FluidEQ makes its folder inside the
 * projects folder they chose once, with a scene in it that already moves —
 * no folder dialog on the way, and no empty folder to pick. Where it goes is
 * on screen, with the way to change it; the change is remembered for every
 * project after.
 */
export default function StudioNewProjectDialog({
  root,
  onClose,
}: IStudioNewProjectDialogProps) {
  const { t } = useTranslation();
  // Open on the Studio's project: its AI may not switch the Studio under it.
  useStudioAgentHold(true);
  const nameId = useId();
  const formId = useId();
  const [name, setName] = useState('');
  const [running, setRunning] = useState(false);
  const [refusal, setRefusal] = useState<TranslationKey>();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  // The separator the projects folder is already written with.
  const separator = root.includes('\\') ? '\\' : '/';

  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    nameRef.current?.focus();
    return giveFocusBack;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!running) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const stops = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLElement>(
          'input, button:not(:disabled)',
        ) ?? [],
      );
      if (!stops.length) {
        return;
      }
      event.preventDefault();
      const current = stops.findIndex(
        (stop) => stop === document.activeElement,
      );
      stops[
        (current + (event.shiftKey ? -1 : 1) + stops.length) % stops.length
      ]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [running, onClose]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (running || !trimmed) {
      return;
    }
    setRunning(true);
    setRefusal(undefined);
    createStudioProject(trimmed)
      .then((result) => {
        setRunning(false);
        if (result === 'written') {
          onClose();
        } else {
          setRefusal(REFUSALS[result]);
        }
        return undefined;
      })
      .catch(() => {
        setRunning(false);
        setRefusal('studio.new.failed');
      });
  };

  return createPortal(
    <div
      className="studio-share-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !running) {
          onClose();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="studio-new"
        icon={<MenuIcon name="filePlus" />}
        title={t('studio.new.title')}
        titleId="studio-new-title"
        description={<span id="studio-new-lead">{t('studio.new.lead')}</span>}
        aria-describedby="studio-new-lead"
        aria-busy={running}
        closeLabel={t('support.close')}
        // Away while the project is being made, as Escape and the backdrop
        // are: the folder is half written until it answers.
        onClose={running ? undefined : onClose}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={running}
              onClick={onClose}
            >
              {t('studio.new.cancel')}
            </button>
            {/* In the foot, outside the form, and still its submit: Enter in
                the name presses it. */}
            <button
              type="submit"
              form={formId}
              className={`button small${running ? ' is-running' : ''}`}
              aria-busy={running}
              disabled={!trimmed}
            >
              {running ? t('studio.new.creating') : t('studio.new.create')}
            </button>
          </div>
        }
      >
        <form id={formId} className="studio-new__form" onSubmit={create}>
          <div className="studio-new__field">
            <label htmlFor={nameId} className="studio-new__label">
              {t('studio.new.name')}
            </label>
            <input
              ref={nameRef}
              id={nameId}
              className="studio-new__input"
              type="text"
              value={name}
              maxLength={MAX_MEMBER_NAME_LENGTH}
              placeholder={t('studio.new.placeholder')}
              aria-invalid={refusal !== undefined}
              onChange={(event) => {
                setName(event.target.value);
                setRefusal(undefined);
              }}
            />
          </div>

          <div className="studio-new__where">
            <span className="studio-new__label">{t('studio.new.where')}</span>
            <span className="studio-new__path" title={root}>
              <Glyph name="folder" />
              <span className="studio-new__root">{root}</span>
              {trimmed && (
                <span className="studio-new__leaf">
                  {separator}
                  {trimmed}
                </span>
              )}
            </span>
            <button
              type="button"
              className="button small subtle"
              disabled={running}
              onClick={() => {
                chooseStudioProjectsRoot().catch(() => undefined);
              }}
            >
              {t('studio.new.change')}
            </button>
          </div>

          {refusal && (
            <p className="studio-notice" role="alert">
              {t(refusal, { name: trimmed })}
            </p>
          )}
        </form>
      </DialogFrame>
    </div>,
    document.body,
  );
}
