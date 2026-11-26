/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amber box under the Studio's stage that says a version will load
 * slowly on Windows (`StudioCompileNotes.tsx`): a status, never an alert —
 * the version plays — with the line of each note. Absent for a version that
 * reads clean, and while there is no version on the stage.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import StudioCompileNotes from '../../../renderer/studio/StudioCompileNotes';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

const SLOW = `struct Card { vec4 rect; vec2 q; float depth; float kind; float info; float below; float wide; };
Card card0, card1, card2;
int cardCount = 0;
void offer(Card c) {
  int n = cardCount;
  if (n == 0) { card0 = c; }
  else {
    if (c.depth < card0.depth) { Card t = card0; card0 = c; c = t; }
    if (n == 1) { card1 = c; }
    else {
      if (c.depth < card1.depth) { Card t = card1; card1 = c; c = t; }
      if (n == 2 || c.depth < card2.depth) card2 = c;
    }
  }
  cardCount = min(n + 1, 3);
}
vec4 sceneColour(vec2 uv) {
${[0, 1, 2, 3].map((k) => `  offer(Card(vec4(${k}.0), uv, uv.x * ${k}.5, 0.0, 0.0, -1.0, 1.0));`).join('\n')}
  return card0.rect;
}
`;

it('lists each note with its line, as a status beside the stage', () => {
  render(<StudioCompileNotes source={SLOW} />);
  const box = screen.getByRole('status');
  expect(box).toHaveClass('studio-problems', 'studio-problems--advice');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(box).getByText('studio.compileNote.heading'),
  ).toBeInTheDocument();
  expect(
    within(box).getByText(
      'studio.problem.line {"file":"studio.file.source","line":4}',
    ),
  ).toBeInTheDocument();
  expect(
    within(box).getByText(
      'studio.compileNote.nearest-offers {"name":"offer","sites":4}',
    ),
  ).toBeInTheDocument();
  expect(within(box).getByText('studio.compileNote.hint')).toBeInTheDocument();
});

it('shows nothing for a version that reads clean', () => {
  const { container } = render(
    <StudioCompileNotes source="vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }" />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('shows nothing while no version is on the stage', () => {
  const { container } = render(<StudioCompileNotes source={undefined} />);
  expect(container).toBeEmptyDOMElement();
});
