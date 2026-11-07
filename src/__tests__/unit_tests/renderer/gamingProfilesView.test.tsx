/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Gaming Lab's profiles page (Ivan, 2026-11-04): each card says what its
 * profile does, a search narrows the cards and the filters' counts, and an
 * empty place says how to fill it.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { translate } from '../../../common/i18n';
import type { IGameProfile } from '../../../common/games';
import GamingProfilesView from '../../../renderer/games/GamingProfilesView';

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate('en', key, vars);

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t }),
}));
jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ setGlobalError: jest.fn() }),
}));
jest.mock('../../../renderer/games/useGamingData', () => ({
  useYoursGamingProfiles: () => [],
  sayGamingProfilesChanged: jest.fn(),
}));
jest.mock('../../../renderer/utils/gamingApi', () => ({
  deleteGamingProfile: jest.fn(),
  renameGamingProfile: jest.fn(),
}));

const cardOf = (name: string): HTMLElement => {
  const heading = screen
    .getAllByText(name)
    .find((element) => element.classList.contains('gaming-profile__name'));
  const card = heading?.closest('article');
  if (!card) {
    throw new Error(`no card named ${name}`);
  }
  return card;
};

const neonDrift: IGameProfile = {
  id: 'game-1',
  name: 'Neon Drift',
  path: 'D:\\Games\\Neon Drift',
  source: 'steam',
  presetId: '',
  profileId: 'ready:competitive',
};

describe('the profiles page', () => {
  it('says on each card what its profile does, in the Game filter’s own numbers', () => {
    render(<GamingProfilesView games={[neonDrift]} onUse={jest.fn()} />);
    const competitive = within(cardOf('Competitive'));
    expect(competitive.getByText('Curve · Competitive')).toBeInTheDocument();
    // Lift 0.85 of Footsteps' 10 dB; the new factory pick leaves voices and
    // environment as mixed, rather than advertising background gain riding.
    // The page's text is matched with its spaces collapsed to one.
    expect(competitive.getByText(/^\+8\.5\sdB$/)).toBeInTheDocument();
    expect(competitive.getAllByText(/^0\sdB$/)).toHaveLength(2);
    expect(competitive.getByText('Pinpoint')).toBeInTheDocument();
    expect(
      competitive.getByText(/Neon Drift started from it/),
    ).toBeInTheDocument();
    // A title kept as it was mixed plays no curve, and says so.
    expect(
      within(cardOf('Alien: Isolation')).getByText(
        'No curve: as the game was mixed',
      ),
    ).toBeInTheDocument();
  });

  it('narrows the cards and the filters’ counts to a search, whatever its accents', () => {
    render(<GamingProfilesView games={[]} onUse={jest.fn()} />);
    const search = screen.getByRole('searchbox', {
      name: 'Search profiles and games',
    });
    fireEvent.change(search, { target: { value: 'VALORÁNT' } });
    // The title's own card, and the kind whose games name it.
    expect(
      screen
        .getAllByRole('article')
        .map(
          (card) => card.querySelector('.gaming-profile__name')?.textContent,
        ),
    ).toEqual(['Competitive', 'Valorant']);
    const filters = screen.getByRole('group', { name: 'Show' });
    expect(
      within(filters).getByRole('button', { name: /^All/ }),
    ).toHaveTextContent(/2$/);
    expect(
      within(filters).getByRole('button', { name: /^Competitive shooters/ }),
    ).toHaveTextContent(/1$/);
    // An empty Yours is only one the search left out: not shown.
    expect(screen.queryByText(/None yet/)).not.toBeInTheDocument();
  });

  it('says when nothing matches, and clears the search from there', () => {
    render(<GamingProfilesView games={[]} onUse={jest.fn()} />);
    const search = screen.getByRole('searchbox', {
      name: 'Search profiles and games',
    });
    fireEvent.change(search, { target: { value: 'zzzz' } });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(
      screen.getByText('No Gaming profile matches “zzzz”.'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Clear the search' })
        .pop() as HTMLElement,
    );
    expect(search).toHaveValue('');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(30);
  });

  it('says how to fill an empty Yours, and offers each profile for a game', () => {
    const onUse = jest.fn();
    render(<GamingProfilesView games={[]} onUse={onUse} />);
    expect(screen.getByText(/None yet\. Tune a game/)).toBeInTheDocument();
    fireEvent.click(
      within(cardOf('Battle royale')).getByRole('button', {
        name: 'Use for a game',
      }),
    );
    expect(onUse).toHaveBeenCalledWith('ready:battleRoyale');
  });
});
