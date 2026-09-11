/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAudioDevice } from 'common/constants';
import type { IEngineOutputHealth } from 'common/engineHealth';
import {
  engineTrouble,
  type IEngineTroubleFacts,
} from 'renderer/audio/engineTrouble';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  isFluidEngineAttached: true,
  canHostEffects: true,
};

const headphones: IAudioDevice = {
  ...speakers,
  id: 'headphones',
  name: 'Headphones',
  guid: '{BBBB}',
  isDefault: false,
};

const running = (
  fields: Partial<IEngineOutputHealth> = {},
): IEngineOutputHealth => ({
  endpoint: '{AAAA}',
  locked: true,
  processing: true,
  owner: true,
  problems: [],
  ...fields,
});

const facts = (fields: Partial<IEngineTroubleFacts>): IEngineTroubleFacts => ({
  engine: 'fluid',
  devices: [speakers, headphones],
  fluidEndpoints: [
    { guid: '{AAAA}', attached: true, backupExists: true },
    { guid: '{BBBB}', attached: true, backupExists: true },
  ],
  reportsStatus: true,
  health: { outputs: [] },
  heardGuid: undefined,
  ...fields,
});

describe('engineTrouble', () => {
  it('says the engine is off where sound was heard and the engine is not running', () => {
    expect(engineTrouble(facts({ heardGuid: '{AAAA}' }))).toEqual({
      kind: 'off',
      device: speakers,
      key: 'off:{AAAA}',
    });
  });

  it('says nothing about an engine too old to report what it is doing', () => {
    // The case above, through an engine from before status files: it runs
    // every output it is on and never writes a word, and was reported as
    // off while the EQ it applied was plainly audible.
    expect(
      engineTrouble(facts({ heardGuid: '{AAAA}', reportsStatus: false })),
    ).toBeUndefined();
  });

  it('says nothing about sound the engine is running', () => {
    // The positive control for the one above: the same sound, a status
    // saying the engine has the output.
    expect(
      engineTrouble(
        facts({ heardGuid: '{AAAA}', health: { outputs: [running()] } }),
      ),
    ).toBeUndefined();
  });

  it('says nothing about an engine passing through an EQ that asks for nothing', () => {
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          health: { outputs: [running({ processing: false })] },
        }),
      ),
    ).toBeUndefined();
  });

  it('says the engine is off when it runs cut off from FluidEQ', () => {
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          health: { outputs: [running({ processing: false, owner: false })] },
        }),
      )?.kind,
    ).toBe('off');
  });

  it('says the engine is off when the audio process that ran it is gone', () => {
    // `readEngineHealth` reads a dead writer's lock as false.
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          health: { outputs: [running({ locked: false })] },
        }),
      )?.kind,
    ).toBe('off');
  });

  it('says nothing before any sound is heard', () => {
    // Not running is the ordinary state of an output nobody is playing.
    expect(engineTrouble(facts({}))).toBeUndefined();
  });

  it('leaves outputs the engine is not on to their own notice', () => {
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          fluidEndpoints: [
            { guid: '{AAAA}', attached: false, backupExists: false },
          ],
        }),
      ),
    ).toBeUndefined();
    // Not listed by the setup helper at all is not a yes either.
    expect(
      engineTrouble(facts({ heardGuid: '{AAAA}', fluidEndpoints: [] })),
    ).toBeUndefined();
  });

  it('takes which outputs the engine is on from the setup helper', () => {
    // Its answer is the authority, whatever the device list's flag says.
    expect(
      engineTrouble(
        facts({
          heardGuid: '{aaaa}',
          devices: [{ ...speakers, isFluidEngineAttached: false }],
          fluidEndpoints: [
            { guid: 'aaaa', attached: true, backupExists: true },
          ],
        }),
      )?.kind,
    ).toBe('off');
  });

  it('leaves an output Windows runs no effects on to its own notice', () => {
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          devices: [{ ...speakers, canHostEffects: false }],
        }),
      ),
    ).toBeUndefined();
  });

  it('says nothing at all under Equalizer APO', () => {
    expect(
      engineTrouble(facts({ engine: 'apo', heardGuid: '{AAAA}' })),
    ).toBeUndefined();
    expect(
      engineTrouble(facts({ engine: null, heardGuid: '{AAAA}' })),
    ).toBeUndefined();
  });

  it('matches an endpoint however either side spelled it', () => {
    expect(
      engineTrouble(
        facts({
          heardGuid: 'aaaa',
          health: { outputs: [running({ endpoint: '{aaaa}' })] },
        }),
      ),
    ).toBeUndefined();
  });

  it('names what is missing on an output the engine is running', () => {
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [running({ problems: ['dsp-rack', 'convolution'] })],
          },
        }),
      ),
    ).toEqual({
      kind: 'problems',
      device: speakers,
      problems: ['dsp-rack', 'convolution'],
      canRestartHelp: true,
      key: 'problems:{AAAA}:dsp-rack,convolution',
    });
  });

  it('does not offer a restart for a file the engine could not read', () => {
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [running({ problems: ['convolution', 'graphic-eq'] })],
          },
        }),
      ),
    ).toEqual(expect.objectContaining({ canRestartHelp: false }));
  });

  it('puts the output being listened to ahead of another', () => {
    const trouble = engineTrouble(
      facts({
        health: {
          outputs: [
            running({ endpoint: '{BBBB}', problems: ['unwatched'] }),
            running({ problems: ['reload-failed'] }),
          ],
        },
      }),
    );
    expect(trouble?.device).toBe(speakers);
  });

  it('still names a second output when it is the only one in trouble', () => {
    const trouble = engineTrouble(
      facts({
        health: {
          outputs: [running({ endpoint: '{BBBB}', problems: ['unwatched'] })],
        },
      }),
    );
    expect(trouble?.device).toBe(headphones);
  });

  it('puts the engine being off ahead of anything missing', () => {
    const trouble = engineTrouble(
      facts({
        heardGuid: '{AAAA}',
        health: {
          outputs: [running({ endpoint: '{BBBB}', problems: ['dsp-rack'] })],
        },
      }),
    );
    expect(trouble?.kind).toBe('off');
  });

  it('ignores problems on an output that is not locked or cannot see FluidEQ', () => {
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [
              running({ locked: false, problems: ['dsp-rack'] }),
              running({
                endpoint: '{BBBB}',
                owner: false,
                problems: ['dsp-rack'],
              }),
            ],
          },
        }),
      ),
    ).toBeUndefined();
  });

  it('ignores an output no longer in the device list', () => {
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [running({ endpoint: '{CCCC}', problems: ['dsp-rack'] })],
          },
        }),
      ),
    ).toBeUndefined();
  });
});
