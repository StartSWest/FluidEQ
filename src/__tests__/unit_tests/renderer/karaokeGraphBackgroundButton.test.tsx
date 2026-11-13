/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import KaraokeGraphBackgroundButton from 'renderer/karaoke/KaraokeGraphBackgroundButton';

afterEach(cleanup);

it('keeps the actual background switch label, pressed state and action together', () => {
  const onClick = jest.fn();
  const { rerender } = render(
    <KaraokeGraphBackgroundButton isSelected={false} onClick={onClick} />,
  );
  const enable = screen.getByRole('button', {
    name: "Use the graph's scene or style as background",
  });
  expect(enable).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(enable);
  expect(onClick).toHaveBeenCalledTimes(1);

  rerender(<KaraokeGraphBackgroundButton isSelected onClick={onClick} />);
  const disable = screen.getByRole('button', {
    name: 'Turn off the scene background',
  });
  expect(disable).toHaveAttribute('aria-pressed', 'true');
  expect(disable).toHaveAttribute('title', 'Turn off the scene background');
  fireEvent.click(disable);
  expect(onClick).toHaveBeenCalledTimes(2);
});
