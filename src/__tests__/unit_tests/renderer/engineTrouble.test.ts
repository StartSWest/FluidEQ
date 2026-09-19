/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAudioDevice } from 'common/constants';
import type { IEngineOutputHealth } from 'common/engineHealth';
import {
  engineOnOutput,
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
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          health: { outputs: [running({ locked: false })] },
        }),
      ),
    ).toEqual({
      kind: 'off',
      device: speakers,
      key: 'off:{AAAA}',
    });
  });

  it('marks an output the engine has never written a status for as never created there', () => {
    // The engine writes a status the moment Windows builds it on an output,
    // before any sound passes; sound heard and no status is an output the
    // driver never built it on — whatever it did elsewhere — and a restart
    // cannot help, only a different slot can.
    const trouble = engineTrouble(
      facts({ heardGuid: '{AAAA}', hasEverRun: true }),
    );
    expect(trouble?.kind === 'off' && trouble.neverRan).toBe(true);
    expect(trouble?.key).toBe('off:never:{AAAA}');
  });

  it('says the sound is going past an engine that is locked and has had none', () => {
    // Ivan's laptop speaker: locked, owner, saying it was processing, and no
    // audio ever in its hands, because Windows plays that output through a
    // chain the engine is not in. Every field but the last says healthy.
    const trouble = engineTrouble(
      facts({
        heardGuid: '{AAAA}',
        reportsCarried: true,
        health: { outputs: [running({ carried: false })] },
      }),
    );
    expect(trouble?.kind === 'off' && trouble.bypassed).toBe(true);
    // Not an engine Windows never created: it ran, and it is running.
    expect(trouble?.kind === 'off' && trouble.neverRan).toBeUndefined();
    expect(trouble?.key).toBe('off:bypassed:{AAAA}');
  });

  it('says nothing when the sound has reached the engine', () => {
    // The positive control: the same status with audio having arrived.
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          reportsCarried: true,
          health: { outputs: [running({ carried: true })] },
        }),
      ),
    ).toBeUndefined();
  });

  it('never calls an older engine passed over for saying nothing', () => {
    // An engine from before this field writes no answer at all, and a status
    // without one must not be read as no sound having come — that would put
    // the card on every output of every machine not yet updated.
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          reportsCarried: false,
          health: { outputs: [running({ carried: false })] },
        }),
      ),
    ).toBeUndefined();
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

  it('marks an engine Windows has never created, so the card can say so', () => {
    const trouble = engineTrouble(
      facts({ heardGuid: '{AAAA}', hasEverRun: false }),
    );
    expect(trouble?.kind).toBe('off');
    expect(trouble?.kind === 'off' && trouble.neverRan).toBe(true);
    // Its own key: the two cards say different things and offer different
    // buttons, so putting one away must not silence the other.
    expect(trouble?.key).toContain('never');
  });

  it('leaves an output with its enhancements switched off to the same notice', () => {
    // Restarting Windows audio cannot help here — Windows loads no effect on
    // that output at all — and this card's own button offers exactly that.
    expect(
      engineTrouble(
        facts({
          heardGuid: '{AAAA}',
          devices: [{ ...speakers, effectsEnabled: false }],
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
      // Equalizer APO stays off a card that offers a fresh engine: it would
      // give up the rack for certain, and the offer above it can bring the
      // rack back.
      canApoHelp: false,
      canInstallHelp: true,
      updateReady: false,
      key: 'problems:{AAAA}:dsp-rack,convolution',
    });
  });

  it('sends a rack that would not start to a fresh engine, not to a restart', () => {
    // The rack is the one part of the engine the app talks to over a wire
    // both sides have to agree on, so an engine older than the app cannot
    // start it. A user with a half-installed engine had the EQ playing and
    // every DSP effect off; the card's restart brought the same engine back
    // and failed the same way, and putting this app's own engine in place
    // is what mended it.
    expect(
      engineTrouble(
        facts({
          health: { outputs: [running({ problems: ['dsp-rack'] })] },
          engineUpdateReady: true,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        canInstallHelp: true,
        updateReady: true,
        // And Equalizer APO is not offered beside it: there is no rack in it
        // at all, so it is strictly less than the action being recommended.
        canApoHelp: false,
      }),
    );
  });

  it('keeps a fresh engine out of troubles a fresh engine does not mend', () => {
    // The positive control for the case above: everything else on this card
    // is the engine's own state or a file it could not read, and swapping
    // the engine for an identical one changes neither.
    [
      'convolution',
      'graphic-eq',
      'eq-phase',
      'reload-failed',
      'unwatched',
    ].forEach((code) => {
      expect(
        engineTrouble(
          facts({
            health: { outputs: [running({ problems: [code] })] },
            engineUpdateReady: true,
          }),
        ),
      ).toEqual(expect.objectContaining({ canInstallHelp: false }));
    });
  });

  it('claims the engine is out of date only where that was established', () => {
    // `updateReady` is main's comparison of the two engines by content. An
    // engine it could not compare must not be called old on the card.
    expect(
      engineTrouble(
        facts({ health: { outputs: [running({ problems: ['dsp-rack'] })] } }),
      ),
    ).toEqual(
      expect.objectContaining({ canInstallHelp: true, updateReady: false }),
    );
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

  it('does not offer a restart for a bounded linear-phase design refusal', () => {
    expect(
      engineTrouble(
        facts({ health: { outputs: [running({ problems: ['eq-phase'] })] } }),
      ),
    ).toEqual(expect.objectContaining({ canRestartHelp: false }));
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [running({ problems: ['eq-phase', 'reload-failed'] })],
          },
        }),
      ),
    ).toEqual(expect.objectContaining({ canRestartHelp: true }));
  });

  it('does not send a DSP failure to Equalizer APO, which has no DSP', () => {
    expect(
      engineTrouble(
        facts({ health: { outputs: [running({ problems: ['dsp-rack'] })] } }),
      ),
    ).toEqual(expect.objectContaining({ canApoHelp: false }));
    expect(
      engineTrouble(
        facts({
          health: {
            outputs: [running({ problems: ['dsp-rack', 'eq-phase'] })],
          },
        }),
      ),
    ).toEqual(expect.objectContaining({ canApoHelp: false }));
  });

  it('offers Equalizer APO for what is the engine itself failing', () => {
    [
      'reload-failed',
      'unwatched',
      'convolution',
      'from-a-newer-engine',
    ].forEach((code) => {
      expect(
        engineTrouble(
          facts({ health: { outputs: [running({ problems: [code] })] } }),
        ),
      ).toEqual(expect.objectContaining({ canApoHelp: true }));
    });
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

describe('whether the engine is reaching the output being listened to', () => {
  // What the side bar's switch reads and what the engine's name is lit by.
  // The switch used to follow FluidEQ's own power and nothing else, so a
  // Bluetooth headset Windows has never once loaded the engine on showed the
  // same lit switch, and the same rainbow name, as an output being processed.
  const asked = (fields: Partial<IEngineTroubleFacts>) => {
    const all = facts(fields);
    return engineOnOutput(all, engineTrouble(all));
  };

  it('says yes for an output the engine is on and nothing is wrong with', () => {
    expect(
      asked({ heardGuid: '{AAAA}', health: { outputs: [running()] } }),
    ).toBe(true);
  });

  it('says no for an output the engine was never put on', () => {
    // No sound needed: not being there is not something to be heard.
    expect(
      asked({
        fluidEndpoints: [
          { guid: '{AAAA}', attached: false, backupExists: false },
          { guid: '{BBBB}', attached: true, backupExists: true },
        ],
      }),
    ).toBe(false);
  });

  it('says no where Windows runs no effects at all', () => {
    expect(asked({ devices: [{ ...speakers, canHostEffects: false }] })).toBe(
      false,
    );
    expect(asked({ devices: [{ ...speakers, effectsEnabled: false }] })).toBe(
      false,
    );
  });

  it('says no once the engine is known not to be running there', () => {
    // Ivan's Bluetooth headset: attached, and Windows has never loaded it.
    expect(asked({ heardGuid: '{AAAA}', hasEverRun: false })).toBe(false);
  });

  it('keeps saying yes while only part of what it was asked for failed', () => {
    // The engine is running this output; one stage of it would not start.
    // Calling the switch off there is the same lie in the other direction.
    expect(
      asked({ health: { outputs: [running({ problems: ['dsp-rack'] })] } }),
    ).toBe(true);
  });

  it('says nothing before the outputs have been read, or under Equalizer APO', () => {
    // The positive control for every `false` above: no answer is not a fault,
    // and a switch that read off for the first seconds of every session would
    // be a worse lie than the one being fixed.
    expect(asked({ devices: [], fluidEndpoints: [] })).toBeUndefined();
    expect(asked({ engine: 'apo' })).toBeUndefined();
  });
});
