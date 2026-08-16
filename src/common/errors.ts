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

import { PRODUCT_NAME } from './branding';

export enum ErrorCode {
  EQUALIZER_APO_NOT_INSTALLED,
  CONFIG_NOT_FOUND,
  TIMEOUT,
  INVALID_PARAMETER,
  FAILURE,
  PRESET_FILE_ERROR,
  INVALID_PRESET_NAME,
  OPRA_READ_ERROR,
  CONVOLUTION_CATALOG_ERROR,
  IMPORT_ERROR,
}

export type ErrorDescription = {
  shortError: string;
  action: string;
  code: ErrorCode;
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
]);

export const isBlockingError = (error?: ErrorDescription) =>
  !!error && BLOCKING_ERROR_CODES.has(error.code);

export const errors: Record<ErrorCode, ErrorDescription> = {
  [ErrorCode.EQUALIZER_APO_NOT_INSTALLED]: {
    shortError: 'Equalizer APO is not installed.',
    action: 'Please install Equalizer APO before retrying.',
    code: ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
  },
  [ErrorCode.CONFIG_NOT_FOUND]: {
    shortError: 'Unable to locate the configuration file for EqualizerAPO.',
    action:
      'Please check whether the config.txt file exists in the config folder of EqualizerAPO.',
    code: ErrorCode.CONFIG_NOT_FOUND,
  },
  [ErrorCode.TIMEOUT]: {
    shortError: 'Timeout waiting for a response.',
    action:
      'Please restart the application. If the error persists, try reaching out to the developers to resolve the issue.',
    code: ErrorCode.TIMEOUT,
  },
  [ErrorCode.INVALID_PARAMETER]: {
    shortError: 'Internal Error: Invalid parameter.',
    action: 'Please reach out to the developers to resolve the issue.',
    code: ErrorCode.INVALID_PARAMETER,
  },
  [ErrorCode.FAILURE]: {
    shortError: 'Internal Error: Failed to apply equalizer settings.',
    action:
      'Please restart the application. If the error persists, try reaching out to the developers to resolve the issue.',
    code: ErrorCode.FAILURE,
  },
  [ErrorCode.PRESET_FILE_ERROR]: {
    shortError: 'Internal Error: Failed to read or modify preset files.',
    action:
      'Please check that the preset name is saveable as a file and that the installation directory is in a writeable place. In addition, check that you have available storage space. If the error persists, try reaching out to the developers to resolve the issue.',
    code: ErrorCode.PRESET_FILE_ERROR,
  },
  [ErrorCode.INVALID_PRESET_NAME]: {
    shortError: 'Internal Error: Invalid preset name provided.',
    action:
      'Please provide a different preset name. If the error persists, try reaching out to the developers to resolve the issue.',
    code: ErrorCode.INVALID_PRESET_NAME,
  },
  [ErrorCode.OPRA_READ_ERROR]: {
    shortError: 'Internal Error: Failed to read the headphone preset library.',
    action: 'Please reach out to the developers to resolve the issue.',
    code: ErrorCode.OPRA_READ_ERROR,
  },
  // The impulse-response catalogue is fetched from AutoEq over the network,
  // which is a different thing failing for different reasons than the bundled
  // preset library — and it used to borrow that library's message, which read
  // as though the headphone list had broken when the network had.
  [ErrorCode.CONVOLUTION_CATALOG_ERROR]: {
    shortError: 'The convolution catalogue could not be reached.',
    action: 'Please check your connection and try again.',
    code: ErrorCode.CONVOLUTION_CATALOG_ERROR,
  },
  // The fallback only. An import failure is almost always about the file the
  // user chose, so the thrower sends a `detail` saying which part of it was
  // the problem and this generic text is replaced.
  [ErrorCode.IMPORT_ERROR]: {
    shortError: 'That file could not be imported.',
    action: `Please check that the file is an Equalizer APO EQ text file, a ${PRODUCT_NAME} profile, or a WAV impulse response.`,
    code: ErrorCode.IMPORT_ERROR,
  },
};

export const getErrorDescription = (code: ErrorCode) => errors[code];
