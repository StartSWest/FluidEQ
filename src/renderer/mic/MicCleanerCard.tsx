/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Noise cancelling, for a mic: the neural module of the rack's Denoise, which
 * the engine runs on live audio from the model in its folder. Mockup A's
 * card (Ivan's pick, 2026-11-23): the voice and the room before and after
 * the cleaner (`MicNoiseLive`) and the Strength. A "Never cuts" panel
 * counting late blocks stood under them until Ivan asked whether it was
 * needed (2026-11-24): it was a diagnostic, and it read 7724 in a minute
 * because it added the engine's running total again on every reading (the
 * status said 2). The engine still never cuts; nothing on the card has to
 * say so. The picture's "Room taken" replaced a bar fed
 * by the restoration's reduction reading, which is its hiss module's: off on
 * every mic, so the bar read 0 dB whatever the cleaner took.
 *
 * Not the DSP page's Denoise card, which calls the module Library-only while
 * the rack runs system-wide - true of music, where the cleaner is wrong
 * anyway, and not of a voice. Hiss, hum and clicks stay off: they are for
 * recordings, and on a live voice the cleaner already takes the room.
 *
 * Mockup A also drew a speed choice (one hop of headroom or two). It is not
 * here: measured on Ivan's machine with every core busy, one hop missed 2
 * blocks in 30 s once the worker ran in Windows' audio class and a missed
 * block stopped playing the raw room (never_cuts bench, 2026-11-23), so a
 * second hop would add 10 ms of delay for nothing a listener can hear.
 */

import type { IDenoiseSettings, IDspSettings } from '../../common/dsp/chain';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import useVoiceModel from '../dsp/useVoiceModel';
import { useTranslation } from '../utils/I18nContext';
import MicNoiseLive from './MicNoiseLive';
import MicPresetBar from './MicPresetBar';
import micStageSwitch from './micStageSwitch';
import type { IMicLevel } from './useMicLevels';

interface IMicCleanerCardProps {
  settings: IDspSettings;
  onPatch: (next: Partial<IDspSettings>) => void;
  onCommit: () => void;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

const MicCleanerCard = ({
  settings,
  onPatch,
  onCommit,
  latest,
  live,
}: IMicCleanerCardProps) => {
  const { t } = useTranslation();
  const { model, download, cancel } = useVoiceModel();
  const { denoise } = settings;
  const on = denoise.enabled && denoise.voice.enabled;
  const missing = model.state !== 'ready';
  const patchDenoise = (next: Partial<IDenoiseSettings>) =>
    onPatch({ denoise: { ...denoise, presetId: '', ...next } });

  return (
    <ProcessorCard
      id="mic-cleaner"
      titleKey="mic.stage.cleaner"
      descriptionKey="mic.cleaner.description"
      isEnabled={on}
      onToggle={() => {
        onPatch(micStageSwitch('denoise', settings));
        onCommit();
      }}
      toolbar={
        <MicPresetBar
          stage="denoise"
          values={denoise.voice}
          hint={(each) => `${Math.round(each.amount * 100)}%`}
          onPick={({ amount }) => {
            // On, as a DSP stage's pick starts it: the cleaner's own switch
            // with the amount, and the stage around it.
            const switched = on
              ? settings
              : micStageSwitch('denoise', settings);
            const next = switched.denoise ?? denoise;
            onPatch({
              denoise: {
                ...next,
                presetId: '',
                voice: { ...next.voice, amount },
              },
            });
            onCommit();
          }}
        />
      }
    >
      <MicNoiseLive on={on} live={live} latest={latest} />
      <div className="dsp-band mic-cleaner__band">
        <div className="mic-cleaner__row">
          <Dial
            labelKey="mic.cleaner.strength"
            value={denoise.voice.amount * 100}
            defaultValue={100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={!on}
            onChange={(percent) =>
              patchDenoise({
                voice: { ...denoise.voice, amount: percent / 100 },
              })
            }
            onCommit={onCommit}
          />
          <p className="dsp-band-hint mic-cleaner__strength-hint">
            {t('mic.cleaner.strengthHint')}
          </p>
        </div>
        {missing && (
          <>
            <p className="dsp-band-hint">
              {t('dsp.denoise.voiceModelMissing')}
            </p>
            <div className="dsp-denoise-model">
              <button
                type="button"
                className="button small"
                disabled={model.state === 'downloading'}
                onClick={download}
              >
                {t('dsp.denoise.voiceDownload')}
              </button>
              {model.state === 'downloading' && (
                <>
                  <span className="dsp-band-spec">
                    {t('dsp.denoise.voiceDownloading', {
                      progress: Math.round(model.fraction * 100),
                    })}
                  </span>
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={cancel}
                  >
                    {t('dsp.denoise.voiceCancel')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </ProcessorCard>
  );
};

export default MicCleanerCard;
