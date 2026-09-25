/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { lightsAnyDevice } from 'common/lighting/lightingModel';
import { setLightingSettings, useLighting } from '../lighting/lightingStore';
import { usePlusEntitled } from '../plus/GalleryParts';
import { useTranslation } from '../utils/I18nContext';
import '../styles/Lighting.scss';

/**
 * Dynamic lighting's switch, on the graph beside the scene it follows.
 *
 * Icon only, like the two wash toggles in the same row: the row is the first
 * thing to run out of width, and a scene has already given up the design
 * button's place. Shown only where it can do something — a Plus member, on
 * Windows, with a Plus scene on the graph — and it is the same setting as the
 * switch on the Plus tab's page.
 */
export default function LightingToggle() {
  const { t } = useTranslation();
  const { state, loaded } = useLighting();
  const entitled = usePlusEntitled();
  if (!loaded || !state.supported || !entitled) {
    return null;
  }
  const { enabled } = state.settings;
  const label = t(enabled ? 'lighting.graph.on' : 'lighting.graph.off');
  return (
    <button
      type="button"
      className={`graph-look-step graph-look-step--toggle graph-lighting${lightsAnyDevice(state) ? ' is-live' : ''}`}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      onClick={() => setLightingSettings({ enabled: !enabled })}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="8" width="11" height="6" rx="1.6" />
        <path d="M6 11h4" />
        {/* The rays are the light, so they are drawn only while it is on: an
            unlit device under rays read as switched on (Ivan, 2026-09-24). The
            device keeps its place, so the button does not jump on a press. */}
        {enabled && <path d="M8 2v2.4M3.6 3.6l1.6 1.6M12.4 3.6l-1.6 1.6" />}
      </svg>
    </button>
  );
}
