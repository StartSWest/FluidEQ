/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <FluidEQ multiple-output contributors>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo } from 'react';
import { DeviceMatchEnum } from 'common/audioDeviceBridge';
import { identifyVirtualDevice } from 'common/virtualAudioDevices';
import SidebarSection from './components/SidebarSection';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import useOutputMirror from './audio/useOutputMirror';
import { useTranslation } from './utils/I18nContext';
import './styles/ExtraOutputs.scss';

/** The dropdown's "not mirroring" entry. Never a device guid. */
const OFF_VALUE = '';

const ExtraOutputs = () => {
  const { t } = useTranslation();
  const {
    error,
    isMirroring,
    isVirtualRoutingAvailable,
    selected,
    selectTarget,
    targets,
  } = useOutputMirror();

  // Everything the picker could offer: the captured endpoint and anything
  // inactive are not merely unusable, they are not choices at all.
  const eligible = useMemo(
    () => targets.filter((target) => target.isEligible),
    [targets],
  );

  const options: IOptionEntry[] = useMemo(
    () => [
      {
        value: OFF_VALUE,
        label: t('extraOutput.off'),
        display: <span>{t('extraOutput.off')}</span>,
      },
      // Every eligible endpoint is listed, including the ones that cannot
      // currently be used. Hiding those would leave a user looking for a
      // speaker that is plainly plugged in with nothing to read and no idea
      // why it is missing; picking it explains itself below instead.
      ...eligible.map((target) => {
        // Voicemeeter presents three inputs whose names differ by one word.
        // A user being told to point an application at one of them needs to
        // know which, and the driver's own naming does not make that obvious.
        const virtual = identifyVirtualDevice(target.device);
        return {
          value: target.device.guid,
          label: target.device.name,
          display: (
            <div className="device-option">
              <span
                className={target.isUsable ? 'device-dot active' : 'device-dot'}
              />
              <span>{target.device.name}</span>
              {virtual && (
                <span className="extra-outputs__tag">{virtual.inputLabel}</span>
              )}
            </div>
          ),
        };
      }),
    ],
    [eligible, t],
  );

  // Why the chosen output cannot be used. Each of these needs a different
  // thing done about it, which is the entire reason the bridge reports them
  // separately rather than as one failure.
  let obstacle = '';
  if (selected && !selected.isUsable) {
    if (selected.match.status === DeviceMatchEnum.AMBIGUOUS) {
      obstacle = t('extraOutput.ambiguous');
    } else if (selected.match.status === DeviceMatchEnum.LABELS_HIDDEN) {
      obstacle = t('extraOutput.labelsHidden');
    } else {
      obstacle = t('extraOutput.unmatched');
    }
  }

  return (
    <SidebarSection
      eyebrow={t('extraOutput.eyebrow')}
      title={t('extraOutput.title')}
      summary={
        <div className="extra-outputs__picker">
          <span className="device-profiles__label device-profiles__label--row">
            {t('extraOutput.target')}
            {isMirroring && (
              <span className="default-badge">{t('extraOutput.active')}</span>
            )}
          </span>
          <Dropdown
            name={t('extraOutput.target')}
            options={options}
            value={selected?.device.guid ?? OFF_VALUE}
            handleChange={(value) =>
              selectTarget(value === OFF_VALUE ? undefined : value)
            }
            isDisabled={eligible.length === 0}
            emptyOptionsPlaceholder={t('extraOutput.none')}
          />
        </div>
      }
    >
      {obstacle && <p className="extra-outputs__obstacle">{obstacle}</p>}
      {error && <p className="extra-outputs__obstacle">{error}</p>}
      {/* Shown only while the mirror is what is actually running. With a
          routing driver in use there is no added delay, and warning about one
          anyway would teach the user to ignore the warning. */}
      {isMirroring && (
        <p className="extra-outputs__latency">{t('extraOutput.latency')}</p>
      )}
      {isVirtualRoutingAvailable && (
        <p className="extra-outputs__virtual">{t('extraOutput.virtual')}</p>
      )}
      <p className="extra-outputs__hint">{t('extraOutput.hint')}</p>
    </SidebarSection>
  );
};

export default ExtraOutputs;
