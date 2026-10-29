/* FluidEQ — GPL-3.0-or-later */

export const PLAYBACK_MAGIC = 0x31504c46;
export const PLAYBACK_HEADER_BYTES = 24;
/** The helper protocol that has command 9, smooth playback for one peer. */
export const PLAYBACK_SMOOTH_SINCE = 2;
const MAX_REPLY_BYTES = 4_096;

export const playbackCommand = (
  kind: number,
  id = 0,
  payload: Buffer = Buffer.alloc(0),
  rate = 0,
  channels = 0,
  frames = 0,
): Buffer => {
  const header = Buffer.alloc(PLAYBACK_HEADER_BYTES);
  header.writeUInt32LE(PLAYBACK_MAGIC, 0);
  header.writeUInt32LE(kind, 4);
  header.writeUInt32LE(id, 8);
  header.writeUInt32LE(rate, 12);
  header.writeUInt16LE(channels, 16);
  header.writeUInt16LE(frames, 18);
  header.writeUInt32LE(payload.byteLength, 20);
  return Buffer.concat([header, payload]);
};

export interface IPlaybackReply {
  kind: number;
  id: number;
  rate: number;
  frames: number;
  payload: Buffer;
  /** Present on a native helper's system-audio frame (10 network, 11 Mac monitor). */
  channels?: number;
}

/** A partial pipe read is not a packet boundary. Bound the declared frame first. */
export class PlaybackReplyReader {
  private pending = Buffer.alloc(0);

  push(bytes: Buffer, accept: (reply: IPlaybackReply) => void): void {
    this.pending = Buffer.concat([this.pending, bytes]);
    while (this.pending.byteLength >= PLAYBACK_HEADER_BYTES) {
      const size = this.pending.readUInt32LE(20);
      const kind = this.pending.readUInt32LE(4);
      const isCapture =
        kind === 10 || (process.platform === 'darwin' && kind === 11);
      const rate = this.pending.readUInt32LE(12);
      const channels = this.pending.readUInt16LE(16);
      const frames = this.pending.readUInt16LE(18);
      const validCapture =
        channels >= 1 &&
        channels <= 8 &&
        frames >= 1 &&
        frames <= 8192 &&
        rate >= 8000 &&
        rate <= 384000 &&
        size === frames * channels * 4;
      if (
        this.pending.readUInt32LE(0) !== PLAYBACK_MAGIC ||
        (isCapture ? !validCapture : size > MAX_REPLY_BYTES)
      ) {
        throw new Error('Invalid native playback reply.');
      }
      const total = PLAYBACK_HEADER_BYTES + size;
      if (this.pending.byteLength < total) {
        return;
      }
      const reply = {
        kind,
        id: this.pending.readUInt32LE(8),
        rate,
        frames,
        ...(isCapture ? { channels } : {}),
        payload: this.pending.subarray(PLAYBACK_HEADER_BYTES, total),
      };
      this.pending = this.pending.subarray(total);
      accept(reply);
    }
  }
}
