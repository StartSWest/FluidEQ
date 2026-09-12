import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import FluidEngineLabel from 'renderer/components/FluidEngineLabel';

const mockWorld: {
  status?: { engine: 'fluid' | 'apo' | null; fluid: { installed: boolean } };
  isEngineUsable: boolean;
} = { isEngineUsable: true };

jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useAudioEngineStatus: () => ({ status: mockWorld.status }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ isEngineUsable: mockWorld.isEngineUsable }),
}));

it('shows the rainbow label only for the installed, enabled Fluid engine', () => {
  mockWorld.status = { engine: 'fluid', fluid: { installed: true } };
  mockWorld.isEngineUsable = true;
  const { rerender } = render(<FluidEngineLabel />);
  expect(screen.getByText('Fluid EQ Engine')).toHaveClass('eq-engine-label');

  mockWorld.isEngineUsable = false;
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.isEngineUsable = true;
  rerender(<FluidEngineLabel />);
  expect(screen.getByText('Fluid EQ Engine')).toBeInTheDocument();

  mockWorld.status.engine = 'apo';
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.status = { engine: 'fluid', fluid: { installed: false } };
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();

  mockWorld.status = undefined;
  rerender(<FluidEngineLabel />);
  expect(screen.queryByText('Fluid EQ Engine')).not.toBeInTheDocument();
});
