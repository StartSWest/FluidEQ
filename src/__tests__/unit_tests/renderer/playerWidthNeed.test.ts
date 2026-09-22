const floorPlayerWidth = jest.fn();

jest.mock('renderer/player/windowModeStore', () => ({
  floorPlayerWidth: (width: number) => floorPlayerWidth(width),
  holdPlayerHeight: () => undefined,
  resizePlayerWindow: () => Promise.resolve(),
}));

// eslint-disable-next-line import/first
import { setPlayerWidthNeed } from 'renderer/player/playerLayout';

beforeEach(() => {
  floorPlayerWidth.mockClear();
  setPlayerWidthNeed('bands', undefined);
  setPlayerWidthNeed('rows', undefined);
  floorPlayerWidth.mockClear();
});

describe('what the player is held to across', () => {
  it('is the widest of the parts that have a say', () => {
    setPlayerWidthNeed('bands', 266);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(266);
    setPlayerWidthNeed('rows', 388.4);
    // Whole pixels, rounded up: a window a fraction narrower than a row is
    // a row cut by a fraction.
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(389);
    setPlayerWidthNeed('bands', 499);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(499);
  });

  it('lets a part withdraw its say, and lifts the floor when none is left', () => {
    setPlayerWidthNeed('bands', 499);
    setPlayerWidthNeed('rows', 389);
    setPlayerWidthNeed('bands', undefined);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(389);
    setPlayerWidthNeed('rows', undefined);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(0);
  });

  it('treats nothing, zero and nonsense as no say', () => {
    setPlayerWidthNeed('rows', 0);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(0);
    setPlayerWidthNeed('rows', Number.NaN);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(0);
    setPlayerWidthNeed('rows', -12);
    expect(floorPlayerWidth).toHaveBeenLastCalledWith(0);
  });
});
