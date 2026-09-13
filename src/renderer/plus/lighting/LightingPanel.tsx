/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useState } from 'react';
import {
  lightsAnyDevice,
  type ILightingDevice,
} from 'common/lighting/lightingModel';
import { resolveSceneName } from 'common/scenePacks';
import {
  deviceLightingGroup,
  lightingProfile,
} from 'common/lighting/lightingProfiles';
import { requestAccountPanel } from '../../account/accountPanel';
import Glyph from '../../community/Glyph';
import { setLightingSettings, useLighting } from '../../lighting/lightingStore';
import { useTranslation } from '../../utils/I18nContext';
import { useSceneLook } from '../../utils/graphStyle';
import Switch from '../../widgets/Switch';
import { usePlusEntitled } from '../GalleryParts';
import { openPlusPlace } from '../plusNavigation';
import { createDeskColourFeed, type IDeskColourFeed } from './deskColours';
import LightingDevices from './LightingDevices';
import LightingNotices from './LightingNotices';
import LightingStage from './LightingStage';
import LightingProfileTuning from './LightingProfileTuning';
import LightingSlider from './LightingSlider';
import '../../styles/Studio.scss';
import '../../styles/StudioControls.scss';
import '../../styles/Lighting.scss';

interface ILightingPanelProps {
  /** Shows the graph, where the scene the devices follow is chosen. */
  onShowGraph: () => void;
}

/**
 * Dynamic lighting's place in the Plus tab: the member's own desk drawn and
 * lit live, the one switch, how bright and how hard on the beat, and every
 * device that was found.
 *
 * The page asks the main process to look for devices while it is open, even
 * with lighting off — a member deciding whether to switch it on should see
 * their own keyboard, not a promise.
 */
export default function LightingPanel({ onShowGraph }: ILightingPanelProps) {
  const { t, locale } = useTranslation();
  const { state, loaded } = useLighting();
  const entitled = usePlusEntitled();
  const scene = useSceneLook();
  const switchId = useId();
  const [feed, setFeed] = useState<IDeskColourFeed | undefined>();
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string>();

  // Made and closed with the page, in one effect, so a remount — React does
  // one in development — gets a feed of its own rather than a closed one.
  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    const opened = createDeskColourFeed();
    setFeed(opened);
    api?.watchLighting(true);
    return () => {
      api?.watchLighting(false);
      opened.close();
      setFeed(undefined);
    };
  }, []);

  useEffect(() => {
    feed?.update(state.devices, state.settings);
  }, [feed, state.devices, state.settings]);

  const head = (
    <header className="community__head">
      <span className="community__head-mark" aria-hidden="true">
        <Glyph name="lighting" />
      </span>
      <span className="community__head-text">
        <span className="community__head-name">{t('lighting.title')}</span>
        <span className="community__head-description">
          {t('lighting.description')}
        </span>
      </span>
    </header>
  );

  if (!loaded) {
    // A moment, the first time only: the store keeps what main last said.
    return head;
  }

  if (!state.supported) {
    return (
      <>
        {head}
        <div className="lighting">
          <div className="community__empty">
            <span className="community__empty-mark" aria-hidden="true">
              <Glyph name="lighting" />
            </span>
            <p className="community__empty-title">
              {t('lighting.unsupported.title')}
            </p>
            <p className="community__empty-hint">
              {t('lighting.unsupported.body')}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!entitled) {
    return (
      <>
        {head}
        <div className="lighting">
          <div className="studio-gate">
            <span className="studio-gate__mark" aria-hidden="true">
              <Glyph name="lighting" />
            </span>
            <span className="studio-gate__eyebrow">
              {t('account.plus.eyebrow')}
            </span>
            <h3 className="studio-gate__title">{t('lighting.gate.title')}</h3>
            <p className="studio-gate__body">{t('lighting.gate.body')}</p>
            <button
              type="button"
              className="button small"
              onClick={() => requestAccountPanel('subscribe')}
            >
              {t('lighting.gate.cta')}
            </button>
          </div>
          <section className="studio-card lighting-devices">
            <span className="studio-card__eyebrow">
              {t('lighting.devices.found')}
            </span>
            <LightingDevices
              devices={state.devices}
              searching={state.searching}
            />
          </section>
        </div>
      </>
    );
  }

  const { enabled } = state.settings;
  const sceneName = scene ? resolveSceneName(scene, locale) : undefined;
  let status: { tone: string; text: string };
  if (!enabled) {
    status = { tone: 'off', text: t('lighting.status.off') };
  } else if (!sceneName) {
    status = { tone: 'waiting', text: t('lighting.status.noScene') };
  } else if (lightsAnyDevice(state)) {
    status = {
      tone: 'live',
      text: t(
        state.ambient ? 'lighting.status.ambient' : 'lighting.status.live',
        { scene: sceneName },
      ),
    };
  } else if (state.live) {
    // The scene is playing and nothing takes it: the notices and the device
    // list say why.
    status = { tone: 'waiting', text: t('lighting.status.nothingLit') };
  } else {
    status = { tone: 'waiting', text: t('lighting.status.waiting') };
  }

  const mute = (device: ILightingDevice, muted: boolean) =>
    setLightingSettings({
      muted: muted
        ? [...state.settings.muted, device.key]
        : state.settings.muted.filter((key) => key !== device.key),
    });

  const selectedDevice = state.devices.find(
    (device) => device.key === selectedDeviceKey,
  );
  const selectedGroup = selectedDevice
    ? deviceLightingGroup(selectedDevice)
    : 'all';
  const selectedDevices = state.devices.filter(
    (device) => deviceLightingGroup(device) === selectedGroup,
  );
  const target = selectedDevices.length ? selectedGroup : 'all';
  const targetName = selectedDevice?.name ?? t('lighting.target.all');

  return (
    <>
      {head}
      <div className="lighting">
        <section className="lighting-hero">
          <div className="lighting-hero__bar">
            <div className="lighting-switch">
              <Switch
                id={switchId}
                isOn={enabled}
                isDisabled={false}
                ariaLabel={t('lighting.switch')}
                handleToggle={() => setLightingSettings({ enabled: !enabled })}
              />
              {/* A label of its own beside the switch's, not around it: the
                  switch is already a label, and labels do not nest. */}
              <label className="lighting-switch__label" htmlFor={switchId}>
                {t('lighting.switch')}
              </label>
            </div>
            {/* Beside the switch rather than over the desk: a long status in
                a long language covered the monitor on a narrow window. */}
            <span
              className={`lighting-status lighting-status--${status.tone}`}
              role="status"
              title={status.text}
            >
              <span className="lighting-status__text">{status.text}</span>
            </span>
          </div>
          <div className="lighting-scene-bar">
            <div className="lighting-scene-bar__identity">
              <span
                className="lighting-scene-bar__swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(135deg, ${(scene?.swatch?.length ? scene.swatch : ['#477da1', '#8b6caf']).join(',')})`,
                }}
              />
              <span>
                <strong>
                  {sceneName
                    ? t('lighting.scene.title', { scene: sceneName })
                    : t('lighting.status.noScene')}
                </strong>
                <small>{t('lighting.scene.saved')}</small>
              </span>
            </div>
            <button
              type="button"
              className="button small subtle"
              onClick={() => openPlusPlace('visualizers')}
            >
              {t('lighting.pickScene')}
            </button>
          </div>
          <LightingNotices state={state} />
          <LightingStage
            devices={state.devices}
            feed={feed}
            prompt={
              enabled && !sceneName ? (
                <div className="lighting-prompt">
                  <button
                    type="button"
                    className="button small"
                    onClick={() => openPlusPlace('visualizers')}
                  >
                    {t('lighting.pickScene')}
                  </button>
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={onShowGraph}
                  >
                    {t('lighting.showGraph')}
                  </button>
                </div>
              ) : undefined
            }
          />
        </section>

        <div className="lighting-columns">
          <section className="studio-card lighting-devices">
            <div className="lighting-devices__head">
              <span className="studio-card__eyebrow">
                {t('lighting.devices.title')}
              </span>
              <button
                type="button"
                className={`button small${target === 'all' ? '' : ' subtle'}`}
                aria-pressed={target === 'all'}
                onClick={() => setSelectedDeviceKey(undefined)}
              >
                {t('lighting.target.all')}
              </button>
            </div>
            <LightingDevices
              devices={state.devices}
              searching={state.searching}
              feed={feed}
              onMute={mute}
              onSelect={(device) => setSelectedDeviceKey(device.key)}
              selectedGroup={target}
              profile={lightingProfile(state.settings.profiles, scene?.lookId)}
            />
            <div className="lighting-master">
              <LightingSlider
                label={t('lighting.tuning.master')}
                value={state.settings.brightness}
                min={0.1}
                onCommit={(brightness) => setLightingSettings({ brightness })}
              />
            </div>
          </section>
          <section className="studio-card lighting-editor">
            <LightingProfileTuning
              settings={state.settings}
              sceneId={scene?.lookId}
              target={target}
              targetName={targetName}
              shared={
                selectedDevices.length > 1
                  ? selectedDevices.map((device) => device.name).join(', ')
                  : undefined
              }
            />
          </section>
        </div>
      </div>
    </>
  );
}
