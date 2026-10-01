/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Runs a case that drives a failure on purpose, with `console.error` held,
 * and fails it unless the failure was reported with `expected` in its first
 * argument — the context the app logs it under. Answers with what `body`
 * answered.
 *
 * Printed, those reports filled the CI log with red that read as failures
 * while every test passed. Held here, each one is proved to have happened
 * instead, and the run's output keeps only what went wrong unexpectedly.
 */
const expectReportedError = async <Result>(
  expected: string,
  body: () => Result | Promise<Result>,
): Promise<Result> => {
  const reported = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  try {
    const result = await body();
    expect(reported.mock.calls.map(([first]) => String(first))).toContainEqual(
      expect.stringContaining(expected),
    );
    return result;
  } finally {
    reported.mockRestore();
  }
};

export default expectReportedError;
