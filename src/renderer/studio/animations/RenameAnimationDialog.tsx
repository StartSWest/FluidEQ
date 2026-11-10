/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import { ANIMATION_NAME } from 'common/studioAnimation';
import DialogFrame from '../../components/DialogFrame';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import useModalKeys from '../../utils/useModalKeys';
import { animationHistory } from './animationActions';
import '../../styles/StudioDialogs.scss';

const REFUSALS: Record<string, TranslationKey> = {
  taken: 'studio.animation.renameTaken',
  invalid: 'studio.animation.renameRule',
};

/**
 * "Rename" on an animation's card: a new name for its file, its sheet and
 * its history together (main's `renameAnimation`). The scene plays what is
 * packed into its artwork, never an animation by its name, so a rename
 * changes nothing on the stage.
 */
export default function RenameAnimationDialog({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const [value, setValue] = useState(name);
  const [running, setRunning] = useState(false);
  const [refusal, setRefusal] = useState<TranslationKey>();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const next = value.trim();
  const allowed = ANIMATION_NAME.test(next);

  useModalKeys(surfaceRef, nameRef, { busy: running, onCancel: onClose });

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (running || next === name) {
      return;
    }
    if (!allowed) {
      setRefusal('studio.animation.renameRule');
      return;
    }
    setRunning(true);
    setRefusal(undefined);
    animationHistory({ action: 'rename', name, to: next })
      .then((outcome) => {
        setRunning(false);
        if (outcome.ok) {
          onClose();
        } else {
          setRefusal(
            REFUSALS[outcome.reason] ?? 'studio.animation.renameFailed',
          );
        }
        return undefined;
      })
      .catch(() => {
        setRunning(false);
        setRefusal('studio.animation.renameFailed');
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
        className="studio-new studio-rename"
        icon={<MenuIcon name="pencil" />}
        title={t('studio.animation.renameTitle')}
        titleId={`${nameId}-title`}
        description={
          <span id={`${nameId}-lead`}>{t('studio.animation.renameLead')}</span>
        }
        aria-describedby={`${nameId}-lead`}
        aria-busy={running}
        closeLabel={t('support.close')}
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
            <button
              type="submit"
              form={`${nameId}-form`}
              className={`button small${running ? ' is-running' : ''}`}
              aria-busy={running}
              disabled={!next || next === name}
            >
              {running ? t('studio.rename.saving') : t('studio.rename.save')}
            </button>
          </div>
        }
      >
        <form
          id={`${nameId}-form`}
          className="studio-new__form"
          onSubmit={rename}
        >
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
              maxLength={40}
              spellCheck={false}
              disabled={running}
              aria-invalid={refusal !== undefined}
              onChange={(event) => {
                setValue(event.target.value);
                setRefusal(undefined);
              }}
            />
          </div>
          {refusal && (
            <p className="studio-notice" role="alert">
              {t(refusal, { name: next })}
            </p>
          )}
        </form>
      </DialogFrame>
    </div>,
    document.body,
  );
}
