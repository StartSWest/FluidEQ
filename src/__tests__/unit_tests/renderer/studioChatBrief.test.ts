/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio's AIs are told (Ivan, 2026-10-16: "review well ... the
 * agent now that we work inside and also even for external ai ... beautiful
 * but also always as performant as possible since this is an app for visual
 * music representation not for a game").
 */

import { NIGHT_BACKGROUND_MOST } from '../../../common/sceneDaylight';
import { LIGHT_FRAME_MS } from '../../../common/studioAgent';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import { ARTWORK_REFERENCE } from '../../../renderer/studio/aiPromptReference';
import chatBrief from '../../../renderer/studio/chat/chatBrief';

const FOLDER = 'C:/Scenes/Aurora';

describe("the Studio chat's brief", () => {
  const brief = chatBrief();

  // The same words for every project, so Claude Code's prompt cache holds
  // the brief once for every scene's chat: a path in it made each project's
  // chat write the whole brief to the cache again.
  it('names no folder by its path, only as the one Claude was started in', () => {
    expect(brief).toContain(
      'THE FOLDER TO WORK IN, which already exists:\n  your working directory - the folder you were started in',
    );
    expect(brief).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(chatBrief()).toBe(brief);
  });

  it('names the look and hear tools as the chat’s own, and asks for no switch', () => {
    expect(brief).toContain('FluidEQ gave it to you in this chat');
    expect(brief).toContain('HEAR THE SONG BEFORE YOU DESIGN FOR IT');
    expect(brief).not.toContain('If you do not have the tool');
    expect(brief).not.toContain('Let your AI see the stage');
    expect(brief).not.toContain('CONNECT TO FLUIDEQ FIRST');
  });

  // The member's own Claude Code tools and plugins are Claude's in the chat,
  // each put to the member first (Ivan, 2026-11-07: "claude need to have
  // access to all plugins that claude has").
  it("offers the member's own tools and plugins, each asked of the member first", () => {
    expect(brief).toContain(
      "You also have the member's own Claude Code\n  plugins' skills",
    );
    expect(brief).toContain('put to the member on a card in the chat');
    expect(brief).toContain('A no is final');
    expect(brief).not.toContain('You cannot run programs');
    expect(brief).toContain('pack_artwork');
  });

  // ChatGPT pictures are closed for 2.1 (`studioChatPictures.ts`): Claude is
  // never told of a tool it is not given, nor that FluidEQ reaches the
  // member's ChatGPT. A picture plugin of the member's own Claude Code is
  // theirs to use, and its pictures go in the art folder.
  it('says nothing of make_picture or of ChatGPT through Codex while pictures are closed', () => {
    expect(brief).not.toContain('make_picture');
    expect(brief).not.toContain('PICTURES FROM CHATGPT');
    expect(brief).not.toContain("the member's own\n  Codex");
    expect(brief).toContain('made with a picture plugin of theirs');
    // The same lessons as every brief: look for a picture skill first.
    expect(brief).toContain(
      'FIND WHAT CAN MAKE IMAGES BEFORE YOU DECIDE NOTHING CAN',
    );
    // How to make and pack them is the artwork skill's, which the brief
    // sends Claude to before any picture is made.
    expect(brief).toContain('fluideq-artwork skill: load it BEFORE');
    expect(brief).not.toContain('ONE PICTURE PER OBJECT');
    expect(ARTWORK_REFERENCE.body).toContain('ONE PICTURE PER OBJECT');
  });

  it('ends on the chat and its craft, with no idea left open', () => {
    expect(brief).not.toMatch(/MY IDEA:/);
    expect(brief).toContain("YOU ARE IN FLUIDEQ STUDIO'S CHAT");
    expect(brief).toContain('HOW A SCENE BECOMES WORTH WATCHING');
  });

  // Ivan, 2026-11-11: "always put update notes when finishing so when
  // publishing the notes are there". The chat's own section said to raise
  // the version instead, which FluidEQ does itself at publish.
  it('makes the update note the last step of every change, and leaves the version alone', () => {
    expect(brief).toContain('THE UPDATE NOTE IS PART OF EVERY CHANGE');
    expect(brief).toContain('"whatsNew"');
    expect(brief).toContain('is not finished');
    expect(brief).not.toMatch(/raise the version/);
    expect(brief).toContain('Leave the version in pack.json as it is');
  });

  // Ivan, 2026-11-11: "aware of the mobile UI to fill the black bottom".
  it('says the scene runs on past its panel, and where to look at it', () => {
    expect(brief).toContain('THE SCENE RUNS ON PAST ITS PANEL');
    expect(brief).toContain('shape "compact-player-column"');
    expect(brief).toContain('480 by 966');
  });

  // Ivan, 2026-11-11: "all scenes I build always make night at 0 too light;
  // it needs to be fully black look, as dark as the night".
  it('says night is black, how FluidEQ measures it, and never to pass a night that is too light', () => {
    expect(brief).toContain('NIGHT IS BLACK. At 0 the scene is as dark as');
    expect(brief).toContain(
      `${NIGHT_BACKGROUND_MOST}% of full brightness or under`,
    );
    expect(brief).toContain(
      'sliders { "daylight": 0 } and sound "silence" says how bright',
    );
    expect(brief).toContain('DAY IS BRIGHT.');
    expect(brief).toContain('THE MIDDLE IS DUSK');
    expect(brief).toContain(
      'Never tell the\n  member a night is done over TOO LIGHT',
    );
    expect(brief).toContain('fluideq-night-and-day');
    // The prompt copied for another AI carries the rule too.
    expect(promptWithIdea('a lake', FOLDER)).toContain('NIGHT IS BLACK.');
  });

  it('says motion is watched, and a frame sheet is never a plain picture', () => {
    expect(brief).toContain('watch_scene');
    expect(brief).toContain('A SHEET OF FRAMES IS NEVER A PLAIN PICTURE');
  });
});

describe('every brief', () => {
  const copied = promptWithIdea('a calm aurora', FOLDER);

  it('a prompt for another AI keeps its wording for a missing tool', () => {
    expect(copied).toContain('If you do not have the tool');
    expect(copied).not.toContain('HEAR THE SONG BEFORE YOU DESIGN FOR IT');
  });

  it('is a picture of the music, not a game', () => {
    expect(copied).toContain('A PICTURE OF THE MUSIC, NOT A GAME');
    expect(copied).not.toMatch(/game world|endless runner|dogfight/);
    expect(chatBrief()).toContain('A PICTURE OF THE MUSIC, NOT A GAME');
  });

  it('gives the frame budget look_at_scene measures against', () => {
    expect(copied).toContain(
      `under ${LIGHT_FRAME_MS} ms in look_at_scene's reading`,
    );
    expect(copied).toContain('BEAUTIFUL AND LIGHT, BOTH');
  });

  it('names the image tools an assistant may have', () => {
    expect(copied).toContain("ChatGPT's or Codex's image");
  });

  // Ivan, 2026-11-09, of a tube painted on flat cards over a photograph:
  // "still not 3d they are flat no perception of depth".
  it('builds what has volume as geometry, and gives every AI the skills from FluidEQ itself', () => {
    [copied, chatBrief()].forEach((brief) => {
      expect(brief).toContain('is real geometry in the world');
      expect(brief).toMatch(/never a ribbon/);
      expect(brief).toContain('fluideq-3d-world');
      expect(brief).toContain('fluideq-photo-3d');
      // Never pointed at a copy in the folder: a copy an update never reaches.
      expect(brief).not.toContain('.agents/skills');
      expect(brief).toContain('they are not in the project folder');
    });
    // The chat loads them as its own and is only told they are there; a
    // prompt for another AI carries them whole, as FluidEQ ships them.
    expect(chatBrief()).not.toContain('=== SKILL fluideq-photo-3d ===');
    expect(copied).toContain('=== SKILL fluideq-photo-3d ===');
    expect(copied).toContain('specularIntensity": 0');
    expect(chatBrief()).toContain('never open a picture in another program');
  });
});
