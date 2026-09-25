/**
 * The part of the Studio's AI prompt (`aiPrompt.ts`) that makes the AI hear
 * the song before it designs for it: the hear_the_music tool
 * (`main/studioAgent/studioTools.ts`), what it answers, and that a scene
 * never carries one song's times. Only in a prompt that carries the
 * connection (`aiPromptConnect.ts`): without it the AI has no way to ask.
 *
 * English, like the rest of the prompt: it is read by a model.
 */
export const HEAR_SECTION = `
HEAR THE SONG BEFORE YOU DESIGN FOR IT. The scene plays every song I own,
but I make it with one in mind, and you cannot hear it. hear_the_music tells
you how that song moves as FluidEQ heard it on this computer: where it is
calm and where it is strong, how it builds into its big moments and where
the drops land, where a voice sings and in what range, its drums and its
tempo - section by section, then second by second, in the names of the
uniforms your scene is handed. Before you start, ask me to play the song I
want the scene for, with FluidEQ open, and call it once it has played - the
more of the song, the more you see. Then let the song decide: what the scene
does in its calm parts, how it grows as the music builds, what happens as a
drop lands, what answers the voice, how strongly each uniform needs to move
it. Never write the song's times into the scene: it has to play every other
song too, and each of these moments reaches it live through the uniforms the
answer names.
`;
