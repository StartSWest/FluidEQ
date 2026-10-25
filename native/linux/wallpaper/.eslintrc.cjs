// GJS resolves these imports from GNOME, not from Node's module directories.
module.exports = {
  globals: { ARGV: 'readonly', imports: 'readonly', printerr: 'readonly' },
  rules: {
    'import/no-unresolved': ['error', { ignore: ['^gi://', '^resource:///'] }],
    // GNOME's modern SpiderMonkey executes iterators without a polyfill.
    'no-restricted-syntax': 'off',
    // GJS's print writes protocol records to stdout; it is not window.print.
    'no-restricted-globals': 'off',
    // This is GNOME's background actor API, not a private FluidEQ field.
    'no-underscore-dangle': ['error', { allow: ['_backgroundGroup'] }],
  },
};
