export async function addShowcasePages({
  page,
  picture,
  text,
  notes,
  accent,
  white,
  muted,
}) {
  let slide = await page(1, 'FluidEQ', true);
  await picture(slide, 'assets/icon.png', 64, 64, 76, 76, 'FluidEQ logo');
  text(slide, 'FluidEQ', 64, 162, 860, 140, 110, white, true);
  text(
    slide,
    'Your sound, finally\nworth watching',
    64,
    308,
    880,
    172,
    67,
    white,
    true,
  );
  text(
    slide,
    'Equalizer, music player and karaoke for Windows.',
    64,
    498,
    940,
    55,
    32,
    muted,
  );
  await picture(
    slide,
    'docs/03-eq-parametric-bands-and-live-response.png',
    48,
    602,
    984,
    535.05,
    'FluidEQ parametric equalizer with colorful bands and live response graph',
  );
  text(slide, 'Free and open source', 64, 1174, 850, 64, 40, accent, true);
  notes(
    slide,
    'FluidEQ is an Equalizer APO interface with music playback and karaoke. Public Windows 10 and 11 download. No performance claims.',
    'What it does; Getting started; Supporting the work',
  );

  slide = await page(2, 'Headphone correction');
  text(
    slide,
    'Tuning that fits\nyour headphones',
    64,
    162,
    956,
    192,
    76,
    white,
    true,
  );
  text(
    slide,
    'Start with a measured correction.\nThen make the sound your own.',
    64,
    370,
    950,
    100,
    36,
    muted,
  );
  await picture(
    slide,
    'docs/04-eq-headphone-correction-and-import.png',
    48,
    532,
    984,
    535.05,
    'Headphone correction library, published measurement curve and Squiglink import',
  );
  text(slide, '6,229', 64, 1088, 365, 116, 94, accent, true);
  text(
    slide,
    'headphone models\nin the offline OPRA library',
    429,
    1114,
    600,
    100,
    33,
    muted,
  );
  notes(
    slide,
    'The documented offline OPRA catalog contains 6,229 headphone models. Published correction remains independent of manual EQ. Count reflects supplied screenshots and documentation.',
    'Start from a measurement',
  );

  slide = await page(3, 'Automatic device profiles');
  text(
    slide,
    'Each device keeps\nits own sound',
    64,
    162,
    956,
    192,
    76,
    white,
    true,
  );
  text(
    slide,
    'Switch from headphones to speakers.\nYour saved tuning follows the output.',
    64,
    370,
    950,
    100,
    36,
    muted,
  );
  await picture(
    slide,
    'docs/02-online-media-multiple-outputs-one-player-at-a-time.png',
    48,
    532,
    984,
    535.05,
    'Online Media beside automatic device profiles and second output controls',
  );
  text(
    slide,
    'Up to 128 EQ bands per output',
    64,
    1101,
    950,
    64,
    43,
    accent,
    true,
  );
  text(
    slide,
    'System EQ on Windows, powered by Equalizer APO.',
    64,
    1183,
    950,
    48,
    31,
    muted,
  );
  notes(
    slide,
    'Per-device settings restore when switching outputs. System parametric EQ supports up to 128 bands and uses Equalizer APO. Second-output mirroring is visible in the existing screenshot.',
    'Follows your output; Six layers, one chain; Plays in two places at once',
  );

  slide = await page(4, 'DSP for local playback');
  text(
    slide,
    'More control over\nyour local music',
    64,
    162,
    956,
    192,
    76,
    white,
    true,
  );
  text(
    slide,
    'Clean up noise, shape bass and control loudness.\nSave the processing chain you like.',
    64,
    370,
    970,
    100,
    34,
    muted,
  );
  await picture(
    slide,
    'docs/07-dsp-maximizer-and-processing-chain.png',
    48,
    532,
    984,
    535.05,
    'FluidEQ nine-stage DSP rack with Maximizer gain-reduction graph and controls',
  );
  text(slide, '9 processing stages', 64, 1100, 950, 75, 56, accent, true);
  text(
    slide,
    "DSP applies to FluidEQ's local player, not other apps.",
    64,
    1191,
    970,
    45,
    30,
    muted,
  );
  notes(
    slide,
    "Nine-stage native DSP rack applies to music played by FluidEQ's own local player. It does not process Spotify, YouTube or other apps. Individual stages and whole racks support saved settings.",
    'Shape what FluidEQ itself plays',
  );

  slide = await page(5, 'Local music library');
  text(
    slide,
    'Your collection,\nback in the spotlight',
    64,
    162,
    980,
    192,
    72,
    white,
    true,
  );
  text(
    slide,
    'Browse your albums in Cover Flow.\nBuild a queue from the music you already own.',
    64,
    370,
    960,
    100,
    34,
    muted,
  );
  await picture(
    slide,
    'docs/09-library-album-and-play-queue.png',
    48,
    532,
    984,
    535.05,
    'FluidEQ Library with album Cover Flow, track list and Up Next queue',
  );
  text(
    slide,
    'A home for your local music',
    64,
    1101,
    950,
    75,
    49,
    accent,
    true,
  );
  text(slide, 'FLAC, MP3, WAV, M4A and more.', 64, 1191, 950, 45, 34, muted);
  notes(
    slide,
    'Library reads user-selected folders, provides album/artist/genre/song/folder/video browsing and Cover Flow, and builds the playback queue from the current view. Music is not included.',
    'Play what is already on the machine',
  );

  slide = await page(6, 'Custom visualizers');
  text(
    slide,
    'A visualizer\nwith your signature',
    64,
    162,
    980,
    192,
    76,
    white,
    true,
  );
  text(
    slide,
    'Choose a form. Adjust its color and glow.\nWatch your music fill the screen.',
    64,
    370,
    950,
    100,
    36,
    muted,
  );
  await picture(
    slide,
    'docs/10-library-customize-visualizer.png',
    48,
    532,
    984,
    535.05,
    'Full-screen rainbow pillar visualizer and its appearance designer',
  );
  text(slide, 'Made to be personalized', 64, 1101, 960, 75, 53, accent, true);
  text(
    slide,
    'Live controls for palette, density and motion.',
    64,
    1191,
    950,
    45,
    33,
    muted,
  );
  notes(
    slide,
    'Visualizer offers selectable forms, palettes and a designer for appearance parameters. No particular performance or refresh-rate claim. Album art is shown only within the existing app screenshot.',
    'Watch the sound, however you like to',
  );

  slide = await page(7, 'Karaoke player');
  text(
    slide,
    'Your next karaoke\nnight starts here',
    64,
    162,
    980,
    192,
    76,
    white,
    true,
  );
  text(
    slide,
    'Bring your songs and timed lyrics.\nSing along on a full-screen stage.',
    64,
    370,
    950,
    100,
    36,
    muted,
  );
  await picture(
    slide,
    'docs/11-karaoke-player.png',
    48,
    532,
    984,
    535.05,
    'Karaoke player with synchronized lyrics, playlist and estimated chord display',
  );
  text(slide, 'Live pitch feedback', 64, 1101, 950, 75, 57, accent, true);
  text(
    slide,
    'Connect a microphone. Target notes need\na compatible lyric file. Music is not included.',
    64,
    1176,
    950,
    86,
    29,
    muted,
  );
  notes(
    slide,
    'Karaoke supports synchronized lyrics and user-enabled microphone pitch feedback. Real target notes require a compatible UltraStar file. LRC lyrics alone do not supply target melody. No music ships with the app.',
    'Sing over what you already own',
  );

  slide = await page(8, 'Karaoke Maker');
  text(
    slide,
    'A karaoke version\nyou can make yourself',
    64,
    162,
    984,
    192,
    70,
    white,
    true,
  );
  text(
    slide,
    'Separate voice and backing. Edit lyric timing\nand melody notes in Karaoke Maker.',
    64,
    370,
    970,
    100,
    34,
    muted,
  );
  await picture(
    slide,
    'docs/12-karaoke-maker-pitch-and-lyrics.png',
    48,
    532,
    984,
    535.05,
    'Karaoke Maker with waveform, lyric timing, editable pitch notes and live preview',
  );
  text(
    slide,
    'Your audio stays on your PC',
    64,
    1101,
    956,
    75,
    48,
    accent,
    true,
  );
  text(
    slide,
    'Optional AI tools download models once.\nUse music and lyrics you have permission to use.',
    64,
    1178,
    960,
    86,
    29,
    muted,
  );
  notes(
    slide,
    'Separation, transcription and melody analysis run locally. Optional models require initial downloads. Separation is an estimate from a mixed recording and is not guaranteed to reproduce studio stems. Users supply authorized audio and lyrics.',
    'And make the file when the song does not have one; Local and account-free',
  );

  slide = await page(9, 'Download FluidEQ', true);
  await picture(slide, 'assets/icon.png', 64, 78, 102, 102, 'FluidEQ logo');
  text(slide, 'FluidEQ', 64, 222, 880, 146, 108, white, true);
  text(
    slide,
    'Your next listen\ncould feel different',
    64,
    402,
    938,
    197,
    70,
    white,
    true,
  );
  text(
    slide,
    'Free for Windows 10 & 11.\nOpen source. No FluidEQ account required.',
    64,
    658,
    920,
    115,
    36,
    muted,
  );
  text(slide, 'fluideq.com', 64, 853, 920, 110, 80, accent, true);
  text(slide, 'Built by Ivan Carmenates Garcia', 64, 1013, 925, 56, 31, white);
  text(slide, 'What would you try first?', 64, 1102, 920, 60, 40, white, true);
  notes(
    slide,
    'Free unsigned Windows 10/11 download, open source under GPL-3.0-or-later, no FluidEQ account. External media sites can have their own sign-in requirements. Creator attribution from repository README. Download destination verified on 5 September 2026.',
    'Getting started; Supporting the work',
  );
}
