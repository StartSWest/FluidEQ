import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import en from 'common/i18n/en';
import { TEqMode } from 'common/eqMode';
import { TBandQ, TCurveSmoothing } from 'common/eqShape';
import EqModeSelect from 'renderer/components/EqModeSelect';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockError = jest.fn();
const mockSetShape = jest.fn().mockResolvedValue(undefined);
const mockSetMode = jest.fn().mockResolvedValue(undefined);
const mockReset = jest.fn().mockResolvedValue(undefined);
const mockWorld: {
  eqMode?: TEqMode;
  curveEqMode?: TEqMode;
  eqBandQ?: TBandQ;
  curveBandQ?: TBandQ;
  curveSmoothing?: TCurveSmoothing;
  isEqDoubleOn: boolean;
  isBlockingError: boolean;
} = {
  isEqDoubleOn: false,
  isBlockingError: false,
};

jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    ...mockWorld,
    refreshState: mockRefresh,
    setGlobalError: mockError,
  }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  resetEqMode: () => mockReset(),
  setEqMode: (...args: unknown[]) => mockSetMode(...args),
  setEqShape: (...args: unknown[]) => mockSetShape(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockWorld.eqMode = undefined;
  mockWorld.curveEqMode = undefined;
  mockWorld.eqBandQ = undefined;
  mockWorld.curveBandQ = undefined;
  mockWorld.curveSmoothing = undefined;
  mockWorld.isEqDoubleOn = false;
  mockWorld.isBlockingError = false;
  mockSetMode.mockResolvedValue(undefined);
  mockReset.mockResolvedValue(undefined);
});

it('resets all mode settings once and keeps the menu open', async () => {
  mockWorld.eqMode = 'double';
  render(<EqModeSelect />);
  fireEvent.click(menu());
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockSetMode).not.toHaveBeenCalled();
  expect(mockSetShape).not.toHaveBeenCalled();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('replaces queued choices with reset after the active write completes', async () => {
  let finish!: () => void;
  mockSetMode.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<EqModeSelect />);
  await pick('×2');
  await pick(`${en['eq.mode.studio']} · ×1.5`);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(mockReset).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockSetMode).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('reports reset failures without closing the menu', async () => {
  const error = new Error('reset failed');
  mockReset.mockRejectedValueOnce(error);
  render(<EqModeSelect />);
  fireEvent.click(menu());
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })),
  );
  expect(mockError).toHaveBeenCalledWith(error);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

const menu = () => screen.getByRole('button', { name: en['eq.mode'] });
const pick = async (label: string) => {
  if (!screen.queryByRole('dialog')) {
    fireEvent.click(menu());
  }
  await act(async () => {
    fireEvent.click(
      within(
        screen.getByRole('group', { name: en['eq.mode.yourEq'] }),
      ).getByRole('button', { name: label }),
    );
  });
};

it('uses the existing dropdown with Normal, EQ ×2, and Studio choices', async () => {
  render(<EqModeSelect />);
  expect(menu()).toHaveTextContent('Normal');
  expect(menu().querySelectorAll('svg')).toHaveLength(1);
  fireEvent.click(menu());
  expect(
    within(screen.getByRole('group', { name: en['eq.mode.yourEq'] }))
      .getAllByRole('button')
      .map((item) => item.textContent),
  ).toEqual([en['eq.mode.normal'], `${en['eq.mode.studio']} · ×1.5`, '×2']);
  await act(async () =>
    fireEvent.click(
      within(
        screen.getByRole('group', { name: en['eq.mode.yourEq'] }),
      ).getByRole('button', { name: '×2' }),
    ),
  );
  expect(mockSetMode).toHaveBeenCalledWith('double', 'eq');
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it('switches a legacy doubled setting to Studio, then back to Normal', async () => {
  mockWorld.isEqDoubleOn = true;
  const { rerender } = render(<EqModeSelect />);
  expect(menu()).toHaveTextContent('Custom');
  await pick(`${en['eq.mode.studio']} · ×1.5`);
  expect(mockSetMode).toHaveBeenLastCalledWith('studio', 'eq');
  mockWorld.eqMode = 'studio';
  rerender(<EqModeSelect />);
  expect(menu()).toHaveTextContent('Custom');
  await pick(en['eq.mode.normal']);
  expect(mockSetMode).toHaveBeenLastCalledWith('normal', 'eq');
});

it('refuses blocked writes but keeps choices clickable while serializing requests', async () => {
  mockWorld.isBlockingError = true;
  const { rerender } = render(<EqModeSelect />);
  fireEvent.click(menu());
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(mockSetMode).not.toHaveBeenCalled();
  mockWorld.isBlockingError = false;
  let finish: () => void = () => undefined;
  mockSetMode.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  rerender(<EqModeSelect />);
  await pick(`${en['eq.mode.studio']} · ×1.5`);
  expect(
    within(screen.getByRole('group', { name: en['eq.mode.curves'] }))
      .getAllByRole('button')
      .every((button) => !button.hasAttribute('disabled')),
  ).toBe(true);
  fireEvent.click(menu());
  expect(mockSetMode).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(menu()).not.toBeDisabled();
  await pick('×2');
  expect(mockSetMode).toHaveBeenCalledTimes(2);
});

it('reports a failed write without pretending the mode changed', async () => {
  const error = new Error('write failed');
  mockSetMode.mockRejectedValueOnce(error);
  render(<EqModeSelect />);
  await pick(`${en['eq.mode.studio']} · ×1.5`);
  expect(mockError).toHaveBeenCalledWith(error);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(menu()).not.toHaveTextContent('×1.5');
  expect(
    within(screen.getByRole('group', { name: 'Your EQ' })).getByRole('button', {
      name: 'Normal',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(menu()).not.toBeDisabled();
});
it('keeps both groups open and sends only the selected scope', async () => {
  mockWorld.eqMode = 'double';
  mockWorld.curveEqMode = 'normal';
  render(<EqModeSelect />);
  fireEvent.click(menu());
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  const own = within(screen.getByRole('group', { name: en['eq.mode.yourEq'] }));
  const curves = within(
    screen.getByRole('group', { name: en['eq.mode.curves'] }),
  );
  expect(own.getByRole('button', { name: '×2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    curves.getByRole('button', { name: en['eq.mode.normal'] }),
  ).toHaveAttribute('aria-pressed', 'true');
  await act(async () =>
    fireEvent.click(
      curves.getByRole('button', { name: `${en['eq.mode.studio']} · ×1.5` }),
    ),
  );
  expect(mockSetMode).toHaveBeenCalledWith('studio', 'curves');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(own.getByRole('button', { name: '×2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(menu()).toHaveFocus();
  fireEvent.click(menu());
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('shows a persistent selection check and pending state without confusing hover with selection', async () => {
  render(<EqModeSelect />);
  fireEvent.click(menu());
  const group = screen.getByRole('group', { name: 'Your EQ · Band Q' });
  const constant = within(group).getByRole('button', { name: 'Constant' });
  const asymmetric = within(group).getByRole('button', { name: 'Asymmetric' });
  expect(constant).toHaveAttribute('aria-pressed', 'true');
  expect(constant.querySelector('.eq-mode-choice__mark svg')).not.toBeNull();
  fireEvent.mouseOver(asymmetric);
  expect(asymmetric).toHaveAttribute('aria-pressed', 'false');
  let finish: () => void = () => undefined;
  mockSetShape.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => fireEvent.click(asymmetric));
  expect(mockSetShape).toHaveBeenCalledWith('eq', 'q', 'asymmetric');
  expect(asymmetric).not.toBeDisabled();
  expect(asymmetric).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => finish());
  expect(asymmetric).not.toBeDisabled();
  expect(screen.getByRole('dialog')).toBeVisible();
  await act(async () =>
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Curves · Curve smoothing' }),
      ).getByRole('button', { name: '1/3 octave' }),
    ),
  );
  expect(mockSetShape).toHaveBeenLastCalledWith('curves', 'smoothing', 'third');
});
it('keeps only the latest queued choice per row without losing another group', async () => {
  let finish: () => void = () => undefined;
  mockSetMode.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  render(<EqModeSelect />);
  await pick('Studio · ×1.5');
  await pick('×2');
  await pick('Normal');
  await act(async () =>
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Curves' })).getByRole(
        'button',
        { name: '×2' },
      ),
    ),
  );
  expect(mockSetMode.mock.calls).toEqual([['studio', 'eq']]);
  await act(async () => finish());
  expect(mockSetMode.mock.calls).toEqual([
    ['studio', 'eq'],
    ['normal', 'eq'],
    ['double', 'curves'],
  ]);
  expect(mockRefresh).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('offers Constant instead of Off in both Q groups without removing smoothing Off', () => {
  render(<EqModeSelect />);
  fireEvent.click(menu());
  ['Your EQ', 'Curves'].forEach((scope) => {
    const group = within(
      screen.getByRole('group', { name: `${scope} · Band Q` }),
    );
    expect(group.getAllByRole('button')).toHaveLength(3);
    expect(group.getByRole('button', { name: 'Constant' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      group.queryByRole('button', { name: 'Off' }),
    ).not.toBeInTheDocument();
    expect(group.getByRole('button', { name: 'Proportional' })).toBeVisible();
    expect(group.getByRole('button', { name: 'Asymmetric' })).toBeVisible();
  });
  expect(
    within(
      screen.getByRole('group', { name: 'Curves · Curve smoothing' }),
    ).getByRole('button', { name: 'Off' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(menu()).toHaveTextContent('Normal');
});

it.each([
  { eqMode: 'double' as const },
  { curveEqMode: 'studio' as const },
  { eqBandQ: 'proportional' as const },
  { curveBandQ: 'asymmetric' as const },
  { curveSmoothing: 'third' as const },
])('shows a compact Custom summary for %j', (settings) => {
  Object.assign(mockWorld, settings);
  const { rerender } = render(<EqModeSelect />);
  expect(menu()).toHaveTextContent('Custom');
  expect(menu().querySelectorAll('svg')).toHaveLength(1);
  Object.assign(mockWorld, {
    eqMode: 'normal',
    curveEqMode: 'normal',
    eqBandQ: 'off',
    curveBandQ: 'off',
    curveSmoothing: 'off',
  });
  rerender(<EqModeSelect />);
  expect(menu()).toHaveTextContent('Normal');
  expect(menu()).not.toHaveTextContent('Custom');
});
