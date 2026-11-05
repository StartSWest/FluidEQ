/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { clampDspSettings, IDspSettings } from '../../common/dsp/chain';
import MainContent from '../MainContent';
import ActiveLayerChips from '../components/ActiveLayerChips';
import useActiveLayers from '../components/useActiveLayers';
import DspStageCards from '../dsp/DspStageCards';
import { DspPresetScopeProvider } from '../dsp/presetScope';
import type { TDspSection } from '../dsp/sections';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import useNativeMeters from '../dsp/useNativeMeters';
import { useDspPageRoomLive } from '../dsp/useRoomLive';
import MyCurvesPanel from '../eq/MyCurvesPanel';
import ResponseCurvesGraph from '../graph/ResponseCurvesGraph';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useListenedOutput } from '../utils/useListenedOutput';
import type { TGamingStage } from './gamingStages';

/** The stages that can be soloed, and switching every one of them off. */
const withoutIsolate = (rack: IDspSettings): IDspSettings => ({
  ...rack,
  denoise: { ...rack.denoise, isolate: false },
  deEsser: { ...rack.deEsser, isolate: false },
  eq: { ...rack.eq, isolate: false },
  footsteps: { ...rack.footsteps, isolate: false },
  exciter: { ...rack.exciter, isolate: false },
  bassForge: { ...rack.bassForge, isolate: false },
  bassPunch: { ...rack.bassPunch, isolate: false },
});

const isSoloing = (rack: IDspSettings): boolean =>
  rack.denoise.isolate ||
  rack.deEsser.isolate ||
  rack.eq.isolate ||
  rack.footsteps.isolate ||
  rack.exciter.isolate ||
  rack.bassForge.isolate ||
  rack.bassPunch.isolate;

/**
 * One stage of the game's rack, as the DSP page draws it, editing the rack
 * playing now — which is the game's own while its sound is on.
 *
 * A solo cannot outlive the stage it was switched on from: leaving the
 * stage, or the Gaming Lab, with the Game filter's Isolate on would keep
 * playing only what it lifts with the switch out of sight (DspPanel does
 * the same for its own pages).
 *
 * The engine's analysis is asked for here, as the DSP page asks for it
 * (`useNativeMeters`): it runs only for a surface that draws it, and without
 * the ask every card's graph and meter stood still (Ivan, 2026-11-03:
 * "nothing moves").
 *
 * Every stage's preset picker here lists the gaming presets (10. DSP's
 * `DspPresetScopeProvider`, Ivan, 2026-11-03: the Gaming tab's rack shows
 * only gaming-tuned presets); the DSP page keeps the music ones.
 */
const GamingRackStage = ({ section }: { section: TDspSection }) => {
  useNativeMeters();
  const rack = useDspSettings();
  const audioEngine = useKnownAudioEngineStatus();
  const isSystemWide = audioEngine?.engine === 'fluid';
  const listened = useListenedOutput(isSystemWide, 'editor');
  const roomLive = useDspPageRoomLive(listened, rack);
  const latest = useRef(rack);
  latest.current = rack;

  useEffect(
    () => () => {
      if (isSoloing(latest.current)) {
        applyDspSettings(withoutIsolate(latest.current));
        persistDspSettings();
      }
    },
    [section],
  );

  return (
    <div className="dsp-stage">
      <DspPresetScopeProvider scope="gaming">
        <DspStageCards
          section={section}
          settings={rack}
          onPatch={(next, preservePreset = false) =>
            applyDspSettings(
              clampDspSettings({
                ...latest.current,
                ...next,
                presetId: preservePreset ? latest.current.presetId : '',
              }),
            )
          }
          onCommit={persistDspSettings}
          isSystemWide={isSystemWide}
          roomLive={roomLive}
        />
      </DspPresetScopeProvider>
    </div>
  );
};

/**
 * Every curve this game plays, as the EQ page's chips show them, each with
 * the × that takes it off, over the listener's own curves to choose from —
 * My curves, as the EQ Presets page lists them, adding and importing
 * included (discussion 52: a game asked for one of My curves). Over them,
 * every curve drawn as the main graph draws it, so a pick is seen landing
 * beside the rest (Ivan, 2026-11-02: "I wanna show all curves graph on
 * curves"). No correction picker of its own: beside My curves it was a
 * second way to the same choice (Ivan, 2026-11-03: "we don't need this thing
 * for my curves"); the EQ mode card keeps it.
 */
const GamingCurve = () => {
  const { t } = useTranslation();
  const active = useActiveLayers();
  return (
    <div className="gaming-editor__card">
      <p className="gaming-editor__note">{t('gaming.editor.curveNote')}</p>
      <ResponseCurvesGraph
        className="gaming-curve__graph"
        ariaLabel={t('graph.curves')}
      />
      {active.layers.length > 0 && (
        <div className="active-layers__menu gaming-curve__layers">
          <ActiveLayerChips active={active} />
        </div>
      )}
      <div className="gaming-curve__mine">
        <MyCurvesPanel />
      </div>
    </div>
  );
};

interface IGamingStageEditorProps {
  stage: TGamingStage;
}

/**
 * The chosen part of a game's sound, edited where the game is chosen, while
 * the game's own sound is the one on (`GamingStageWaiting` stands here
 * otherwise).
 *
 * Every editor here is the one the rest of the app uses — the DSP page's
 * cards, the EQ page's bands and Tone, its correction picker — working on
 * the sound playing now, which is the game's copy: every edit is saved into
 * it.
 */
const GamingStageEditor = ({ stage }: IGamingStageEditorProps) => {
  const { t } = useTranslation();
  if (stage === 'mainEq') {
    return (
      <div className="gaming-editor gaming-editor--eq">
        <p className="gaming-editor__note">{t('gaming.editor.eqNote')}</p>
        {/* The EQ page's own editor, in the box the EQ page gives it: its
            rows fold by that box's width (`eq-panel`). The Tone is its row
            under the bands with no band selected, so the Lab has no Tone
            part of its own (Ivan, 2026-11-03: "remove tone ... since we have
            that on eq already"). */}
        <div className="gaming-eq">
          <MainContent />
        </div>
      </div>
    );
  }
  if (stage === 'curve') {
    return (
      <div className="gaming-editor">
        <GamingCurve />
      </div>
    );
  }
  return (
    <div className="gaming-editor gaming-editor--rack">
      <GamingRackStage section={stage as TDspSection} />
    </div>
  );
};

export default GamingStageEditor;
