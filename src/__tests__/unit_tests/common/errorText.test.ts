/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ERROR_TEXT,
  ErrorCode,
  errorText,
  errors,
  getErrorDescription,
  isErrorDescription,
} from 'common/errors';
import { loadLocale, translate, type Translate } from 'common/i18n';
import en from 'common/i18n/en';

/*
 * The error banner and the blocking dialog showed the codes' own English
 * table in every language. The codes' words are keys now, and main's own —
 * a file at the wrong rate, a band past the limit — arrive already in the
 * reader's language and are shown as they came.
 */

const de: Translate = (key, vars) => translate('de', key, vars);

beforeAll(async () => {
  await loadLocale('de');
});

describe("an error's words", () => {
  it("are the code's own, in the reader's language", () => {
    const shown = errorText(getErrorDescription(ErrorCode.IMPORT_ERROR), de);
    expect(shown).toEqual({
      title: de('error.import'),
      action: de('error.import.action'),
    });
    // Positive control: German is not the English it replaced.
    expect(shown.title).not.toBe(en['error.import']);
  });

  it("are main's own where it sent some, as they came", () => {
    const shown = errorText(
      {
        ...getErrorDescription(ErrorCode.IMPORT_ERROR),
        detail: 'Diese Datei ist keine WAV-Impulsantwort.',
      },
      de,
    );
    expect(shown.title).toBe('Diese Datei ist keine WAV-Impulsantwort.');
    // A detail alone keeps the code's own action.
    expect(shown.action).toBe(de('error.import.action'));

    expect(
      errorText(
        {
          ...getErrorDescription(ErrorCode.INVALID_PARAMETER),
          detail: 'x',
          detailAction: 'y',
        },
        de,
      ),
    ).toEqual({ title: 'x', action: 'y' });
  });

  it('are English in the table the log reads, for every code', () => {
    (Object.keys(ERROR_TEXT) as unknown as ErrorCode[]).forEach((key) => {
      const code = Number(key) as ErrorCode;
      expect(errors[code]).toEqual({
        code,
        shortError: en[ERROR_TEXT[code].title],
        action: en[ERROR_TEXT[code].action],
      });
    });
  });
});

describe('what counts as a description', () => {
  it("is one of the codes' descriptions, however it travelled", () => {
    expect(isErrorDescription(getErrorDescription(ErrorCode.FAILURE))).toBe(
      true,
    );
    // As ipcRequest rejects: an Error carrying the description's fields.
    expect(
      isErrorDescription(
        Object.assign(
          new Error('x'),
          getErrorDescription(ErrorCode.PRESET_FILE_ERROR),
        ),
      ),
    ).toBe(true);
  });

  it('is not a plain Error, a code nobody has, or nothing', () => {
    expect(
      isErrorDescription(new TypeError('undefined is not a function')),
    ).toBe(false);
    expect(isErrorDescription({ code: 999, shortError: 'x' })).toBe(false);
    expect(isErrorDescription({ code: ErrorCode.FAILURE })).toBe(false);
    expect(isErrorDescription(undefined)).toBe(false);
  });
});
