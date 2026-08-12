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
  it('starts collapsed and summarizes only enabled outputs', () => {
    const enabled = target('Enabled speakers', true, true);
    const disabled = target('Disabled speakers', false);
    mockedUseOutputMirror.mockReturnValue({
      error: '',
      isMirroring: true,
      isVirtualRoutingAvailable: false,
      mirroringCount: 1,
      refresh: jest.fn().mockResolvedValue(undefined),
      selectedTargets: [enabled],
      setTargetVolume: jest.fn(),
      targets: [enabled, disabled],
      toggleTarget: jest.fn(),
    });

    render(<ExtraOutputs />);

    const header = screen.getByRole('button', { name: /Second output/i });
    const section = header.closest('.sidebar-section') as HTMLElement;
    const summary = section.querySelector(
      '.sidebar-section__summary',
    ) as HTMLElement;

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(summary).toHaveTextContent('Enabled speakers');
    expect(summary).not.toHaveTextContent('Disabled speakers');
    expect(summary).not.toHaveTextContent('Off');

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(
      section.querySelector('.sidebar-section__summary'),
    ).not.toBeInTheDocument();
  });

  it('uses only its header when no second output is enabled', () => {
    const disabled = target('Disabled speakers', false);
    mockedUseOutputMirror.mockReturnValue({
      error: '',
      isMirroring: false,
      isVirtualRoutingAvailable: false,
      mirroringCount: 0,
      refresh: jest.fn().mockResolvedValue(undefined),
      selectedTargets: [],
      setTargetVolume: jest.fn(),
      targets: [disabled],
      toggleTarget: jest.fn(),
    });

    render(<ExtraOutputs />);

    const header = screen.getByRole('button', { name: /Second output/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(
      header
        .closest('.sidebar-section')
        ?.querySelector('.sidebar-section__summary'),
    ).not.toBeInTheDocument();
  });
});
