/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { requestAccountPanel } from '../../account/accountPanel';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';
import { useScenePicture } from '../scenePictures';
import type { IDeskColourFeed } from './deskColours';
import LightingDevices from './LightingDevices';
import LightingProfileTuning from './LightingProfileTuning';
import LightingSceneSwatch from './LightingSceneSwatch';
import LightingSlider from './LightingSlider';
import LightingStage from './LightingStage';
import { useDemoScene, useLightingDemo } from './lightingDemo';

interface ILightingPreviewProps {
  devices: readonly ILightingDevice[];
  searching: boolean;
  feed: IDeskColourFeed | undefined;
  /** What the member's own settings would look like, shown and not editable. */
  brightness: number;
}

/**
 * Dynamic lighting as an account without Plus sees it: the whole page, with
 * the member's own devices on the drawn desk and one scene lighting them, and
 * every control there to be looked at rather than used.
 *
 * It is the page and not a poster because the page is the argument: a desk
 * with their own keyboard and headset on it, taking a scene's colours, says
 * what dynamic lighting is in a way a paragraph cannot. What Plus adds is
 * what is locked here — every other scene, the tuning, and the devices
 * themselves actually lighting up.
 */
export default function LightingPlusPreview({
  devices,
  searching,
  feed,
  brightness,
}: ILightingPreviewProps) {
  const { t, locale } = useTranslation();
  const switchId = useId();
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const scene = useDemoScene();
  const picture = useScenePicture(
    {
      lookId: scene?.lookId ?? '',
      authorId: FLUIDEQ_CREATOR_ID,
      sceneId: scene?.id ?? '',
      version: scene?.version ?? 0,
    },
    scene ? stage : null,
  );
  const demo = useLightingDemo(
    scene,
    picture.state === 'ready' ? picture.url : undefined,
  );
  const unlock = () => requestAccountPanel('subscribe');
  const sceneName = scene ? resolveSceneName(scene, locale) : undefined;

  return (
    <div className="lighting">
      <section className="lighting-unlock">
        <span className="lighting-unlock__mark" aria-hidden="true">
          <Glyph name="lighting" />
        </span>
        <span className="lighting-unlock__text">
          <span className="studio-card__eyebrow">
            {t('account.plus.eyebrow')}
          </span>
          <strong>{t('lighting.gate.title')}</strong>
          <small>{t('lighting.gate.body')}</small>
        </span>
        <button type="button" className="button small" onClick={unlock}>
          {t('lighting.gate.cta')}
        </button>
      </section>

      <section className="lighting-hero">
        <div className="lighting-hero__bar">
          <div className="lighting-switch">
            <Switch
              id={switchId}
              isOn={false}
              isDisabled
              ariaLabel={t('lighting.switch')}
              handleToggle={unlock}
            />
            <label className="lighting-switch__label" htmlFor={switchId}>
              {t('lighting.switch')}
            </label>
          </div>
          <span
            className="lighting-status lighting-status--preview"
            role="status"
          >
            <span className="lighting-status__text">
              {t('lighting.preview.status')}
            </span>
          </span>
        </div>
        <div className="lighting-scene-bar">
          <div className="lighting-scene-bar__identity">
            <LightingSceneSwatch feed={feed} />
            <span>
              <strong>
                {sceneName
                  ? t('lighting.scene.title', { scene: sceneName })
                  : t('lighting.preview.noScene')}
              </strong>
              <small>{t('lighting.preview.oneScene')}</small>
            </span>
          </div>
          <button
            type="button"
            className="button small subtle"
            onClick={unlock}
          >
            {t('lighting.preview.moreScenes')}
          </button>
        </div>
        {/* The tag sits in the corner and the line under the desk: a banner
            across the middle of it covered the very keyboard being sold. */}
        <div className="lighting-demo" ref={setStage}>
          <LightingStage devices={devices} feed={feed} />
          {demo.state === 'playing' && sceneName && (
            <span className="lighting-taste">
              <span className="lighting-taste__live" aria-hidden="true" />
              {t('lighting.status.live', { scene: sceneName })}
            </span>
          )}
        </div>
        <div className="lighting-scene-bar lighting-held">
          <span>{t('lighting.preview.held')}</span>
          {/* Quiet: the loud one is the strip at the top of the page, and
              two of them competing is neither recommending anything. */}
          <button
            type="button"
            className="button small subtle"
            onClick={unlock}
          >
            {t('lighting.gate.cta')}
          </button>
        </div>
      </section>

      <div className="lighting-columns">
        <section className="studio-card lighting-devices">
          <div className="lighting-devices__head">
            <span className="studio-card__eyebrow">
              {t('lighting.devices.title')}
            </span>
          </div>
          <LightingDevices
            devices={devices}
            searching={searching}
            feed={feed}
          />
          {/* Disabled as a set, so every control inside is out of reach of the
              pointer, the keyboard and a screen reader in one declaration. */}
          <fieldset
            className="lighting-editor__fields lighting-master"
            disabled
          >
            <LightingSlider
              label={t('lighting.tuning.master')}
              value={brightness}
              min={0.1}
              onCommit={() => undefined}
            />
          </fieldset>
        </section>
        <section className="studio-card lighting-editor">
          <p className="lighting-locked">
            <Glyph name="lock" />
            {t('lighting.preview.locked')}
          </p>
          <LightingProfileTuning
            settings={{
              enabled: false,
              brightness,
              pulse: 'gentle',
              muted: [],
              profiles: {},
            }}
            target="all"
            targetName={t('lighting.target.all')}
          />
        </section>
      </div>
    </div>
  );
}
