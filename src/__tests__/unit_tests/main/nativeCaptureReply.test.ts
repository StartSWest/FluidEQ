/* FluidEQ — GPL-3.0-or-later */
import {
  playbackCommand,
  PlaybackReplyReader,
} from 'main/nativeRemoteAudioPlaybackProtocol';

it('carries native capture blocks larger than a control reply without losing sample bits', () => {
  const pcm = Buffer.alloc(1920 * 2 * 4, 0x35);
  const packet = playbackCommand(10, 7, pcm, 384000, 2, 1920);
  const accept = jest.fn();
  const reader = new PlaybackReplyReader();
  reader.push(packet.subarray(0, 35), accept);
  expect(accept).not.toHaveBeenCalled();
  reader.push(packet.subarray(35), accept);
  expect(accept).toHaveBeenCalledWith({
    kind: 10,
    id: 7,
    rate: 384000,
    frames: 1920,
    channels: 2,
    payload: pcm,
  });
});

it.each([
  playbackCommand(10, 0, Buffer.alloc(8), 48000, 0, 1),
  playbackCommand(10, 0, Buffer.alloc(8), 48000, 2, 8193),
  playbackCommand(10, 0, Buffer.alloc(8), 0, 2, 1),
  playbackCommand(10, 0, Buffer.alloc(4), 48000, 2, 1),
  playbackCommand(5, 0, Buffer.alloc(4097)),
])(
  'rejects malformed native capture and oversized control frames',
  (packet) => {
    expect(() => new PlaybackReplyReader().push(packet, jest.fn())).toThrow(
      'Invalid native playback reply',
    );
  },
);
