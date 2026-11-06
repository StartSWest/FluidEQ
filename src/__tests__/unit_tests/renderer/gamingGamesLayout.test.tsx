/* FluidEQ — GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGameProfile } from '../../../common/games';
import GamingGameRow from '../../../renderer/games/GamingGameRow';
import GamingGamesLayout from '../../../renderer/games/GamingGamesLayout';
import { I18nProvider } from '../../../renderer/utils/I18nContext';

const KEY = 'fluideq.gaming.gamesLayout';
class TestPointerEvent extends MouseEvent {
  pointerId = 1;
}

const open = () =>
  render(
    <I18nProvider>
      <GamingGamesLayout
        count={2}
        isOn
        list={<button type="button">Select game</button>}
      >
        <input aria-label="Game tuning" defaultValue="keep this edit" />
      </GamingGamesLayout>
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  Object.assign(window, { PointerEvent: TestPointerEvent });
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 800,
    width: 1200,
    height: 800,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

it('folds the game list without remounting or losing the editor, and remembers the fold', () => {
  const view = open();
  const editor = screen.getByLabelText('Game tuning');
  const game = screen.getByRole('button', { name: 'Select game' });
  fireEvent.change(editor, { target: { value: 'edited' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show game icons' }));
  // A fold changes the presentation, not the availability of other games.
  expect(screen.getByRole('button', { name: 'Select game' })).toBe(game);
  expect(game.closest('aside')).not.toHaveAttribute('inert');
  expect(game.closest('aside')).not.toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByLabelText('Game tuning')).toBe(editor);
  expect(editor).toHaveValue('edited');
  expect(screen.queryByRole('separator')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Show game names' }),
  ).toHaveAttribute('aria-expanded', 'false');
  view.unmount();
  open();
  expect(
    screen.getByRole('button', { name: 'Show game names' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Select game' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show game names' }));
  expect(
    screen.getByRole('button', { name: 'Select game' }),
  ).toBeInTheDocument();
});

it('writes the dragged width only on release, and persists the actual keyboard step', () => {
  open();
  const edge = screen.getByRole('separator', { name: 'Resize game list' });
  const writes = jest.spyOn(Storage.prototype, 'setItem');
  fireEvent.pointerDown(edge, { button: 0, clientX: 270 });
  fireEvent.pointerMove(edge, { clientX: 310 });
  fireEvent.pointerMove(edge, { clientX: 350 });
  expect(writes).not.toHaveBeenCalled();
  fireEvent.pointerUp(edge, { clientX: 350 });
  expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').width).toBe(350);
  fireEvent.keyDown(edge, { key: 'ArrowRight' });
  expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').width).toBe(374);
  fireEvent.doubleClick(edge);
  expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').width).toBe(270);
});

it('clamps oversized saved widths while damaged preferences cannot block opening', () => {
  localStorage.setItem(KEY, JSON.stringify({ width: 9000, collapsed: false }));
  const view = open();
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '100');
  view.unmount();
  localStorage.setItem(KEY, '{damaged');
  open();
  expect(
    screen.getByRole('button', { name: 'Show game icons' }),
  ).toBeInTheDocument();
});

const games: IGameProfile[] = [
  {
    id: 'first',
    name: 'First game',
    path: 'C:/Games/First',
    source: 'steam',
    presetId: '',
  },
  {
    id: 'second',
    name: 'Second game',
    path: 'C:/Games/Second',
    source: 'gog',
    presetId: '',
  },
];

const GamePicker = () => {
  const [selected, select] = useState(games[0].id);
  return (
    <GamingGamesLayout
      count={games.length}
      isOn
      list={games.map((game) => (
        <GamingGameRow
          key={game.id}
          game={game}
          profileName="Competitive"
          isTuned={false}
          isPlaying={game.id === 'second'}
          isSelected={game.id === selected}
          onSelect={() => select(game.id)}
        />
      ))}
    >
      <output aria-label="Selected game">{selected}</output>
    </GamingGamesLayout>
  );
};

it('keeps saved collapsed games named and selectable by keyboard without reopening the list', async () => {
  localStorage.setItem(KEY, JSON.stringify({ collapsed: true }));
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <GamePicker />
    </I18nProvider>,
  );
  const first = screen.getByRole('button', { name: /^First game/ });
  const second = screen.getByRole('button', { name: /^Second game/ });
  expect(first).toHaveAttribute('title', 'First game');
  expect(second).toHaveAttribute('title', 'Second game');
  expect(first).toHaveAttribute('aria-current', 'true');
  expect(screen.queryByRole('separator')).toBeNull();

  await user.tab();
  expect(screen.getByRole('button', { name: 'Show game names' })).toHaveFocus();
  await user.tab();
  expect(first).toHaveFocus();
  await user.tab();
  expect(second).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(second).toHaveAttribute('aria-current', 'true');
  expect(screen.getByLabelText('Selected game')).toHaveTextContent('second');
  expect(
    screen.getByRole('button', { name: 'Show game names' }),
  ).toHaveAttribute('aria-expanded', 'false');
  expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').collapsed).toBe(true);
});
