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
  const brief = chatBrief(FOLDER);

  it('names the look and hear tools as the chat’s own, and asks for no switch', () => {
    expect(brief).toContain('FluidEQ gave it to you in this chat');
    expect(brief).toContain('HEAR THE SONG BEFORE YOU DESIGN FOR IT');
    expect(brief).not.toContain('If you do not have the tool');
    expect(brief).not.toContain('Let your AI see the stage');
    expect(brief).not.toContain('CONNECT TO FLUIDEQ FIRST');
  });

  it('says what the chat cannot do: run scripts or download', () => {
    expect(brief).toContain('You cannot run programs or reach the internet');
    expect(brief).toContain('pack_artwork');
  });

  // ChatGPT pictures are closed for 2.1 (`studioChatPictures.ts`): Claude is
  // never told of a tool it is not given, nor that FluidEQ reaches the
  // member's ChatGPT. (The art section every AI gets still says to use an
  // image tool of its own, if it has one; Claude in the chat has none.)
  it('says nothing of make_picture or of ChatGPT through Codex while pictures are closed', () => {
    expect(brief).not.toContain('make_picture');
    expect(brief).not.toContain('PICTURES FROM CHATGPT');
    expect(brief).not.toContain("the member's own\n  Codex");
    expect(brief).toContain('You draw everything');
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
    expect(chatBrief(FOLDER)).toContain('A PICTURE OF THE MUSIC, NOT A GAME');
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
});
