export async function addOutputFeaturePages({
  page,
  picture,
  text,
  notes,
  accent,
  white,
  muted,
}) {
  let slide = await page(2, 'Second Output');
  text(
    slide,
    'Second Output\nSound in more places',
    64,
    162,
    956,
    192,
    71,
    white,
    true,
  );
  text(
    slide,
    'Play through headphones and speakers at once.\nGive each device its own level and EQ profile.',
    64,
    370,
    956,
    100,
    34,
    muted,
  );
  await picture(
    slide,
    'docs/02-online-media-multiple-outputs-one-player-at-a-time.png',
    48,
    532,
    984,
    535.05,
    'FluidEQ Second Output panel with individual device switches and levels beside Online Media',
  );
  text(
    slide,
    'Separate devices. Separate tuning.',
    64,
    1101,
    956,
    75,
    45,
    accent,
    true,
  );
  text(
    slide,
    'Mirroring runs while FluidEQ is open.\nPlayback delay depends on your devices.',
    64,
    1180,
    956,
    82,
    29,
    muted,
  );
  notes(
    slide,
    'Second Output mirrors playback to multiple devices with individual levels and saved EQ profiles. Each Windows output applies its own APO profile. FluidEQ must remain open. Device latency varies.',
    'Plays in two places at once',
  );

  slide = await page(3, 'Share Audio');
  text(
    slide,
    'Share Audio\nYour PCs, heard together',
    64,
    162,
    956,
    192,
    65,
    white,
    true,
  );
  text(
    slide,
    'Hear your other PCs through the computer\nconnected to your headphones or speakers.',
    64,
    370,
    956,
    100,
    35,
    muted,
  );
  await picture(
    slide,
    'docs/social/share-audio-roles.png',
    48,
    540,
    984,
    204.17,
    'FluidEQ Share Audio panel in Spanish with receiver and sender roles, a connection monitor and private local-network status; no pairing code is visible',
  );
  text(
    slide,
    'Several senders, one receiver',
    64,
    820,
    956,
    70,
    48,
    accent,
    true,
  );
  text(
    slide,
    'Same private network.\nPair with a connection code.\nKeep FluidEQ open on both ends.',
    64,
    925,
    956,
    190,
    39,
    white,
  );
  text(
    slide,
    'Shared audio bypasses the local Library DSP rack.',
    64,
    1191,
    970,
    45,
    29,
    muted,
  );
  notes(
    slide,
    'Share Audio sends system audio between computers on the same private network. Multiple senders can mix at one receiver. Pairing uses a private connection code. Keep FluidEQ open on both ends. Received shared audio bypasses Library DSP.',
    'docs/USER-GUIDE.md: Share audio between computers; src/renderer/remoteAudio',
  );
}
