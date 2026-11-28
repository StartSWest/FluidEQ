/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp's sound section as refreshed on 2026-11-27 (Ivan: "same order as
 * in the full app", "we save space for your EQ and tone there"): the EQ
 * page's tabs in its head, Your EQ before the Tone; the fold at the head's
 * end; the page's tools under the faders, in the page's order; and the pet's
 * switch, remembered.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { MAX_FREQUENCY, MIN_FREQUENCY } from 'common/constants';
import { requestAutoEqOpen } from 'renderer/eq/autoEq/autoEqOpen';
import freeBandFrequency from 'renderer/eq/freeBandFrequency';
import PlayerSound from 'renderer/player/PlayerSound';
import {
  setPlayerPetShown,
  usePlayerPetShown,
} from 'renderer/player/playerPet';

jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ filters: { a: {}, b: {}, c: {} } }),
  useFluidEqLayers: () => ({ tone: undefined, eqCuts: undefined }),
}));

jest.mock('renderer/utils/useEqualizerPower', () => ({
  __esModule: true,
  default: () => ({
    isEnabled: true,
    isBlockingError: false,
    toggle: () => Promise.resolve(),
  }),
}));

// The controls the rows hold, as their names alone: what is under test is
// where each one stands, not what it does. A declaration, so it is there
// when the hoisted mocks first build their modules.
function mockStub(name: string) {
  return {
    __esModule: true,
    default: () => <span data-tool={name} />,
  };
}
jest.mock('renderer/components/VoicingQuickPick', () => mockStub('preset'));
jest.mock('renderer/player/MiniBands', () => mockStub('faders'));
jest.mock('renderer/player/PlayerTone', () => mockStub('dials'));
jest.mock('renderer/components/BandLayoutMenu', () => mockStub('count'));
jest.mock('renderer/player/PlayerAddBand', () => mockStub('add'));
jest.mock('renderer/components/ClearEqButton', () => mockStub('clear'));
jest.mock('renderer/eq/autoEq/SavedEqKeys', () => mockStub('saved EQs'));
// The Curves menu as its way to a headphone correction alone, to see where
// the amp sends it.
jest.mock('renderer/components/CurvesPicker', () => ({
  __esModule: true,
  default: ({ onAddCorrection }: { onAddCorrection?: () => void }) => (
    <button type="button" data-tool="curves" onClick={onAddCorrection}>
      Add a headphone correction
    </button>
  ),
}));
// The menu, never the EQ page's pinnable one: pinned, that one opens a card
// in the full app's sound panel, which the amp does not have.
jest.mock('renderer/components/EqModeSelect', () => mockStub('mode'));
jest.mock('renderer/components/eqMode/EqPageModeSelect', () =>
  mockStub('pinnable mode'),
);
jest.mock('renderer/eq/autoEq/AutoEqButton', () => mockStub('auto eq'));
jest.mock('renderer/player/useRowNeed', () => ({
  __esModule: true,
  default: () => undefined,
}));

const toolsIn = (row: Element) =>
  [...row.querySelectorAll('[data-tool]')].map((tool) =>
    tool.getAttribute('data-tool'),
  );

beforeEach(() => {
  window.localStorage.clear();
});

describe('the amp’s sound rows', () => {
  it('has Your EQ before the Tone in its head, each saying what it holds, and the fold at the end', () => {
    const { container } = render(<PlayerSound onOpenPage={() => undefined} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Your EQ3', 'ToneOff']);
    const head = container.querySelector('.player-sound__head');
    expect(head?.lastElementChild).toHaveClass('player-sound__fold');
  });

  it('opens the tab pressed, and the drawer with it', () => {
    const { container } = render(<PlayerSound onOpenPage={() => undefined} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fold the sound controls' }),
    );
    expect(container.querySelector('.player-sound')).toHaveClass('is-folded');
    fireEvent.click(screen.getByRole('tab', { name: /Tone/ }));
    expect(container.querySelector('.player-sound')).not.toHaveClass(
      'is-folded',
    );
    expect(screen.getByRole('tab', { name: /Tone/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(container.querySelector('[data-tool="dials"]')).toBeInTheDocument();
    // The face is remembered for the window: back to the faders for the next.
    fireEvent.click(screen.getByRole('tab', { name: /Your EQ/ }));
  });

  it('lays the EQ page’s tools under the faders in the page’s order, Auto EQ at the end', () => {
    const { container } = render(<PlayerSound onOpenPage={() => undefined} />);
    const row = container.querySelector('.player-sound__tools');
    expect(row).not.toBeNull();
    expect(toolsIn(row as Element)).toEqual([
      'count',
      'add',
      'clear',
      'saved EQs',
      'curves',
      'mode',
      'auto eq',
    ]);
  });
});

describe('what the amp’s tools open', () => {
  it('takes the way to a headphone correction back to the full app’s page for it', () => {
    const opened: string[] = [];
    render(<PlayerSound onOpenPage={(page) => opened.push(page)} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Add a headphone correction' }),
    );
    expect(opened).toEqual(['presets']);
  });

  // The sound on the song's card asks for Auto EQ: the amp answers it itself,
  // with its section open, rather than sending the listener to the full app.
  it('unfolds the section when Auto EQ is asked for, on the face it was on', () => {
    const { container } = render(<PlayerSound onOpenPage={() => undefined} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fold the sound controls' }),
    );
    expect(container.querySelector('.player-sound')).toHaveClass('is-folded');
    act(() => {
      requestAutoEqOpen();
    });
    expect(container.querySelector('.player-sound')).not.toHaveClass(
      'is-folded',
    );
    expect(screen.getByRole('tab', { name: /Your EQ/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('where a band added with nothing selected goes', () => {
  it('is 1 kHz when it is free', () => {
    expect(freeBandFrequency(new Set([100, 2000]))).toBe(1000);
  });

  it('is the first free hertz above 1 kHz, then below it', () => {
    expect(freeBandFrequency(new Set([1000, 1001]))).toBe(1002);
    const above = new Set<number>();
    for (let hz = 1000; hz <= MAX_FREQUENCY; hz += 1) {
      above.add(hz);
    }
    expect(freeBandFrequency(above)).toBe(999);
  });

  it('is nowhere when every hertz is taken', () => {
    const all = new Set<number>();
    for (let hz = MIN_FREQUENCY; hz <= MAX_FREQUENCY; hz += 1) {
      all.add(hz);
    }
    expect(freeBandFrequency(all)).toBeUndefined();
  });
});

describe('the pet’s switch', () => {
  it('shows her until she is hidden, and remembers it', () => {
    const { result } = renderHook(() => usePlayerPetShown());
    expect(result.current).toBe(true);
    act(() => setPlayerPetShown(false));
    expect(result.current).toBe(false);
    expect(window.localStorage.getItem('fluideq.player.petShown')).toBe(
      'false',
    );
    act(() => setPlayerPetShown(true));
    expect(result.current).toBe(true);
  });
});
