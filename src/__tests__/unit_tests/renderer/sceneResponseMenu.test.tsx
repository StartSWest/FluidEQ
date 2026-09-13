import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SceneResponseMenu from '../../../renderer/graph/SceneResponseMenu';
import {
  RESPONSE_SLIDER_STEPS,
  responseFromPosition,
  responseToPosition,
} from '../../../renderer/utils/responseSlider';
import {
  clearListenerResponse,
  reportOwnResponse,
} from '../../../renderer/utils/sceneResponseStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const LOOK = 'premium:neon-city';
const OWN = { sensitivity: 1, threshold: 0, attack: 0, release: 200 };

const sliders = () => screen.getAllByRole('slider') as HTMLInputElement[];
const slide = (input: HTMLInputElement, value: number) =>
  fireEvent.change(input, {
    target: {
      value: String(
        Math.round(
          responseToPosition('release', value) * RESPONSE_SLIDER_STEPS,
        ),
      ),
    },
  });

beforeEach(() => {
  window.localStorage.clear();
  act(() => clearListenerResponse(LOOK));
});

describe('the View menu’s attack and release for a Plus visualizer', () => {
  it('waits for the scene to load before offering its timing', () => {
    render(<SceneResponseMenu lookId="premium:not-loaded" />);
    const [attack, release] = sliders();
    expect(attack).toBeDisabled();
    expect(release).toBeDisabled();
  });

  it('starts from the visualizer’s own timing and shows it in milliseconds', () => {
    act(() => reportOwnResponse(LOOK, OWN));
    render(<SceneResponseMenu lookId={LOOK} />);
    const [attack, release] = sliders();
    expect(attack).toBeEnabled();
    expect(attack).toHaveAttribute('aria-valuetext', 'graph.scene.ms 0');
    expect(release).toHaveAttribute('aria-valuetext', 'graph.scene.ms 200');
    expect(
      screen.getByRole('menuitem', { name: 'graph.scene.ownTiming' }),
    ).toBeDisabled();
  });

  it('takes any timing the listener likes and keeps it for that visualizer', () => {
    act(() => reportOwnResponse(LOOK, OWN));
    const { unmount } = render(<SceneResponseMenu lookId={LOOK} />);
    slide(sliders()[1], 1500);
    const chosen = responseFromPosition(
      'release',
      Math.round(responseToPosition('release', 1500) * RESPONSE_SLIDER_STEPS) /
        RESPONSE_SLIDER_STEPS,
    );
    expect(sliders()[1]).toHaveAttribute(
      'aria-valuetext',
      `graph.scene.ms ${chosen}`,
    );
    unmount();

    // Opened again, as the menu is every time: still what was chosen.
    render(<SceneResponseMenu lookId={LOOK} />);
    expect(sliders()[1]).toHaveAttribute(
      'aria-valuetext',
      `graph.scene.ms ${chosen}`,
    );
    expect(
      JSON.parse(window.localStorage.getItem('fluideq.sceneResponse') ?? '{}'),
    ).toEqual({ [LOOK]: { release: chosen } });
  });

  it('falls onto the visualizer’s own value near it, and forgets the choice', () => {
    act(() => reportOwnResponse(LOOK, OWN));
    render(<SceneResponseMenu lookId={LOOK} />);
    slide(sliders()[1], 1500);
    slide(sliders()[1], 205);
    expect(sliders()[1]).toHaveAttribute(
      'aria-valuetext',
      'graph.scene.ms 200',
    );
    expect(window.localStorage.getItem('fluideq.sceneResponse')).toBeNull();
  });

  it('puts the visualizer’s own timing back from one row', () => {
    act(() => reportOwnResponse(LOOK, OWN));
    render(<SceneResponseMenu lookId={LOOK} />);
    slide(sliders()[0], 400);
    const reset = screen.getByRole('menuitem', {
      name: 'graph.scene.ownTiming',
    });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(sliders()[0]).toHaveAttribute('aria-valuetext', 'graph.scene.ms 0');
    expect(reset).toBeDisabled();
  });
});

describe('the response slider’s curve', () => {
  it.each([
    ['attack', 0],
    ['attack', 58],
    ['release', 200],
    ['release', 3000],
  ] as const)('puts %s %d back where it came from', (key, value) => {
    expect(responseFromPosition(key, responseToPosition(key, value))).toBe(
      value,
    );
  });

  it('gives the short times most of the travel', () => {
    expect(responseToPosition('release', 300)).toBeGreaterThan(0.3);
  });
});
