/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic's stages, in the order the voice goes through them, on the DSP
 * page's own rail (`dsp-rail`). The two Voice stages draw their glyphs in
 * the same two strokes as every other stage's (`DspSectionIcon`).
 */

import type { IDspSettings } from '../../common/dsp/chain';
import type { TranslationKey } from '../../common/i18n';
import DspSectionIcon from '../dsp/DspSectionIcon';
import type { TDspSection } from '../dsp/sections';
import { useTranslation } from '../utils/I18nContext';

export type TMicStage =
  'lowCut' | 'denoise' | 'gate' | 'deEsser' | 'eq' | 'dynamics' | 'maximizer';

export const MIC_STAGES: readonly {
  id: TMicStage;
  labelKey: TranslationKey;
}[] = [
  { id: 'lowCut', labelKey: 'mic.stage.lowCut' },
  { id: 'denoise', labelKey: 'mic.stage.cleaner' },
  { id: 'gate', labelKey: 'mic.stage.gate' },
  { id: 'deEsser', labelKey: 'mic.stage.deEsser' },
  { id: 'eq', labelKey: 'mic.stage.eq' },
  { id: 'dynamics', labelKey: 'mic.stage.compressor' },
  { id: 'maximizer', labelKey: 'mic.stage.limiter' },
];

/** Whether a stage is doing anything to the voice right now. */
export const micStageOn = (settings: IDspSettings, stage: TMicStage) => {
  const { voice } = settings;
  switch (stage) {
    case 'lowCut':
      return Boolean(
        voice?.enabled &&
        (voice.lowCutHz > 0 || voice.proximityDb > 0 || voice.deplosive > 0),
      );
    case 'gate':
      return Boolean(voice?.enabled && voice.gateEnabled);
    case 'denoise':
      return settings.denoise.enabled && settings.denoise.voice.enabled;
    case 'deEsser':
      return settings.deEsser.enabled;
    case 'eq':
      return settings.eq.enabled;
    case 'dynamics':
      return settings.dynamics.enabled;
    default:
      return settings.maximizer.enabled;
  }
};

/** A high-pass's slope, and the voice standing clear above it. */
const LowCutIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path className="dsp-section-icon__frame" d="M2 16 C5 16 6 7 9 7 H18" />
    <path
      className="dsp-section-icon__accent"
      d="M13 4 V12 M11 9.5 L13 12 L15 9.5"
    />
  </svg>
);

/** A level crossing a dashed line: open above it, closed under. */
const GateIcon = () => (
  <svg
    className="dsp-section-icon"
    viewBox="0 0 20 20"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      className="dsp-section-icon__frame"
      d="M2 11 H4 M6 11 H8 M10 11 H12 M14 11 H16 M18 11 H18.5"
    />
    <path
      className="dsp-section-icon__accent"
      d="M2 15 H6 L8 4 L10 15 H12 L13 13 L14 15 H18"
    />
  </svg>
);

const StageIcon = ({ stage }: { stage: TMicStage }) => {
  if (stage === 'lowCut') {
    return <LowCutIcon />;
  }
  if (stage === 'gate') {
    return <GateIcon />;
  }
  return <DspSectionIcon section={stage as TDspSection} />;
};

interface IMicStageRailProps {
  heading: string;
  active: TMicStage;
  settings: IDspSettings;
  onSelect: (stage: TMicStage) => void;
}

const MicStageRail = ({
  heading,
  active,
  settings,
  onSelect,
}: IMicStageRailProps) => {
  const { t } = useTranslation();
  return (
    // No heading over the stages: the header names the mic just above, and
    // its Windows name repeated here was cut to an ellipsis at every width.
    <nav className="dsp-rail mic-rail" aria-label={heading}>
      {MIC_STAGES.map(({ id, labelKey }) => (
        <button
          key={id}
          type="button"
          className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
            micStageOn(settings, id) ? ' is-on' : ''
          }`}
          aria-current={id === active ? 'true' : undefined}
          title={t(labelKey)}
          onClick={() => onSelect(id)}
        >
          <StageIcon stage={id} />
          <span className="dsp-rail-name studio-rail__word">{t(labelKey)}</span>
          <span className="dsp-rail-lamp" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
};

export default MicStageRail;
