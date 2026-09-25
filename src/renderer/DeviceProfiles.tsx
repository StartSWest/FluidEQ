/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AUTOMATIC_PRESET_PREFIX,
  IAudioDevice,
  IDeviceProfileSettings,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import type { TAudioEngine } from 'common/audioEngine';
import type { IEngineSetupResult } from 'main/engineSetup';
import Dropdown from './widgets/Dropdown';
import Button from './widgets/Button';
import SidebarSection from './components/SidebarSection';
import RoomOutputNotice from './components/RoomOutputNotice';
import { IOptionEntry } from './widgets/List';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import { isOutputOff, outputEngineState } from './utils/outputEngineState';
import { openWindowsSoundSettings } from './utils/soundSettings';
import { reportError } from './utils/logger';
import { subscribeAudioEngineChanged } from './utils/audioEngineEvents';
import {
  getAudioDevices,
  getDeviceProfileSettings,
  setDefaultAudioDevice,
} from './utils/equalizerApi';
import './styles/DeviceProfiles.scss';

const EMPTY_SETTINGS: IDeviceProfileSettings = {
  version: 1,
  assignments: {},
};

interface IDeviceProfilesProps {
  /**
   * Which engine is carrying the audio, passed in rather than fetched here.
   *
   * The shell already holds one answer for the whole window; a second fetch
   * from this panel would be a second round trip on every mount and a second
   * thing to keep in step with a switch made in the engine dialog.
   */
  engine: TAudioEngine | null;
  isNoticeHidden?: boolean;
  onConfigureApo: () => Promise<boolean>;
  onAttachFluidEngine: (guid: string) => Promise<IEngineSetupResult>;
  /**
   * The profiles that play through the output, under its picker.
   *
   * The Output card is the output you listen on at the top and the profiles
   * under it, because the ON pill on a profile only means anything next to
   * the output it is on. They were two cards — "Automatic profile" and
   * "Named profiles" — and the pill's meaning sat one card away from it.
   * The profile list keeps its own state (PresetsBar); this card only gives
   * it its place.
   */
  children: ReactNode;
}

const DeviceProfiles = ({
  engine,
  isNoticeHidden = false,
  onConfigureApo,
  onAttachFluidEngine,
  children,
}: IDeviceProfilesProps) => {
  // Re-read the state, do not raise the loading flag: that flag is the
  // start-up screen, so noticing a headphone plug used to blank the whole
  // workspace and rebuild it instead of moving the bands to that output's
  // profile. See the same note in PresetsBar.
  const { isBlockingError, refreshState, setGlobalError } = useFluidEqContext();
  const { t } = useTranslation();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [settings, setSettings] =
    useState<IDeviceProfileSettings>(EMPTY_SETTINGS);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [dismissedApoDeviceId, setDismissedApoDeviceId] = useState('');
  // Why the engine did not get attached, when it did not. A declined Windows
  // prompt is an answer rather than a fault, so the notice stays open with
  // that sentence under it instead of closing as though it had worked.
  const [attachFailure, setAttachFailure] = useState<
    'declined' | 'failed' | undefined
  >();
  const [isAttaching, setIsAttaching] = useState(false);
  const activeDeviceIdRef = useRef('');

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextSettings] = await Promise.all([
        getAudioDevices(),
        getDeviceProfileSettings(),
      ]);
      setDevices(nextDevices);
      setSettings(nextSettings);
      const activeDevice = nextDevices.find((device) => device.isDefault);
      if (activeDevice && activeDevice.id !== activeDeviceIdRef.current) {
        activeDeviceIdRef.current = activeDevice.id;
        setSelectedDeviceId(activeDevice.id);
        window.dispatchEvent(
          new CustomEvent('fluideq-output-changed', {
            detail: { deviceId: activeDevice.id },
          }),
        );
        refreshState();
      }
      setSelectedDeviceId((current) => {
        if (nextDevices.some((device) => device.id === current)) {
          return current;
        }
        return (
          nextDevices.find((device) => device.isDefault)?.id ||
          nextDevices[0]?.id ||
          ''
        );
      });
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [refreshState, setGlobalError]);

  // Polled, because Windows does not tell us when someone plugs in headphones,
  // and paused whenever the window is hidden.
  //
  // Each tick is an IPC round-trip that enumerates every audio endpoint on the
  // machine, and this panel is mounted for the whole life of the app — so
  // unpaused it is twenty of those a minute, forever, including while the
  // window is minimised behind everything else. A device list nobody can see
  // does not need refreshing, and nothing is missed by stopping: the refresh
  // on the way back up runs before the window is painted, so what you see when
  // you look is current.
  useEffect(() => {
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      if (timer !== undefined) {
        return;
      }
      refresh();
      timer = window.setInterval(refresh, 3000);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const isFluid = engine === 'fluid';
  // Whichever engine is in use, and only an explicit answer from Windows —
  // see `outputEngineState`.
  const engineState = outputEngineState(selectedDevice, engine);
  const cannotHostEffects = engineState === 'no-effects';
  const effectsTurnedOff = engineState === 'effects-off';
  // The list is re-read the moment the engine changes, and the notice waits
  // for that read: switching engines puts the other engine's effect back on
  // every output, and until the next read the list still described the
  // outputs as the engine being left had them — so "Equalizer APO is not
  // enabled for this output" showed for a few seconds after every switch to
  // Equalizer APO, and went away by itself.
  const [isRereadingAfterSwitch, setIsRereadingAfterSwitch] = useState(false);
  useEffect(
    () =>
      subscribeAudioEngineChanged(() => {
        setIsRereadingAfterSwitch(true);
        refresh().finally(() => setIsRereadingAfterSwitch(false));
      }),
    [refresh],
  );
  const showEngineNotice =
    !isNoticeHidden &&
    !isRereadingAfterSwitch &&
    isOutputOff(engineState) &&
    dismissedApoDeviceId !== selectedDevice?.id;

  useEffect(() => {
    setDismissedApoDeviceId('');
    setAttachFailure(undefined);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!showEngineNotice) {
      return undefined;
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedDevice) {
        setDismissedApoDeviceId(selectedDevice.id);
      }
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [selectedDevice, showEngineNotice]);
  /**
   * What an output plays through, as the line under its name in the picker:
   * the named profile that is on, the automatic one it keeps by itself, or
   * nothing. It used to be a block of its own under the picker ("Automatic
   * mapping / Live tuning attached / Edit any EQ control to…"), three lines
   * to say what one under the name says.
   */
  const describeMapping = useCallback(
    (deviceId: string) => {
      const assigned = settings.assignments[deviceId]?.presetName || '';
      if (!assigned) {
        return t('output.mapping.neutral');
      }
      return assigned.startsWith(AUTOMATIC_PRESET_PREFIX)
        ? t('output.mapping.live')
        : t('output.playing', { profile: assigned });
    },
    [settings, t],
  );

  const handleDeviceChange = async (deviceId: string) => {
    setIsBusy(true);
    try {
      await setDefaultAudioDevice(deviceId);
      activeDeviceIdRef.current = '';
      await refresh();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfigureApo = async () => {
    if (selectedDevice && (await onConfigureApo())) {
      setDismissedApoDeviceId(selectedDevice.id);
    }
  };

  const handleEnableEngine = async () => {
    if (!selectedDevice || isAttaching) {
      return;
    }
    setIsAttaching(true);
    setAttachFailure(undefined);
    const result = await onAttachFluidEngine(selectedDevice.guid);
    if (result.ok) {
      setDismissedApoDeviceId(selectedDevice.id);
    } else {
      setAttachFailure(result.declined ? 'declined' : 'failed');
      // Main logs what the helper said; this is which output it was for and
      // whether it was a refusal or a failure, which the helper's line lacks.
      reportError(
        `Enabling the engine on ${selectedDevice.name} ${
          result.declined ? 'was declined' : 'failed'
        }`,
        result.error ?? 'no reason given',
      );
    }
    setIsAttaching(false);
  };

  /*
   * Never enabled without a press. The app used to enable the output Windows
   * plays through by itself the moment the list showed the engine was not on
   * it — one Windows prompt, audio restarted — and every change of output,
   * and every output unplugged, then put an administrator prompt up with
   * nobody having asked for anything. The notice below says the engine is
   * not on this output and its Enable button is the one thing that asks.
   */

  /** The notice's words for the output it is about. */
  const noticeCopy = (device: IAudioDevice) => {
    if (cannotHostEffects) {
      return {
        title: t('output.noEffectsTitle'),
        body: t('output.noEffectsBody', { device: device.name }),
      };
    }
    if (effectsTurnedOff) {
      return {
        title: t('output.effectsOffTitle'),
        body: t('output.effectsOffBody', { device: device.name }),
      };
    }
    return isFluid
      ? {
          title: t('output.engineMissingTitle'),
          body: t('output.engineMissingBody', { device: device.name }),
        }
      : {
          title: t('output.apoMissingTitle'),
          body: t('output.apoMissingBody', { device: device.name }),
        };
  };

  // One display for both places the option is drawn. In the list it is a dot
  // and a name; the picker's own face — the chosen one — also carries the
  // headphones mark, the line saying what the output plays through, and the
  // badges. Which parts show where is the stylesheet's: the list hides the
  // face's extras and the face hides the dot.
  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((device) => {
        // Engine-neutral: the badge says this output is not being
        // processed, and which piece of software is not processing it is
        // the engine dialog's business, not a pill's.
        const isOff = isOutputOff(outputEngineState(device, engine));
        return {
          value: device.id,
          label: device.name,
          display: (
            <div className="device-option">
              <span
                className={
                  device.isDefault ? 'device-dot active' : 'device-dot'
                }
              />
              <svg
                className="device-option__glyph"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
                <rect x="3" y="13" width="4" height="7" rx="1.5" />
                <rect x="17" y="13" width="4" height="7" rx="1.5" />
              </svg>
              <span className="device-option__text">
                <span className="device-option__name">{device.name}</span>
                <span className={`device-option__sub${isOff ? ' is-off' : ''}`}>
                  {describeMapping(device.id)}
                </span>
              </span>
              <span className="device-option__badges">
                {isOff && <span className="apo-badge">{t('output.off')}</span>}
                {device.isDefault && (
                  <span className="default-badge">{t('output.active')}</span>
                )}
              </span>
            </div>
          ),
        };
      }),
    [describeMapping, devices, engine, t],
  );

  return (
    // The picker is the summary, so folding this section hides the profiles
    // but leaves the output you are choosing between on screen. The picker
    // is the whole face of the card: the badges that used to sit on a label
    // above it are on the chosen row itself, because the picker lists every
    // endpoint and which one Windows is actually playing through is not
    // otherwise obvious.
    <SidebarSection
      className="device-profiles"
      glyph={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18.5 7a7 7 0 0 1 0 10" />
        </svg>
      }
      title={t('output.title')}
      summary={
        <Dropdown
          name={t('output.device')}
          className="device-profiles__row"
          menuClassName="device-profiles-menu"
          options={deviceOptions}
          value={selectedDeviceId}
          handleChange={handleDeviceChange}
          isDisabled={isBlockingError || isBusy || devices.length === 0}
          emptyOptionsPlaceholder={t('output.none')}
        />
      }
    >
      {children}
      <p className="device-profiles__hint">{t('output.hint')}</p>
      {showEngineNotice &&
        selectedDevice &&
        createPortal(
          <aside
            className="device-apo-notice"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="device-apo-notice-title"
            aria-describedby="device-apo-notice-body"
          >
            <div className="device-apo-notice__copy">
              <span className="apo-badge">{t('output.off')}</span>
              <h2 id="device-apo-notice-title">
                {noticeCopy(selectedDevice).title}
              </h2>
              <p id="device-apo-notice-body">
                {noticeCopy(selectedDevice).body}
              </p>
              {attachFailure && (
                <p className="device-apo-notice__error">
                  {t(
                    attachFailure === 'declined'
                      ? 'engine.declined'
                      : 'engine.failed',
                  )}
                </p>
              )}
            </div>
            <div className="device-apo-notice__actions">
              {/* Under the engine this is one Windows prompt and a moment of
                  silence, so it is done from here; under Equalizer APO the
                  only way in is APO's own Device Selector, which is a
                  different program and a restart. On an output Windows runs
                  no effects on, there is nothing to do but know it. */}
              {cannotHostEffects ? (
                <Button
                  ariaLabel={t('output.gotIt')}
                  isDisabled={false}
                  className="small"
                  handleChange={() =>
                    setDismissedApoDeviceId(selectedDevice.id)
                  }
                >
                  {t('output.gotIt')}
                </Button>
              ) : null}
              {/* The one switch nothing in FluidEQ can reach: it is Windows'
                  own, it needs the machine's administrator, and while it is
                  off no engine is ever loaded. So the notice takes them to
                  the page that has it rather than offering a repair here
                  that would do nothing. */}
              {effectsTurnedOff ? (
                <>
                  <Button
                    ariaLabel={t('output.openSoundSettings')}
                    isDisabled={false}
                    className="small"
                    handleChange={openWindowsSoundSettings}
                  >
                    {t('output.openSoundSettings')}
                  </Button>
                  <Button
                    ariaLabel={t('output.notNow')}
                    isDisabled={false}
                    className="small subtle"
                    handleChange={() =>
                      setDismissedApoDeviceId(selectedDevice.id)
                    }
                  >
                    {t('output.notNow')}
                  </Button>
                </>
              ) : null}
              {cannotHostEffects || effectsTurnedOff ? null : (
                <>
                  {isFluid ? (
                    // Not disabled while it works, as in the engine update
                    // notice: a disabled button drops the `is-running` breath,
                    // and this one says the enabling is under way — often
                    // without anyone having pressed it. A second press is
                    // refused by `handleEnableEngine` itself.
                    <Button
                      ariaLabel={t('output.enable')}
                      isDisabled={false}
                      className={`small${isAttaching ? ' is-running' : ''}`}
                      handleChange={handleEnableEngine}
                    >
                      {t('output.enable')}
                    </Button>
                  ) : (
                    <Button
                      ariaLabel={t('output.apoConfigure')}
                      isDisabled={false}
                      className="default"
                      handleChange={handleConfigureApo}
                    >
                      {t('output.apoConfigure')}
                    </Button>
                  )}
                  <Button
                    ariaLabel={t('output.notNow')}
                    isDisabled={false}
                    className={isFluid ? 'small subtle' : 'subtle'}
                    handleChange={() =>
                      setDismissedApoDeviceId(selectedDevice.id)
                    }
                  >
                    {t('output.notNow')}
                  </Button>
                </>
              )}
            </div>
          </aside>,
          document.body,
        )}
      {/* The Room's one press to 7.1, on the output being played through,
          when the engine reports the room folding a stereo stream there. It
          steps aside for the engine notice above: an output the engine is
          not on has nothing to set to 7.1 for. */}
      <RoomOutputNotice
        engine={engine}
        device={selectedDevice}
        isHidden={isNoticeHidden || showEngineNotice}
      />
    </SidebarSection>
  );
};

export default DeviceProfiles;
