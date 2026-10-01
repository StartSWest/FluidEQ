/**
 * Fails a case that prints to `console.error` or `console.warn` without
 * holding it.
 *
 * Every suite passed while the CI log carried four hundred and fifty red
 * console blocks: React updates landing after a case had ended, fakes missing
 * a function the code called, failures driven on purpose and printed. Read on
 * the actions page they looked like a broken build, and among them a real
 * warning had nowhere to stand out. A case that drives a failure on purpose
 * holds the report and asserts it (`__tests__/utils/reportedError`); a case
 * that spies on the console itself takes this spy over, and owns what it
 * hears.
 */

const recorded: string[] = [];

const record =
  (level: 'error' | 'warn') =>
  (...args: unknown[]): void => {
    recorded.push(`console.${level}: ${args.map(String).join(' ')}`);
  };

beforeEach(() => {
  recorded.length = 0;
  jest.spyOn(console, 'error').mockImplementation(record('error'));
  jest.spyOn(console, 'warn').mockImplementation(record('warn'));
});

afterEach(() => {
  const printed = recorded.splice(0);
  if (printed.length > 0) {
    throw new Error(
      `This case printed to the console without holding it:\n${printed
        .map((line) => `  ${line.split('\n').slice(0, 3).join('\n    ')}`)
        .join('\n')}`,
    );
  }
});
