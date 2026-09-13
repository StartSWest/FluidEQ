import {
  lampArrayFormOf,
  razerFormOf,
} from '../../../common/lighting/deviceForms';
import { describeRazer } from '../../../common/lighting/razerDevices';
import { RAZER_PRODUCTS } from '../../../common/lighting/razerProductData';
import { razerProductOf } from '../../../common/lighting/razerProducts';

describe('Razer products by product id', () => {
  it('reads every line of the table', () => {
    const lines = RAZER_PRODUCTS.trim().split('\n');
    // The table parses when the module loads and throws on a malformed line,
    // so every id in it resolving is the whole table being well formed.
    const ids = lines.map((line) => Number.parseInt(line.slice(0, 4), 16));
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(razerProductOf([id])).toEqual(
        expect.objectContaining({ productId: id }),
      );
    });
  });

  it('files the devices seen on real desks under the channel they follow', () => {
    // Razer's own table files the Mouse Dock Pro under mouse and leaves the
    // Base Station V2 out; both follow the mousepad channel.
    expect(razerProductOf([0x00a4])).toEqual(
      expect.objectContaining({ channel: 'mousepad' }),
    );
    expect(razerProductOf([0x0f20])).toEqual(
      expect.objectContaining({ channel: 'mousepad' }),
    );
    expect(razerProductOf([0x0567])).toEqual(
      expect.objectContaining({ channel: 'mousepad' }),
    );
    expect(razerProductOf([0x0c05])).toEqual(
      expect.objectContaining({ name: 'Razer Strider Chroma' }),
    );
  });

  it('gives every mapped LED one of the twenty mousepad zones', () => {
    const dock = razerProductOf([0x00a4]);
    expect(dock).toEqual(
      expect.objectContaining({ zones: [10, 7, 4, 2, 0, 17, 14, 12] }),
    );
    RAZER_PRODUCTS.trim()
      .split('\n')
      .map((line) => razerProductOf([Number.parseInt(line.slice(0, 4), 16)]))
      .forEach((product) => {
        if (product === undefined || product === 'unlit' || !product.zones) {
          return;
        }
        expect(product.channel).toBe('mousepad');
        product.zones.forEach((zone) => {
          expect(zone).toBeGreaterThanOrEqual(0);
          expect(zone).toBeLessThan(20);
        });
      });
  });

  it('finds the lit interface among several, whichever Windows lists first', () => {
    // A Base Station V2 Chroma's media keys (48F0) carry no light.
    expect(razerProductOf([0x48f0, 0x0f20])).toEqual(
      expect.objectContaining({ productId: 0x0f20 }),
    );
    expect(razerProductOf([0x48f0])).toBe('unlit');
  });

  it('leaves an id it has never seen to the name', () => {
    expect(razerProductOf([0xfffe])).toBeUndefined();
    expect(razerProductOf([0x0f2f, 0xfffe])).toBeUndefined();
    expect(razerProductOf([])).toBeUndefined();
  });
});

describe('describeRazer', () => {
  it('names a device whose USB string is a code by Razer’s name for it', () => {
    const keyboard = describeRazer({ name: 'DSV2Pro TKL', productId: 0x0298 });
    expect(keyboard.name).toMatch(/^Razer DeathStalker V2 Pro/);
    expect(keyboard).toEqual(
      expect.objectContaining({
        form: 'keyboard-tkl',
        kind: 'keyboard',
        channel: 'keyboard',
        lit: true,
      }),
    );
    const dock = describeRazer({
      name: 'RAZER THUNDERBOLT 4 DOCK CHROMA',
      productId: 0x0f21,
    });
    expect(dock.name).toBe('Razer Thunderbolt 4 Dock Chroma');
    expect(dock.form).toBe('dock');
  });

  it('keeps the name Razer’s driver gave', () => {
    expect(
      describeRazer({ name: 'Razer Basilisk V3', productId: 0x0099 }).name,
    ).toBe('Razer Basilisk V3');
  });

  it('draws the products that were drawn wrong as what they are', () => {
    expect(
      describeRazer({ name: 'Razer Mouse Dock Pro', productId: 0x00a4 }),
    ).toEqual(
      expect.objectContaining({
        form: 'mouse-dock',
        channel: 'mousepad',
        zones: [10, 7, 4, 2, 0, 17, 14, 12],
      }),
    );
    expect(
      describeRazer({ name: 'Razer Strider Chroma', productId: 0x0c05 }).form,
    ).toBe('desk-mat');
    expect(
      describeRazer({
        name: 'Razer Base Station V2 Chroma',
        productId: 0x48f0,
        productIds: [0x0f20, 0x48f0],
      }),
    ).toEqual(expect.objectContaining({ form: 'headset-stand', lit: true }));
  });

  it('draws a product by its class when no name says what it is', () => {
    expect(describeRazer({ name: 'Razer Blade', productId: 0x02c6 }).form).toBe(
      'laptop',
    );
  });

  it('hides unlit products, by id and, for ids it does not know, by name', () => {
    expect(
      describeRazer({ name: 'BlackShark V3 Pro', productId: 0x0577 }).lit,
    ).toBe(false);
    expect(describeRazer({ name: 'USB2.0 Hub', productId: 0x0f2f }).lit).toBe(
      false,
    );
    expect(
      describeRazer({ name: 'Razer BlackShark V9', productId: 0xfffe }).lit,
    ).toBe(false);
    // A future lit mouse the table does not know yet is still lit by name.
    expect(
      describeRazer({ name: 'Razer Basilisk V9 Pro', productId: 0xfffe }),
    ).toEqual(
      expect.objectContaining({ lit: true, form: 'mouse', channel: 'mouse' }),
    );
  });
});

describe('device forms from names', () => {
  it('takes the most specific product line first', () => {
    expect(razerFormOf('Razer Mouse Dock Pro')).toBe('mouse-dock');
    expect(razerFormOf('Razer BlackWidow V4 Mini HyperSpeed')).toBe(
      'keyboard-compact',
    );
    expect(razerFormOf('Razer BlackWidow Tournament Edition Chroma V2')).toBe(
      'keyboard-tkl',
    );
    expect(razerFormOf('Razer Aether Standing Light Bars')).toBe('lamp');
    expect(razerFormOf('Razer Aether Monitor Light Bar')).toBe('light-bar');
    expect(razerFormOf('Razer Raptor 27')).toBe('monitor');
    expect(razerFormOf('Razer Laptop Cooling Pad')).toBe('laptop-stand');
    expect(razerFormOf('Razer Something New')).toBe('accessory');
  });

  it('does not take a mouse or a microphone called Mini for a keyboard', () => {
    expect(razerFormOf('Razer Viper Mini')).toBe('mouse');
    expect(razerFormOf('Razer Seiren Mini')).toBe('microphone');
  });

  it('tells keyboard sizes and mats from what Windows Dynamic Lighting reports', () => {
    expect(lampArrayFormOf(1, 'Logitech G915 X', 0.47)).toBe('keyboard-full');
    expect(lampArrayFormOf(1, 'Logitech G915 X TKL', 0.37)).toBe(
      'keyboard-tkl',
    );
    expect(lampArrayFormOf(1, 'Keychron Q2', 0.32)).toBe('keyboard-compact');
    expect(
      lampArrayFormOf(4, 'Corsair MM700 RGB Extended Mouse Pad', 0.93),
    ).toBe('desk-mat');
    expect(lampArrayFormOf(4, 'SteelSeries QcK Prism Mouse Pad', 0.32)).toBe(
      'mousepad',
    );
    expect(lampArrayFormOf(13, 'Soundbar', 0.6)).toBe('soundbar');
  });
});
