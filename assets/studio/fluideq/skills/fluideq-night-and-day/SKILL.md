---
name: fluideq-night-and-day
description: Make a FluidEQ scene's night really black and its day really bright, and check both with the numbers look_at_scene gives - at daylight 0 in silence the background must measure 6% or under. Use whenever you write or change a scene's light, sky, fog, colours or materials, whenever look_at_scene says "Night check: TOO LIGHT", and whenever the member says "night", "dark", "darker", "too light", "too bright", "washed out", "grey", "day", "brightness" or "daylight".
---

# Night and day in a FluidEQ scene

Every scene is played at a time of day: `daylight`, 0 for night to 100 for
day, set by FluidEQ from the window's Brightness. A listener with a black
window gets `daylight` 0, and expects a night.

## The rule

**At daylight 0 the scene is as dark as a real night.** The sky, the ground
and the water are near black. The only bright things are the ones that give
off light: the moon, stars, lamps, windows, fire, an aurora, neon, the
music's own element.

**At daylight 100 it is a full, bright day** - a light sky, lit ground,
clean colour - with nothing burnt to flat white.

**At 50 it is dusk**, a time of its own: low warm light, a deepening sky,
the first lamps on. Not the night at half strength, not the day greyed.

## It is measured, not judged

`look_at_scene` with `sliders: { "daylight": 0 }` and `sound: "silence"`
answers with a line like:

    How dark this picture is: its background (the darkest 60% of it) is at
    11.4% of full brightness ...
    Night check (daylight 0, silence): TOO LIGHT. ...

- The **background** is the darkest 60% of the picture - what a sky, a
  ground and water take up when the subject and the lights have the rest.
- A pixel is as bright as its brightest channel, so a deep blue or purple
  wash counts as the light it is.
- **Night passes at 6% or under.** That line comes from FluidEQ's own
  scenes: the ones whose night is black measure 1 to 5; the ones that are a
  blue or purple wash measure 8 to 17.
- The check is made in **silence**, where only the scene's own lights are
  on. With music the same scene measures lighter, and should.

A night that looks dark enough to you is, nearly always, still too light.
Go by the number. Never tell the member the night is done over a check that
says TOO LIGHT.

## When to look

After any change to light, colour, sky, fog or materials, and before saying
anything is done - three looks:

1. `sliders: { "daylight": 0 }`, `sound: "silence"` - read the Night check.
2. `sliders: { "daylight": 50 }` - is it a dusk?
3. `sliders: { "daylight": 100 }` - bright, and nothing burnt out?

Then once more at 0 with the music, to see that what the music lights
stands out of the dark.

## Making a night black in `scene.frag`

Write night and day as two sets of colours and blend by the time of day:

    float day = smoothstep(0.0, 1.0, clamp(uParam_daylight / 100.0, 0.0, 1.0));

- **Night colours are near zero.** A night sky is `vec3(0.0, 0.004, 0.012)`
  at the top and no more than `vec3(0.012, 0.015, 0.035)` at the horizon -
  not `vec3(0.09, 0.05, 0.15)`, which is the purple wash this rule is
  about. If your shader ends with a tone curve or a gamma, check what
  those numbers come out as: 0.02 through a `pow(c, 1/2.2)` is 17% on
  screen.
- **Everything that is not a light is multiplied by the day.** Ground,
  water, mountains, trees, clouds: `colour * mix(0.03, 1.0, day)` or darker,
  so by night they are silhouettes against a slightly less black sky, with
  only a rim from the moon or a lamp.
- **Haze, fog, mist and glow-in-the-air go to nothing at night**, except
  inside the reach of a light. A horizon haze of 0.1 everywhere is the
  commonest reason a night fails.
- **Lights are added, and reach a short way.** A lamp is its core plus
  `exp(-distance / reach)` with a small reach. A glow whose tail never
  falls to zero lifts the whole picture: cut it off
  (`max(glow - 0.004, 0.0)`).
- **No floor on the output.** No `max(colour, 0.03)`, no `colour + 0.02`
  "so it is not pure black", no vignette that adds. Grain to stop banding
  is one 255th, centred on zero.
- **The moon and stars are small.** A moon with a halo across a third of
  the sky is a lamp over the whole scene. Stars are points, and few.
- **The music lights the night; it does not paint it.** A beat can flash
  the subject, raise a glow, light the water under it. It must not lift the
  whole background: that is the night gone, sixteen times a bar.

## Making a night black in a 3D world

Everything that lights the whole world is a formula of `p.daylight`, and is
zero - or very nearly - at 0:

- **`ambient` and `hemisphere` lights**: intensity `0` at night.
  `"intensity": "0.9 * day"` with `"day": "smoothstep(0, 1, p.daylight / 100)"`
  in `vars`. An ambient light left on is the 3D way of a grey wash.
- **`environment`**: `environmentIntensity` is one number for night and
  day alike - it cannot follow `p.daylight` - and the studio environment
  lights every surface from every side. So a scene with a night uses
  `"environment": "none"`, or keeps the intensity at 0.05 or under, and
  gets its daylight from a `hemisphere` light that does follow the day.
- **The sun** (`directional`): its intensity falls to 0 by dusk, and a moon
  takes over at a twentieth of it or less, cool, from another side.
- **`fog`**: its `colour` is one fixed colour, so by itself it cannot be
  black at night and pale by day: a fog that is right at noon is a glowing
  band across the night. Use `"toBackdrop": true` with
  `"backdrop": "shader"`: the distance then thins into `scene.frag`'s sky,
  which follows the day.
- **`backdrop`**: `"shader"`, and `scene.frag` behind the world follows
  every rule in the section above. A colour backdrop is one colour at all
  hours, which is right for a scene that is always night and for no other.
- **`exposure`**: do not raise it at night to "see the scene". If the
  scene cannot be seen, it wants a light source in it, not a brighter
  camera.
- **Material GLSL** reads `uParam_daylight` and keeps to the same rule: no
  term that adds light everywhere.
- **What stays on**: point and spot lights that are lamps, fires and
  windows; `glow` materials; the moon. Give the subject a light of its own
  - a lantern, a rim from the moon - so it reads against the black.

## Making the day bright

- The sky is light: `vec3(0.45, 0.65, 0.95)` high to `vec3(0.85, 0.9, 0.95)`
  at the horizon, or the place's own.
- Ground and water take their true colours, lit; shadows short and soft.
- The scene's own lights soften into the daylight rather than vanish: a
  lamp is still a lamp at noon, just not the brightest thing.
- Nothing is flat white. If a white wall, a cloud or snow reads as one
  blank shape, bring it down until its shading shows: keep the brightest
  surface under about 0.9, and leave the last tenth for the sun and its
  glints.
- A scene with no place of its own - bars, waves, shapes - goes from black
  to a light, airy ground, and its colours from glowing to bright and
  clean: on a light ground, colour goes in as a dye, since light added to
  white only washes out.

## When the check fails

Work down this list, looking again at 0 in silence after each:

1. Print the sky alone: is its night colour near zero **after** the tone
   curve?
2. Is there fog, haze, mist or an atmosphere term not multiplied by the
   day?
3. In a world: an `ambient` or `hemisphere` light, or the `environment`,
   still on at 0?
4. A glow with a long tail, or a moon halo, covering the picture?
5. A floor on the output: `max(...)`, `+ 0.0x`, a lifted black in a
   colour grade?
6. Is the darkest 60% simply not background - is the subject, lit,
   filling the picture? Then pull the light in so it falls on the subject
   and not the space round it.
