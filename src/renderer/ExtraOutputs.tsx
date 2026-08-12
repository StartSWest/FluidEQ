/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo } from 'react';
import { DeviceMatchEnum } from 'common/audioDeviceBridge';
import { AUTOMATIC_PRESET_PREFIX } from 'common/constants';
import { identifyVirtualDevice } from 'common/virtualAudioDevices';
import SidebarSection from './components/SidebarSection';
import Switch from './widgets/Switch';
import useOutputMirror, { IMirrorTarget } from './audio/useOutputMirror';
import { useTranslation } from './utils/I18nContext';
import './styles/ExtraOutputs.scss';

const ExtraOutputs = () => {
  const { t } = useTranslation();
  const {
    error,
    isMirroring,
    isVirtualRoutingAvailable,
    selectedTargets,
    setTargetVolume,
    targets,
    toggleTarget,
  } = useOutputMirror();

  // Everything the list could offer: the captured endpoint and anything
  // inactive are not merely unusable, they are not choices at all.
  const eligible = useMemo(
    () => targets.filter((target) => target.isEligible),
    [targets],
  );
  const enabled = useMemo(
    () => eligible.filter((target) => target.isSelected),
    [eligible],
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

  // The profile an output carries, when saying so tells you anything.
  //
  // An automatic profile is named after the endpoint that owns it, so printing
  // it beside that endpoint's own name says the same thing twice — and it is
  // what nearly every output has, so the column filled up with one repeated
  // phrase. A named profile is worth showing; "no profile" is worth showing,
  // because it means that speaker gets no correction at all.
  const describeProfile = (target: IMirrorTarget): string => {
    // Nothing, while it is actually mirroring — because the profile attached
    // to this endpoint is not what it is playing.
    //
    // The capture is taken after Equalizer APO has corrected the output being
    // listened on, so the *primary* device's chain is baked into the audio
    // before FluidEQ sees it, and that is what reaches every mirror. Naming
    // this endpoint's own profile beside it would say a speaker was playing a
    // tuning it is not.
    if (target.isRunning) {
      return '';
    }
    if (!target.presetName) {
      return t('output.mapping.neutral');
    }
    return target.presetName.startsWith(AUTOMATIC_PRESET_PREFIX)
      ? ''
      : target.presetName;
  };

  // Only outputs that could have run. One that has since become the device you
  // are listening on is not a problem to report: it is absent from the list
  // because the capture cannot mirror to itself, and complaining about a row
  // that is not on screen is just a stale message about a healthy state. The
  // selection is kept, so it comes back the moment you listen elsewhere.
  const blocked = selectedTargets.filter(
    (target) => target.isEligible && !target.isUsable,
  );

  return (
    <SidebarSection
      className="extra-outputs"
      defaultOpen={false}
      eyebrow={t('extraOutput.eyebrow')}
      title={t('extraOutput.title')}
      summary={
        enabled.length > 0 ? (
          <ul className="extra-outputs__enabled">
            {enabled.map((target) => (
              <li key={target.device.guid}>
                <span
                  className={
                    target.isRunning ? 'device-dot active' : 'device-dot'
                  }
                  aria-hidden="true"
                />
                <span>{target.device.name}</span>
              </li>
            ))}
          </ul>
        ) : undefined
      }
      summaryWhenCollapsedOnly
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
            const profile = describeProfile(target);
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
                {/* Name and profile stack rather than sharing the width. A
                    sidebar this narrow cannot hold an endpoint name and a
                    profile name side by side, and splitting it put "Odyssey G5
                    (NVIDIA High Definition Audio)" across four lines. */}
                <span className="extra-outputs__text">
                  <span className="extra-outputs__name">
                    {target.device.name}
                    {virtual && (
                      <span className="extra-outputs__tag">
                        {virtual.inputLabel}
                      </span>
                    )}
                  </span>
                  {/* The profile this output already carries — the same one it
                      plays when it is the device you are listening on. Nothing
                      to set up: it follows the endpoint, and this only says
                      which it is. */}
                  {profile && (
                    <span className="extra-outputs__profile">{profile}</span>
                  )}
                  {/* Only for outputs that are on. A level control under a
                      switch that is off adjusts nothing, and seven of them
                      would bury the list it belongs to. */}
                  {target.isSelected && (
                    <div className="extra-outputs__volume">
                      <input
                        aria-label={`${t('extraOutput.volume')} — ${
                          target.device.name
                        }`}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setTargetVolume(
                            target.device.guid,
                            Number(event.target.value) / 100,
                          )
                        }
                        step="1"
                        title={t('extraOutput.volume')}
                        type="range"
                        value={Math.round(target.volume * 100)}
                      />
                      <span className="extra-outputs__volumeValue">
                        {Math.round(target.volume * 100)}%
                      </span>
                    </div>
                  )}
                </span>
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
