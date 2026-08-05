import {
  getVirtualDevices,
  hasVirtualRouting,
  identifyVirtualDevice,
  VirtualDeviceEnum,
} from '../../../common/virtualAudioDevices';
import { IAudioDevice } from '../../../common/constants';

const makeDevice = (name: string, guid = '{guid}'): IAudioDevice => ({
  id: `{0.0.0.00000000}.${guid}`,
  name,
  guid,
  isDefault: false,
  isActive: true,
});

describe('recognising a routing driver somebody else installed', () => {
  it('identifies VB-Cable through the driver suffix Windows appends', () => {
    expect(
      identifyVirtualDevice(makeDevice('CABLE Input (VB-Audio Virtual Cable)')),
    ).toEqual({ kind: VirtualDeviceEnum.VB_CABLE, inputLabel: 'Main' });
  });

  it('identifies the main Voicemeeter input', () => {
    expect(
      identifyVirtualDevice(
        makeDevice('VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)'),
      ),
    ).toEqual({ kind: VirtualDeviceEnum.VOICEMEETER, inputLabel: 'Main' });
  });

  it('does not let the general Voicemeeter rule swallow the Aux input', () => {
    // "voicemeeter aux input" also starts with "voicemeeter input"'s brand, so
    // rule order is load-bearing: get it wrong and every Voicemeeter input is
    // labelled Main, and a user pointing an app at one is told the wrong one.
    expect(
      identifyVirtualDevice(
        makeDevice('VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)'),
      ),
    ).toEqual({ kind: VirtualDeviceEnum.VOICEMEETER, inputLabel: 'Aux' });
  });

  it('identifies the VAIO3 input', () => {
    expect(
      identifyVirtualDevice(
        makeDevice('VoiceMeeter VAIO3 Input (VB-Audio VoiceMeeter VAIO3)'),
      ),
    ).toEqual({ kind: VirtualDeviceEnum.VOICEMEETER, inputLabel: 'VAIO3' });
  });

  it('leaves an ordinary sound card alone', () => {
    expect(
      identifyVirtualDevice(makeDevice('Speakers (Realtek(R) Audio)')),
    ).toBeUndefined();
    expect(
      identifyVirtualDevice(makeDevice('Headphones (2- USB Audio Device)')),
    ).toBeUndefined();
  });

  it('does not mistake the cable’s capture side for its input', () => {
    expect(
      identifyVirtualDevice(
        makeDevice('CABLE Output (VB-Audio Virtual Cable)'),
      ),
    ).toBeUndefined();
  });

  it('ignores case, because these arrive as vendor branding', () => {
    expect(identifyVirtualDevice(makeDevice('cable input'))?.kind).toBe(
      VirtualDeviceEnum.VB_CABLE,
    );
  });
});

describe('deciding which route to lead with', () => {
  const realDevices = [
    makeDevice('Speakers (Realtek(R) Audio)', '{aaa}'),
    makeDevice('USB Headphones', '{bbb}'),
  ];

  it('reports no routing when only real endpoints are present', () => {
    expect(hasVirtualRouting(realDevices)).toBe(false);
  });

  it('reports routing once a virtual input shows up', () => {
    expect(
      hasVirtualRouting([
        ...realDevices,
        makeDevice('CABLE Input (VB-Audio Virtual Cable)', '{ccc}'),
      ]),
    ).toBe(true);
  });

  it('lists only the virtual inputs, in the order given', () => {
    const devices = [
      realDevices[0],
      makeDevice('VoiceMeeter Aux Input', '{ccc}'),
      realDevices[1],
      makeDevice('VoiceMeeter Input', '{ddd}'),
    ];

    expect(
      getVirtualDevices(devices).map((device) => [
        device.guid,
        device.virtual.inputLabel,
      ]),
    ).toEqual([
      ['{ccc}', 'Aux'],
      ['{ddd}', 'Main'],
    ]);
  });
});
