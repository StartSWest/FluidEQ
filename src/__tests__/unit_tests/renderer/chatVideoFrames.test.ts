/**
 * @jest-environment node
 */

/**
 * Where the window draws a video's frames for video_frames, and at what
 * size: the decoding itself needs a page with video, which a test does not
 * have, so what is held here is what it asks the video for.
 */

import {
  frameMoments,
  frameSize,
} from '../../../renderer/studio/chat/chatVideo';

describe('the moments drawn', () => {
  it('spreads them evenly, each in the middle of its share', () => {
    expect(frameMoments(4, 2)).toEqual([0.25, 0.75, 1.25, 1.75]);
  });

  it('keeps to the part asked for, and inside the video', () => {
    expect(frameMoments(2, 10, 4, 6)).toEqual([4.5, 5.5]);
    // Past the end, the part is what there is.
    expect(frameMoments(2, 3, 2, 99)).toEqual([2.25, 2.75]);
    expect(frameMoments(3, 3, -5)).toEqual([0.5, 1.5, 2.5]);
  });

  it('never repeats the first frame as the last of a loop', () => {
    const moments = frameMoments(8, 1);
    expect(moments[0]).toBeGreaterThan(0);
    expect(moments[moments.length - 1]).toBeLessThan(1);
  });
});

describe('the size drawn', () => {
  it('keeps the shape, its longest side the edge asked for', () => {
    expect(frameSize(1920, 1080, 384)).toEqual({ width: 384, height: 216 });
    expect(frameSize(720, 1280, 256)).toEqual({ width: 144, height: 256 });
  });

  it('never draws larger than the video is', () => {
    expect(frameSize(200, 100, 512)).toEqual({ width: 200, height: 100 });
  });
});
