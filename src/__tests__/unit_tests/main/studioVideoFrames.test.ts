/**
 * @jest-environment node
 */

/**
 * video_frames (Ivan, 2026-11-11: "videos and everything Higgsfield can
 * do"): a scene plays no video, so a video in the project's art folder
 * becomes frames for build_sheet. The window draws them; these hold what the
 * tool reads, asks for and writes, with the page stood in for.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  IStudioChatVideoAsk,
  TStudioChatVideoAnswer,
} from '../../../common/studioChat';
import createVideoFramesTool from '../../../main/studioChat/videoFramesTool';
import createWindowAsks from '../../../main/studioChat/windowAsks';

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1,
]);

let folder: string;
let asked: Omit<IStudioChatVideoAsk, 'id'>[];
let answer: TStudioChatVideoAnswer | 'no-window';
let stop: AbortController;

const frames = (
  count: number,
): Extract<TStudioChatVideoAnswer, { ok: true }> => ({
  ok: true,
  frames: Array.from({ length: count }, () => PNG),
  width: 384,
  height: 216,
  duration: 4,
});

const tool = () =>
  createVideoFramesTool({
    project: () => ({ ok: true, id: 'lake', folder }),
    signal: () => stop.signal,
    framesInWindow: async (ask) => {
      asked.push(ask);
      return answer;
    },
  });

const art = (name: string) => path.join(folder, 'art', name);
const textOf = (result: { content: { type: string; text?: string }[] }) =>
  result.content.map((part) => part.text ?? '').join('\n');

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-video-'));
  fs.mkdirSync(path.join(folder, 'art'));
  fs.writeFileSync(art('heron.mp4'), Buffer.from('a video'));
  asked = [];
  answer = frames(12);
  stop = new AbortController();
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('a video in the art folder', () => {
  it('becomes frames art/<name>-01.png and on, and build_sheet is named next', async () => {
    const result = await tool().call({ video: 'art/heron.mp4', name: 'heron' });
    expect(result.isError).toBeUndefined();
    expect(asked).toEqual([
      expect.objectContaining({ type: 'video/mp4', count: 12, edge: 384 }),
    ]);
    expect(Buffer.from(asked[0].video).toString()).toBe('a video');
    expect(fs.existsSync(art('heron-01.png'))).toBe(true);
    expect(fs.existsSync(art('heron-12.png'))).toBe(true);
    expect(fs.existsSync(art('heron-13.png'))).toBe(false);
    expect(textOf(result)).toContain('build_sheet');
    expect(textOf(result)).toContain('{ "from": "art/heron-12.png" }');
  });

  it('asks for what was asked, held to what a sheet can take', async () => {
    answer = frames(48);
    await tool().call({
      video: 'art/heron.mp4',
      name: 'heron',
      frames: 500,
      size: 9000,
      from: 1.5,
      to: 2.5,
    });
    expect(asked[0]).toMatchObject({
      count: 48,
      edge: 512,
      from: 1.5,
      to: 2.5,
    });
  });

  it('is never read from outside the art folder, nor as anything but a video', async () => {
    fs.writeFileSync(path.join(folder, 'outside.mp4'), 'x');
    fs.writeFileSync(art('notes.txt'), 'x');
    const refused = await Promise.all(
      [
        'outside.mp4',
        'art/../outside.mp4',
        'art/notes.txt',
        'art/gone.mp4',
      ].map((video) => tool().call({ video, name: 'heron' })),
    );
    expect(refused.every((result) => result.isError)).toBe(true);
    expect(asked).toEqual([]);
  });

  it('writes over nothing already there unless told to replace', async () => {
    fs.writeFileSync(art('heron-03.png'), 'the member’s own');
    const kept = await tool().call({ video: 'art/heron.mp4', name: 'heron' });
    expect(kept.isError).toBe(true);
    expect(textOf(kept)).toContain('art/heron-03.png is already there');
    expect(fs.readFileSync(art('heron-03.png'), 'utf8')).toBe(
      'the member’s own',
    );
    expect(asked).toEqual([]);
    // The control: told to, it does.
    await tool().call({ video: 'art/heron.mp4', name: 'heron', replace: true });
    expect(Buffer.from(fs.readFileSync(art('heron-03.png')))).toEqual(
      Buffer.from(PNG),
    );
  });

  it('writes nothing the page did not draw as asked', async () => {
    answer = {
      ...frames(12),
      frames: [...frames(11).frames, Uint8Array.from([1, 2])],
    };
    expect(
      (await tool().call({ video: 'art/heron.mp4', name: 'heron' })).isError,
    ).toBe(true);
    answer = frames(5);
    expect(
      (await tool().call({ video: 'art/heron.mp4', name: 'heron' })).isError,
    ).toBe(true);
    answer = { ok: false, reason: 'unreadable' };
    const unreadable = await tool().call({
      video: 'art/heron.mp4',
      name: 'heron',
    });
    expect(textOf(unreadable)).toContain('MP4 (H.264) or WebM');
    expect(fs.existsSync(art('heron-01.png'))).toBe(false);
  });

  it('writes nothing when the member stops the reply, or no window is open', async () => {
    stop.abort();
    expect(
      (await tool().call({ video: 'art/heron.mp4', name: 'heron' })).isError,
    ).toBe(true);
    stop = new AbortController();
    answer = 'no-window';
    const closed = await tool().call({ video: 'art/heron.mp4', name: 'heron' });
    expect(textOf(closed)).toContain('open the Studio');
    expect(fs.existsSync(art('heron-01.png'))).toBe(false);
  });
});

describe('an ask of the window', () => {
  type TAsk = { id: number; what: string };
  const page = () => {
    const sent: unknown[] = [];
    const gone: Array<() => void> = [];
    return {
      sent,
      gone,
      webContents: {
        send: (_channel: string, ask: unknown) => sent.push(ask),
        once: (_event: string, listener: () => void) => gone.push(listener),
        removeListener: () => undefined,
      },
    };
  };

  it('answers what the page read, and only for the ask it was sent', async () => {
    const shown = page();
    const asks = createWindowAsks<TAsk, string>({
      channel: 'c',
      pageOf: () => shown.webContents as never,
      signalOf: () => new AbortController().signal,
      read: (raw, ask) => `${ask.what}:${String(raw)}`,
    });
    const pending = asks.ask('p', { what: 'frames' });
    expect(shown.sent).toEqual([{ what: 'frames', id: 1 }]);
    asks.answer(99, 'stray');
    asks.answer(1, 'drawn');
    await expect(pending).resolves.toBe('frames:drawn');
  });

  it('answers no-window with no page, a Stop, or the page going away', async () => {
    const none = createWindowAsks<TAsk, string>({
      channel: 'c',
      pageOf: () => undefined,
      signalOf: () => new AbortController().signal,
      read: () => 'x',
    });
    await expect(none.ask('p', { what: 'a' })).resolves.toBe('no-window');
    const shown = page();
    const stopped = new AbortController();
    const asks = createWindowAsks<TAsk, string>({
      channel: 'c',
      pageOf: () => shown.webContents as never,
      signalOf: () => stopped.signal,
      read: () => 'x',
    });
    const first = asks.ask('p', { what: 'a' });
    stopped.abort();
    await expect(first).resolves.toBe('no-window');
    const second = createWindowAsks<TAsk, string>({
      channel: 'c',
      pageOf: () => shown.webContents as never,
      signalOf: () => new AbortController().signal,
      read: () => 'x',
    }).ask('p', { what: 'b' });
    shown.gone[shown.gone.length - 1]();
    await expect(second).resolves.toBe('no-window');
  });
});
