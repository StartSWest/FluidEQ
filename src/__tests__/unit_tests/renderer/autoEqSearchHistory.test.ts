import type * as AutoEqSearchHistory from 'renderer/utils/autoEqSearchHistory';

type TAutoEqSearchHistory = typeof AutoEqSearchHistory;

const load = (): TAutoEqSearchHistory => {
  let store: TAutoEqSearchHistory;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    store = require('renderer/utils/autoEqSearchHistory');
  });
  return store!;
};

describe('AutoEQ model search history', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps the newest 20 unique searches in local storage', () => {
    const store = load();
    for (let index = 0; index < 25; index += 1) {
      store.addAutoEqSearchToHistory(`model ${index}`);
    }

    const history = JSON.parse(
      window.localStorage.getItem(store.AUTO_EQ_SEARCH_HISTORY_STORAGE_KEY) ??
        '[]',
    ) as string[];
    expect(history).toHaveLength(20);
    expect(history[0]).toBe('model 24');
    expect(history[19]).toBe('model 5');
  });

  it('restores saved searches when the store is loaded again', () => {
    window.localStorage.setItem(
      'fluideq.autoEqModelSearchHistory',
      JSON.stringify(['HD 600', 'Kraken']),
    );
    const store = load();

    expect(store.AUTO_EQ_SEARCH_HISTORY_STORAGE_KEY).toBe(
      'fluideq.autoEqModelSearchHistory',
    );
    expect(store.getAutoEqSearchHistory()).toEqual(['HD 600', 'Kraken']);
  });
});
