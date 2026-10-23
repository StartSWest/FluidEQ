import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ICurveComparisonStatus } from 'common/curveComparison';
import { TCurveSmoothing } from 'common/eqShape';
import EqModeSelect from 'renderer/components/EqModeSelect';
import { refreshTrebleDesigns } from 'renderer/utils/useTrebleDesigns';

const mockSelect = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockError = jest.fn();
const mockReset = jest.fn().mockResolvedValue(undefined);
let mockStatus: ICurveComparisonStatus;
// Unset is the 1/12 octave default: anything else makes the menu Custom by
// itself, and a Custom read after a phase change would then prove nothing.
let mockSmoothing: TCurveSmoothing | undefined;
let mockRate = 48000;
let mockGameMode = false;
jest.mock('renderer/utils/useListenedOutput', () => ({
  useListenedOutput: () => ({
    output: { latency: { rate: mockRate }, gameMode: mockGameMode },
  }),
}));

// The Treble choice, as a window with no choice written reads it: without
// this the menu and the graph ask a bridge jsdom does not have.
jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ eq: 'precise', curves: 'precise' }),
  setTrebleDesign: jest.fn(),
}));
// One answer for the whole window, asked the first time anything shows it.
// Answered before any case renders: left to the first mount, it landed after
// that case had ended and re-rendered the EQ outside act.
beforeAll(() => refreshTrebleDesigns());
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isBlockingError: false,
    curveSmoothing: mockSmoothing,
    refreshState: mockRefresh,
    setGlobalError: mockError,
  })),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  resetEqMode: () => mockReset(),
  setEqMode: jest.fn(),
  setEqShape: jest.fn(),
}));
jest.mock('renderer/utils/useCurvePhase', () => ({
  __esModule: true,
  default: () => ({ status: mockStatus, select: mockSelect }),
}));

const group = (scope: string) =>
  within(screen.getByRole('group', { name: `${scope} · Phase` }));
const open = () => {
  render(<EqModeSelect />);
  fireEvent.click(screen.getByRole('button', { name: 'EQ mode' }));
};
const pick = async (scope: string, phase: string) => {
  await act(async () =>
    fireEvent.click(group(scope).getByRole('button', { name: phase })),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSmoothing = undefined;
  mockRate = 48000;
  mockGameMode = false;
  mockSelect.mockResolvedValue(undefined);
  mockStatus = {
    variant: 'B',
    eqVariant: 'B',
    active: true,
    supported: true,
    eqSupported: true,
    hasSampledCurves: false,
  };
});

it('defaults both groups to Minimum even with smoothing off and no sampled curves', () => {
  mockSmoothing = 'off';
  open();
  ['Your EQ', 'Corrections'].forEach((scope) => {
    expect(
      group(scope).getByRole('button', { name: 'Minimum' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(group(scope).getByRole('button', { name: 'Linear' })).toBeEnabled();
  });
});

it('calls both groups at Minimum nothing changed', () => {
  open();
  expect(screen.getByRole('button', { name: 'EQ mode' })).toHaveTextContent(
    'Normal',
  );
});

it('writes only the chosen phase scope and keeps the popup open', async () => {
  open();
  await pick('Your EQ', 'Linear');
  expect(mockSelect).toHaveBeenLastCalledWith('A', 'eq');
  expect(
    group('Corrections').getByRole('button', { name: 'Minimum' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await pick('Corrections', 'Linear');
  expect(mockSelect).toHaveBeenLastCalledWith('A', 'curves');
  expect(mockRefresh).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('serializes rapid choices, keeping the latest phase per group', async () => {
  let finish = () => {};
  mockSelect.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  open();
  await pick('Your EQ', 'Linear');
  await pick('Your EQ', 'Minimum');
  await pick('Your EQ', 'Linear');
  await pick('Corrections', 'Linear');
  expect(mockSelect.mock.calls).toEqual([['A', 'eq']]);
  expect(
    group('Corrections').getByRole('button', { name: 'Linear' }),
  ).toBeEnabled();
  await act(async () => finish());
  expect(mockSelect.mock.calls).toEqual([
    ['A', 'eq'],
    ['A', 'eq'],
    ['A', 'curves'],
  ]);
});

it('resets both phases along with the existing modes', async () => {
  mockStatus.variant = 'A';
  mockStatus.eqVariant = 'A';
  open();
  expect(screen.getByRole('button', { name: 'EQ mode' })).toHaveTextContent(
    'Custom',
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockSelect.mock.calls).toEqual([
    ['B', 'curves'],
    ['B', 'eq'],
  ]);
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('does not pretend a failed phase write changed the sound', async () => {
  const failure = new Error('write refused');
  mockSelect.mockRejectedValueOnce(failure);
  open();
  await pick('Your EQ', 'Linear');
  expect(mockError).toHaveBeenCalledWith(failure);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(
    group('Your EQ').getByRole('button', { name: 'Minimum' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('gates old engines while leaving supported engines usable', () => {
  mockStatus.supported = false;
  mockStatus.eqSupported = false;
  open();
  expect(
    group('Your EQ').getByRole('button', { name: 'Linear' }),
  ).toBeDisabled();
  expect(
    group('Corrections').getByRole('button', { name: 'Linear' }),
  ).toBeDisabled();
  expect(
    screen.getAllByText('Update the FluidEQ Engine to change phase.'),
  ).toHaveLength(2);
});

it('does not offer FluidEQ phase controls under Equalizer APO', async () => {
  mockStatus.active = false;
  open();
  expect(
    screen.queryByRole('group', { name: 'Your EQ · Phase' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Corrections · Phase' }),
  ).not.toBeInTheDocument();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockSelect).not.toHaveBeenCalled();
});
it('forecasts the real FIR delay even before the first EQ band is changed', () => {
  mockStatus.bandPhaseScopes = { eq: false, curves: false };
  open();
  expect(
    group('Your EQ').getByRole('button', { name: /Linear/ }),
  ).toHaveTextContent('≈ +352 ms with active EQ');
  expect(
    group('Corrections').getByRole('button', { name: /Linear/ }),
  ).toHaveTextContent('≈ +0 ms delay');
});

it.each([
  [44100, 383],
  [48000, 352],
  [96000, 347],
])('uses the running output rate of %i Hz for the preview', (rate, delay) => {
  mockRate = rate;
  mockStatus.bandPhaseScopes = { eq: true, curves: true };
  open();
  ['Your EQ', 'Corrections'].forEach((scope) => {
    expect(
      group(scope).getByRole('button', { name: /Linear/ }),
    ).toHaveTextContent(`≈ +${delay} ms delay`);
  });
});

it('explains that Game mode keeps Minimum phase instead of promising a linear zero-delay filter', () => {
  mockGameMode = true;
  mockStatus.bandPhaseScopes = { eq: true, curves: true };
  open();
  expect(screen.getAllByText('Game mode: Minimum')).toHaveLength(2);
  expect(screen.queryByText(/\+0 ms/)).not.toBeInTheDocument();
});
