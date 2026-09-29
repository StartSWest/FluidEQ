/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import en, { type TranslationKey } from './i18n/en';
import type { Translate } from './i18n';

export enum ErrorCode {
  EQUALIZER_APO_NOT_INSTALLED,
  CONFIG_NOT_FOUND,
  INVALID_PARAMETER,
  FAILURE,
  PRESET_FILE_ERROR,
  INVALID_PRESET_NAME,
  OPRA_READ_ERROR,
  CONVOLUTION_CATALOG_ERROR,
  IMPORT_ERROR,
  /**
   * No engine preference on disk yet — the first-run dialog has not been
   * answered. Distinct from either engine being missing: there is nothing to
   * install until the user has said which one, so the banner that answers
   * this one is the chooser, not an installer.
   */
  AUDIO_ENGINE_NOT_CHOSEN,
  FLUID_ENGINE_NOT_INSTALLED,
}

export type ErrorDescription = {
  /** In English, for the log and a bug report; the window shows `errorText`. */
  shortError: string;
  action: string;
  code: ErrorCode;
  /**
   * What main said about this failure, already in the reader's language —
   * a file at the wrong rate, a band past the limit — standing in for the
   * code's own title.
   */
  detail?: string;
  /** And what main said to do about it, standing in for the code's action. */
  detailAction?: string;
};

/**
 * Failures that genuinely stop FluidEQ from doing anything at all, and so earn
 * the right to take over the screen.
 *
 * Everything else — a preset that would not save, a rejected name, a database
 * read that failed — is a message, not a wall. Those used to raise the same
 * blocking modal, which meant one failed write made the entire equalizer
 * disappear behind a "prerequisite missing" screen while the user's audio was
 * still being processed perfectly well by Equalizer APO.
 */
export const BLOCKING_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
  ErrorCode.CONFIG_NOT_FOUND,
  // Both stop every write the app exists to make: with no engine chosen there
  // is no directory to write to, and with the chosen engine missing there is
  // nothing on the other side reading what was written.
  ErrorCode.AUDIO_ENGINE_NOT_CHOSEN,
  ErrorCode.FLUID_ENGINE_NOT_INSTALLED,
]);

export const isBlockingError = (error?: ErrorDescription) =>
  !!error && BLOCKING_ERROR_CODES.has(error.code);

/**
 * Each code's own words, as keys: the window says them in the reader's
 * language (`errorText`), and the English beside them is what the log and a
 * bug report read. They were English strings, on screen in every language.
 */
export const ERROR_TEXT: Record<
  ErrorCode,
  { title: TranslationKey; action: TranslationKey }
> = {
  [ErrorCode.EQUALIZER_APO_NOT_INSTALLED]: {
    title: 'error.apoMissing',
    action: 'error.apoMissing.action',
  },
  [ErrorCode.CONFIG_NOT_FOUND]: {
    title: 'error.configMissing',
    action: 'error.configMissing.action',
  },
  [ErrorCode.INVALID_PARAMETER]: {
    title: 'error.invalidParameter',
    action: 'error.reachOut',
  },
  [ErrorCode.FAILURE]: {
    title: 'error.failure',
    action: 'error.failure.action',
  },
  [ErrorCode.PRESET_FILE_ERROR]: {
    title: 'error.presetFile',
    action: 'error.presetFile.action',
  },
  [ErrorCode.INVALID_PRESET_NAME]: {
    title: 'error.presetName',
    action: 'error.presetName.action',
  },
  [ErrorCode.OPRA_READ_ERROR]: {
    title: 'error.opra',
    action: 'error.reachOut',
  },
  // The impulse-response catalogue is fetched from AutoEq over the network,
  // which is a different thing failing for different reasons than the bundled
  // preset library — and it used to borrow that library's message, which read
  // as though the headphone list had broken when the network had.
  [ErrorCode.CONVOLUTION_CATALOG_ERROR]: {
    title: 'error.convolutionCatalog',
    action: 'error.convolutionCatalog.action',
  },
  // The fallback only. An import failure is almost always about the file the
  // user chose, so the thrower sends a `detail` saying which part of it was
  // the problem and this generic text is replaced.
  [ErrorCode.IMPORT_ERROR]: {
    title: 'error.import',
    action: 'error.import.action',
  },
  [ErrorCode.AUDIO_ENGINE_NOT_CHOSEN]: {
    title: 'error.engineNotChosen',
    action: 'error.engineNotChosen.action',
  },
  [ErrorCode.FLUID_ENGINE_NOT_INSTALLED]: {
    title: 'error.engineMissing',
    action: 'error.engineMissing.action',
  },
};

/** A code's description, in English: see `ERROR_TEXT`. */
const describe = (code: ErrorCode): ErrorDescription => ({
  shortError: en[ERROR_TEXT[code].title],
  action: en[ERROR_TEXT[code].action],
  code,
});

export const errors: Record<ErrorCode, ErrorDescription> = {
  [ErrorCode.EQUALIZER_APO_NOT_INSTALLED]: describe(
    ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
  ),
  [ErrorCode.CONFIG_NOT_FOUND]: describe(ErrorCode.CONFIG_NOT_FOUND),
  [ErrorCode.INVALID_PARAMETER]: describe(ErrorCode.INVALID_PARAMETER),
  [ErrorCode.FAILURE]: describe(ErrorCode.FAILURE),
  [ErrorCode.PRESET_FILE_ERROR]: describe(ErrorCode.PRESET_FILE_ERROR),
  [ErrorCode.INVALID_PRESET_NAME]: describe(ErrorCode.INVALID_PRESET_NAME),
  [ErrorCode.OPRA_READ_ERROR]: describe(ErrorCode.OPRA_READ_ERROR),
  [ErrorCode.CONVOLUTION_CATALOG_ERROR]: describe(
    ErrorCode.CONVOLUTION_CATALOG_ERROR,
  ),
  [ErrorCode.IMPORT_ERROR]: describe(ErrorCode.IMPORT_ERROR),
  [ErrorCode.AUDIO_ENGINE_NOT_CHOSEN]: describe(
    ErrorCode.AUDIO_ENGINE_NOT_CHOSEN,
  ),
  [ErrorCode.FLUID_ENGINE_NOT_INSTALLED]: describe(
    ErrorCode.FLUID_ENGINE_NOT_INSTALLED,
  ),
};

export const getErrorDescription = (code: ErrorCode) => errors[code];

/** One of the codes' descriptions, as `ipcRequest` rejects with. */
export const isErrorDescription = (value: unknown): value is ErrorDescription =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  typeof value.code === 'number' &&
  value.code in ERROR_TEXT &&
  'shortError' in value &&
  typeof value.shortError === 'string';

/**
 * An error as the reader sees it: main's own words where it sent some, which
 * main already put in the reader's language, and otherwise the code's own.
 */
export const errorText = (
  error: ErrorDescription,
  t: Translate,
): { title: string; action: string } => {
  const text = ERROR_TEXT[error.code];
  return {
    title: error.detail ?? (text ? t(text.title) : error.shortError),
    action: error.detailAction ?? (text ? t(text.action) : error.action),
  };
};
