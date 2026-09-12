import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ICurveComparisonStatus } from 'common/curveComparison';
import EqModeSelect from 'renderer/components/EqModeSelect';

const mockSelect = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockError = jest.fn();
const mockReset = jest.fn().mockResolvedValue(undefined);
let mockStatus: ICurveComparisonStatus;

jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    isBlockingError: false,
    curveSmoothing: 'off',
    refreshState: mockRefresh,
    setGlobalError: mockError,
  }),
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
  open();
  ['Your EQ', 'Curves'].forEach((scope) => {
    expect(
      group(scope).getByRole('button', { name: 'Minimum' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(group(scope).getByRole('button', { name: 'Linear' })).toBeEnabled();
  });
  expect(screen.getByRole('button', { name: 'EQ mode' })).toHaveTextContent(
    'Normal',
  );
});

it('writes only the chosen phase scope and keeps the popup open', async () => {
  open();
  await pick('Your EQ', 'Linear');
  expect(mockSelect).toHaveBeenLastCalledWith('A', 'eq');
  expect(
    group('Curves').getByRole('button', { name: 'Minimum' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await pick('Curves', 'Linear');
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
  await pick('Curves', 'Linear');
  expect(mockSelect.mock.calls).toEqual([['A', 'eq']]);
  expect(group('Curves').getByRole('button', { name: 'Linear' })).toBeEnabled();
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
    group('Curves').getByRole('button', { name: 'Linear' }),
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
    screen.queryByRole('group', { name: 'Curves · Phase' }),
  ).not.toBeInTheDocument();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockSelect).not.toHaveBeenCalled();
});
