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
    name: 'Use current visualizer as background',
  });
  expect(enable).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(enable);
  expect(onClick).toHaveBeenCalledTimes(1);

  rerender(<KaraokeGraphBackgroundButton isSelected onClick={onClick} />);
  const disable = screen.getByRole('button', {
    name: 'Turn off visualizer background',
  });
  expect(disable).toHaveAttribute('aria-pressed', 'true');
  expect(disable).toHaveAttribute('title', 'Turn off visualizer background');
  fireEvent.click(disable);
  expect(onClick).toHaveBeenCalledTimes(2);
});
