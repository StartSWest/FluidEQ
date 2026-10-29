/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { FORM_OF_KIND } from 'common/lighting/deviceForms';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import {
  DEFAULT_LIGHTING_SETTINGS,
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
  LIGHTING_PULSES,
  type ILightingDevice,
  type ILightingSettings,
  type TLightingKind,
} from 'common/lighting/lightingModel';
import type { TranslationKey } from 'common/i18n/en';
import { lightingProfile } from 'common/lighting/lightingProfiles';
import Glyph from '../../community/Glyph';
import {
  createDeskColourFeed,
  type IDeskColourFeed,
  type TDeskFrameSource,
} from '../../plus/lighting/deskColours';
import LightingDevices from '../../plus/lighting/LightingDevices';
import LightingProfileTuning from '../../plus/lighting/LightingProfileTuning';
import LightingSceneSwatch from '../../plus/lighting/LightingSceneSwatch';
import LightingSlider from '../../plus/lighting/LightingSlider';
import LightingStage from '../../plus/lighting/LightingStage';
import { useTranslation } from '../../utils/I18nContext';
import SegmentedControl from '../../widgets/SegmentedControl';
import Switch from '../../widgets/Switch';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import { PlusTab } from './plusFigures';
import '../../styles/Studio.scss';
import '../../styles/StudioControls.scss';
import '../../styles/Lighting.scss';

/**
 * The lighting chapter's page, drawn by the page's own stage, device rows,
 * brightness, pulse and style editor (`helpChapters/plus.ts`, which frames
 * it in two figures), for a made-up desk of five devices following Aurora.
 * Tall enough for the whole page in every language, so neither card is
 * cut off by the page's own scroll.
 *
 * The desk is lit by the page's own colour feed and lamp model, from one
 * frame of the Aurora still the app ships (`stillFrames`): the page itself
 * follows the scene playing on the reader's graph, and lights the reader's
 * real devices with it — neither of which a picture in Help may do. The
 * head, the switch's bar and the scene's bar are their markup, class for
 * class, as `LightingPanel` draws them.
 */

const nothing = () => undefined;

const SCENE = 'Aurora';
const SCENE_ID = 'help-aurora';

const device = (kind: TLightingKind, name: string): ILightingDevice => ({
  key: `help:${kind}`,
  name,
  kind,
  form: FORM_OF_KIND[kind],
  route: 'windows',
  lamps: KIND_PREVIEW_LAMPS[kind],
  channel: 'windows',
  muted: false,
});

const DEVICES: readonly ILightingDevice[] = [
  device('stand', 'Headset stand'),
  device('headset', 'Wireless headset'),
  device('keyboard', 'Mechanical keyboard'),
  device('mousepad', 'Mousepad'),
  device('mouse', 'Gaming mouse'),
];

const SETTINGS: ILightingSettings = {
  ...DEFAULT_LIGHTING_SETTINGS,
  enabled: true,
};

/**
 * One frame of a still, reduced to the lamps' grid as the scene's would be,
 * with the still itself for the desk's monitor. Long enough after the last
 * frame that every lamp has eased all the way to it. Nothing where the
 * window cannot decode a picture off screen (a test's document).
 */
const stillFrames =
  (url: string): TDeskFrameSource =>
  (receive) => {
    let stopped = false;
    const picture = new Image();
    picture.src = url;
    if (
      typeof picture.decode !== 'function' ||
      typeof createImageBitmap !== 'function' ||
      typeof OffscreenCanvas === 'undefined'
    ) {
      return nothing;
    }
    picture
      .decode()
      .then(() => createImageBitmap(picture))
      .then((bitmap) => {
        const grid = new OffscreenCanvas(
          LIGHTING_GRID_WIDTH,
          LIGHTING_GRID_HEIGHT,
        );
        const context = grid.getContext('2d');
        if (stopped || !context) {
          bitmap.close();
          return undefined;
        }
        context.drawImage(bitmap, 0, 0, grid.width, grid.height);
        const rgba = context.getImageData(0, 0, grid.width, grid.height).data;
        const rgb = new Uint8Array(grid.width * grid.height * 3);
        for (let cell = 0; cell < grid.width * grid.height; cell += 1) {
          rgb.set(rgba.subarray(cell * 4, cell * 4 + 3), cell * 3);
        }
        receive(
          {
            width: grid.width,
            height: grid.height,
            rgb,
            level: 0.7,
            beat: 0.3,
            bass: 0.6,
            mid: 0.5,
            treble: 0.4,
            deltaMs: 5000,
            sceneId: SCENE_ID,
          },
          bitmap,
        );
        return undefined;
      })
      .catch(nothing);
    return () => {
      stopped = true;
    };
  };

/** Dynamic lighting on, following Aurora, every device on the same style. */
const LightingDrawing = () => {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<IDeskColourFeed>();

  useEffect(() => {
    const opened = createDeskColourFeed(stillFrames(aurora));
    // Told what it lights before its frame can arrive.
    opened.update(DEVICES, SETTINGS);
    setFeed(opened);
    return () => opened.close();
  }, []);

  return (
    <PlusTab shown="lighting" height={1450}>
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
      <div className="lighting">
        <section className="lighting-hero">
          <div className="lighting-hero__bar">
            <div className="lighting-switch">
              <Switch
                id="help-lighting-switch"
                isOn
                isDisabled={false}
                ariaLabel={t('lighting.switch')}
                handleToggle={nothing}
              />
              <label
                className="lighting-switch__label"
                htmlFor="help-lighting-switch"
              >
                {t('lighting.switch')}
              </label>
            </div>
            <span className="lighting-status lighting-status--live">
              <span className="lighting-status__text">
                {t('lighting.status.live', { scene: SCENE })}
              </span>
            </span>
          </div>
          <div className="lighting-scene-bar">
            <div className="lighting-scene-bar__identity">
              <LightingSceneSwatch feed={feed} />
              <span>
                <strong>{t('lighting.scene.title', { scene: SCENE })}</strong>
                <small>{t('lighting.scene.saved')}</small>
              </span>
            </div>
            <button type="button" className="button small subtle">
              {t('lighting.pickScene')}
            </button>
          </div>
          <LightingStage devices={DEVICES} feed={feed} />
        </section>

        <div className="lighting-columns">
          <section className="studio-card lighting-devices">
            <div className="lighting-devices__head">
              <span className="studio-card__eyebrow">
                {t('lighting.devices.title')}
              </span>
              <button type="button" className="button small" aria-pressed>
                {t('lighting.target.all')}
              </button>
            </div>
            <LightingDevices
              devices={DEVICES}
              searching={false}
              feed={feed}
              onMute={nothing}
              onSelect={nothing}
              selectedGroup="all"
              profile={lightingProfile(SETTINGS.profiles, SCENE_ID)}
            />
            <div className="lighting-master">
              <LightingSlider
                label={t('lighting.tuning.master')}
                value={SETTINGS.brightness}
                min={0.1}
                onCommit={nothing}
              />
              <div className="studio-setting">
                <div className="studio-setting__head">
                  <span className="studio-setting__label">
                    {t('lighting.pulse')}
                  </span>
                </div>
                <SegmentedControl
                  name={t('lighting.pulse')}
                  value={SETTINGS.pulse}
                  options={LIGHTING_PULSES.map((pulse) => ({
                    value: pulse,
                    label: t(`lighting.pulse.${pulse}` as TranslationKey),
                  }))}
                  onChange={nothing}
                />
              </div>
            </div>
          </section>
          <section className="studio-card lighting-editor">
            <LightingProfileTuning
              settings={SETTINGS}
              sceneId={SCENE_ID}
              target="all"
              targetName={t('lighting.target.all')}
              keyboardFit={false}
            />
          </section>
        </div>
      </div>
    </PlusTab>
  );
};

export default LightingDrawing;
