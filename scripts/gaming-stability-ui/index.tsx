/* FluidEQ — GPL-3.0-or-later. Isolated regression harness. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../../src/renderer/utils/I18nContext';
import LabelledKnob from '../../src/renderer/components/LabelledKnob';
import DspFootstepsControls from '../../src/renderer/dsp/DspFootstepsControls';
import DspGameEnvironment from '../../src/renderer/dsp/DspGameEnvironment';
import DspGameVoices from '../../src/renderer/dsp/DspGameVoices';
import {
  FOOTSTEPS_DEFAULTS,
  IFootstepsSettings,
} from '../../src/common/dsp/footsteps';
import '../../src/renderer/styles/App.scss';
import '../../src/renderer/styles/Dsp.scss';

const params = new URLSearchParams(window.location.search);
localStorage.setItem('fluideq.locale', params.get('locale') || 'en');
function Harness() {
  const [footsteps, set] = useState({ ...FOOTSTEPS_DEFAULTS, enabled: true });
  const [long, setLong] = useState(false);
  const patch = (next: Partial<IFootstepsSettings>) =>
    set((was) => ({ ...was, ...next }));
  return (
    <main style={{ padding: 20, height: '100vh', overflow: 'auto' }}>
      <button type="button" id="words" onClick={() => setLong((was) => !was)}>
        Words
      </button>
      <button
        type="button"
        id="tuning"
        onClick={() =>
          patch({
            environment: footsteps.environment === 0 ? 1 : 0,
            lift: footsteps.lift === 1 ? 0 : 1,
          })
        }
      >
        Tuning
      </button>
      <div className="dsp-card">
        <div className="dsp-card-body">
          <div className="dsp-game-parts">
            <DspFootstepsControls
              footsteps={footsteps}
              onEdit={patch}
              onCommit={() => {}}
            />
            <DspGameVoices
              footsteps={footsteps}
              isHeard
              onEdit={patch}
              onCommit={() => {}}
            />
            <DspGameEnvironment
              footsteps={footsteps}
              isHeard
              onEdit={patch}
              onCommit={() => {}}
            />
          </div>
          <div className="dsp-band">
            <div className="dsp-band-dials" id="neighbors">
              {[
                {
                  id: 'words',
                  label: long
                    ? 'Pasos detectados por encima del sonido de fondo'
                    : 'Pasos',
                  value: long ? 100 : 1,
                },
                { id: 'neighbor', label: 'Calm', value: 0 },
              ].map(({ id, label, value }) => (
                <LabelledKnob
                  key={id}
                  label={label}
                  value={value}
                  min={0}
                  max={100}
                  unit="%"
                  step={1}
                  onChange={() => {}}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
const root = document.getElementById('root');
if (!root) {
  throw new Error('No root');
}
createRoot(root).render(
  <I18nProvider>
    <Harness />
  </I18nProvider>,
);
