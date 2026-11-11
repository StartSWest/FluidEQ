---
name: fluideq-hands
description: The reference for what a listener's hand does to a FluidEQ scene - uPointer, uTap and uCamera with their formulas, the "camera" ranges and pivot in pack.json, and the pieces thrown from the pointer (pack.json "pointer") with every bound. Load before you use uPointer, uTap or uCamera, before you write or change "camera" or "pointer", and whenever the member says "turn", "rotate", "orbit", "zoom", "drag", "mouse", "pointer", "tap", "click", "touch", "sparks" or "trail".
---

THE VIEWER'S HANDS
The listener can reach into a scene: point at it, tap it, and turn a 3D one
with the mouse. It is a gift, never the point. Most of the time nobody
touches it, and nobody ever can on the desktop background or the desk
lights, so the scene is whole with uPointer.w at 0, and whatever the pointer
does fades with uPointer.w.
- uPointer: light that follows the hand, eyes that watch it, fur that parts
  or water that ripples under it, the world leaning towards it. xy is where
  it is, in uv; z rises to 1 while it is held down.
- uTap: something that happens where the viewer tapped - a ripple, a burst, a
  creature turning to look - driven by uTap.z, the seconds since, which reads
  60 until the first tap:
    float age = uTap.z;
    float ring = exp(-2.0 * age)
               * (1.0 - smoothstep(0.0, 0.015, abs(length(p - tap) - 0.6 * age)));
  with p and tap the pixel and uTap.xy in the same aspect-corrected space.
  uTap.w changes with every tap: hash it for each one's own colour or
  direction. Keep it small and quick like a beat; the rules on flashing hold.
- uCamera: the viewer turns a 3D scene by dragging it and moves in and out
  with the wheel, and FluidEQ does all of that - the dragging, the easing,
  the limits, the way back to your view. Say how far in pack.json:
    "camera": { "yaw": [-0.9, 0.9], "pitch": [-0.15, 0.6], "zoom": [0.7, 1.8] }
  radians round to either side, down and up, and how far out and in. Each
  range holds 0 (1 for zoom), which is your own view, and FluidEQ keeps the
  camera inside them. Pitch above 0 raises the viewer to look down on the
  scene. The widest FluidEQ allows: pitch 1.45 each way,
  zoom 0.25 to 4, and yaw [-3.1416, 3.1416],
  which goes all the way round - uCamera.x then wraps, so use it only inside
  sin and cos. Leave "camera" out and the scene cannot be turned.
  In a 3D world, "pivot": "eye" makes the turn a look round from where your
  camera stands - its zoom a longer lens - instead of an orbit round what it
  looks at. Give it to every landscape, whose target is far off (an orbit
  round it swings the camera through the foreground), and to any world
  whose sky shader still paints its subject: the look moves the world and
  the painted sky together, where an orbit parts them and shows the subject
  twice. Keep an eye pivot to small angles - 0.1 to 0.2 each way - so it
  reads as leaning in, never as leaving the picture. In your own shader,
  orbit your camera about what it looks at:
    float yaw = uCamera.x;
    float pitch = 0.3 + uCamera.y;       // your own tilt, plus theirs
    float dist = 4.5 / uCamera.z;
    vec3 target = vec3(0.0, 1.0, 0.0);
    vec3 ro = target + dist * vec3(sin(yaw) * cos(pitch), sin(pitch),
                                   cos(yaw) * cos(pitch));
  then build forward, right and up from ro to target as always, and keep
  your own tilt plus theirs short of 1.57, straight down or up, where a
  look-at camera folds. Choose the ranges from pictures: every angle you
  allow must look designed - no bare underside of a floor, no missing back
  wall, no subject leaving the frame. Letting me turn a scene that was built
  for one view means building what it never showed - its sides, a back, a
  floor to the edges, a subject deep enough from the side - and that is
  keeping its look, from every angle.
  A flat scene can take a camera too, as parallax: each layer shifted by
  uCamera.xy times its depth.

THROWN FROM THE HAND (pack.json "pointer", optional)
FluidEQ can throw pieces from the listener's pointer over the scene - a trail
as the mouse crosses it, a burst where it taps - drawn by FluidEQ in front of
the scene, while the listener's Pointer sparks switch is on. A flower
throws its petals, a fire its sparks, a winter scene its snow. Give it where
it belongs to the idea, never as decoration for its own sake:
  "pointer": { "emitters": [
    { "on": "move", "element": "petals", "amount": 3, "size": [10, 18],
      "life": 1.6, "speed": 0.3, "spread": 0.6, "gravity": 0.35,
      "spin": 0.6 },
    { "on": "tap", "shape": "spark", "colours": ["#ffd27a", "#ff8a4c"],
      "amount": 14, "size": [6, 12], "life": 0.9, "speed": 0.7,
      "spread": 1, "gravity": 0.2, "spin": 0.2 }
  ] }
- on: "move" throws "amount" pieces for every 100 pixels the hand travels,
  left behind it; "tap" throws "amount" at once, up and out.
- element: one of the scene's own elements in the window (see AMBIENT), by
  its id - its shape, outline or picture and its colours - or shape, one of
  petal, blossom, leaf, star, spark, bokeh, firefly, bubble, snow, gem, bird, with "colours" (1 to 3; an element's own when
  left empty).
- size [smallest, largest] in pixels (4 to 48); life in seconds (0.2 to 3); speed
  0..1, how fast a piece leaves the hand; spread 0..1, from straight away to
  every way round; gravity -1..1, rising (below 0) to falling (above 0);
  spin 0..1, how much each turns as it flies. Flat things - petals, leaves,
  birds - turn over as they fall by themselves.
- At most 3 emitters; a trail at most 8 pieces for every 100 pixels, a burst
  at most 24; FluidEQ keeps 90 pieces in the air at most, across all of them,
  and throws nothing for someone who asked for less motion.
