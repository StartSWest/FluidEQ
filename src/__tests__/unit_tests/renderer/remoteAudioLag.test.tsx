/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import RemoteAudioLag from '../../../renderer/remoteAudio/RemoteAudioLag';

let frame: () => boolean = () => false;
let clock = 0;
jest.mock('../../../renderer/utils/useSmoothFrames', () => {
  const kick = () => undefined;
  return {
    __esModule: true,
    default: (draw: () => boolean) => {
      frame = draw;
      return kick;
    },
  };
});
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: { milliseconds: string }) =>
      values ? `≈${values.milliseconds} ms` : key,
  }),
}));

beforeEach(() => {
  clock = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => jest.restoreAllMocks());
const stats = {
  peerId: 'yoga',
  direction: 'receive' as const,
  bytesPerSecond: 100,
  queuedBytes: 0,
  queuedMilliseconds: 0,
  incomingLagMs: 44,
  outgoingLagMs: 310,
};

it('shows distinct incoming and final receiving-PC outgoing estimates', () => {
  render(<RemoteAudioLag stats={stats} incoming outgoing />);
  expect(screen.getByText('≈44 ms')).toBeInTheDocument();
  expect(screen.getByText('≈310 ms')).toBeInTheDocument();
});

it('shows no numeric lag for an off, offline or unsupported direction', () => {
  const { rerender } = render(
    <RemoteAudioLag stats={stats} incoming={false} outgoing />,
  );
  expect(screen.queryByText('≈44 ms')).not.toBeInTheDocument();
  expect(screen.getByText('≈310 ms')).toBeInTheDocument();
  rerender(<RemoteAudioLag stats={undefined} incoming outgoing />);
  expect(screen.getAllByText('—')).toHaveLength(2);
});

it('clears frozen reports and stops its display freshness check', () => {
  render(<RemoteAudioLag stats={stats} incoming outgoing />);
  expect(frame()).toBe(true);
  clock = 3_001;
  act(() => {
    expect(frame()).toBe(false);
  });
  expect(screen.getAllByText('—')).toHaveLength(2);
});
