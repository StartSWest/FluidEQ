/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import type { ReactElement } from 'react';
import ProfileTestProvider from '__tests__/utils/profileTestProvider';
import { showOutputEditor } from '__tests__/utils/outputEditorFixture';
import { fireEvent, render, screen } from '@testing-library/react';
import { DeviceMatchEnum } from '../../common/audioDeviceBridge';
import ExtraOutputs from '../../renderer/ExtraOutputs';
import useOutputMirror, {
  IMirrorTarget,
} from '../../renderer/audio/useOutputMirror';
import {
  type IIncomingSound,
  IncomingSoundContext,
} from '../../renderer/remoteAudio/remoteAudioValueContext';

const renderProfiles = (view: ReactElement) =>
  render(view, { wrapper: ProfileTestProvider });

jest.mock('../../renderer/audio/useOutputMirror');

const mockedUseOutputMirror = useOutputMirror as jest.MockedFunction<
  typeof useOutputMirror
>;

const target = (
  name: string,
  isSelected: boolean,
  isRunning = false,
  delayMs: number | undefined = undefined,
): IMirrorTarget => ({
  device: {
    id: name.toLowerCase().replaceAll(' ', '-'),
    guid: `guid-${name}`,
    name,
    isDefault: false,
    isActive: true,
  },
  match: {
    guid: `guid-${name}`,
    name,
    status: DeviceMatchEnum.MATCHED,
    sinkId: `sink-${name}`,
  },
  isEligible: true,
  isUsable: true,
  isSelected,
  isRunning,
  presetName: '',
  volume: 1,
  delayMs,
});

const mirrorState = (targets: IMirrorTarget[]) => {
  const selected = targets.filter((entry) => entry.isSelected);
  const running = targets.filter((entry) => entry.isRunning);
  mockedUseOutputMirror.mockReturnValue({
    error: '',
    isMirroring: running.length > 0,
    isVirtualRoutingAvailable: false,
    mirroringCount: running.length,
    refresh: jest.fn().mockResolvedValue(undefined),
    selectedTargets: selected,
    setTargetVolume: jest.fn(),
    targets,
    toggleTarget: jest.fn(),
  });
};

const renderOpen = (incoming: IIncomingSound[] = []) => {
  renderProfiles(
    <IncomingSoundContext.Provider value={incoming}>
      <ExtraOutputs engine="apo" />
    </IncomingSoundContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Second output/i }));
};

describe('ExtraOutputs', () => {
  beforeEach(() => {
    showOutputEditor();
  });
  it('starts collapsed and names only the enabled outputs in its summary', () => {
    const enabled = target('Enabled speakers', true, true);
    const disabled = target('Disabled speakers', false);
    mirrorState([enabled, disabled]);

    renderProfiles(<ExtraOutputs engine="apo" />);

    const header = screen.getByRole('button', { name: /Second output/i });
    const summary = header
      .closest('.sidebar-section')
      ?.querySelector('.sidebar-section__summary');

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(summary).toHaveTextContent('Enabled speakers');
    expect(summary).not.toHaveTextContent('Disabled speakers');
    expect(summary).toHaveTextContent('Edit sound');
    expect(
      header.querySelector('.sidebar-section__status'),
    ).not.toBeInTheDocument();

    // Open, the list says it in full; the header does not say it twice.
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(
      header.querySelector('.sidebar-section__status'),
    ).not.toBeInTheDocument();
  });

  it('says Off in its header when no second output is enabled', () => {
    mirrorState([target('Disabled speakers', false)]);

    renderProfiles(<ExtraOutputs engine="apo" />);

    const header = screen.getByRole('button', { name: /Second output/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    const status = header.querySelector('.sidebar-section__status');
    expect(status).toHaveTextContent('Off');
    expect(status).not.toHaveTextContent('Disabled speakers');
    // The header is the whole of it: no second row under it.
    expect(
      header
        .closest('.sidebar-section')
        ?.querySelector('.sidebar-section__summary'),
    ).not.toBeInTheDocument();
  });

  it('keeps output volume available without a manual buffering choice', () => {
    mirrorState([target('Headset', true, true, 42)]);
    renderOpen();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(
      screen.getByRole('slider', { name: 'Volume — Headset' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Each output uses its own EQ profile/),
    ).toBeInTheDocument();
  });

  it('reports a running output’s software buffer', () => {
    mirrorState([target('Headset', true, true, 41.6)]);
    renderOpen();
    expect(screen.getByText('Software buffer: 42 ms')).toBeInTheDocument();
  });

  it('says nothing of a delay it has not been told yet', () => {
    mirrorState([target('Headset', true, false)]);
    renderOpen();
    expect(screen.queryByText(/Software buffer:/)).not.toBeInTheDocument();
    expect(screen.getByText('Headset')).toBeInTheDocument();
  });

  it('adds known network buffering only for another computer whose sound is arriving', () => {
    mirrorState([target('Headset', true, true, 42)]);
    renderOpen([
      { id: 'peer', name: 'SWEST-YOGA', delayMs: 145, isSounding: true },
      { id: 'quiet', name: 'OFFICE', delayMs: undefined, isSounding: true },
      { id: 'silent', name: 'STUDIO', delayMs: 160, isSounding: false },
    ]);
    expect(screen.getByText('Software buffer: 42 ms')).toBeInTheDocument();
    expect(
      screen.getByText('From SWEST-YOGA: 187 ms software buffering'),
    ).toBeInTheDocument();
    // A computer whose delay is not known yet is not guessed at.
    expect(screen.queryByText(/OFFICE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/STUDIO/)).not.toBeInTheDocument();
  });
});
