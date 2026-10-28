/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import KaraokeSceneAppearanceControls from '../../../renderer/karaoke/KaraokeSceneAppearanceControls';
import KaraokeTransport from '../../../renderer/karaoke/KaraokeTransport';
import {
  setKaraokeSceneBlur,
  setKaraokeSceneOpacity,
} from '../../../renderer/karaoke/karaokeSceneAppearance';
import {
  getOverlayBlur,
  getOverlayOpacity,
  setOverlayBlur,
} from '../../../renderer/utils/graphOverlay';
import { resetSettings } from '../../../renderer/utils/settingsReset';

afterEach(cleanup);

it('keeps untouched Karaoke blur independent and saves its initial choice for reopening', () => {
  const previousGraphBlur = getOverlayBlur();
  const view = render(<KaraokeSceneAppearanceControls />);
  const initial = Number(
    (screen.getByRole('slider', { name: 'Blur' }) as HTMLInputElement).value,
  );
  const nextGraphBlur = initial === 40 ? 0 : 40;
  try {
    act(() => setOverlayBlur(nextGraphBlur));
    // Positive control: the real graph setting changed, while Karaoke did not.
    expect(getOverlayBlur()).toBe(nextGraphBlur);
    expect(screen.getByRole('slider', { name: 'Blur' })).toHaveValue(
      String(initial),
    );
    expect(window.localStorage.getItem('fluideq-karaoke-scene-blur')).toBe(
      String(initial),
    );
    view.unmount();
    render(<KaraokeSceneAppearanceControls />);
    expect(screen.getByRole('slider', { name: 'Blur' })).toHaveValue(
      String(initial),
    );
  } finally {
    act(() => setOverlayBlur(previousGraphBlur));
  }
});

it('shares scene controls between View and Mix without changing graph settings or duplicating IDs', () => {
  act(() => {
    setKaraokeSceneOpacity(1);
    setKaraokeSceneBlur(0);
  });
  const graphBefore = { opacity: getOverlayOpacity(), blur: getOverlayBlur() };
  const { container } = render(
    <>
      <section aria-label="View appearance">
        <KaraokeSceneAppearanceControls />
      </section>
      <KaraokeTransport
        status="paused"
        playheadMs={0}
        durationMs={1000}
        levels={[
          { id: 'master', label: 'Volume', value: 0.8, onChange: jest.fn() },
        ]}
        appearanceControls={<KaraokeSceneAppearanceControls />}
        onTogglePlayback={jest.fn()}
        onStop={jest.fn()}
        onJumpToStart={jest.fn()}
        onJumpToEnd={jest.fn()}
        onSeek={jest.fn()}
      />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mix settings' }));
  const view = within(screen.getByRole('region', { name: 'View appearance' }));
  const mix = within(screen.getByRole('dialog', { name: 'Mix settings' }));
  fireEvent.change(view.getByRole('slider', { name: 'See through' }), {
    target: { value: '75' },
  });
  expect(mix.getByRole('slider', { name: 'See through' })).toHaveValue('75');
  fireEvent.change(mix.getByRole('slider', { name: 'Blur' }), {
    target: { value: '12' },
  });
  expect(view.getByRole('slider', { name: 'Blur' })).toHaveValue('12');
  expect(window.localStorage.getItem('fluideq-karaoke-scene-opacity')).toBe(
    '0.25',
  );
  expect(window.localStorage.getItem('fluideq-karaoke-scene-blur')).toBe('12');
  expect({ opacity: getOverlayOpacity(), blur: getOverlayBlur() }).toEqual(
    graphBefore,
  );
  const ids = Array.from(
    container.ownerDocument.querySelectorAll('[id]'),
    (node) => node.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
});

it('resets both scene preferences while retaining the Karaoke playback session', () => {
  act(() => {
    setKaraokeSceneOpacity(0.4);
    setKaraokeSceneBlur(18);
  });
  window.localStorage.setItem(
    'fluideq.karaoke.current-progress.v1',
    'saved song',
  );
  resetSettings(window.localStorage);
  expect(
    window.localStorage.getItem('fluideq-karaoke-scene-opacity'),
  ).toBeNull();
  expect(window.localStorage.getItem('fluideq-karaoke-scene-blur')).toBeNull();
  expect(
    window.localStorage.getItem('fluideq.karaoke.current-progress.v1'),
  ).toBe('saved song');
});
