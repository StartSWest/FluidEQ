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
}: {
  device: IAudioDevice;
  label?: string;
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
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      className={`link-button output-edit-button${canFinish ? ' is-editing' : ''}`}
      type="button"
      disabled={busy || (selected && !canFinish)}
      aria-label={canFinish ? t('extraOutput.done') : undefined}
      aria-pressed={selected}
      onClick={edit}
      title={
        canFinish
          ? t('extraOutput.editMain')
          : t('extraOutput.editHint', { device: device.name })
      }
    >
      <MenuIcon name={selected ? 'check' : 'configure'} />
      {canFinish ? (
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
