import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import { MAX_MEMBER_NAME_LENGTH } from 'common/memberScenes';
import type { TNewProjectResult } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { chooseStudioProjectsRoot, createStudioProject } from './studioStore';
import '../styles/StudioDialogs.scss';

const REFUSALS: Record<
  Exclude<TNewProjectResult, 'written'>,
  TranslationKey
> = {
  exists: 'studio.new.exists',
  invalid: 'studio.new.invalid',
  failed: 'studio.new.failed',
  refused: 'studio.new.failed',
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
  const nameId = useId();
  const [name, setName] = useState('');
  const [running, setRunning] = useState(false);
  const [refusal, setRefusal] = useState<TranslationKey>();
  const surfaceRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  // The separator the projects folder is already written with.
  const separator = root.includes('\\') ? '\\' : '/';

  useEffect(() => {
    const previousFocus = document.activeElement;
    nameRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
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
      <form
        ref={surfaceRef}
        className="studio-share studio-new"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-new-title"
        aria-describedby="studio-new-lead"
        aria-busy={running}
        onSubmit={create}
      >
        <div className="studio-share__head">
          <span className="studio-share__mark" aria-hidden="true">
            <Glyph name="studio" />
          </span>
          <h2 id="studio-new-title" className="studio-share__title">
            {t('studio.new.title')}
          </h2>
        </div>
        <p id="studio-new-lead" className="studio-share__lead">
          {t('studio.new.lead')}
        </p>

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

        <div className="studio-share__foot">
          <span className="studio-share__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={running}
              onClick={onClose}
            >
              {t('studio.new.cancel')}
            </button>
            <button
              type="submit"
              className={`button small${running ? ' is-running' : ''}`}
              aria-busy={running}
              disabled={!trimmed}
            >
              {running ? t('studio.new.creating') : t('studio.new.create')}
            </button>
          </span>
        </div>
      </form>
    </div>,
    document.body,
  );
}
