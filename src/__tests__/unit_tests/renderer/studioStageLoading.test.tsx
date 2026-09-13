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
};
const current = () => runner.mock.calls[runner.mock.calls.length - 1][0];
const frame = (fade: number) =>
  ({ fade }) as Parameters<
    NonNullable<ReturnType<typeof current>['onDrawn']>
  >[0];
beforeEach(() => jest.clearAllMocks());
it('keeps loading through the black opening frame, then reveals the first visible frame', () => {
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
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');
  act(() => current().onDrawn?.(frame(0), 1, 0, frame(0)));
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  act(() => current().onDrawn?.(frame(0.1), 1, 0, frame(0.1)));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByTestId('studio-stage')).toHaveAttribute(
    'aria-busy',
    'false',
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
    />,
  );
  act(() => current().onDrawn?.(frame(1), 1, 0, frame(1)));
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
      identity="two"
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');
});
it('ends the loader and reports an actual compile error', () => {
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
    />,
  );
  act(() => current().source.reportFailure('compile', 'Bad shader'));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(props.onTrouble).toHaveBeenCalledWith({
    kind: 'compile',
    log: 'Bad shader',
  });
});
