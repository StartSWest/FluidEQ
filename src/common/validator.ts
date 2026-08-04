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

// Heavily modified from the validator generated from @rkesters/typescript-json-validator
import { FilterTypeEnum } from './constants';

const Ajv = require('ajv');

/**
 * Every filter type the app can actually produce, taken from the enum itself.
 *
 * These schemas used to hard-code ['HSC', 'LSC', 'PK'] while the band dropdown
 * offered seven types and the IPC handler accepted all seven. Choosing Notch,
 * Low Pass, High Pass or Band Pass therefore wrote a state file that failed its
 * own validation on the next launch — and the recovery path preserves the type,
 * so it failed too. The result was a silent reset to ten default bands, which
 * auto-save then wrote over the user's named profile. Deriving the list means
 * adding a type can never reintroduce that.
 */
const FILTER_TYPE_VALUES = Object.values(FilterTypeEnum);

export const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: false,
  strictNumbers: false,
  strictRequired: false,
  strictSchema: false,
  strictTuples: false,
  strictTypes: false,
  useDefaults: true,
});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

const IStateSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  defaultProperties: [],
  definitions: {
    FilterTypeEnum: {
      enum: FILTER_TYPE_VALUES,
      type: 'string',
    },
    AutoEqFormat: {
      enum: ['parametric', 'fixed-band', 'graphic'],
      type: 'string',
    },
    GraphicEqPoint: {
      properties: {
        frequency: { type: 'number' },
        gain: { type: 'number' },
      },
      required: ['frequency', 'gain'],
      type: 'object',
    },
    IFiltersMap: {
      additionalProperties: {
        $ref: '#/definitions/IFilter',
      },
      defaultProperties: [],
      description: '----- Application Interfaces -----',
      type: 'object',
    },
    IFilter: {
      defaultProperties: [],
      properties: {
        frequency: {
          type: 'number',
        },
        gain: {
          type: 'number',
        },
        id: {
          type: 'string',
        },
        quality: {
          type: 'number',
        },
        type: {
          $ref: '#/definitions/FilterTypeEnum',
        },
      },
      required: ['frequency', 'gain', 'id', 'quality', 'type'],
      type: 'object',
    },
  },
  properties: {
    filters: {
      $ref: '#/definitions/IFiltersMap',
    },
    isAutoPreAmpOn: {
      type: 'boolean',
    },
    isEnabled: {
      type: 'boolean',
    },
    isGraphViewOn: {
      type: 'boolean',
    },
    preAmp: {
      type: 'number',
    },
    eqFormat: {
      $ref: '#/definitions/AutoEqFormat',
    },
    graphicEq: {
      items: { $ref: '#/definitions/GraphicEqPoint' },
      type: 'array',
    },
  },
  required: [
    'filters',
    'isAutoPreAmpOn',
    'isEnabled',
    'isGraphViewOn',
    'preAmp',
  ],
  type: 'object',
};

export const IPresetSchemaV1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  defaultProperties: [],
  definitions: {
    FilterTypeEnum: {
      enum: FILTER_TYPE_VALUES,
      type: 'string',
    },
    AutoEqFormat: {
      enum: ['parametric', 'fixed-band', 'graphic'],
      type: 'string',
    },
    GraphicEqPoint: {
      properties: {
        frequency: { type: 'number' },
        gain: { type: 'number' },
      },
      required: ['frequency', 'gain'],
      type: 'object',
    },
    IFilter: {
      defaultProperties: [],
      properties: {
        frequency: {
          type: 'number',
        },
        gain: {
          type: 'number',
        },
        id: {
          type: 'string',
        },
        quality: {
          type: 'number',
        },
        type: {
          $ref: '#/definitions/FilterTypeEnum',
        },
      },
      required: ['frequency', 'gain', 'id', 'quality', 'type'],
      type: 'object',
    },
  },
  properties: {
    filters: {
      items: {
        $ref: '#/definitions/IFilter',
      },
      type: 'array',
    },
    preAmp: {
      type: 'number',
    },
    eqFormat: {
      $ref: '#/definitions/AutoEqFormat',
    },
    graphicEq: {
      items: { $ref: '#/definitions/GraphicEqPoint' },
      type: 'array',
    },
  },
  required: ['filters', 'preAmp'],
  type: 'object',
};

const IPresetSchemaV2 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  defaultProperties: [],
  definitions: {
    FilterTypeEnum: {
      enum: FILTER_TYPE_VALUES,
      type: 'string',
    },
    AutoEqFormat: {
      enum: ['parametric', 'fixed-band', 'graphic'],
      type: 'string',
    },
    GraphicEqPoint: {
      properties: {
        frequency: { type: 'number' },
        gain: { type: 'number' },
      },
      required: ['frequency', 'gain'],
      type: 'object',
    },
    Filters: {
      additionalProperties: {
        $ref: '#/definitions/IFilter',
      },
      defaultProperties: [],
      description: '----- Application Interfaces -----',
      type: 'object',
    },
    IFilter: {
      defaultProperties: [],
      properties: {
        frequency: {
          type: 'number',
        },
        gain: {
          type: 'number',
        },
        id: {
          type: 'string',
        },
        quality: {
          type: 'number',
        },
        type: {
          $ref: '#/definitions/FilterTypeEnum',
        },
      },
      required: ['frequency', 'gain', 'id', 'quality', 'type'],
      type: 'object',
    },
  },
  properties: {
    filters: {
      $ref: '#/definitions/Filters',
    },
    preAmp: {
      type: 'number',
    },
    eqFormat: {
      $ref: '#/definitions/AutoEqFormat',
    },
    graphicEq: {
      items: { $ref: '#/definitions/GraphicEqPoint' },
      type: 'array',
    },
  },
  required: ['filters', 'preAmp'],
  type: 'object',
};

export const validateState = ajv.compile(IStateSchema);
export const validatePresetV1 = ajv.compile(IPresetSchemaV1);
export const validatePresetV2 = ajv.compile(IPresetSchemaV2);
