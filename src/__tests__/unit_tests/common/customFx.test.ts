import { hasCustomFxCurve, parseCustomFx } from 'common/customFx';

describe('custom APO FX', () => {
  it('keeps a native GraphicEQ curve for the renderer', () => {
    const custom = parseCustomFx(
      'fluideq-0123456789ab-custom.txt',
      '# user curve\nGraphicEQ: 20 -2; 1000 3; 20000 0',
    );

    expect(custom?.fileName).toBe('fluideq-0123456789ab-custom.txt');
    expect(custom?.graphicEq).toEqual([
      { frequency: 20, gain: -2 },
      { frequency: 1000, gain: 3 },
      { frequency: 20000, gain: 0 },
    ]);
    expect(hasCustomFxCurve(custom)).toBe(true);
  });

  it('does not treat GraphicEQ editor projections as a second stage', () => {
    const custom = parseCustomFx(
      'fluideq-0123456789ab-custom.txt',
      'GraphicEQ: 20 -2; 1000 3; 20000 0',
    );

    expect(custom?.filters).toEqual({});
  });

  it('keeps explicit filters alongside a native GraphicEQ', () => {
    const custom = parseCustomFx(
      'fluideq-0123456789ab-custom.txt',
      'GraphicEQ: 20 -2; 1000 3; 20000 0\nFilter 1: ON PK Fc 500 Hz Gain 2 dB Q 1',
    );

    expect(Object.values(custom?.filters ?? {})).toHaveLength(1);
    expect(Object.values(custom?.filters ?? {})[0].gain).toBe(2);
  });

  it('keeps unsupported commands as an applied layer without inventing a curve', () => {
    const custom = parseCustomFx(
      'fluideq-0123456789ab-custom.txt',
      'Delay: 5 ms\nPlugin: example.dll',
    );

    expect(custom).toBeDefined();
    expect(hasCustomFxCurve(custom)).toBe(false);
  });

  it('ignores the generated comment-only template', () => {
    expect(
      parseCustomFx(
        'fluideq-0123456789ab-custom.txt',
        '# Yours\n# FluidEQ never overwrites this file\n',
      ),
    ).toBeUndefined();
  });
});
