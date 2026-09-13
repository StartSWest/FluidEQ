import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import FluidEngineLabel from 'renderer/components/FluidEngineLabel';

type TMockStatus = {
  engine: 'fluid' | 'apo' | null;
  apo: { installed: boolean };
  fluid: { installed: boolean };
};

// The status as `useAudioEngineStatus` really answers it: both engines are
// always described. A mock with only `fluid` crashed the label the moment it
// asked whether Equalizer APO was installed.
const mockWorld: { status?: TMockStatus; isEngineUsable: boolean } = {
  isEngineUsable: true,
};

const status = (
  engine: TMockStatus['engine'],
  installed: { apo?: boolean; fluid?: boolean } = {},
): TMockStatus => ({
  engine,
  apo: { installed: installed.apo ?? false },
  fluid: { installed: installed.fluid ?? false },
});

jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useAudioEngineStatus: () => ({ status: mockWorld.status }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ isEngineUsable: mockWorld.isEngineUsable }),
}));

it('shows the rainbow label only for the installed, enabled Fluid engine', () => {
  mockWorld.status = status('fluid', { fluid: true });
  mockWorld.isEngineUsable = true;
  const { rerender } = render(<FluidEngineLabel />);
  expect(screen.getByText('Fluid EQ Engine')).toHaveClass('eq-engine-label');

  mockWorld.isEngineUsable = false;
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.isEngineUsable = true;
  rerender(<FluidEngineLabel />);
  expect(screen.getByText('Fluid EQ Engine')).toBeInTheDocument();

  mockWorld.status = status('apo', { fluid: true });
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.status = status('fluid', { fluid: false });
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.status = undefined;
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();
  expect(screen.queryByText('APO Engine')).not.toBeInTheDocument();
});

it('names Equalizer APO when it is the installed, enabled engine', () => {
  mockWorld.status = status('apo', { apo: true });
  mockWorld.isEngineUsable = true;
  const { rerender } = render(<FluidEngineLabel />);
  expect(screen.getByText('APO Engine')).toHaveClass(
    'eq-engine-label',
    'eq-engine-label--apo',
  );
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.isEngineUsable = false;
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('APO Engine')).not.toBeInTheDocument();

  mockWorld.isEngineUsable = true;
  mockWorld.status = status('apo', { apo: false });
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('APO Engine')).not.toBeInTheDocument();

  // Chosen FluidEQ Engine with APO also on the machine: only the engine in use
  // is named.
  mockWorld.status = status('fluid', { apo: true, fluid: true });
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('APO Engine')).not.toBeInTheDocument();
  expect(screen.getByText('Fluid EQ Engine')).toBeInTheDocument();
});
