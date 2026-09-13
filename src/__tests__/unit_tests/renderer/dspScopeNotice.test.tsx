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
 * Then under the FluidEQ Engine it opened on the unnamed pill and swapped the
 * speaker's name in a moment later, on every visit. Both were the line
 * guessing instead of waiting for the answer.
 *
 * The cases are in one file on purpose and in this order: the output's name
 * is kept for the session, so the case about a later visit depends on an
 * earlier read.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import type { IAudioDevice } from '../../../common/constants';
import en from '../../../common/i18n/en';
import DspScopeNotice from '../../../renderer/dsp/DspScopeNotice';
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

const SPEAKERS: IAudioDevice = {
  id: 'a',
  name: 'Speakers (Realtek)',
  guid: '{A}',
  isDefault: true,
  isActive: true,
};

const notice = (shown: IAudioEngineStatus | undefined) => (
  <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, isEnabled: true }}>
    <DspScopeNotice
      status={shown}
      suspension={undefined}
      isRackEngaged
      phase="minimum"
    />
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
    expect(getAudioDevices).not.toHaveBeenCalled();
  });

  it('names the output from the first frame of every visit after the first', async () => {
    let devicesAnswer: (devices: IAudioDevice[]) => void = () => undefined;
    jest.mocked(getAudioDevices).mockImplementationOnce(
      () =>
        new Promise<IAudioDevice[]>((resolve) => {
          devicesAnswer = resolve;
        }),
    );
    const named = en['dsp.scope.system'].replace('{output}', SPEAKERS.name);

    const first = render(notice(status('fluid')));
    // The first visit waits for the name rather than showing a pill that
    // changes under the reader a moment later.
    expect(first.container).toBeEmptyDOMElement();
    expect(libraryOnly()).not.toBeInTheDocument();
    await act(async () => {
      devicesAnswer([SPEAKERS]);
    });
    expect(screen.getByText(named)).toBeInTheDocument();
    first.unmount();

    // A later visit reads the output again, and shows what it had meanwhile:
    // this read is never answered.
    jest.mocked(getAudioDevices).mockImplementationOnce(
      () =>
        new Promise<IAudioDevice[]>((resolve) => {
          devicesAnswer = resolve;
        }),
    );
    render(notice(status('fluid')));
    expect(screen.getByText(named)).toBeInTheDocument();
    expect(
      screen.queryByText(en['dsp.scope.systemAll']),
    ).not.toBeInTheDocument();
  });
});
