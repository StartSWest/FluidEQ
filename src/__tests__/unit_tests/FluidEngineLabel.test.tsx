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

/**
 * The three things the line can be saying, and the one that celebrates.
 *
 * The arrival used to fire on the label merely being drawn — the moment an
 * engine was installed and chosen — so a success animation played in front of
 * an output nothing was reaching. It now belongs to one state only.
 */
const lineOf = (): HTMLElement => {
  const label = screen.getByText('Fluid EQ Engine');
  const line = label.parentElement;
  if (!line) {
    throw new Error('the label has no line around it');
  }
  return line;
};

describe('what the engine line is saying', () => {
  beforeEach(() => {
    mockWorld.status = status('fluid', { fluid: true });
    mockWorld.isEngineUsable = true;
  });

  it('waits rather than claiming, while the window has not been told', () => {
    render(<FluidEngineLabel />);
    expect(lineOf()).toHaveClass('eq-engine-line--checking');
    // Nothing is being celebrated yet, and nothing is being blamed.
    expect(screen.getByText('Fluid EQ Engine')).not.toHaveClass('is-riding');
    expect(document.querySelector('.status-dot.error')).not.toBeInTheDocument();
  });

  it('celebrates once, on becoming the engine that is working', () => {
    const { rerender } = render(<FluidEngineLabel />);
    expect(screen.getByText('Fluid EQ Engine')).not.toHaveClass('is-riding');

    rerender(<FluidEngineLabel isEngineOnOutput />);
    expect(lineOf()).toHaveClass('eq-engine-line--working');
    expect(screen.getByText('Fluid EQ Engine')).toHaveClass('is-riding');
  });

  it('shows the red dot and no celebration when it is not reaching the output', () => {
    render(<FluidEngineLabel isEngineOnOutput={false} />);
    expect(lineOf()).toHaveClass('eq-engine-line--broken');
    expect(screen.getByText('Fluid EQ Engine')).not.toHaveClass('is-riding');
    expect(document.querySelector('.status-dot.error')).toBeInTheDocument();
  });

  it('never celebrates on the way to a fault', () => {
    // The positive control for the case above: the same label arriving, and
    // going the other way. Waiting → not working must look like nothing
    // happened, or the success animation is meaningless.
    const { rerender } = render(<FluidEngineLabel />);
    rerender(<FluidEngineLabel isEngineOnOutput={false} />);
    expect(screen.getByText('Fluid EQ Engine')).not.toHaveClass('is-riding');
  });

  it('leaves Equalizer APO out of all three, because it says nothing', () => {
    mockWorld.status = status('apo', { apo: true });
    render(<FluidEngineLabel isEngineOnOutput={false} />);
    const line = screen.getByText('APO Engine').parentElement;
    expect(line?.className).toBe('eq-engine-line');
    expect(document.querySelector('.status-dot.error')).not.toBeInTheDocument();
  });
});
