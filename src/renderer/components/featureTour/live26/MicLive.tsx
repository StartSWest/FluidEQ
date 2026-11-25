/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useRef, useState } from 'react';
import { micProfileSettings } from '../../../../common/mic/micProfiles';
import MenuIcon from '../../../icons/MenuIcon';
import MicStage from '../../../mic/MicStage';
import MicStageRail, { type TMicStage } from '../../../mic/MicStageRail';
import MicVoicePicture from '../../../mic/MicVoicePicture';
import type { IMicLevel } from '../../../mic/useMicLevels';
import { useTranslation } from '../../../utils/I18nContext';
import RichPick from '../../../widgets/RichPick';
import StudioRail from '../../../widgets/StudioRail';
import useTourFrames from '../useTourFrames';
import { micLevelsAt } from './madeUpMusic';

// Singing with a plate: the profile that shows 2.6's Reverb at work, on
// the one card that draws from its settings alone. The cards that draw the
// voice over time run on the DSP page's graph loop, which only turns while
// the engine reports, and a picture has no engine.
const SETTINGS = micProfileSettings('singPlate');
const STAGE: TMicStage = 'reverb';
const MIC_NAME = 'USB Microphone';
/** As many readings as the picture keeps, a strip's worth at 30 a second. */
const KEPT = 300;
const nothing = () => undefined;

/**
 * The Mic tab as it is, on the Singing, plate profile: the stages down its
 * rail, the voice picture scrolling with a made-up voice that sings in
 * phrases, and the Reverb card's plate. The rail's meters and the
 * picture read the same refs the engine's readings fill on the real page
 * (`useMicLevels`), filled here by `micLevelsAt`, so every live part of the
 * page moves exactly as it does with a voice.
 *
 * Its rail width is given, never remembered: the drawing cannot be dragged,
 * and a picture of a page writes nothing a reset would have to find.
 */
export default function MicLive() {
  const { t } = useTranslation();
  const latest = useRef<IMicLevel | undefined>(undefined);
  const history = useRef<IMicLevel[]>([]);
  const [rail] = useState(() => ({
    width: 270,
    isResizing: false,
    storageKey: 'tour-mic-rail',
    setWidth: nothing,
    setIsResizing: nothing,
  }));

  useTourFrames((seconds) => {
    // The strip is full from the first frame: the seconds before it were
    // spoken too.
    if (history.current.length === 0) {
      for (let back = KEPT; back > 0; back -= 1) {
        history.current.push(readingAt(seconds - back / 30));
      }
    }
    const reading = readingAt(seconds);
    latest.current = reading;
    history.current.push(reading);
    if (history.current.length > KEPT) {
      history.current.shift();
    }
  });

  const { voice } = SETTINGS;
  const gateDb =
    voice?.enabled && voice.gateEnabled ? voice.gateThresholdDb : undefined;
  const glyph = (
    <MenuIcon name="microphoneSettings" className="rich-pick__glyph" />
  );

  return (
    <div className="mic-page tour-live26-mic">
      <StudioRail
        rail={rail}
        isPinned
        onPinnedChange={nothing}
        heading={t('mic.tab')}
      >
        <MicStageRail
          heading={MIC_NAME}
          active={STAGE}
          settings={SETTINGS}
          onSelect={nothing}
          onToggle={nothing}
          onMaster={nothing}
          delays={{ denoise: 10, maximizer: 2 }}
          latest={latest}
          live
          ownEffects={{ on: false, available: true }}
          onOwnToggle={nothing}
        />
      </StudioRail>
      <div className="mic-page__main">
        <header className="mic-head">
          <div className="mic-head__who">
            <RichPick
              className="mic-head__pick"
              entries={[
                {
                  id: 'mic',
                  name: MIC_NAME,
                  hint: '',
                  group: 'mics',
                  icon: glyph,
                },
              ]}
              groupLabel={() => t('mic.list.heading')}
              activeId="mic"
              onPick={nothing}
              placeholder={MIC_NAME}
              placeholderIcon={glyph}
              triggerAriaLabel={t('mic.label')}
              triggerTitle={t('mic.pickHint')}
            />
            <span className="mic-head__live is-live" role="status">
              <span className="mic-head__lamp" aria-hidden="true" />
              {t('mic.live')}
            </span>
          </div>
          <MicVoicePicture history={history} gateDb={gateDb} />
          <div className="mic-head__sound">
            <RichPick
              className="mic-head__profile"
              entries={[
                {
                  id: 'singPlate',
                  name: t('mic.profile.singPlate'),
                  hint: t('mic.profile.singPlate.hint'),
                  group: 'singing',
                  icon: glyph,
                },
              ]}
              groupLabel={() => t('mic.profile.group.singing')}
              activeId="singPlate"
              onPick={nothing}
              placeholder={t('mic.profile.singPlate')}
              placeholderIcon={glyph}
              triggerAriaLabel={t('mic.profile.label')}
              triggerTitle={t('mic.profile.pickHint')}
            />
          </div>
        </header>
        <MicStage
          stage={STAGE}
          settings={SETTINGS}
          isSystemWide
          lowCutKept={undefined}
          onPatch={nothing}
          onCommit={nothing}
          onSwitchLowCut={nothing}
          latest={latest}
          live
        />
      </div>
    </div>
  );
}

/**
 * One reading as the engine would hand it over: the voice and the room
 * before the rack, what leaves it, and Voice level and the gate at work.
 */
const readingAt = (seconds: number): IMicLevel => {
  const { input, output } = micLevelsAt(seconds);
  const speaking = output > 0.01;
  const heardDb = 20 * Math.log10(Math.max(input, 1e-4));
  return {
    input,
    output,
    limiterDb: speaking ? -0.6 * (output / 0.37) : 0,
    gateLevelDb: heardDb,
    gateGainDb: speaking ? 0 : -18,
    levelHeardDb: heardDb,
    levelGainDb: speaking ? Math.max(-6, Math.min(8, -18 - heardDb)) : 0,
  };
};
