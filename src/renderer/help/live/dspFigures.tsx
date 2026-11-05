/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { dynamicsPresetSettings } from 'common/dsp/dynamicsPresets';
import { DSP_PRESETS } from 'common/dsp/presets';
import { ProcessorCard } from '../../dsp/DspControls';
import DspDeEsserControls from '../../dsp/DspDeEsserControls';
import DspDynamicsControls from '../../dsp/DspDynamicsControls';
import DspSideTabs from '../../dsp/DspSideTabs';
import type { TDspSection } from '../../dsp/sections';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import RichPick from '../../widgets/RichPick';
import '../../styles/Dsp.scss';

const nothing = () => undefined;
const DYNAMICS = dynamicsPresetSettings('gentle', true);
const DE_ESSER = { ...DSP_DEFAULTS.deEsser, enabled: true };
const ENABLED: Record<TDspSection, boolean> = {
  normalizer: false,
  denoise: false,
  deEsser: true,
  exciter: false,
  bassForge: false,
  eq: true,
  footsteps: false,
  bassPunch: false,
  dimension: false,
  room: false,
  dynamics: true,
  maximizer: true,
  master: false,
  crossfade: false,
};

/** Factory examples only: the drawings share the real controls without reading a profile, opening an engine or saving an edit. */
export function DynamicsDrawing() {
  const id = useId();
  return (
    <div className="dsp-panel">
      <ProcessorCard
        id={`help-dynamics-${id}`}
        titleKey="dsp.dynamics.title"
        descriptionKey="dsp.dynamics.description"
        isEnabled
        onToggle={nothing}
      >
        <DspDynamicsControls
          dynamics={DYNAMICS}
          onPatch={nothing}
          onCommit={nothing}
        />
      </ProcessorCard>
    </div>
  );
}

export function DeEsserDrawing() {
  const id = useId();
  return (
    <div className="dsp-panel">
      <ProcessorCard
        id={`help-deesser-${id}`}
        titleKey="dsp.deEsser.title"
        descriptionKey="dsp.deEsser.description"
        isEnabled
        onToggle={nothing}
      >
        <DspDeEsserControls
          deEsser={DE_ESSER}
          onEdit={nothing}
          onCommit={nothing}
          onTune={nothing}
        />
      </ProcessorCard>
    </div>
  );
}

/** The rail reads the same stage list as DSP, so new stages cannot be absent from its picture. */
export default function DspOverviewDrawing() {
  const { t } = useTranslation();
  return (
    <div className="dsp-panel">
      <header className="dsp-header">
        <div className="dsp-header-line">
          <h2 className="dsp-title">{t('dsp.title')}</h2>
          <div className="dsp-presets">
            <RichPick
              entries={DSP_PRESETS.filter((p) =>
                ['balanced', 'warm', 'speech'].includes(p.id),
              ).map((p) => ({
                id: p.id,
                name: t(p.labelKey as TranslationKey),
                hint: '',
                group: '',
                icon: null,
              }))}
              groupLabel={() => ''}
              activeId=""
              onPick={nothing}
              placeholder={t('dsp.eqPreset.custom')}
              triggerAriaLabel={t('dsp.presets')}
              triggerTitle={t('dsp.presets')}
              placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
            />
          </div>
        </div>
      </header>
      <div className="dsp-body">
        <DspSideTabs
          active="dynamics"
          onSelect={nothing}
          enabled={ENABLED}
          filtersDisabled={false}
          playbackDisabled={false}
        />
        <div className="dsp-stage">
          <DynamicsDrawing />
        </div>
      </div>
    </div>
  );
}
