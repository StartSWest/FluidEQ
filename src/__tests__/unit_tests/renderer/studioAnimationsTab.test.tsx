/**
 * The Studio's Animations tab (`StudioAnimations`): every animation as a
 * card, one opened to step through its frames and try on a ground, and the
 * same view over the Studio to see it bigger - one player for both, so
 * closing the larger view leaves the animation on the frame it was on.
 */
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import useAnimationPlayer from '../../../renderer/studio/animations/useAnimationPlayer';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const viewed = (
  name: string,
  count: number,
  readable = true,
): IViewedAnimation => {
  const animation = readStudioAnimation(name, {
    sheet: `art/${name}.png`,
    count,
    columns: 3,
    fps: 8,
    ground: 'ground',
  });
  if (!animation) {
    throw new Error('the animation did not read');
  }
  return {
    animation,
    aspect: 1.6,
    feetLine: 0.9,
    ...(readable
      ? {
          bitmap: {
            width: 300,
            height: 200,
            close: jest.fn(),
          } as unknown as ImageBitmap,
        }
      : {}),
  };
};

/** The frame the stage says it shows, from its chip. */
const shownFrame = (within_: HTMLElement = document.body) =>
  within(within_)
    .getAllByText(/studio\.animation\.frameOf/)
    .map(
      (chip) =>
        JSON.parse(chip.textContent?.replace(/^\S+ /, '') ?? '{}').frame,
    )[0];

beforeAll(() => {
  // jsdom lays nothing out, so it has nothing to scroll into view.
  Element.prototype.scrollIntoView = jest.fn();
});

describe('the Animations tab', () => {
  it('shows a card for every animation, and the way to ask for another', () => {
    render(
      <StudioAnimations
        animations={[viewed('fox-trot', 6), viewed('wolf-walk', 8)]}
      />,
    );
    expect(screen.getByText('fox-trot')).toBeInTheDocument();
    expect(screen.getByText('wolf-walk')).toBeInTheDocument();
    expect(
      screen.getByText('studio.animation.meta {"count":8,"fps":8}'),
    ).toBeInTheDocument();
    expect(screen.getByText('studio.animation.askTitle')).toBeInTheDocument();
  });

  it('says so of a sheet it could not read, and keeps it closed', () => {
    render(<StudioAnimations animations={[viewed('broken', 4, false)]} />);
    expect(screen.getByText('studio.animation.unreadable')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    expect(
      screen.queryByRole('button', { name: 'studio.animation.next' }),
    ).toBeNull();
  });

  it('opens an animation to step through, and goes back to the cards', () => {
    render(<StudioAnimations animations={[viewed('wolf-walk', 8)]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    // A frame picked from the strip, then a step on and two back: each stops
    // it on the frame stepped to, wrapping round the cycle.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'studio.animation.frame {"frame":8}',
      }),
    );
    expect(shownFrame()).toBe(8);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.next' }),
    );
    expect(shownFrame()).toBe(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.previous' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.previous' }),
    );
    expect(shownFrame()).toBe(7);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.back' }),
    );
    expect(screen.getByText('studio.animation.askTitle')).toBeInTheDocument();
  });

  it('tries the creature on the ground it belongs to, the sky or the water', () => {
    render(<StudioAnimations animations={[viewed('wolf-walk', 8)]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    const stage = screen.getByTestId('animation-stage');
    expect(stage).toHaveClass('is-ground');
    expect(
      screen.getByRole('group', { name: 'studio.animation.slope' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.ground.sky' }),
    );
    expect(stage).toHaveClass('is-sky');
    // A slope is for a ground only.
    expect(
      screen.queryByRole('group', { name: 'studio.animation.slope' }),
    ).toBeNull();
  });

  it('sees it bigger over the Studio, and comes back on the same frame', () => {
    render(<StudioAnimations animations={[viewed('wolf-walk', 8)]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /studio\.animation\.pause|studio\.animation\.play/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'studio.animation.frame {"frame":5}',
      }),
    );
    expect(shownFrame()).toBe(5);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.expand' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(shownFrame(dialog)).toBe(5);
    // The arrow keys step through the frames there.
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(shownFrame(dialog)).toBe(6);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'studio.animation.close' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shownFrame()).toBe(6);
  });

  it('closes the bigger view with Escape too', () => {
    render(<StudioAnimations animations={[viewed('wolf-walk', 8)]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /studio\.animation\.open/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animation.expand' }),
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('an animation playing', () => {
  let frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    frames = [];
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => frames.push(callback));
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  /** Paints a frame at `at` milliseconds. */
  const paint = (at: number) =>
    act(() => {
      const waiting = frames;
      frames = [];
      waiting.forEach((callback) => callback(at));
    });

  it('shows the frame that many frames-a-second after it started, on the painted clock', () => {
    const { result } = renderHook(() =>
      useAnimationPlayer(viewed('wolf-walk', 8)),
    );
    paint(1000);
    expect(result.current.frame).toBe(0);
    paint(1000 + 3 * 125);
    expect(result.current.frame).toBe(3);
    // Round the loop.
    paint(1000 + 9 * 125);
    expect(result.current.frame).toBe(1);
  });

  it('plays from the frame it was stopped on, at the speed chosen', () => {
    const { result } = renderHook(() =>
      useAnimationPlayer(viewed('wolf-walk', 8)),
    );
    act(() => result.current.goTo(4));
    act(() => result.current.setFps(4));
    act(() => result.current.toggle());
    paint(0);
    paint(500);
    expect(result.current.frame).toBe(6);
  });

  it('holds a one-shot on its last frame and stops', () => {
    const once = viewed('jump', 4);
    const { result } = renderHook(() =>
      useAnimationPlayer({
        ...once,
        animation: { ...once.animation, loop: false },
      }),
    );
    paint(0);
    paint(5000);
    expect(result.current.frame).toBe(3);
    expect(result.current.playing).toBe(false);
  });
});
