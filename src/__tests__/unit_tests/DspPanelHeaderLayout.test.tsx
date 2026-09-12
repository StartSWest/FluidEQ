/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DOM the DSP page's wrapping layout depends on.
 *
 * The headers and the EQ's band strip wrap by themselves now, with no grid per
 * page per width, and that only works for the shape of markup asserted here:
 * a note inside the toolbar was held to the width left beside the bypass
 * switch, and three loose dials in the strip broke onto lines of their own
 * with a button stranded after them. Neither is visible to a layout-free DOM,
 * but both are decided by where an element sits, which is.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { DSP_DEFAULTS } from '../../common/dsp/chain';
import { FluidEqProviderWrapper } from '../../renderer/utils/FluidEqContext';
import DspPanel from '../../renderer/dsp/DspPanel';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../renderer/audio/playbackOwner';
import { setDspNativeState } from '../../renderer/dsp/store';

const renderPanel = () =>
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, isEnabled: true }}
    >
      <DspPanel
        settings={DSP_DEFAULTS}
        onChange={jest.fn()}
        onCommit={jest.fn()}
        engineState="running"
      />
    </FluidEqProviderWrapper>,
  );

const openPage = (container: HTMLElement, name: string, id: string) => {
  const rail = screen.getByRole('navigation', { name: 'DSP' });
  fireEvent.click(within(rail).getByRole('button', { name: new RegExp(name) }));
  const header = container.querySelector(`#${id} .dsp-card-header`);
  if (!(header instanceof HTMLElement)) {
    throw new Error(`no header on the ${name} page`);
  }
  return header;
};

/** The page, and the full-width line its header must hold beside its toolbar. */
const PAGES_WITH_A_NOTE = [
  ['Exciter', 'dsp-exciter', '.dsp-exciter-note'],
  ['Bass Forge', 'dsp-bass-forge', '.dsp-bass-forge-note'],
  ['Bass Punch', 'dsp-bass-punch', '.dsp-bass-punch-note'],
  ['Dimension', 'dsp-dimension', '.dsp-dimension-note'],
  ['Maximizer', 'dsp-maximizer', '.dsp-maximizer-note'],
  ['Master', 'dsp-master', '.dsp-maximizer-note'],
  ['Equaliser', 'dsp-eq', '.dsp-eq-settings'],
] as const;

describe('DSP processor headers', () => {
  beforeEach(() =>
    act(() => {
      claimPlayback('library');
      setDspNativeState('engaged');
    }),
  );

  afterEach(() =>
    act(() => {
      stopAllPlayback();
      setDspNativeState('idle');
    }),
  );

  it.each(PAGES_WITH_A_NOTE)(
    'keeps the %s note beside the toolbar rather than inside it',
    (name, id, line) => {
      const { container } = renderPanel();
      const header = openPage(container, name, id);
      const toolbar = header.querySelector(':scope > .dsp-eq-bar');
      expect(toolbar).not.toBeNull();
      expect(header.querySelector(`:scope > ${line}`)).not.toBeNull();
      expect(toolbar?.querySelector(line)).toBeNull();
    },
  );

  it('holds only control groups in each toolbar', () => {
    const { container } = renderPanel();
    PAGES_WITH_A_NOTE.forEach(([name, id]) => {
      const header = openPage(container, name, id);
      const groups = Array.from(
        header.querySelector(':scope > .dsp-eq-bar')?.children ?? [],
      );
      expect(groups.length).toBeGreaterThan(0);
      groups.forEach((group) => {
        expect(
          ['dsp-eq-preset', 'dsp-eq-transfer', 'dsp-eq-rack'].some((kind) =>
            group.classList.contains(kind),
          ),
        ).toBe(true);
      });
    });
  });

  it('POSITIVE CONTROL: puts Reset inside the toolbar it belongs to', () => {
    const { container } = renderPanel();
    const header = openPage(container, 'Bass Punch', 'dsp-bass-punch');
    const toolbar = header.querySelector(':scope > .dsp-eq-bar') as HTMLElement;
    // Exact: "Previous preset" and "Next preset" contain "reset" as well.
    expect(
      within(toolbar).getByRole('button', { name: 'Reset' }),
    ).toBeInTheDocument();
    expect(header.querySelector(':scope > .dsp-eq-transfer')).toBeNull();
  });

  it('wraps the EQ strip by whole groups, never by a single control', () => {
    const { container } = renderPanel();
    openPage(container, 'Equaliser', 'dsp-eq');
    const strip = container.querySelector('.dsp-eq-strip') as HTMLElement;
    const dials = strip.querySelector(':scope > .dsp-eq-strip-dials');
    const actions = strip.querySelector(':scope > .dsp-eq-strip-actions');
    expect(dials).not.toBeNull();
    expect(actions).not.toBeNull();
    ['Freq', 'Gain', 'Width'].forEach((dial) => {
      expect(
        within(dials as HTMLElement).getByRole('slider', { name: dial }),
      ).toBeInTheDocument();
    });
    expect(
      within(actions as HTMLElement).getByTitle('Add a band below this one'),
    ).toBeInTheDocument();
    expect(
      within(actions as HTMLElement).getByRole('button', {
        name: /^(On|Off)$/,
      }),
    ).toHaveAttribute('aria-pressed');
    expect(strip.querySelector(':scope > .labelled-knob')).toBeNull();
    expect(strip.querySelector(':scope > .button')).toBeNull();
  });
});
