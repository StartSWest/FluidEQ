/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { MutableRefObject } from 'react';
import { micProfileSettings } from 'common/mic/micProfiles';
import { DspPresetScopeProvider } from '../../dsp/presetScope';
import MenuIcon from '../../icons/MenuIcon';
import type { ILibraryRailWidth } from '../../library/LibraryRailSplitter';
import MicDelayReadout from '../../mic/MicDelayReadout';
import MicStage from '../../mic/MicStage';
import MicStageRail from '../../mic/MicStageRail';
import MicVoicePicture from '../../mic/MicVoicePicture';
import { MIC_HISTORY, type IMicLevel } from '../../mic/useMicLevels';
import { useTranslation } from '../../utils/I18nContext';
import RichPick from '../../widgets/RichPick';
import StudioRail from '../../widgets/StudioRail';

/**
 * The Mic chapter's page (`helpChapters/sound.ts`), laid out as `MicPage`
 * lays it out: the stages down the studio rail, and beside it the head — the
 * microphone, its live line, the picture of the voice, the profile and the
 * delay — over the open stage.
 *
 * Every part is the page's own, handed a made-up USB microphone singing a
 * made-up phrase into the Streaming profile, with the EQ open; nothing asks
 * the engine, the reader's microphones or Windows anything, and nothing acts.
 */

const nothing = () => undefined;

const MIC_NAME = 'USB Microphone';
const SETTINGS = micProfileSettings('stream');

const RAIL: ILibraryRailWidth = {
  width: 286,
  isResizing: false,
  storageKey: 'help-mic-rail',
  setWidth: nothing,
  setIsResizing: nothing,
};

/** Words and the pauses after them, in frames of the picture. */
const WORDS: readonly (readonly [number, number])[] = [
  [38, 14],
  [22, 9],
  [54, 20],
  [30, 11],
  [46, 16],
  [26, 24],
  [60, 10],
  [34, 18],
];

/** The room under the voice before the cleaner (-50 dBFS) and after it. */
const ROOM_RAW = 0.0032;
const ROOM_CLEAN = 0.0003;

/**
 * A spoken phrase as the picture keeps it, a reading a frame on its -60 dB
 * scale: words of different lengths, each a run of syllables peaking between
 * -14 and -6 dBFS, and the room's floor in the pauses, which the cleaner
 * takes down to nothing heard.
 */
const phrase = (): IMicLevel[] => {
  const levels: IMicLevel[] = [];
  let word = 0;
  while (levels.length < MIC_HISTORY) {
    const [length, pause] = WORDS[word % WORDS.length];
    const weight = 0.2 + 0.3 * (((word * 7) % 5) / 4);
    for (let at = 0; at < length; at += 1) {
      const shape = Math.sin(Math.PI * (at / length));
      const syllable = 0.35 + 0.65 * Math.abs(Math.sin((at / 11) * Math.PI));
      const voice = weight * shape * syllable;
      levels.push({
        input: ROOM_RAW + voice,
        output: ROOM_CLEAN + voice * 0.9,
        limiterDb: voice > 0.4 ? -1 : 0,
      });
    }
    for (let at = 0; at < pause; at += 1) {
      levels.push({ input: ROOM_RAW, output: ROOM_CLEAN, limiterDb: 0 });
    }
    word += 1;
  }
  return levels.slice(0, MIC_HISTORY);
};

const HISTORY: MutableRefObject<IMicLevel[]> = { current: phrase() };
const LATEST: MutableRefObject<IMicLevel | undefined> = {
  current: HISTORY.current[HISTORY.current.length - 20],
};

const MicGlyph = () => (
  <MenuIcon name="microphoneSettings" className="rich-pick__glyph" />
);

export default function MicPageDrawing() {
  const { t } = useTranslation();
  return (
    <div className="mic-page">
      <StudioRail
        rail={RAIL}
        isPinned
        onPinnedChange={nothing}
        heading={t('mic.tab')}
      >
        <MicStageRail
          heading={MIC_NAME}
          active="eq"
          settings={SETTINGS}
          onSelect={nothing}
          onToggle={nothing}
          onMaster={nothing}
          delays={undefined}
          latest={LATEST}
          live
          ownEffects={{ on: true, available: true }}
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
                  id: 'help-mic',
                  name: MIC_NAME,
                  hint: t('mic.list.on'),
                  group: 'mics',
                  icon: <MicGlyph />,
                },
              ]}
              groupLabel={() => t('mic.list.heading')}
              activeId="help-mic"
              onPick={nothing}
              placeholder={MIC_NAME}
              placeholderIcon={<MicGlyph />}
              triggerAriaLabel={t('mic.label')}
              triggerTitle={t('mic.pickHint')}
            />
            <span className="mic-head__live is-live" role="status">
              <span className="mic-head__lamp" aria-hidden="true" />
              {t('mic.live')}
            </span>
          </div>
          <MicVoicePicture history={HISTORY} gateDb={-48} />
          <div className="mic-head__sound">
            <RichPick
              className="mic-head__profile"
              entries={[
                {
                  id: 'stream',
                  name: t('mic.profile.stream'),
                  hint: t('mic.profile.stream.hint'),
                  group: 'use',
                  icon: <MicGlyph />,
                },
              ]}
              groupLabel={() => t('mic.profile.group.use')}
              activeId="stream"
              onPick={nothing}
              placeholder={t('mic.profile.stream')}
              placeholderIcon={<MicGlyph />}
              triggerAriaLabel={t('mic.profile.label')}
              triggerTitle={t('mic.profile.pickHint')}
            />
          </div>
          <MicDelayReadout health={undefined} />
        </header>
        <DspPresetScopeProvider scope="mic">
          <MicStage
            stage="eq"
            settings={SETTINGS}
            isSystemWide
            lowCutKept={undefined}
            onPatch={nothing}
            onCommit={nothing}
            onSwitchLowCut={nothing}
            latest={LATEST}
            live
          />
        </DspPresetScopeProvider>
      </div>
    </div>
  );
}
