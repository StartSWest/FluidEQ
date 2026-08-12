import type * as ConvolutionSearchHistory from 'renderer/utils/convolutionSearchHistory';

type TConvolutionSearchHistory = typeof ConvolutionSearchHistory;

const loadHistory = (): TConvolutionSearchHistory => {
  let store: TConvolutionSearchHistory;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    store = require('renderer/utils/convolutionSearchHistory');
  });
  return store!;
};

describe('Convolution search history', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists only the latest 20 unique queries', () => {
    const store = loadHistory();
    for (let index = 0; index < 25; index += 1) {
      store.addConvolutionSearchToHistory(`headset ${index}`);
    }

    const history = JSON.parse(
      window.localStorage.getItem(
        store.CONVOLUTION_SEARCH_HISTORY_STORAGE_KEY,
      ) ?? '[]',
    ) as string[];
    expect(history).toHaveLength(20);
    expect(history[0]).toBe('headset 24');
    expect(history[19]).toBe('headset 5');
  });

  it('restores its own history independently from AutoEQ', () => {
    window.localStorage.setItem(
      'fluideq.convolutionSearchHistory',
      JSON.stringify(['HD 650', 'Sundara']),
    );
    const store = loadHistory();

    expect(store.getConvolutionSearchHistory()).toEqual(['HD 650', 'Sundara']);
    expect(
      window.localStorage.getItem('fluideq.autoEqModelSearchHistory'),
    ).toBeNull();
  });
});
