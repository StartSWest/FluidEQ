import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

let isBackdrop = false;

jest.mock('renderer/utils/useIsBackdrop', () => ({
  __esModule: true,
  default: () => isBackdrop,
}));
jest.mock('renderer/player/StageAmp', () => ({
  __esModule: true,
  default: () => <div data-testid="stage-amp" />,
}));
jest.mock('renderer/player/classic/ClassicAmp', () => ({
  __esModule: true,
  default: () => <div data-testid="classic-amp" />,
}));

// eslint-disable-next-line import/first
import MiniPlayer from 'renderer/player/MiniPlayer';

afterEach(() => {
  isBackdrop = false;
});

describe('which amp the window is', () => {
  it('is the 2.0 amp in every mode but the Backdrop', () => {
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(screen.getByTestId('classic-amp')).toBeInTheDocument();
    expect(screen.queryByTestId('stage-amp')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('classic');
    unmount();
  });

  it('is the Stage while the Backdrop is drawn', () => {
    isBackdrop = true;
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(screen.getByTestId('stage-amp')).toBeInTheDocument();
    expect(screen.queryByTestId('classic-amp')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('stage');
    unmount();
  });

  it('follows the mode as it changes, and leaves no word behind', () => {
    const { rerender, unmount } = render(
      <MiniPlayer onOpenPage={() => undefined} />,
    );
    expect(document.documentElement.dataset.amp).toBe('classic');
    isBackdrop = true;
    act(() => rerender(<MiniPlayer onOpenPage={() => undefined} />));
    expect(screen.getByTestId('stage-amp')).toBeInTheDocument();
    expect(document.documentElement.dataset.amp).toBe('stage');
    unmount();
    // The window is the app again: neither amp's stylesheet applies.
    expect(document.documentElement.dataset.amp).toBeUndefined();
  });
});
