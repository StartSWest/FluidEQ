import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import StudioStage from '../../../renderer/studio/StudioStage';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));
const runner = jest.mocked(useSceneRunner);
const pack = { names: { en: 'Alpine' } } as IScenePack;
const props = {
  identity: 'one',
  pack,
  serial: 1,
  signal: 'live' as const,
  size: 'graph' as const,
  onTrouble: jest.fn(),
  onDrawn: jest.fn(),
  onExitFullscreen: jest.fn(),
  onToggleFullscreen: jest.fn(),
  wave: { height: 1, position: 0 },
};
const current = () => runner.mock.calls[runner.mock.calls.length - 1][0];
const frame = (fade: number) =>
  ({ fade }) as Parameters<
    NonNullable<ReturnType<typeof current>['onDrawn']>
  >[0];
beforeEach(() => jest.clearAllMocks());
// When a version is on its way is the runner's to say (`onWaiting`), frames
// and all: `studioStageRebuild.test.tsx` drives the real one.
it('shows loading for as long as the runner says a version is on its way', () => {
  render(
    <StudioStage
      identity={props.identity}
      pack={props.pack}
      serial={props.serial}
      signal={props.signal}
      size={props.size}
      onTrouble={props.onTrouble}
      onDrawn={props.onDrawn}
      onExitFullscreen={props.onExitFullscreen}
      onToggleFullscreen={props.onToggleFullscreen}
      wave={props.wave}
      isGridShown={false}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');
  // A frame alone decides nothing here.
  act(() => current().onDrawn?.(frame(1), 1, 0, frame(1)));
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  act(() => current().onWaiting?.(false));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  act(() => current().onWaiting?.(true));
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'aria-busy',
    'true',
  );
});
it('starts loading again when the selected project changes', () => {
  const { rerender } = render(
    <StudioStage
      key="one"
      identity={props.identity}
      pack={props.pack}
      serial={props.serial}
      signal={props.signal}
      size={props.size}
      onTrouble={props.onTrouble}
      onDrawn={props.onDrawn}
      onExitFullscreen={props.onExitFullscreen}
      onToggleFullscreen={props.onToggleFullscreen}
      wave={props.wave}
      isGridShown={false}
    />,
  );
  act(() => current().onWaiting?.(false));
  rerender(
    <StudioStage
      key="two"
      pack={props.pack}
      serial={props.serial}
      signal={props.signal}
      size={props.size}
      onTrouble={props.onTrouble}
      onDrawn={props.onDrawn}
      onExitFullscreen={props.onExitFullscreen}
      onToggleFullscreen={props.onToggleFullscreen}
      wave={props.wave}
      isGridShown={false}
      identity="two"
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');
});
it('reports an actual compile error', () => {
  render(
    <StudioStage
      identity={props.identity}
      pack={props.pack}
      serial={props.serial}
      signal={props.signal}
      size={props.size}
      onTrouble={props.onTrouble}
      onDrawn={props.onDrawn}
      onExitFullscreen={props.onExitFullscreen}
      onToggleFullscreen={props.onToggleFullscreen}
      wave={props.wave}
      isGridShown={false}
    />,
  );
  act(() => current().source.reportFailure('compile', 'Bad shader'));
  expect(props.onTrouble).toHaveBeenCalledWith({
    kind: 'compile',
    log: 'Bad shader',
  });
});
