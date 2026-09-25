/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The line under the DSP title saying where the rack runs, and when it says it.
 *
 * It said "Library only", in amber, for the frames before main had answered
 * which engine was running — under a rack that was running on every output.
 * Under the FluidEQ Engine it named the output in a pill, which Ivan took out
 * on 2026-09-22: with the rack running there the line says nothing, and it
 * does not read the device list to say it.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import en from '../../../common/i18n/en';
import DspScopeNotice from '../../../renderer/dsp/DspScopeNotice';
import type { TRackSuspension } from '../../../renderer/dsp/rackPlacement';
import { getAudioDevices } from '../../../renderer/utils/equalizerApi';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  ...jest.requireActual('../../../renderer/utils/equalizerApi'),
  getAudioDevices: jest.fn(),
}));

const status = (engine: IAudioEngineStatus['engine']): IAudioEngineStatus => ({
  engine,
  apo: { installed: engine === 'apo' },
  fluid: { installed: engine === 'fluid', endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
});

const notice = (
  shown: IAudioEngineStatus | undefined,
  suspension?: TRackSuspension,
) => (
  <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, isEnabled: true }}>
    <DspScopeNotice status={shown} suspension={suspension} isRackEngaged />
  </FluidEqProviderWrapper>
);

const libraryOnly = () =>
  screen.queryByText(new RegExp(en['dsp.scopeNotice'].slice(0, 30)));

describe('the DSP scope line', () => {
  it('says nothing until main has said which engine runs', () => {
    const { container, rerender } = render(notice(undefined));
    expect(libraryOnly()).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();

    // POSITIVE CONTROL: the same line, once the answer is Equalizer APO.
    rerender(notice(status('apo')));
    expect(libraryOnly()).toBeInTheDocument();
  });

  it('says nothing while the rack runs under the FluidEQ Engine', () => {
    const { container } = render(notice(status('fluid')));
    expect(container).toBeEmptyDOMElement();
    // No pill naming the output, and no read of the outputs to name one with.
    expect(screen.queryByText(/System-wide/)).not.toBeInTheDocument();
    expect(getAudioDevices).not.toHaveBeenCalled();
  });

  it('still says why the rack is off under the FluidEQ Engine', () => {
    // POSITIVE CONTROL for the case above: the same engine, the rack
    // suspended, and the line is there with its reason.
    render(notice(status('fluid'), 'engine-off'));
    expect(screen.getByRole('status')).toHaveTextContent(
      en['dspOff.engineOff'],
    );
  });

  // It was an amber paragraph with a link wrapped onto a line of its own,
  // which read as an error left on the page rather than as something to act
  // on (Ivan, 2026-09-22).
  it('offers switching FluidEQ back on as a real button at the end of the strip', () => {
    render(notice(status('fluid'), 'switched-off'));
    const strip = screen.getByRole('status');
    const button = screen.getByRole('button', { name: en['dspOff.turnOn'] });
    expect(strip).toContainElement(button);
    // The loud style: switching back on is what the line exists to suggest.
    expect(button).toHaveClass('button', 'small');
    expect(button).not.toHaveClass('link-button');
    expect(strip.querySelector('.dsp-scope__icon')).not.toBeNull();
  });
});
