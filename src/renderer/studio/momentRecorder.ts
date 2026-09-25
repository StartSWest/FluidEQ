import type { ISceneFrame } from '../graph/sceneGl';

/**
 * How much of what the scene heard a capture replays before its moment.
 *
 * Enough for everything a scene eases to arrive where it was on screen: the
 * slow spectrum's longest half-life is 420 ms, so after three seconds what is
 * left of wherever the replay started is under one percent; and the musical
 * accent's opening 1.5 s hold has passed, so a beat the stage saw in the last
 * second and a half is one the replay sees too.
 */
const REPLAY_MS = 3000;

/** Three seconds at 240 Hz, the fastest display a frame can come from. */
const MAX_FRAMES = 720;

/** The runner's own cap on how far one frame moves the clock. */
const MAX_FRAME_MS = 100;

type TMomentSlot = ISceneFrame & { deltaMs: number };

export interface IMomentRecorder {
  /** Keeps a copy of a frame just drawn. Allocates no buffers once warm. */
  record(frame: ISceneFrame): void;
  /**
   * Copies of the frames drawn over the last three seconds, oldest first; the
   * last is the moment. Copies, because recording carries on while the
   * picture is drawn.
   */
  moment(): ISceneFrame[];
}

const copyOf = (slot: TMomentSlot): ISceneFrame => ({
  ...slot,
  spectrum: slot.spectrum.slice(),
  waveform: slot.waveform.slice(),
});

/**
 * What a scene heard, frame by frame, for as long as a capture needs, so the
 * moment a member picks on screen can be drawn again off screen at full
 * quality (see `renderCapturedStill`). A ring of slots whose buffers are
 * reused: the frame's spectrum and waveform are buffers the runner overwrites
 * every frame, so a slot keeps arrays of its own and copies into them.
 *
 * Everything else in the frame is kept whole, by spreading it, never field by
 * field: the reused slots once copied a list of fields that had stopped at
 * the params, and every capture after the first three seconds replayed the
 * accent and the flywheel from whenever the slot was first filled.
 */
export const createMomentRecorder = (): IMomentRecorder => {
  const slots: TMomentSlot[] = [];
  let next = 0;
  let count = 0;

  return {
    record: (frame) => {
      const slot = slots[next];
      const reused =
        slot &&
        slot.spectrum.length === frame.spectrum.length &&
        slot.waveform.length === frame.waveform.length;
      const spectrum = reused ? slot.spectrum : frame.spectrum.slice();
      const waveform = reused ? slot.waveform : frame.waveform.slice();
      if (reused) {
        spectrum.set(frame.spectrum);
        waveform.set(frame.waveform);
      }
      slots[next] = {
        ...frame,
        deltaMs: frame.deltaMs ?? 0,
        spectrum,
        waveform,
      };
      next = (next + 1) % MAX_FRAMES;
      count = Math.min(count + 1, MAX_FRAMES);
    },
    moment: () => {
      const frames: ISceneFrame[] = [];
      let elapsed = 0;
      for (let back = 1; back <= count && elapsed < REPLAY_MS; back += 1) {
        const slot = slots[(next - back + MAX_FRAMES) % MAX_FRAMES];
        frames.push(copyOf(slot));
        elapsed += Math.min(MAX_FRAME_MS, slot.deltaMs);
      }
      return frames.reverse();
    },
  };
};
