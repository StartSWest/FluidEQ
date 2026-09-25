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
import { fireEvent, render, screen } from '@testing-library/react';
import { DeviceMatchEnum } from '../../common/audioDeviceBridge';
import ExtraOutputs from '../../renderer/ExtraOutputs';
import useOutputMirror, {
  IMirrorTarget,
} from '../../renderer/audio/useOutputMirror';

jest.mock('../../renderer/audio/useOutputMirror');

const mockedUseOutputMirror = useOutputMirror as jest.MockedFunction<
  typeof useOutputMirror
>;

const target = (
  name: string,
  isSelected: boolean,
  isRunning = false,
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
});

describe('ExtraOutputs', () => {
  it('starts collapsed and names only the enabled outputs in its header', () => {
    const enabled = target('Enabled speakers', true, true);
    const disabled = target('Disabled speakers', false);
    mockedUseOutputMirror.mockReturnValue({
      error: '',
      isMirroring: true,
      isVirtualRoutingAvailable: false,
      mirroringCount: 1,
      mode: 'music',
      refresh: jest.fn().mockResolvedValue(undefined),
      setMode: jest.fn(),
      selectedTargets: [enabled],
      setTargetVolume: jest.fn(),
      targets: [enabled, disabled],
      toggleTarget: jest.fn(),
    });

    render(<ExtraOutputs engine="apo" />);

    const header = screen.getByRole('button', { name: /Second output/i });
    const status = header.querySelector('.sidebar-section__status');

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(status).toHaveTextContent('Enabled speakers');
    expect(status).not.toHaveTextContent('Disabled speakers');
    expect(status).not.toHaveTextContent('Off');

    // Open, the list says it in full; the header does not say it twice.
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(
      header.querySelector('.sidebar-section__status'),
    ).not.toBeInTheDocument();
  });

  it('says Off in its header when no second output is enabled', () => {
    const disabled = target('Disabled speakers', false);
    mockedUseOutputMirror.mockReturnValue({
      error: '',
      isMirroring: false,
      isVirtualRoutingAvailable: false,
      mirroringCount: 0,
      mode: 'music',
      refresh: jest.fn().mockResolvedValue(undefined),
      setMode: jest.fn(),
      selectedTargets: [],
      setTargetVolume: jest.fn(),
      targets: [disabled],
      toggleTarget: jest.fn(),
    });

    render(<ExtraOutputs engine="apo" />);

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
});
