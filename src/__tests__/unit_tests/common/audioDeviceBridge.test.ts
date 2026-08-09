import {
  DeviceMatchEnum,
  IMediaOutputDevice,
  isEligibleMirrorTarget,
  matchAudioDevices,
  normalizeDeviceName,
  resolveMirrorSinkId,
} from '../../../common/audioDeviceBridge';
import { IAudioDevice } from '../../../common/constants';

const makeDevice = (
  name: string,
  guid: string,
  overrides: Partial<IAudioDevice> = {},
): IAudioDevice => ({
  id: `{0.0.0.00000000}.${guid}`,
  name,
  guid,
  isDefault: false,
  isActive: true,
  ...overrides,
});

const makeOutput = (deviceId: string, label: string): IMediaOutputDevice => ({
  deviceId,
  label,
  groupId: `group-${deviceId}`,
});

describe('bridging Windows GUIDs to Chromium sink ids', () => {
  it('matches an endpoint whose name picks out exactly one output', () => {
    const devices = [makeDevice('Speakers (Realtek(R) Audio)', '{aaa}')];
    const outputs = [
      makeOutput('sink-1', 'Speakers (Realtek(R) Audio)'),
      makeOutput('sink-2', 'USB Headphones'),
    ];

    expect(matchAudioDevices(devices, outputs)).toEqual([
      {
        guid: '{aaa}',
        name: 'Speakers (Realtek(R) Audio)',
        status: DeviceMatchEnum.MATCHED,
        sinkId: 'sink-1',
      },
    ]);
  });

  it('ignores case and repeated whitespace, which never carry meaning', () => {
    const devices = [makeDevice('  Studio   Monitors ', '{bbb}')];
    const outputs = [makeOutput('sink-1', 'studio monitors')];

    const [match] = matchAudioDevices(devices, outputs);

    expect(match.status).toBe(DeviceMatchEnum.MATCHED);
    expect(match.sinkId).toBe('sink-1');
    expect(normalizeDeviceName('  Studio   Monitors ')).toBe('studio monitors');
  });

  it('matches through the USB id Chromium adds and Windows does not', () => {
    // Real names, off a real machine. Chromium appends the vendor:product id
    // to USB endpoints only, which is why the Realtek output below matched all
    // along and every Razer one did not.
    const devices = [
      makeDevice('Speakers (Razer Leviathan V2)', '{usb}'),
      makeDevice('Speakers (Realtek(R) Audio)', '{onboard}'),
    ];
    const outputs = [
      makeOutput('sink-usb', 'Speakers (Razer Leviathan V2) (1532:0532)'),
      makeOutput('sink-onboard', 'Speakers (Realtek(R) Audio)'),
    ];

    expect(
      matchAudioDevices(devices, outputs).map((match) => [
        match.status,
        match.sinkId,
      ]),
    ).toEqual([
      [DeviceMatchEnum.MATCHED, 'sink-usb'],
      [DeviceMatchEnum.MATCHED, 'sink-onboard'],
    ]);
  });

  it('does not mistake a bracketed name for a USB id', () => {
    // The suffix is four hex digits, a colon, four hex digits. An ordinary
    // name that happens to end in brackets must survive intact, or two NVIDIA
    // outputs would fold into one another and both be refused.
    expect(normalizeDeviceName('Y27qf-30 (NVIDIA High Definition Audio)')).toBe(
      'y27qf-30 (nvidia high definition audio)',
    );
    expect(
      normalizeDeviceName('Speakers (Razer Leviathan V2) (1532:0532)'),
    ).toBe('speakers (razer leviathan v2)');
  });

  it('still refuses when stripping the USB id makes two names collide', () => {
    // Two of the same product. The suffix is exactly what told them apart, so
    // removing it must not turn a refusal into a coin flip.
    const devices = [makeDevice('Speakers (Razer Kraken V4 Pro)', '{aaa}')];
    const outputs = [
      makeOutput('sink-1', 'Speakers (Razer Kraken V4 Pro) (1532:0567)'),
      makeOutput('sink-2', 'Speakers (Razer Kraken V4 Pro) (1532:0568)'),
    ];

    const [match] = matchAudioDevices(devices, outputs);

    expect(match.status).toBe(DeviceMatchEnum.AMBIGUOUS);
    expect(match.sinkId).toBeUndefined();
  });

  it('refuses when two outputs answer to the same name', () => {
    const devices = [makeDevice('Speakers', '{ccc}')];
    const outputs = [
      makeOutput('sink-1', 'Speakers'),
      makeOutput('sink-2', 'Speakers'),
    ];

    const [match] = matchAudioDevices(devices, outputs);

    // Refusing is the whole point: picking either one is a coin flip that
    // plays a correction into a speaker the user did not choose.
    expect(match.status).toBe(DeviceMatchEnum.AMBIGUOUS);
    expect(match.sinkId).toBeUndefined();
    expect(match.tiedSinkIds).toEqual(['sink-1', 'sink-2']);
  });

  it('refuses when Windows itself has two endpoints of that name', () => {
    // Only one Chromium output, so the name looks unique from that side alone.
    // It is not: two endpoints are called this, and the survivor of
    // `filterVisibleAudioDevices` would otherwise match with false confidence.
    const devices = [
      makeDevice('Speakers', '{ddd}'),
      makeDevice('Speakers', '{eee}'),
    ];
    const outputs = [makeOutput('sink-1', 'Speakers')];

    const matches = matchAudioDevices(devices, outputs);

    expect(matches.map((match) => match.status)).toEqual([
      DeviceMatchEnum.AMBIGUOUS,
      DeviceMatchEnum.AMBIGUOUS,
    ]);
    expect(matches.every((match) => match.sinkId === undefined)).toBe(true);
  });

  it('reports an endpoint Chromium is not offering as unmatched', () => {
    const devices = [makeDevice('Optical Out', '{fff}')];
    const outputs = [makeOutput('sink-1', 'Speakers')];

    expect(matchAudioDevices(devices, outputs)[0].status).toBe(
      DeviceMatchEnum.UNMATCHED,
    );
  });

  it('separates withheld labels from a genuine failure to match', () => {
    const devices = [makeDevice('Speakers', '{ggg}')];
    const outputs = [makeOutput('sink-1', ''), makeOutput('sink-2', '')];

    // The fix here is a permission, not renaming a speaker, so the caller has
    // to be able to tell the two apart.
    expect(matchAudioDevices(devices, outputs)[0].status).toBe(
      DeviceMatchEnum.LABELS_HIDDEN,
    );
  });

  it('treats a machine with no outputs as unmatched, not as hidden labels', () => {
    const devices = [makeDevice('Speakers', '{hhh}')];

    expect(matchAudioDevices(devices, [])[0].status).toBe(
      DeviceMatchEnum.UNMATCHED,
    );
  });

  it('never resolves to Chromium’s moving aliases', () => {
    const devices = [makeDevice('Speakers', '{iii}')];
    const outputs = [
      // Chromium can label the alias identically to the endpoint it points at.
      // Counting it would make a unique name look ambiguous, and selecting it
      // would hand back a sink that silently retargets when the user changes
      // their default output.
      makeOutput('default', 'Speakers'),
      makeOutput('communications', 'Speakers'),
      makeOutput('sink-1', 'Speakers'),
    ];

    const [match] = matchAudioDevices(devices, outputs);

    expect(match.status).toBe(DeviceMatchEnum.MATCHED);
    expect(match.sinkId).toBe('sink-1');
  });

  it('returns one result per device, in the order given', () => {
    const devices = [
      makeDevice('Speakers', '{jjj}'),
      makeDevice('USB Headphones', '{kkk}'),
      makeDevice('Optical Out', '{lll}'),
    ];
    const outputs = [
      makeOutput('sink-headphones', 'USB Headphones'),
      makeOutput('sink-speakers', 'Speakers'),
    ];

    expect(
      matchAudioDevices(devices, outputs).map((match) => [
        match.guid,
        match.sinkId,
      ]),
    ).toEqual([
      ['{jjj}', 'sink-speakers'],
      ['{kkk}', 'sink-headphones'],
      ['{lll}', undefined],
    ]);
  });
});

describe('re-resolving a persisted mirror target', () => {
  const devices = [
    makeDevice('Speakers', '{aaa}'),
    makeDevice('USB Headphones', '{bbb}'),
  ];
  const outputs = [
    makeOutput('sink-1', 'Speakers'),
    makeOutput('sink-2', 'USB Headphones'),
  ];

  it('finds the sink id for a stored GUID', () => {
    expect(resolveMirrorSinkId('{bbb}', devices, outputs)).toEqual({
      guid: '{bbb}',
      name: 'USB Headphones',
      status: DeviceMatchEnum.MATCHED,
      sinkId: 'sink-2',
    });
  });

  it('gives nothing for an endpoint that is no longer present', () => {
    // Unplugged or disabled. Distinct from present-but-unmatchable, because
    // the two need different things said about them.
    expect(resolveMirrorSinkId('{gone}', devices, outputs)).toBeUndefined();
  });

  it('reports the stored GUID as ambiguous rather than guessing', () => {
    expect(
      resolveMirrorSinkId('{aaa}', devices, [
        makeOutput('sink-1', 'Speakers'),
        makeOutput('sink-3', 'Speakers'),
      ])?.status,
    ).toBe(DeviceMatchEnum.AMBIGUOUS);
  });
});

describe('choosing a legal mirror target', () => {
  it('keeps the mirror off the endpoint being captured', () => {
    // Capture is a loopback of the output. Playing back into it feeds the
    // capture, which feeds the playback, which builds every pass.
    const captured = makeDevice('Speakers', '{aaa}', { isDefault: true });

    expect(isEligibleMirrorTarget(captured, '{aaa}')).toBe(false);
    expect(isEligibleMirrorTarget(makeDevice('Rears', '{bbb}'), '{aaa}')).toBe(
      true,
    );
  });

  it('falls back to the default endpoint when the source is not named', () => {
    expect(
      isEligibleMirrorTarget(
        makeDevice('Speakers', '{aaa}', { isDefault: true }),
      ),
    ).toBe(false);
    expect(isEligibleMirrorTarget(makeDevice('Rears', '{bbb}'))).toBe(true);
  });

  it('rejects an endpoint that is not active', () => {
    expect(
      isEligibleMirrorTarget(makeDevice('Rears', '{bbb}', { isActive: false })),
    ).toBe(false);
  });
});
