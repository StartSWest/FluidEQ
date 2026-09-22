import {
  holdSeek,
  seekAnswered,
  seekSettled,
} from 'renderer/library/player/pendingSeek';

describe('the bar while a seek is on its way to the host', () => {
  it('holds the asked-for position past clock readings that beat the answer', () => {
    const pending = holdSeek(150_000);
    // The song playing on from 45 s, forty readings a second, none of them
    // the host's answer: the knob used to go back to these and then jump.
    expect(seekSettled(pending, 45.025, true)).toBe(false);
    expect(seekSettled(pending, 45.05, true)).toBe(false);
  });

  it('lets go on the first reading after the host took it', () => {
    const answered = seekAnswered(holdSeek(150_000), true, 45.075);
    expect(answered).toEqual({ targetMs: 150_000, answeredAtSeconds: 45.075 });
    if (answered === undefined) {
      throw new Error('a taken seek is still held');
    }
    // The reading the answer arrived against is not yet a new one.
    expect(seekSettled(answered, 45.075, true)).toBe(false);
    expect(seekSettled(answered, 150, true)).toBe(true);
  });

  it('lets go at once when the deck refused it', () => {
    expect(seekAnswered(holdSeek(150_000), false, 45.075)).toBeUndefined();
  });

  it('lets go when the host no longer has the clock', () => {
    expect(seekSettled(holdSeek(150_000), 45.025, false)).toBe(true);
  });
});
