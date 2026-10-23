/** @jest-environment node */
import {
  macOutputGuid,
  parseMacOutputs,
} from '../../../main/macEngine/macOutputs';
import { parseMacEngineVersion } from '../../../main/macEngine/macEngineStatus';

describe('Mac outputs and engine identity', () => {
  it('turns a Core Audio UID into the same SHA-256 endpoint the native engine uses', () => {
    expect(macOutputGuid('abc')).toBe('{BA7816BF-8F01-CFEA-4141-40DE5DAE2223}');
    expect(macOutputGuid('other')).not.toBe(macOutputGuid('abc'));
  });

  it('lists real outputs with stable profile identities and the default flag', () => {
    const outputs = parseMacOutputs(
      JSON.stringify([
        { uid: 'abc', name: 'Headphones', isDefault: true },
        { uid: 'other', name: '' },
      ]),
    );
    expect(outputs).toHaveLength(2);
    expect(outputs[0]).toMatchObject({
      id: 'abc',
      guid: macOutputGuid('abc'),
      name: 'Headphones',
      isDefault: true,
      isFluidEngineAttached: true,
    });
    expect(outputs[1]).toMatchObject({ name: 'other', isDefault: false });
  });

  it('rejects malformed output lists without inventing a demo output', () => {
    ['not json', '{}', 'null', '[null,1,{}, {"uid":""}]'].forEach((text) => {
      expect(parseMacOutputs(text)).toEqual([]);
    });
  });

  it('accepts only the native engine version format', () => {
    expect(parseMacEngineVersion('1.21.0.0\n')).toBe('1.21.0.0');
    ['1.21', 'unknown', '1.21.0.0 extra', ''].forEach((text) => {
      expect(parseMacEngineVersion(text)).toBeUndefined();
    });
  });
});
