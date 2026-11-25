/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab's own-effects row and card (Ivan, 2026-11-25: "Put it at the
 * bottom of all the filters with a divider ... make sure it has the proper
 * name ... display the name and everything from Windows").
 *
 * The row stands after the last stage, inside its own divider block, never
 * above the rack's switch where it read as part of his processing. The card
 * says what the helper read of each effect — name, maker, where it runs,
 * file, class id, a Windows mark — and "Unnamed effect" only for a class
 * Windows truly has no name for.
 */

import { render, screen, within } from '@testing-library/react';
import type {
  IFluidEngineMicrophone,
  IMicEffect,
} from '../../../common/audioEngine';
import { micProfileSettings } from '../../../common/mic/micProfiles';
import MicOwnEffectsCard from '../../../renderer/mic/MicOwnEffectsCard';
import MicStageRail from '../../../renderer/mic/MicStageRail';

const OURS: IMicEffect = {
  clsid: '{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}',
  name: 'FluidEQ Engine',
  kind: 'endpoint',
};

const ELEVOC: IMicEffect = {
  clsid: '{0099058B-5D54-4EDF-944D-E8187363997A}',
  name: 'Elevoc Audio UAPO MFX',
  maker: 'Elevoc Technology Co.,Ltd',
  description: 'Elevoc Audio Effects Component',
  file: 'ElevocUAPO.dll',
  version: '1.0.1.984',
  kind: 'mode',
};

const PROXY: IMicEffect = {
  clsid: '{889C03C8-ABAD-4004-BF0A-BC7BB825E166}',
  name: 'Microsoft Audio Proxy Discover Effects APO',
  maker: 'Microsoft Corporation',
  file: 'MsApoFxProxy.dll',
  windows: true,
  kind: 'stream',
};

const BARE: IMicEffect = {
  clsid: '{00000000-1111-2222-3333-444444444444}',
  name: '',
};

const mic = (
  extra: Partial<IFluidEngineMicrophone>,
): IFluidEngineMicrophone => ({
  guid: '{MIC}',
  name: 'Microphone Array',
  attached: true,
  backupExists: true,
  ...extra,
});

describe("the Mic rail's own-effects row", () => {
  const renderRail = () =>
    render(
      <MicStageRail
        heading="Microphone Array"
        active="lowCut"
        settings={micProfileSettings('stream')}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
        onMaster={jest.fn()}
        delays={undefined}
        latest={{ current: undefined }}
        live={false}
        ownEffects={{ on: true, available: true }}
        onOwnToggle={jest.fn()}
      />,
    );

  it('stands after the last stage, behind its own divider', () => {
    const { container } = renderRail();
    const names = Array.from(
      container.querySelectorAll('.dsp-rail-tab .dsp-rail-name'),
      (node) => node.textContent,
    );
    expect(names[names.length - 1]).toBe('Mic’s own effects');
    expect(names[names.length - 2]).toBe('Limiter');
    // Control: it is not first, where it stood over the rack's switch.
    expect(names[0]).toBe('Low cut');
    const own = container.querySelector('.mic-rail__own');
    expect(own).not.toBeNull();
    expect(own?.textContent).toContain('Mic’s own effects');
    // The divider block holds the own row and nothing of the rack's.
    expect(own?.querySelectorAll('.dsp-rail-row')).toHaveLength(1);
    // Below the rack's switch in the document, not above it.
    const blocks = Array.from(container.querySelectorAll('nav > *'));
    const master = container.querySelector('.mic-rail__master');
    expect(master).not.toBeNull();
    expect(blocks.indexOf(own as Element)).toBeGreaterThan(
      blocks.indexOf(master as Element),
    );
  });

  it('keeps its switch inside the row', () => {
    renderRail();
    expect(
      screen.getByRole('checkbox', { name: 'Turn Mic’s own effects off' }),
    ).toBeTruthy();
  });
});

describe("the mic's own-effects card", () => {
  const renderCard = (value: IFluidEngineMicrophone) =>
    render(<MicOwnEffectsCard mic={value} press="idle" onSwitch={jest.fn()} />);

  const entry = (name: string) => {
    const item = screen.getByText(name).closest('li');
    if (!item) {
      throw new Error(`no entry for ${name}`);
    }
    return within(item);
  };

  it('says everything Windows has on record for each effect', () => {
    renderCard(mic({ runs: [ELEVOC, PROXY, OURS] }));
    const elevoc = entry('Elevoc Audio UAPO MFX');
    expect(
      elevoc.getByText(
        'Elevoc Technology Co.,Ltd · Runs on one kind of recording, such as calls',
      ),
    ).toBeTruthy();
    expect(elevoc.getByText('Elevoc Audio Effects Component')).toBeTruthy();
    expect(elevoc.getByText('ElevocUAPO.dll, version 1.0.1.984')).toBeTruthy();
    expect(elevoc.getByText(ELEVOC.clsid)).toBeTruthy();
    expect(elevoc.queryByText('Part of Windows')).toBeNull();
    const proxy = entry('Microsoft Audio Proxy Discover Effects APO');
    expect(proxy.getByText('Part of Windows')).toBeTruthy();
    expect(
      proxy.getByText('Microsoft Corporation · Runs on each app’s recording'),
    ).toBeTruthy();
    // A file with no version is the file alone.
    expect(proxy.getByText('MsApoFxProxy.dll')).toBeTruthy();
    // The engine itself is not one of the mic's own.
    expect(screen.queryByText('FluidEQ Engine')).toBeNull();
    expect(screen.queryByText('Unnamed effect')).toBeNull();
  });

  it('calls an effect unnamed only when Windows has no name for it', () => {
    renderCard(mic({ runs: [BARE, OURS] }));
    const bare = entry('Unnamed effect');
    expect(bare.getByText(BARE.clsid)).toBeTruthy();
    expect(bare.getByText('Maker not on record')).toBeTruthy();
  });

  it('lists what the switch took off, with where each ran', () => {
    renderCard(
      mic({
        runs: [OURS],
        ownEffectsOff: true,
        ownEffectsTaken: [ELEVOC],
      }),
    );
    expect(screen.getByText('Taken off')).toBeTruthy();
    const elevoc = entry('Elevoc Audio UAPO MFX');
    expect(elevoc.getByText('Off')).toBeTruthy();
    expect(
      elevoc.getByText(
        'Elevoc Technology Co.,Ltd · Runs on one kind of recording, such as calls',
      ),
    ).toBeTruthy();
  });

  it("reads an older helper's bare name without inventing the rest", () => {
    renderCard(
      mic({ runs: [{ clsid: '{OLD}', name: 'THX Spatial Audio APO' }, OURS] }),
    );
    const old = entry('THX Spatial Audio APO');
    // No kind, no file: only what was sent, and an honest maker line.
    expect(old.getByText('Maker not on record')).toBeTruthy();
    expect(old.getByText('{OLD}')).toBeTruthy();
  });
});
