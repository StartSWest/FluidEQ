import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import { MAX_MEMBER_NAME_LENGTH } from 'common/memberScenes';
import type { TRenameProjectResult } from 'main/ipc/memberScenes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import { renameStudioProject } from './studioStore';
import { useStudioAgentHold } from './studioAgentHold';
import '../styles/StudioDialogs.scss';

const REFUSALS: Record<
  Exclude<TRenameProjectResult, 'renamed'>,
  TranslationKey
> = {
  exists: 'studio.rename.exists',
  invalid: 'studio.new.invalid',
  failed: 'studio.rename.failed',
  refused: 'studio.rename.failed',
};

interface IStudioRenameProjectDialogProps {
  id: string;
  /** What the project is called now. */
  name: string;
  /** Its folder, as the main process names it; shown, never sent back. */
  path: string;
  onClose: () => void;
}

/**
 * "Rename": one name for the scene and its folder. The folder is renamed
 * where it is, so the project stays in the same place, with the same id, and
 * opens again under its new name; the dialog shows the folder it will become
 * while the name is typed.
 */
export default function StudioRenameProjectDialog({
  id,
  name,
  path,
  onClose,
}: IStudioRenameProjectDialogProps) {
  const { t } = useTranslation();
  // Open on the Studio's project: its AI may not switch the Studio under it.
  useStudioAgentHold(true);
  const nameId = useId();
  const [value, setValue] = useState(name);
  const [running, setRunning] = useState(false);
  const [refusal, setRefusal] = useState<TranslationKey>();
  const surfaceRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();
  const cut = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  const parent = path.slice(0, cut);
  const separator = path.charAt(cut) || '/';
  const folderName = path.slice(cut + 1);
  // Nothing to do only when neither the scene nor its folder would change.
  const unchanged = trimmed === name && trimmed === folderName;

  useModalKeys(surfaceRef, nameRef, { busy: running, onCancel: onClose });

  // The whole name selected, so typing replaces it.
  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (running || !trimmed || unchanged) {
      return;
    }
    setRunning(true);
    setRefusal(undefined);
    renameStudioProject(id, trimmed)
      .then((result) => {
        setRunning(false);
        if (result === 'renamed') {
          onClose();
        } else {
          setRefusal(REFUSALS[result]);
        }
        return undefined;
      })
      .catch(() => {
        setRunning(false);
        setRefusal('studio.rename.failed');
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
        aria-labelledby={`${nameId}-title`}
        aria-describedby={`${nameId}-lead`}
        aria-busy={running}
        onSubmit={rename}
      >
        <div className="studio-share__head">
          <span className="studio-share__mark" aria-hidden="true">
            <Glyph name="folder" />
          </span>
          <h2 id={`${nameId}-title`} className="studio-share__title">
            {t('studio.rename.title')}
          </h2>
        </div>
        <p id={`${nameId}-lead`} className="studio-share__lead">
          {t('studio.rename.lead')}
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
            value={value}
            maxLength={MAX_MEMBER_NAME_LENGTH}
            disabled={running}
            aria-invalid={refusal !== undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setRefusal(undefined);
            }}
          />
        </div>

        <div className="studio-new__where">
          <span className="studio-new__label">{t('studio.rename.where')}</span>
          <span className="studio-new__path" title={path}>
            <Glyph name="folder" />
            <span className="studio-new__root">{parent}</span>
            <span className="studio-new__leaf">
              {separator}
              {trimmed || folderName}
            </span>
          </span>
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
              disabled={!trimmed || unchanged}
            >
              {running ? t('studio.rename.saving') : t('studio.rename.save')}
            </button>
          </span>
        </div>
      </form>
    </div>,
    document.body,
  );
}
