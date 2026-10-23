/* FluidEQ — GPL-3.0-or-later */

import type os from 'os';
import {
  broadcastOf,
  isVirtualAdapter,
  lanInterfaces,
} from '../../../main/remoteAudioLanAddresses';

const v4 = (address: string, netmask = '255.255.255.0') =>
  ({
    address,
    netmask,
    family: 'IPv4',
    internal: false,
    mac: '00:00:00:00:00:00',
    cidr: null,
  }) as unknown as os.NetworkInterfaceInfo;

describe('the addresses one Share Audio code carries', () => {
  it('leaves out container and VM bridges, which another computer cannot reach', () => {
    // This server's own list when the code page showed seventeen codes.
    const interfaces = {
      wlp2s0: [v4('192.168.1.30')],
      'br-92066c3bd293': [v4('172.21.0.1', '255.255.0.0')],
      'br-a1d5f5dbdff9': [v4('192.168.16.1', '255.255.240.0')],
      docker0: [v4('172.17.0.1', '255.255.0.0')],
      'vEthernet (WSL)': [v4('172.28.48.1', '255.255.240.0')],
      lo: [{ ...v4('127.0.0.1'), internal: true }],
    };

    expect(lanInterfaces(interfaces)).toEqual([
      { address: '192.168.1.30', broadcast: '192.168.1.255' },
    ]);
  });

  it('keeps both of two real network cards, home network first', () => {
    const interfaces = {
      eth0: [v4('10.0.0.5', '255.0.0.0')],
      wlan0: [v4('192.168.1.40')],
    };

    expect(lanInterfaces(interfaces).map((entry) => entry.address)).toEqual([
      '192.168.1.40',
      '10.0.0.5',
    ]);
  });

  it('keeps a virtual adapter when it is the only network there is', () => {
    expect(lanInterfaces({ docker0: [v4('172.17.0.1')] })).toHaveLength(1);
  });

  it('works out each network’s broadcast address', () => {
    expect(broadcastOf('192.168.1.30', '255.255.255.0')).toBe('192.168.1.255');
    expect(broadcastOf('172.21.3.9', '255.255.0.0')).toBe('172.21.255.255');
    expect(broadcastOf('10.4.5.6', '255.0.0.0')).toBe('10.255.255.255');
  });

  it('names the adapters that exist only inside one computer', () => {
    [
      'docker0',
      'br-0f91cc6b47d1',
      'veth12ab',
      'virbr0',
      'vEthernet (WSL)',
      'VMware Network Adapter VMnet8',
      'tailscale0',
    ].forEach((name) => expect(isVirtualAdapter(name)).toBe(true));
    ['eth0', 'wlp2s0', 'enp3s0', 'Wi-Fi', 'Ethernet 2'].forEach((name) =>
      expect(isVirtualAdapter(name)).toBe(false),
    );
  });
});
