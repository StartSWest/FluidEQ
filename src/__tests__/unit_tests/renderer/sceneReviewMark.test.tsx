/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The warning a refused scene keeps beside its name in the Studio until it is
 * sent again (Ivan, 2026-11-11: "like with a warning icon, they hover and see
 * the reason"): the admin's reason in full, the date and what to do next, on
 * a hover, on keyboard focus and on a press; a quiet clock while it waits;
 * nothing for a scene the review has nothing to say about.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TSceneStandings } from '../../../common/sceneReviewStanding';
import SceneReviewBadge from '../../../renderer/plus/SceneReviewBadge';
import SceneReviewMark from '../../../renderer/plus/SceneReviewMark';

let mockStandings: TSceneStandings | undefined;
jest.mock('../../../renderer/plus/sceneReviewStore', () => ({
  useSceneReview: () => ({ notice: null, standings: mockStandings }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const NOTE =
  'The white flash on every kick covers more than a quarter of the screen. Slow it to twice a second, then send it again.';

beforeEach(() => {
  mockStandings = {
    lake: {
      kind: 'rejected',
      version: 3,
      reason: 'flashing',
      reasonNote: NOTE,
      decidedAt: '2026-11-11T09:00:00Z',
    },
    ember: { kind: 'pending', version: 2, submittedAt: '2026-11-10T18:00:00Z' },
  };
});

const panelText = () => screen.getByRole('dialog').textContent ?? '';

describe('a refused scene', () => {
  it('opens the reason in full, the date and the next step on a hover', () => {
    render(<SceneReviewMark sceneId="lake" />);
    const mark = screen.getByRole('button', { name: 'review.mark.show' });
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
    render(<SceneReviewMark sceneId="lake" />);
    const mark = screen.getByRole('button', { name: 'review.mark.show' });
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

it('shows a quiet clock while a scene waits, and nothing without a word', () => {
  const { rerender } = render(<SceneReviewMark sceneId="ember" />);
  expect(
    screen.getByRole('img', { name: 'review.mark.pending' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
  // The control: a scene the review has nothing to say about wears nothing.
  rerender(<SceneReviewMark sceneId="dune" />);
  expect(screen.queryByRole('img')).toBeNull();
  rerender(<SceneReviewMark sceneId={undefined} />);
  expect(screen.queryByRole('img')).toBeNull();
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
