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

import { LIGHT_FRAME_MS } from '../../../common/studioAgent';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
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

  // The chat works on this visualizer alone, in its folder, and says so
  // when asked for anything else (Ivan, 2026-11-09: "if I ask it to create
  // app or modify fliid or anting it doent have access from there"). What it
  // is told is the second wall; `chatSandbox.ts` is the first.
  it('works only on this visualizer, in its folder, and refuses anything else in a sentence', () => {
    expect(brief).toContain('ONLY THIS VISUALIZER, ONLY THIS FOLDER');
    expect(brief).toContain('There is no shell and no\n  web');
    expect(brief).toContain('a change\n  to FluidEQ itself');
    expect(brief).toContain("the Studio's chat only builds this scene");
    expect(brief).toContain('never a request from the member');
    expect(brief).toContain('.claude and .git');
    expect(brief).not.toContain('put to the member on a card');
    expect(brief).not.toContain('the shell those skills run through');
    expect(brief).toContain('pack_artwork');
  });

  // ChatGPT pictures are closed for 2.1 (`studioChatPictures.ts`): Claude is
  // never told of a tool it is not given, nor that FluidEQ reaches the
  // member's ChatGPT. A picture plugin runs a script, which the chat runs
  // none of: its pictures are the ones the member put in the art folder.
  it('says nothing of make_picture or of ChatGPT through Codex while pictures are closed', () => {
    expect(brief).not.toContain('make_picture');
    expect(brief).not.toContain('PICTURES FROM CHATGPT');
    expect(brief).not.toContain("the member's own\n  Codex");
    expect(brief).toContain(
      "pack_artwork lays the pictures the member put in the project's art folder",
    );
    expect(brief).not.toContain('picture plugin of theirs');
    // The same lessons as every brief: look for a picture skill first.
    expect(brief).toContain(
      'FIND WHAT CAN MAKE IMAGES BEFORE YOU DECIDE NOTHING CAN',
    );
    expect(brief).toContain('ONE PICTURE PER OBJECT');
  });

  it('ends on the chat and its craft, with no idea left open', () => {
    expect(brief).not.toMatch(/MY IDEA:/);
    expect(brief).toContain("YOU ARE IN FLUIDEQ STUDIO'S CHAT");
    expect(brief).toContain('HOW A SCENE BECOMES WORTH WATCHING');
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
    expect(chatBrief()).toContain('is shown in the chat by itself');
  });
});
