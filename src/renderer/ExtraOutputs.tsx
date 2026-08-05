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
import Switch from './widgets/Switch';
import useOutputMirror, { IMirrorTarget } from './audio/useOutputMirror';
import { activateAudioDeviceProfile } from './utils/equalizerApi';
import { useTranslation } from './utils/I18nContext';
import './styles/ExtraOutputs.scss';

const ExtraOutputs = () => {
  const { t } = useTranslation();
  const {
    error,
    isMirroring,
    isVirtualRoutingAvailable,
    selectedTargets,
    targets,
    toggleTarget,
  } = useOutputMirror();

  // Everything the list could offer: the captured endpoint and anything
  // inactive are not merely unusable, they are not choices at all.
  const eligible = useMemo(
    () => targets.filter((target) => target.isEligible),
    [targets],
  );

  // Why a chosen output cannot be used. Each of these needs a different thing
  // done about it, which is the entire reason the bridge reports them
  // separately rather than as one failure.
  const describeObstacle = (target: IMirrorTarget): string => {
    if (target.match.status === DeviceMatchEnum.AMBIGUOUS) {
      return t('extraOutput.ambiguous');
    }
    if (target.match.status === DeviceMatchEnum.LABELS_HIDDEN) {
      return t('extraOutput.labelsHidden');
    }
    return t('extraOutput.unmatched');
  };

  const blocked = selectedTargets.filter((target) => !target.isUsable);

  return (
    <SidebarSection
      eyebrow={t('extraOutput.eyebrow')}
      title={t('extraOutput.title')}
      summary={
        <span className="device-profiles__label device-profiles__label--row">
          {t('extraOutput.target')}
          {isMirroring ? (
            <span className="default-badge">{t('extraOutput.active')}</span>
          ) : (
            <span className="extra-outputs__idle">{t('extraOutput.off')}</span>
          )}
        </span>
      }
    >
      {eligible.length === 0 ? (
        <p className="extra-outputs__hint">{t('extraOutput.none')}</p>
      ) : (
        <ul className="extra-outputs__list">
          {/* Every eligible endpoint is listed, including ones that cannot
              currently run. Hiding those would leave someone looking for a
              speaker that is plainly plugged in with nothing to read and no
              idea why it is missing; switching it on explains itself below. */}
          {eligible.map((target) => {
            // Voicemeeter presents three inputs whose names differ by one
            // word, and someone pointing an application at one of them needs
            // to know which.
            const virtual = identifyVirtualDevice(target.device);
            return (
              <li className="extra-outputs__row" key={target.device.guid}>
                <Switch
                  id={`mirror-${target.device.guid}`}
                  isOn={target.isSelected}
                  isDisabled={false}
                  handleToggle={() => toggleTarget(target.device.guid)}
                />
                <span
                  className={
                    target.isRunning ? 'device-dot active' : 'device-dot'
                  }
                />
                <span className="extra-outputs__name">
                  {target.device.name}
                </span>
                {virtual && (
                  <span className="extra-outputs__tag">
                    {virtual.inputLabel}
                  </span>
                )}
                {/* Points every EQ control at this output's own profile,
                    without making it the Windows default. A device with no
                    profile yet gets an empty one, so it starts flat rather
                    than inheriting the output you are listening on. */}
                <button
                  className="link-button extra-outputs__tune"
                  disabled={target.isBeingTuned}
                  onClick={() => activateAudioDeviceProfile(target.device.id)}
                  type="button"
                >
                  {target.isBeingTuned
                    ? t('extraOutput.tuning')
                    : t('extraOutput.setUp')}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {blocked.map((target) => (
        <p className="extra-outputs__obstacle" key={target.device.guid}>
          <strong>{target.device.name}</strong> {describeObstacle(target)}
        </p>
      ))}
      {error && <p className="extra-outputs__obstacle">{error}</p>}

      {/* Shown only while a mirror is what is actually running. With a routing
          driver in use there is no added delay, and warning about one anyway
          is how a user learns to stop reading warnings. */}
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
