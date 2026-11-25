/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The reason a refused scene keeps in the Studio until it is sent again
 * (Ivan, 2026-11-11: "they hover and see the reason"), behind the "See why"
 * after the line that says the version was not approved: the admin's reason
 * in full, the date and what to do next, on a hover, on keyboard focus and
 * on a press. And the same refusal inside a picker row.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TSceneStandings } from '../../../common/sceneReviewStanding';
import SceneReviewBadge from '../../../renderer/plus/SceneReviewBadge';
import SceneReviewWhy from '../../../renderer/plus/SceneReviewWhy';

let mockStandings: TSceneStandings | undefined;
let mockLocale = 'en';
jest.mock('../../../renderer/plus/sceneReviewStore', () => ({
  useSceneReview: () => ({ notice: null, standings: mockStandings }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: mockLocale,
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const NOTE =
  'The white flash on every kick covers more than a quarter of the screen. Slow it to twice a second, then send it again.';

beforeEach(() => {
  mockLocale = 'en';
  mockStandings = {
    lake: {
      kind: 'rejected',
      version: 3,
      reason: 'flashing',
      reasonNotes: { en: NOTE },
      decidedAt: '2026-11-11T09:00:00Z',
    },
    ember: { kind: 'pending', version: 2, submittedAt: '2026-11-10T18:00:00Z' },
  };
});

const refusalOf = (sceneId: string) => {
  const standing = mockStandings?.[sceneId];
  if (standing?.kind !== 'rejected') {
    throw new Error(`no refusal for ${sceneId}`);
  }
  return standing;
};

const panelText = () => screen.getByRole('dialog').textContent ?? '';

describe('a refused scene', () => {
  it('says the admin’s line in the maker’s own language', () => {
    const german =
      'Der weiße Blitz bei jedem Kick bedeckt mehr als ein Viertel des Bildes.';
    mockLocale = 'de';
    mockStandings = {
      lake: {
        kind: 'rejected',
        version: 3,
        reason: 'flashing',
        reasonNotes: { en: NOTE, de: german },
        decidedAt: '2026-11-11T09:00:00Z',
      },
    };
    render(<SceneReviewWhy refusal={refusalOf('lake')} />);
    fireEvent.pointerEnter(
      screen.getByRole('button', { name: 'studio.line.seeWhy' }),
    );
    expect(panelText()).toContain(german);
    expect(panelText()).not.toContain(NOTE);
  });

  it('opens the reason in full, the date and the next step on a hover', () => {
    render(<SceneReviewWhy refusal={refusalOf('lake')} />);
    const mark = screen.getByRole('button', { name: 'studio.line.seeWhy' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.pointerEnter(mark);
    expect(panelText()).toContain('review.reason.flashing');
    expect(panelText()).toContain(NOTE);
    expect(panelText()).toContain('review.mark.rejectedOn:Nov 11, 2026');
    expect(panelText()).toContain('review.next');
    fireEvent.pointerLeave(mark);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on keyboard focus, and a press keeps it open to be read', async () => {
    render(<SceneReviewWhy refusal={refusalOf('lake')} />);
    const mark = screen.getByRole('button', { name: 'studio.line.seeWhy' });
    act(() => mark.focus());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => mark.blur());
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(mark);
    fireEvent.pointerLeave(mark);
    act(() => mark.blur());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mark).toHaveAttribute('aria-expanded', 'true');
  });
});

it('says the whole refusal as its name where it sits inside a picker row', () => {
  render(<SceneReviewBadge sceneId="lake" />);
  const badge = screen.getByRole('img');
  const name = badge.getAttribute('aria-label') ?? '';
  expect(name).toContain('review.reason.flashing');
  expect(name).toContain(NOTE);
  expect(name).toContain('review.next');
  expect(badge).toHaveAttribute('title', name);
  // Never a control inside the row's own button.
  expect(screen.queryByRole('button')).toBeNull();
});
