/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core hears the output once for everybody who listens, and not at all
 * while nobody does: a loopback holds the output awake, so a run left going
 * after the last window let go keeps somebody's DAC out of its sleep.
 */
import {
  createSystemSound,
  type ISystemSoundBlock,
  type ISystemSoundHandlers,
  type ISystemSoundListener,
  type ISystemSoundSource,
} from 'core/systemSound/systemSound';

interface IFakeRun {
  handlers: ISystemSoundHandlers;
  stop: jest.Mock;
}

const fakeSource = () => {
  const runs: IFakeRun[] = [];
  const source: ISystemSoundSource = {
    start: (handlers) => {
      const run = { handlers, stop: jest.fn() };
      runs.push(run);
      return { stop: run.stop };
    },
  };
  return { source, runs };
};

const listener = (): ISystemSoundListener & {
  ready: jest.Mock;
  audio: jest.Mock;
  lost: jest.Mock;
} => ({ ready: jest.fn(), audio: jest.fn(), lost: jest.fn() });

const block = (sequence: number): ISystemSoundBlock => ({
  sampleRate: 48000,
  channels: 2,
  frames: 480,
  sequence,
  pcm: new Float32Array(960).buffer,
});

describe('the core hearing the output', () => {
  it('runs one source for every listener and stops it with the last', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const first = listener();
    const second = listener();

    const stopFirst = sound.listen(first);
    const stopSecond = sound.listen(second);
    expect(runs).toHaveLength(1);

    stopFirst();
    expect(runs[0].stop).not.toHaveBeenCalled();
    stopSecond();
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });

  it('tells a listener the sound is ready whenever it joins', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const early = listener();
    sound.listen(early);
    expect(early.ready).not.toHaveBeenCalled();

    runs[0].handlers.ready();
    expect(early.ready).toHaveBeenCalledTimes(1);

    const late = listener();
    sound.listen(late);
    expect(late.ready).toHaveBeenCalledTimes(1);
    expect(runs).toHaveLength(1);
  });

  it('hands every block to every listener', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const first = listener();
    const second = listener();
    sound.listen(first);
    sound.listen(second);
    runs[0].handlers.ready();
    const heard = block(7);
    runs[0].handlers.audio(heard);

    expect(first.audio).toHaveBeenCalledWith(heard);
    expect(second.audio).toHaveBeenCalledWith(heard);
  });

  it('hears the new output at once when Windows moves it', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const heard = listener();
    sound.listen(heard);
    runs[0].handlers.ready();

    runs[0].handlers.ended('output-changed');
    expect(runs).toHaveLength(2);
    expect(heard.lost).not.toHaveBeenCalled();

    runs[1].handlers.ready();
    runs[1].handlers.audio(block(1));
    expect(heard.ready).toHaveBeenCalledTimes(2);
    expect(heard.audio).toHaveBeenCalledTimes(1);
  });

  it('loses everybody on a failure, and none of them hears the next run', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const failed = listener();
    sound.listen(failed);
    runs[0].handlers.ready();
    runs[0].handlers.ended('failed');
    expect(failed.lost).toHaveBeenCalledTimes(1);
    expect(runs).toHaveLength(1);

    // Somebody asks again; the one told it was lost was never asked back.
    const next = listener();
    sound.listen(next);
    expect(runs).toHaveLength(2);
    runs[1].handlers.ready();
    runs[1].handlers.audio(block(2));

    expect(next.audio).toHaveBeenCalledTimes(1);
    expect(failed.audio).not.toHaveBeenCalled();
    expect(failed.ready).toHaveBeenCalledTimes(1);
  });

  it('ignores whatever a run it has stopped still says', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const gone = listener();
    sound.listen(gone)();
    const next = listener();
    sound.listen(next);

    runs[0].handlers.ready();
    runs[0].handlers.audio(block(3));
    runs[0].handlers.ended('failed');

    expect(next.ready).not.toHaveBeenCalled();
    expect(next.audio).not.toHaveBeenCalled();
    expect(next.lost).not.toHaveBeenCalled();
    // The control: the run that is current is heard.
    runs[1].handlers.ready();
    expect(next.ready).toHaveBeenCalledTimes(1);
  });

  it('says at once that nothing can be heard where there is no source', () => {
    const sound = createSystemSound(undefined);
    const nobody = listener();
    const stop = sound.listen(nobody);

    expect(nobody.lost).toHaveBeenCalledTimes(1);
    expect(stop).not.toThrow();
  });

  it('loses a listener whose source throws as it starts', () => {
    const sound = createSystemSound({
      start: () => {
        throw new Error('no helper');
      },
    });
    const heard = listener();
    sound.listen(heard);

    expect(heard.lost).toHaveBeenCalledTimes(1);
  });

  it('stops a run that ended before its start returned', () => {
    const stop = jest.fn();
    const sound = createSystemSound({
      start: (handlers) => {
        handlers.ended('failed');
        return { stop };
      },
    });
    const heard = listener();
    sound.listen(heard);

    expect(heard.lost).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('lets a listener stop twice without stopping somebody else’s run', () => {
    const { source, runs } = fakeSource();
    const sound = createSystemSound(source);
    const stopFirst = sound.listen(listener());
    sound.listen(listener());

    stopFirst();
    stopFirst();
    expect(runs[0].stop).not.toHaveBeenCalled();
  });
});
