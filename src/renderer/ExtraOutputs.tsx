/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo } from 'react';
import { DeviceMatchEnum } from 'common/audioDeviceBridge';
import { AUTOMATIC_PRESET_PREFIX } from 'common/constants';
import type { TAudioEngine } from 'common/audioEngine';
import { identifyVirtualDevice } from 'common/virtualAudioDevices';
import SidebarSection from './components/SidebarSection';
import Switch from './widgets/Switch';
import BatteryLevel from './widgets/BatteryLevel';
import MirrorDelay from './MirrorDelay';
import useReadWhenShown from './utils/useReadWhenShown';
import useOutputMirror, { IMirrorTarget } from './audio/useOutputMirror';
import { useIncomingSound } from './remoteAudio/remoteAudioValueContext';
import { useTranslation } from './utils/I18nContext';
import { setSinglePlayer, useSinglePlayer } from './utils/singlePlayer';
import './styles/ExtraOutputs.scss';
import SecondOutputProfilePicker from './SecondOutputProfilePicker';
import OutputEditButton from './OutputEditButton';

interface IExtraOutputsProps {
  /** Passed straight down to the per-output badge. See the picker. */
  engine: TAudioEngine | null;
  /**
   * Whether the pane holding this card is on screen: coming into view, it
   * reads again. On screen unless a pane says otherwise.
   */
  isPaneShown?: boolean;
}

const ExtraOutputs = ({ engine, isPaneShown = true }: IExtraOutputsProps) => {
  const { t } = useTranslation();
  const isSinglePlayer = useSinglePlayer();
  const {
    error,
    isMirroring,
    isVirtualRoutingAvailable,
    refresh,
    reread,
    selectedTargets,
    setTargetVolume,
    targets,
    toggleTarget,
  } = useOutputMirror();
  // Read afresh when the pane comes into view or the card is opened, for the
  // battery levels on it (`useReadWhenShown`).
  useReadWhenShown(isPaneShown, reread);

  // Another computer's sound playing here plays on the second output too,
  // later by its own delay: each running output says both.
  const incoming = useIncomingSound();

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

  // Named profiles and neutral outputs add useful detail. Automatic profiles
  // already have the endpoint's name, so showing both would repeat it.
  const describeProfile = (target: IMirrorTarget): string => {
    // The native path shares audio before the endpoint's corrections.
    // Other platforms still use endpoint loopback.
    if (target.isRunning && window.electron?.platform !== 'win32') {
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
      onOpen={reread}
      glyph={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="7" height="16" rx="2" />
          <rect x="14" y="4" width="7" height="16" rx="2" />
          <circle cx="6.5" cy="14" r="2" />
          <circle cx="17.5" cy="14" r="2" />
        </svg>
      }
      title={t('extraOutput.title')}
      // Folded, the outputs that are on each get a row under the header —
      // the light that says it is playing, its name and its battery where its
      // device reports one, and under them the profile it plays — and the
      // header says only that none is. One line of names in the header read
      // for one output and not for two (Ivan, 2026-10-02: "if we have more
      // than one selected it doesn't make sense").
      status={enabled.length > 0 ? undefined : t('extraOutput.statusOff')}
      summary={
        enabled.length > 0 && (
          <ul className="extra-outputs__onList">
            {enabled.map((target) => {
              const profile = describeProfile(target);
              return (
                <li className="extra-outputs__on" key={target.device.guid}>
                  <span
                    className={
                      target.isRunning ? 'device-dot active' : 'device-dot'
                    }
                  />
                  <span className="extra-outputs__onText">
                    <span className="extra-outputs__onLine">
                      <span
                        className="extra-outputs__onName"
                        title={target.device.name}
                      >
                        {target.device.name}
                      </span>
                      {typeof target.device.batteryPercent === 'number' && (
                        <BatteryLevel percent={target.device.batteryPercent} />
                      )}
                    </span>
                    <span className="extra-outputs__profileActions">
                      {profile && (
                        <>
                          <span
                            className="extra-outputs__onProfile"
                            title={profile}
                          >
                            {profile}
                          </span>
                          <span
                            className="extra-outputs__separator"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                        </>
                      )}
                      <OutputEditButton device={target.device} />
                    </span>
                    {(target.delayMs !== undefined ||
                      target.delayKind === 'unavailable') && (
                      <MirrorDelay
                        delayMs={target.delayMs}
                        kind={target.delayKind}
                        incoming={incoming}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )
      }
      summaryWhenCollapsedOnly
      // Never folded away with the rest. It is a rule about the sound, not a
      // detail of the list, and the card is closed by default — folded with
      // the endpoints it would be a setting nobody ever meets.
      aside={
        <div className="extra-outputs__rule">
          <Switch
            id="single-player"
            isOn={isSinglePlayer}
            isDisabled={false}
            handleToggle={() => setSinglePlayer(!isSinglePlayer)}
          />
          <span className="extra-outputs__text">
            <span className="extra-outputs__name">
              {t('extraOutput.singlePlayer')}
            </span>
            <span className="extra-outputs__profile">
              {t('extraOutput.singlePlayerHint')}
            </span>
          </span>
        </div>
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
                <div className="extra-outputs__text">
                  <span className="extra-outputs__name">
                    {target.device.name}
                    {virtual && (
                      <span className="extra-outputs__tag">
                        {virtual.inputLabel}
                      </span>
                    )}
                    {typeof target.device.batteryPercent === 'number' && (
                      <BatteryLevel percent={target.device.batteryPercent} />
                    )}
                  </span>
                  {/* The profile this output already carries — the same one it
                      plays when it is the device you are listening on. Nothing
                      to set up: it follows the endpoint, and this only says
                      which it is. */}
                  {profile && !target.isSelected && (
                    <span className="extra-outputs__profile">{profile}</span>
                  )}
                  {target.isSelected &&
                    window.electron?.platform === 'win32' && (
                      <SecondOutputProfilePicker
                        device={target.device}
                        engine={engine}
                        presetName={target.presetName}
                        onChanged={refresh}
                      />
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
                  {target.isSelected &&
                    window.electron?.platform !== 'win32' && (
                      <OutputEditButton device={target.device} />
                    )}
                  {/* Reported software buffering, not acoustic delay;
                      include incoming buffering only while it has sound. */}
                  {target.isSelected &&
                    (target.delayMs !== undefined ||
                      target.delayKind === 'unavailable') && (
                      <MirrorDelay
                        delayMs={target.delayMs}
                        kind={target.delayKind}
                        incoming={incoming}
                      />
                    )}
                </div>
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
      {isMirroring &&
        enabled.some((target) => target.delayKind === 'buffer') && (
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
