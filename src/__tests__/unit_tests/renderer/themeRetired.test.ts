/**
 * Ocean and Black were retired for Dark, to make room for a light theme. A
 * choice of either saved by an earlier version has to land on Dark - painted
 * by `:root` with no attribute - rather than leave somebody in a look that no
 * longer exists, or an attribute no stylesheet answers.
 */
import type * as ThemeModule from 'renderer/utils/theme';

const loadTheme = (): typeof ThemeModule => {
  let theme: typeof ThemeModule | undefined;
  // The module reads the saved choice once, when it is first imported.
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- see above: the import IS the read under test
    theme = require('renderer/utils/theme');
  });
  if (!theme) {
    throw new Error('theme module did not load');
  }
  return theme;
};

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('a theme saved before Ocean was retired', () => {
  it.each(['ocean', 'black'])('reads a saved %s as Dark', (saved) => {
    window.localStorage.setItem('fluideq.theme', saved);
    document.documentElement.setAttribute('data-theme', saved);

    expect(loadTheme().getTheme()).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('opens a fresh install in Dark', () => {
    expect(loadTheme().getTheme()).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
