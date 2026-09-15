/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { ILightingState } from 'common/lighting/lightingModel';
import { resolveSceneName } from 'common/scenePacks';
import { requestAccountPanel } from '../../account/accountPanel';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';
import type { IDeskColourFeed } from './deskColours';
import LightingDevices from './LightingDevices';
import LightingNotices from './LightingNotices';
import LightingProfileTuning from './LightingProfileTuning';
import LightingSceneSwatch from './LightingSceneSwatch';
import LightingSlider from './LightingSlider';
import LightingStage from './LightingStage';
import { useLightingDemo } from './lightingDemo';

interface ILightingPreviewProps {
  state: ILightingState;
  feed: IDeskColourFeed | undefined;
}

/**
 * Dynamic lighting as an account without Plus sees it: the whole page, with
 * the member's own devices on the drawn desk and one scene lighting them —
 * the real devices too, ten seconds at a time — and every control there to
 * be looked at rather than used.
 *
 * It is the page and not a poster because the page is the argument: a desk
 * with their own keyboard and headset on it, taking a scene's colours, and
 * the keyboard itself lighting up under their hands, say what dynamic
 * lighting is in a way a paragraph cannot. What Plus adds is what is locked
 * here — every other scene, the tuning, and the devices staying lit.
 */
export default function LightingPlusPreview({
  state,
  feed,
}: ILightingPreviewProps) {
  const { t, locale } = useTranslation();
  const switchId = useId();
  const demo = useLightingDemo();
  const unlock = () => requestAccountPanel('subscribe');
  const sceneName =
    demo.state === 'dark' ? undefined : resolveSceneName(demo.pack, locale);

  // What the real devices are doing, as the main process says: `live` is it
  // sending them this page's frames.
  const status = state.live
    ? { tone: 'live', text: t('lighting.preview.lit') }
    : { tone: 'preview', text: t('lighting.preview.status') };

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
          {/* Not disabled: a switch that does nothing when pressed reads as
              broken ("it won't let me turn it on"). Like every lock in the
              Studio, pressing it opens the way to Plus, and it stays off. */}
          <div className="lighting-switch is-locked">
            <Switch
              id={switchId}
              isOn={false}
              isDisabled={false}
              ariaLabel={t('lighting.switch')}
              handleToggle={unlock}
            />
            <label className="lighting-switch__label" htmlFor={switchId}>
              {t('lighting.switch')}
              <Glyph name="lock" className="lighting-switch__lock" />
            </label>
          </div>
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
        {/* The devices are really lit here, so what keeps them from being lit
            — Windows holding them, Razer Chroma not running — is said. */}
        <LightingNotices state={state} />
        {/* The tag sits in the corner and the line under the desk: a banner
            across the middle of it covered the very keyboard being sold. */}
        <div className="lighting-demo">
          <LightingStage devices={state.devices} feed={feed} />
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
            devices={state.devices}
            searching={state.searching}
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
              value={state.settings.brightness}
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
            settings={state.settings}
            target="all"
            targetName={t('lighting.target.all')}
          />
        </section>
      </div>
    </div>
  );
}
