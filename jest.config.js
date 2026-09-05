const path = require('path');

// `music-metadata` (the media library's tag reader, src/main/library/libraryMetadata.ts)
// pulls in `file-type` as a transitive dependency, and `file-type` is ESM-only
// in a way ts-jest cannot resolve. pnpm's strict isolation gives a transitive
// dependency no top-level node_modules symlink, so there is no
// version-independent path to it — resolve it live instead of hardcoding
// node_modules/.pnpm/file-type@21.3.4/..., which broke the whole suite with
// "Cannot find module 'file-type'" on every pnpm update that bumped the
// pinned version. `file-type`'s own package.json restricts its export map to
// ".", "./core" and "./node" (no "./package.json"), and it has no top-level
// symlink for a bare `require.resolve('file-type', ...)` to start from either,
// so resolution is anchored through music-metadata's own dependency path.
const musicMetadataEntry = require.resolve('music-metadata');
const fileTypeEntry = require.resolve('file-type', {
  paths: [path.dirname(musicMetadataEntry)],
});

module.exports = {
  moduleDirectories: ['src', 'node_modules', 'release/app/node_modules'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  moduleNameMapper: {
    // Jest runs in Node even when jsdom supplies a DOM. Resolving the browser
    // logger here waits for an Electron preload bridge that no unit test owns.
    '^electron-log$': '<rootDir>/.erb/mocks/testLogger.js',
    '^electron-log/renderer$': '<rootDir>/.erb/mocks/testLogger.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|worklet)$':
      '<rootDir>/.erb/mocks/fileMock.js',
    '^@fluideq/whisper-wasm$': '<rootDir>/.erb/mocks/fileMock.js',
    '^@fluideq/whisper-runtime$': '<rootDir>/.erb/mocks/fileMock.js',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    // MUST stay anchored: the unanchored "d3" matched the substring inside
    // "id3v1"/"id3v2" and silently redirected music-metadata's ID3 parser to
    // the D3 charting library instead of leaving it unmapped.
    '^d3$': '<rootDir>/node_modules/d3/dist/d3.min.js',
    '^music-metadata$': '<rootDir>/node_modules/music-metadata/lib/index.js',
    '^file-type$': fileTypeEntry,
  },
  setupFiles: [
    './.erb/scripts/check-build-exists.ts',
    './.erb/scripts/jest-setup.ts',
  ],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  testPathIgnorePatterns: [
    'release/app/dist',
    '<rootDir>/.claude/',
    '<rootDir>/.gigaide/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/.gigaide/'],
  transform: {
    '\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  testMatch: ['**/__tests__/unit_tests/**/*.ts?(x)'],
  transformIgnorePatterns: [
    // Eight of these nine packages are individually load-bearing: each ships
    // ESM that music-metadata's parse chain needs transpiled rather than left
    // for Node's `require` to choke on. `win-guid` is the ninth — forward
    // provisioning for WMA/ASF tag parsing that no test exercises yet.
    '/node_modules/(?!.*(uuid|music-metadata|file-type|strtok3|token-types|media-typer|uint8array-extras|win-guid|@borewit|@tokenizer))',
    '\\.pnp\\.[^\\/]+$',
  ],
};
