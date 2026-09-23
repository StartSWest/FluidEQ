/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every DSP graph says when its stage is switched off.
 *
 * Bass Forge's picture always dimmed when its stage was off; the Equaliser,
 * Exciter, Denoise, Dimension, Maximizer, Master and Crossfade graphs looked
 * exactly the same on and off (Ivan, 2026-09-22: "enabling and disabling the
 * graph changes colour, see how Bass Forge does"). The dim itself is the
 * stylesheet's, held in `tabEntranceStyles.test.ts`; what is held here is that
 * each graph wears the class it is keyed on, and only while its stage is off.
 *
 * And each names what it draws in words, never by a translation key: the
 * Master's legend printed "dsp.master.graph.reduction" in the running window
 * for the length of a session.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import en from '../../../common/i18n/en';
import DspBassForgeGraph from '../../../renderer/dsp/DspBassForgeGraph';
import DspBassPunchGraph from '../../../renderer/dsp/DspBassPunchGraph';
import DspCrossfadeCard from '../../../renderer/dsp/DspCrossfadeCard';
import DspDenoiseGraph from '../../../renderer/dsp/DspDenoiseGraph';
import DspDimensionGraph from '../../../renderer/dsp/DspDimensionGraph';
import DspEqCard from '../../../renderer/dsp/DspEqCard';
import DspEqLegend from '../../../renderer/dsp/DspEqLegend';
import DspExciterGraph from '../../../renderer/dsp/DspExciterGraph';
import DspMasterGraph from '../../../renderer/dsp/DspMasterGraph';
import DspMaximizerGraph from '../../../renderer/dsp/DspMaximizerGraph';

const ignore = () => undefined;

interface IGraph {
  name: string;
  /** The element the stylesheet dims. */
  wrapper: string;
  draw: (enabled: boolean) => ReactElement;
}

const GRAPHS: IGraph[] = [
  {
    name: 'Equaliser',
    wrapper: '.dsp-eq-plot',
    draw: (enabled) => (
      <DspEqCard
        eq={{ ...DSP_DEFAULTS.eq, enabled }}
        sampleRate={48_000}
        onChange={ignore}
        onCommit={ignore}
      />
    ),
  },
  {
    name: 'Exciter',
    wrapper: '.dsp-exciter-display',
    draw: (enabled) => (
      <DspExciterGraph
        settings={{ ...DSP_DEFAULTS.exciter, enabled }}
        onChange={ignore}
        onCommit={ignore}
      />
    ),
  },
  {
    name: 'Denoise',
    wrapper: '.dsp-denoise-graph',
    draw: (enabled) => (
      <DspDenoiseGraph
        profile={undefined}
        profileSource="adaptive"
        hiss={DSP_DEFAULTS.denoise.hiss}
        hum={DSP_DEFAULTS.denoise.hum}
        click={DSP_DEFAULTS.denoise.click}
        isEnabled={enabled}
      />
    ),
  },
  {
    name: 'Dimension',
    wrapper: '.dsp-dimension-graph',
    draw: (enabled) => (
      <DspDimensionGraph
        dimension={{ ...DSP_DEFAULTS.dimension, enabled }}
        sampleRate={48_000}
      />
    ),
  },
  {
    name: 'Bass Forge',
    wrapper: '.dsp-bass-forge-display',
    draw: (enabled) => (
      <DspBassForgeGraph bassForge={{ ...DSP_DEFAULTS.bassForge, enabled }} />
    ),
  },
  {
    name: 'Bass Punch',
    wrapper: '.dsp-bass-punch-display',
    draw: (enabled) => (
      <DspBassPunchGraph bassPunch={{ ...DSP_DEFAULTS.bassPunch, enabled }} />
    ),
  },
  {
    name: 'Maximizer',
    wrapper: '.dsp-maximizer-display',
    draw: (enabled) => (
      <DspMaximizerGraph maximizer={{ ...DSP_DEFAULTS.maximizer, enabled }} />
    ),
  },
  {
    name: 'Master',
    wrapper: '.dsp-master-display',
    draw: (enabled) => (
      <DspMasterGraph
        master={{ ...DSP_DEFAULTS.master, enabled }}
        loudnessGainDb={0}
      />
    ),
  },
  {
    name: 'Crossfade',
    wrapper: '.dsp-crossfade-preview',
    draw: (enabled) => (
      <DspCrossfadeCard
        crossfade={{ ...DSP_DEFAULTS.crossfade, enabled }}
        onPatch={ignore}
        onCommit={ignore}
      />
    ),
  },
];

/** A translation key where words should be: `dsp.` and a name after it. */
const RAW_KEY = /\bdsp\.[a-z][a-zA-Z]*\.[a-zA-Z]/;

describe('a DSP graph whose stage is switched off', () => {
  it.each(GRAPHS)('$name wears the Off look, and only then', (graph) => {
    const off = render(graph.draw(false));
    expect(off.container.querySelector(graph.wrapper)).toHaveClass('is-off');
    off.unmount();

    const on = render(graph.draw(true));
    const wrapper = on.container.querySelector(graph.wrapper);
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).not.toHaveClass('is-off');
  });

  it.each(GRAPHS)('$name names what it draws in words', (graph) => {
    const { container } = render(graph.draw(true));
    expect(container.textContent ?? '').not.toMatch(RAW_KEY);
  });

  it('POSITIVE CONTROL: a key printed as text is caught', () => {
    expect('Momentary LUFS dsp.master.graph.reduction').toMatch(RAW_KEY);
  });
});

describe('the Equaliser legend under Isolate', () => {
  const legend = (isIsolating: boolean) =>
    render(
      <DspEqLegend
        hasDynamic={false}
        showsThreshold={false}
        showsSubsonic={false}
        isIsolating={isIsolating}
      />,
    ).container.textContent ?? '';

  it('names the spectrum for what it is then: what the EQ adds and takes away', () => {
    // Isolating, what leaves the EQ is only its change — a cut draws a hill
    // under its own notch — and "Output" read as the EQ doing the opposite.
    expect(legend(true)).toContain(en['dsp.eq.legend.isolated']);
    expect(legend(true)).not.toContain(en['dsp.eq.legend.spectrum']);
  });

  it('names it the output while listening', () => {
    expect(legend(false)).toContain(en['dsp.eq.legend.spectrum']);
    expect(legend(false)).not.toContain(en['dsp.eq.legend.isolated']);
  });
});
