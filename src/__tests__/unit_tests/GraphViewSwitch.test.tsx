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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GraphViewSwitch from '../../renderer/components/GraphViewSwitch';
import { useFluidEqContext } from '../../renderer/utils/FluidEqContext';
import {
  disableGraphView,
  enableGraphView,
} from '../../renderer/utils/equalizerApi';

jest.mock('../../renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: jest.fn(),
}));
jest.mock('../../renderer/utils/equalizerApi', () => ({
  disableGraphView: jest.fn(async () => undefined),
  enableGraphView: jest.fn(async () => undefined),
}));

describe('GraphViewSwitch', () => {
  const setGlobalError = jest.fn();
  const setGraphViewOn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFluidEqContext as jest.Mock).mockReturnValue({
      isBlockingError: false,
      isGraphViewOn: true,
      setGlobalError,
      setGraphViewOn,
    });
  });

  it('uses the active tab value without changing the legacy global setting', async () => {
    const onToggle = jest.fn();
    render(
      <GraphViewSwitch id="graph-per-tab" isOn={false} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true));
    expect(enableGraphView).not.toHaveBeenCalled();
    expect(disableGraphView).not.toHaveBeenCalled();
    expect(setGraphViewOn).not.toHaveBeenCalled();
  });

  it('retains the legacy global behavior when used uncontrolled', async () => {
    render(<GraphViewSwitch id="graph-global" />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(disableGraphView).toHaveBeenCalledTimes(1));
    expect(setGraphViewOn).toHaveBeenCalledWith(false);
  });
});
