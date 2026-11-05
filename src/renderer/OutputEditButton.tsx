/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { useState } from 'react';
import MenuIcon from './icons/MenuIcon';
import './styles/OutputEditButton.scss';
import type { IAudioDevice } from '../common/constants';
import type { ErrorDescription } from '../common/errors';
import { activateAudioDeviceProfile } from './utils/equalizerApi';
import { useFluidEqShell } from './utils/FluidEqContext';
import { useOutputEditor } from './utils/outputEditor';
import { useTranslation } from './utils/I18nContext';

const OutputEditButton = ({
  device,
  label,
  onDone,
  className = 'link-button',
}: {
  device: IAudioDevice;
  label?: string;
  className?: string;
  /** Called once the editor has moved, before this button may disappear. */
  onDone?: () => void;
}) => {
  const { t } = useTranslation();
  const { editor, main } = useOutputEditor();
  const { refreshState, setGlobalError } = useFluidEqShell();
  const [busy, setBusy] = useState(false);
  const selected = editor?.device.id === device.id;
  const canFinish = selected && !!main && main.id !== device.id;
  const edit = async () => {
    if (busy || (selected && !canFinish)) {
      return;
    }
    setBusy(true);
    try {
      await activateAudioDeviceProfile(canFinish && main ? main.id : device.id);
      await refreshState();
      onDone?.();
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };
  // A toggle keeps one name whatever its state, and the state is
  // aria-pressed: it said "Done" while pressed, and every second output's
  // was "Edit sound" — two buttons nobody could tell apart. Never disabled
  // while it works: a disabled button lets go of the keyboard's focus.
  // Named actions keep their visible label and do not announce toggle state.
  return (
    <button
      className={`${className} output-edit-button${canFinish && !label ? ' is-editing' : ''}`}
      type="button"
      aria-disabled={busy || (selected && !canFinish) || undefined}
      aria-label={label ?? t('extraOutput.editHint', { device: device.name })}
      aria-pressed={label ? undefined : selected}
      onClick={edit}
      title={
        label ??
        (canFinish
          ? t('extraOutput.editMain')
          : t('extraOutput.editHint', { device: device.name }))
      }
    >
      <MenuIcon name={selected ? 'check' : 'configure'} />
      {canFinish && !label ? (
        <span className="output-edit-button__state" aria-hidden="true">
          <span className="output-edit-button__editing">
            {t('extraOutput.editing')}
          </span>
          <span className="output-edit-button__done">
            {t('extraOutput.done')}
          </span>
        </span>
      ) : (
        <span>
          {label ?? t(selected ? 'extraOutput.editing' : 'extraOutput.edit')}
        </span>
      )}
    </button>
  );
};
export default OutputEditButton;
