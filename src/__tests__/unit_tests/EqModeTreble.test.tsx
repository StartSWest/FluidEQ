/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ mode menu's Treble row, Precise or Classic for each group.
 *
 * Offered only where it changes something: under the FluidEQ Engine, and
 * chosen only on an engine that reads the choice — an older one plays what it
 * always did, and the row says so rather than offering a switch that changes
 * nothing. What it shows is what the engine's folder holds once a choice has
 * landed, never the click.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { IAudioEngineStatus } from 'common/audioEngine';
import type {
  ITrebleDesigns,
  TTrebleDesign,
  TTrebleScope,
} from 'common/filterDesign';
import EqModeSelect from 'renderer/components/EqModeSelect';
import { resetTrebleDesigns } from 'renderer/utils/useTrebleDesigns';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockError = jest.fn();
const mockReset = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn();
let mockFiles: ITrebleDesigns;
let mockEngine: IAudioEngineStatus | undefined;

jest.mock('renderer/utils/useListenedOutput', () => ({
  useListenedOutput: () => ({ output: undefined }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isBlockingError: false,
    curveSmoothing: 'off',
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
  default: () => ({ status: undefined, select: jest.fn() }),
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () => mockEngine,
}));
jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ ...mockFiles }),
  setTrebleDesign: (choice: TTrebleDesign, scope: TTrebleScope) =>
    mockSet(choice, scope),
}));

const engine = (
  kind: 'fluid' | 'apo',
  dllVersion = '1.14.0.0',
): IAudioEngineStatus => ({
  engine: kind,
  apo: { installed: kind === 'apo' },
  fluid: { installed: kind === 'fluid', endpoints: [], dllVersion },
  fluidSupported: true,
  fluidUpdateReady: false,
});

const row = (group: string) =>
  within(screen.getByRole('group', { name: `${group} · Treble` }));
const pressed = (group: string, choice: string) =>
  row(group).getByRole('button', { name: choice });
const open = async () => {
  render(<EqModeSelect />);
  // The choice comes from main after the first render.
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'EQ mode' }));
};
const pick = async (group: string, choice: string) => {
  await act(async () =>
    fireEvent.click(row(group).getByRole('button', { name: choice })),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  resetTrebleDesigns();
  mockFiles = { eq: 'precise', curves: 'precise' };
  mockEngine = engine('fluid');
  mockSet.mockImplementation(
    async (choice: TTrebleDesign, scope: TTrebleScope) => {
      mockFiles = { ...mockFiles, [scope]: choice };
      return { ...mockFiles };
    },
  );
});

it('is not offered under Equalizer APO, which has only the cookbook', async () => {
  mockEngine = engine('apo');
  await open();
  expect(
    screen.queryByRole('group', { name: 'Your EQ · Treble' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Corrections · Treble' }),
  ).not.toBeInTheDocument();
  // POSITIVE CONTROL: the menu itself is open, with the rows it always has.
  expect(
    screen.getByRole('group', { name: 'Your EQ · Band Q' }),
  ).toBeInTheDocument();
});

it('shows what an older engine plays, and asks for the update instead of offering a switch', async () => {
  mockEngine = engine('fluid', '1.13.0.0');
  // That engine reads no choice, so a file left saying Classic changes nothing.
  mockFiles = { eq: 'classic', curves: 'classic' };
  await open();
  ['Your EQ', 'Corrections'].forEach((group) => {
    expect(pressed(group, 'Precise')).toHaveAttribute('aria-pressed', 'true');
    expect(pressed(group, 'Precise')).toBeDisabled();
    expect(pressed(group, 'Classic')).toBeDisabled();
  });
  expect(
    screen.getAllByText(
      'Update the FluidEQ Engine to choose how treble plays.',
    ),
  ).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'EQ mode' })).toHaveTextContent(
    'Normal',
  );
});

it('shows each group as its file says, and calls the menu custom when one is Classic', async () => {
  mockFiles = { eq: 'classic', curves: 'precise' };
  await open();
  expect(pressed('Your EQ', 'Classic')).toHaveAttribute('aria-pressed', 'true');
  expect(pressed('Corrections', 'Precise')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    screen.getByText(/^Classic: the way Equalizer APO plays them\./),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/^Precise: your headphone correction plays exactly/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'EQ mode' })).toHaveTextContent(
    'Custom',
  );
});

it('writes only the group picked, and the row follows what landed', async () => {
  await open();
  await pick('Corrections', 'Classic');
  expect(mockSet.mock.calls).toEqual([['classic', 'curves']]);
  expect(pressed('Corrections', 'Classic')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(pressed('Your EQ', 'Precise')).toHaveAttribute('aria-pressed', 'true');
  expect(
    screen.getByText(
      /^Classic: the way Equalizer APO plays them, and the way AutoEQ tunes/,
    ),
  ).toBeInTheDocument();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('puts every Classic group back to Precise on Reset, one after the other', async () => {
  mockFiles = { eq: 'classic', curves: 'classic' };
  let finishEq = () => {};
  mockSet.mockImplementationOnce(
    (choice: TTrebleDesign, scope: TTrebleScope) =>
      new Promise<ITrebleDesigns>((resolve) => {
        finishEq = () => {
          mockFiles = { ...mockFiles, [scope]: choice };
          resolve({ ...mockFiles });
        };
      }),
  );
  await open();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockReset).toHaveBeenCalledTimes(1);
  // Each answer reads both files back: the second write waits for the first.
  expect(mockSet.mock.calls).toEqual([['precise', 'eq']]);
  await act(async () => finishEq());
  expect(mockSet.mock.calls).toEqual([
    ['precise', 'eq'],
    ['precise', 'curves'],
  ]);
  ['Your EQ', 'Corrections'].forEach((group) =>
    expect(pressed(group, 'Precise')).toHaveAttribute('aria-pressed', 'true'),
  );
});

it('leaves a group already on Precise alone on Reset', async () => {
  mockFiles = { eq: 'precise', curves: 'classic' };
  await open();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockSet.mock.calls).toEqual([['precise', 'curves']]);
});

it('does not keep a choice that failed to land', async () => {
  const failure = new Error('write refused');
  mockSet.mockRejectedValueOnce(failure);
  await open();
  await pick('Your EQ', 'Classic');
  expect(mockError).toHaveBeenCalledWith(failure);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(pressed('Your EQ', 'Precise')).toHaveAttribute('aria-pressed', 'true');
});
