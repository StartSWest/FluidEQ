/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import { useId } from 'react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { dynamicsPresetSettings } from 'common/dsp/dynamicsPresets';
import { ProcessorCard } from '../../dsp/DspControls';
import DspDeEsserControls from '../../dsp/DspDeEsserControls';
import DspDynamicsControls from '../../dsp/DspDynamicsControls';
import { RESTING_DYNAMICS } from '../../dsp/useDynamicsLive';
import '../../styles/Dsp.scss';

const nothing = () => undefined;
const DYNAMICS = dynamicsPresetSettings('gentle', true);
const DE_ESSER = { ...DSP_DEFAULTS.deEsser, enabled: true };

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
          bus={RESTING_DYNAMICS}
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
