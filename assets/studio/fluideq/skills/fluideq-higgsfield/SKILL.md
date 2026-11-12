---
name: fluideq-higgsfield
description: Make a picture, a video that becomes an animation, the frames of an animation or a 3D model for a FluidEQ scene with Higgsfield, on the member's own Higgsfield account and credits - how to tell whether Higgsfield is connected, what to say when it is not, how to say the cost before spending, and how to bring every result into the scene's folder. Use before anything is made outside FluidEQ, and whenever the member says "Higgsfield", "generate it", "make it with AI", "a 3D model of", "a video of", "animate it", or asks for a subject, material, backdrop, sprite, moving subject or model that drawing in the shader will not carry.
---

# Higgsfield in a FluidEQ scene

Higgsfield is a picture, video and 3D generator the member may have
connected to their own Claude Code. It is theirs: their account, their
plan, their credits. FluidEQ ships nothing of it, holds no sign-in of it
and pays for nothing. You reach it only through the tools it gives you.

## Is it connected?

Look at your own tools. Higgsfield's are the ones whose name carries
`higgsfield` - `mcp__higgsfield__...`, or `mcp__claude_ai_Higgsfield__...`
when the member has it as a claude.ai connector.

- **They are there**: it is connected. Read each tool's own description
  before you use it; this skill names none of them, because Higgsfield
  changes them and the newest are always the ones you are given.
- **They are not there**: it is not connected. Say so in one line and point
  the member to this chat's **Accounts**, under **Set up Higgsfield**: one
  press adds Higgsfield to their Claude Code and opens its sign-in in their
  browser. Its tools are yours from their next message. Until then draw the
  thing in the shader, or build it from the world's own shapes.
- **A tool answers that nobody is signed in, or that the plan does not allow
  it**: tell the member exactly that, in their words, and stop. Higgsfield
  needs a paid plan for its tools.

Never install, add, connect or sign in to anything yourself: not with a
command, not by editing a settings file, not by another tool. Setting it up
is the member's own press.

## The Studio's one maker

In FluidEQ Studio's chat, Higgsfield is what makes pictures, frames and
models: there is nothing to choose between. The member may have other
picture tools of their own; use one only when the member names it.

## What a scene can take

- **A subject, a backdrop, a material**: ask for one still picture - a
  subject on a plain flat background, or transparent when the tool offers
  it. Save it in `art/`, then `pack_artwork`.
- **The frames of an animation**: ask for still pictures of the poses, the
  same subject at the same size and place in each - a character Higgsfield
  keeps the same from picture to picture is the way to that. Then
  `build_sheet` (the fluideq-animation skill) - never `pack_artwork`.
- **A moving subject from a video**: a wing beat, a flag, a flame, a walk.
  A scene never plays a video; it becomes an animation. Ask for a few
  seconds, the camera still, the subject whole and on a plain flat
  background, moving through one clean loop. Save the video file itself in
  `art/`, then `video_frames` (8 to 16 frames over one loop, with `from` and
  `to` round it), then `build_sheet`, then `look_at_animation`.
- **A picture made better**: upscale one too small for its place (an
  artwork piece rarely needs more than 1024 a side); take the background
  out of a subject whose background is not flat, before `pack_artwork` or
  `build_sheet`; expand a backdrop to the shape it fills, such as the
  ultra-wide graph, five and a half times as wide as tall.
- **A thing in a 3D world**: ask for a 3D model as `.glb`, when its tools
  offer one. Then the world's `models` (the fluideq-3d-world skill).

A scene cannot play sound. Never ask Higgsfield for music, a voice or a
sound effect: the credits would be spent on something the scene cannot
use. Every other thing it makes is offered above only where the scene can
use the result.

## The cost comes first

Every generation spends the member's credits, and nothing caps them.

1. Before each generation say in the chat, in one line and in the member's
   language: what you will make, at what size or quality, and what it costs
   when a tool tells you (ask its balance or price tool first when it has
   one). When you cannot learn the cost, say that you cannot.
2. Then call the tool. FluidEQ puts every Higgsfield call on a card for the
   member; their yes on that card is the go. A no is final for that request:
   do not try the same thing another way.
3. One thing at a time. No batches, no "a few variations", no retry loops.
   Choose the smallest size that will hold up in the scene: artwork is laid
   into a sheet, so a subject rarely needs more than 1024 pixels a side.
4. To change a result, edit it when the tools can; do not make it again.
5. When the reply ends, say what was made and what it spent, when you know.

## Bring every result into the scene's folder

Higgsfield keeps what it makes in the member's own Assets and hands you an
address. A scene cannot load an address: it plays only what is in its
folder.

1. Download each result into this project's folder - pictures, frames and
   videos into `art/`, a model beside the world's other models - under a plain
   name that says what it is.
2. Open it and look. A wrong result is said to the member before anything
   else is spent.
3. Lay it in: `pack_artwork` for pictures, `build_sheet` for frames,
   `video_frames` and then `build_sheet` for a video, the world's `models`
   for a `.glb`. A model must pass FluidEQ's own check
   (size, textures, nothing loaded from outside); when it does not, say what
   failed and do not work around it.
4. Never write a Higgsfield address into a shader, `pack.json` or
   `world.json`.

## Reference pictures

Higgsfield's tools cannot read a picture attached to this chat. When a
reference is needed, use the way its own tools give - an upload they open,
or a public address they import - and tell the member first which picture
of theirs would leave their computer, and wait for their yes.

## What to say about it

A made picture is a made picture. Never tell the member, or write in the
scene's notes, that a person drew or photographed something Higgsfield
generated. Whether to publish a scene that carries one is the member's call.
