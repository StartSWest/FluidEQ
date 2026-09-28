const floorPlayerWidth = jest.fn();

jest.mock('renderer/player/windowModeStore', () => ({
  floorPlayerWidth: (width: number) => floorPlayerWidth(width),
  holdPlayerHeight: () => undefined,
  resizePlayerWindow: () => Promise.resolve(),
}));

// eslint-disable-next-line import/first
import {
  setPlayerWidthNeed,
  sheetAllowance,
} from 'renderer/player/playerLayout';

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

describe('the room the sheet takes beside a row', () => {
  const sheetIn = (display: string) => {
    const sheet = document.createElement('section');
    sheet.style.display = display;
    sheet.style.padding = '4px 16px 14px';
    sheet.style.margin = '8px 10px 10px';
    document.body.appendChild(sheet);
    return sheet;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is its padding and a margin each side', () => {
    expect(sheetAllowance(sheetIn('flex'))).toBe(16 + 16 + 2 * 10);
  });

  it('is the same while the sheet is not drawn, whatever the window’s width', () => {
    // The picture on the whole screen hides the sheet: its box is nothing,
    // and a need worked out from that box was the width of the screen.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1440,
    });
    expect(sheetAllowance(sheetIn('none'))).toBe(16 + 16 + 2 * 10);
  });
});
