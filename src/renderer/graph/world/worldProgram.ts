/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Fog,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { IScenePack } from 'common/scenePacks';
import { worldHasMirror, worldVarUniform } from 'common/sceneWorld';
import { uniformNameForParam } from 'common/sceneUniformContract';
import type { ISceneProgram, TSceneCompileResult } from '../sceneGl';
import { createWorldBloom } from './worldBloom';
import createWorldCamera from './worldCamera';
import { createWorldComposite } from './worldComposite';
import { createFormula } from './worldFormula';
import { createWorldInputs } from './worldInputs';
import type { IWorldMaterialContext } from './worldMaterials';
import { createWorldMirror } from './worldMirror';
import { parseWorldModels } from './worldModels';
import { buildWorldNodes } from './worldNodes';
import { createWorldPass } from './worldPasses';
import {
  externalTargets,
  programReady,
  trackDrawnTargets,
  waitForPrograms,
} from './worldRenderer';

/**
 * A 3D world as a scene program: the same `draw`, on the same context, into
 * the same target, as a shader-only scene.
 *
 * That is the whole integration. The worker binds whatever the picture is to
 * be finished in — the brightness limiter's target for a member's scene, the
 * finishing chain's for FSR, supersampling or FXAA, or the canvas itself —
 * and calls `draw`. The world renders into targets of its own, then lays the
 * finished picture into the one it found bound, inside the scissor it found
 * set, and leaves the context as the worker expects to find it. Nothing
 * downstream can tell a world from a shader, so everything downstream works
 * on both: FSR brings a world drawn at half size up to the panel exactly as
 * it brings a shader up.
 *
 * What the world adds before handing over is what a shader cannot do for
 * itself: geometry edges are multisampled four times (the anti-aliasing FSR
 * asks its input to have, and that no edge filter matches on a thin
 * silhouette), light is kept in half floats so a lamp can outshine a wall,
 * and the glow reads that light (`worldBloom.ts`).
 */

const abortError = () => new DOMException('World load abandoned', 'AbortError');

/** Pixels past which the world skips multisampling: it is supersampled. */
const MULTISAMPLE_LIMIT = 3840 * 2160;

const compileWorld = async (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  artwork: ImageBitmap | undefined,
  signal: AbortSignal | undefined,
  hurry: AbortSignal | undefined,
  /**
   * Frees what `release` frees once `linked` says the links are done: the
   * worker's own tracker (`sceneCompile.ts`), which it waits for before it
   * is ended.
   */
  releaseWhenLinked: (linked: () => boolean, release: () => void) => void,
): Promise<TSceneCompileResult> => {
  const { world } = pack;
  if (!world) {
    return { ok: false, log: 'the pack has no world' };
  }
  const renderer = new WebGLRenderer({
    canvas: gl.canvas,
    context: gl,
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  // A lost context takes every object with it, and the worker lets the
  // program go without disposing it (`sceneRenderer.worker.ts`). Three's
  // listeners on the canvas would outlive it and bring this renderer back to
  // life on the restored context beside the one the worker builds, so they
  // go with the context.
  const onLost = () => renderer.dispose();
  gl.canvas.addEventListener('webglcontextlost', onLost, { once: true });
  const external = externalTargets(renderer);
  if (!external) {
    gl.canvas.removeEventListener('webglcontextlost', onLost);
    renderer.dispose();
    return { ok: false, log: 'this build of three cannot draw into the scene' };
  }
  const targets = trackDrawnTargets(renderer);
  const disposables: { dispose(): void }[] = [];
  /** Drawn once and still wanted after a rest: the studio lighting. */
  const kept: WebGLRenderTarget[] = [];
  // Never disposed: its framebuffer becomes the worker's, and disposing a
  // target deletes its framebuffer. It owns nothing of its own to free.
  const shown = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    generateMipmaps: false,
  });
  let released = false;
  /**
   * Everything the world made, once, however its build ends: a build that
   * threw part way left its renderer, its listener on the canvas and every
   * picture made so far to the collector.
   */
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    targets.free([shown]);
    disposables.forEach((item) => item.dispose());
    gl.canvas.removeEventListener('webglcontextlost', onLost);
    renderer.dispose();
  };
  /** Set once `release` is someone else's to run: a link still in flight. */
  let handedOff = false;
  try {
    const problems: string[] = [];
    renderer.debug.onShaderError = (context, program, vertex, fragment) => {
      const log = [
        context.getProgramInfoLog(program),
        context.getShaderInfoLog(vertex),
        context.getShaderInfoLog(fragment),
      ]
        .filter((line): line is string => Boolean(line && line.trim()))
        .join('\n');
      problems.push(log || 'a world material did not compile');
    };
    renderer.autoClear = false;
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.resetState();

    const floatTargets = gl.getExtension('EXT_color_buffer_float') !== null;
    const maxSamples = Number(gl.getParameter(gl.MAX_SAMPLES)) || 0;
    const contractArtwork = artwork ? new Texture(artwork) : null;
    if (contractArtwork) {
      contractArtwork.flipY = false;
      contractArtwork.needsUpdate = true;
      disposables.push(contractArtwork);
    }
    const usesAtlas = Object.values(world.materials).some(
      (material) => material.map || material.emissiveMap,
    );
    const atlas = artwork && usesAtlas ? new Texture(artwork) : null;
    if (atlas) {
      atlas.flipY = false;
      atlas.colorSpace = SRGBColorSpace;
      atlas.needsUpdate = true;
      disposables.push(atlas);
    }

    const inputs = createWorldInputs(pack, contractArtwork);
    disposables.push(inputs);
    const { parsed: models, problems: notes } = await parseWorldModels(
      world.models,
    );
    if (signal?.aborted) {
      release();
      throw abortError();
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      50,
      1,
      world.camera.near,
      world.camera.far,
    );
    if (world.fog) {
      scene.fog = new Fog(world.fog.colour, world.fog.near, world.fog.far);
    }
    if (world.environment === 'studio') {
      const pmrem = new PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const lighting = pmrem.fromScene(room, 0.04);
      scene.environment = lighting.texture;
      scene.environmentIntensity = world.environmentIntensity;
      room.dispose();
      pmrem.dispose();
      disposables.push(lighting);
      kept.push(lighting);
    }

    const declarations = [
      ...pack.params.map(
        (param) => `uniform float ${uniformNameForParam(param.id)};`,
      ),
      ...world.vars.map(
        (known) => `uniform float ${worldVarUniform(known.name)};`,
      ),
    ].join('\n');
    const mirror = worldHasMirror(world.materials)
      ? createWorldMirror(floatTargets, inputs.uniforms.uWorldPointScale)
      : null;
    if (mirror) {
      disposables.push(mirror);
    }
    const context: IWorldMaterialContext = {
      inputs,
      declarations: `${declarations}\n`,
      atlas,
      fogToBackdrop:
        world.fog?.toBackdrop === true && world.backdrop === 'shader',
      mirror: mirror ? mirror.uniforms : null,
    };
    const build = buildWorldNodes(world, inputs, context, models, camera);
    disposables.push(build);
    scene.add(build.root);
    renderer.shadowMap.enabled = build.shadows;
    const aim = createWorldCamera(world.camera, camera, inputs);

    const drawn = new WebGLRenderTarget(1, 1, {
      type: floatTargets ? HalfFloatType : UnsignedByteType,
      samples: Math.min(4, maxSamples),
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
    disposables.push(drawn);
    const pass = createWorldPass();
    disposables.push(pass);
    const bloom = world.bloom
      ? createWorldBloom(renderer, pass, floatTargets)
      : null;
    if (bloom && world.bloom) {
      bloom.setShape(world.bloom.threshold, world.bloom.radius);
      disposables.push(bloom);
    }
    const bloomStrength = createFormula(
      world.bloom?.strength ?? 0,
      inputs.runtime,
      inputs.scope,
    );
    const exposure = createFormula(
      world.exposure,
      inputs.runtime,
      inputs.scope,
    );
    const composite = createWorldComposite(pack, world, inputs);
    disposables.push(composite);
    const renderWorld = (width: number, height: number) => {
      const multisample = width * height <= MULTISAMPLE_LIMIT;
      const samples = multisample ? Math.min(4, maxSamples) : 0;
      if (drawn.samples !== samples) {
        drawn.samples = samples;
        drawn.dispose();
      }
      if (drawn.width !== width || drawn.height !== height) {
        drawn.setSize(width, height);
      }
      if (mirror && build.mirror) {
        mirror.render(renderer, scene, camera, build.mirror, width, height);
      }
      renderer.setRenderTarget(drawn);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      const glow = bloom ? bloom.render(drawn.texture, width, height) : null;
      composite.set(
        drawn.texture,
        glow,
        bloomStrength.value(),
        exposure.value(),
      );
    };

    // Compiled before the first frame, never during it: every program is
    // linked on the driver's threads and waited for here.
    const materials = new Set<Material>();
    renderer.setRenderTarget(drawn);
    renderer
      .compile(scene, camera)
      .forEach((material) => materials.add(material));
    pass.use(composite.material);
    // Pointed at the default framebuffer until a frame points it at the
    // worker's: set as a target before that, three would make one of its own.
    external.point(shown, null);
    renderer.setRenderTarget(shown);
    renderer
      .compile(pass.scene, pass.camera)
      .forEach((material) => materials.add(material));
    await waitForPrograms(renderer, [...materials], signal, hurry);
    if (signal?.aborted) {
      // Given up on while linking, most likely: deleting a program the driver
      // is still linking waits for the link on the GPU process's main thread,
      // and every scene in the window froze for as long as that took. Its
      // sky is the pack's whole shader, so a heavy one is Alpine's nine
      // seconds (`sceneCompile.ts`). Let go once every link has finished.
      handedOff = true;
      releaseWhenLinked(
        () =>
          [...materials].every((material) => programReady(renderer, material)),
        release,
      );
      throw abortError();
    }
    // The frames drawn by the old program in the wait moved GL state under
    // three's cache of it.
    renderer.resetState();
    // One frame into its own targets with no music, so a material that fails
    // to link says so now — three reports a program on its first use — and so
    // the textures are on the GPU before anyone is watching.
    inputs.update(
      {
        timeSeconds: 0,
        deltaMs: 0,
        level: 0,
        beat: 0,
        bands: [0, 0, 0],
        musicAccent: [0, 0],
        musicRun: [0, 0],
        accent: [1, 1, 1],
        fade: 1,
        spectrum: new Uint8Array(0),
        waveform: new Uint8Array(0),
        params: {},
      },
      2,
      2,
    );
    aim(1);
    build.update(0);
    // Every object drawn, whatever its formulas and the camera say at 0 s:
    // one first drawn later linked later, and failed where no note is read,
    // and its textures were uploaded later — from the scene's picture, which
    // the worker closes the moment this build returns, so they came up
    // black. So the trial shows everything, and every texture goes up now.
    const shownBefore = new Map<Object3D, [boolean, boolean]>();
    scene.traverse((object) => {
      shownBefore.set(object, [object.visible, object.frustumCulled]);
      Object.assign(object, { visible: true, frustumCulled: false });
    });
    scene.traverse((object) => {
      const { material } = object as Partial<Mesh>;
      (Array.isArray(material) ? material : [material]).forEach((each) =>
        Object.values(each ?? {}).forEach((value: unknown) => {
          if (value instanceof Texture) {
            renderer.initTexture(value);
          }
        }),
      );
    });
    if (contractArtwork) {
      renderer.initTexture(contractArtwork);
    }
    renderWorld(2, 2);
    shownBefore.forEach(([visible, frustumCulled], object) => {
      Object.assign(object, { visible, frustumCulled });
    });
    // The last pass too, into a target of its own: the pack's shader is linked
    // into it, and it is the one program the world's own frame does not use.
    const trial = new WebGLRenderTarget(2, 2, { depthBuffer: false });
    renderer.setRenderTarget(trial);
    pass.use(composite.material);
    renderer.render(pass.scene, pass.camera);
    trial.dispose();
    renderer.resetState();
    if (problems.length > 0) {
      release();
      return { ok: false, log: problems.join('\n') };
    }

    let lastAccent = 0;
    /**
     * The instant last rendered. The Studio's and the gallery's stills draw
     * one frame again and again, a band of the picture at a time under the
     * scissor, with no time passing (`sceneStill.worker.ts`): a shader only
     * shades the band, but a world rendered the whole scene for every band, so
     * its still cost the world times the number of bands. The same frame at the
     * same size is the same picture, and only the band is laid down again.
     */
    let rendered:
      | { frame: unknown; width: number; height: number; band: string }
      | undefined;
    const program: ISceneProgram = {
      draw: (frame, width, height) => {
        // What the worker left bound is where the picture belongs.
        const target = gl.getParameter(
          gl.FRAMEBUFFER_BINDING,
        ) as WebGLFramebuffer | null;
        const clipped = gl.isEnabled(gl.SCISSOR_TEST);
        const box = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
        renderer.resetState();

        [lastAccent] = frame.musicAccent;
        // Only the NEXT band of the same frame reuses it. The same band
        // drawn again is somebody timing the frame (`sceneStillKeep.ts`
        // draws one frame nine times to measure it for the member's AI, and
        // three for the still's estimate): reused, every draw after the
        // first measured the sky alone, and a heavy world read as cheap.
        const band = `${clipped}:${box.join(',')}`;
        const again =
          rendered !== undefined &&
          rendered.frame === frame &&
          rendered.width === width &&
          rendered.height === height &&
          rendered.band !== band;
        if (!again) {
          inputs.update(frame, width, height);
          aim(width / Math.max(1, height));
          build.update((frame.deltaMs ?? 0) / 1000);
          renderWorld(width, height);
        }
        rendered = { frame, width, height, band };

        shown.viewport.set(0, 0, width, height);
        shown.scissor.set(box[0], box[1], box[2], box[3]);
        shown.scissorTest = clipped;
        external.point(shown, target);
        renderer.setRenderTarget(shown);
        pass.use(composite.material);
        renderer.render(pass.scene, pass.camera);

        // The context as the worker expects it: three's state gone, the
        // picture's target bound, its clip on.
        renderer.resetState();
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, width, height);
        if (clipped) {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(box[0], box[1], box[2], box[3]);
        }
      },
      isSettled: () => inputs.settled(),
      musicAccent: () => lastAccent,
      rest: () => {
        // Every picture drawn again each frame — the world's, its glow, its
        // reflection, three's own for glass — is made again by the next frame
        // at the size it kept, so the frame after a rest is the frame it would
        // have been.
        targets.free([shown, ...kept]);
        rendered = undefined;
      },
      dispose: release,
    };
    return { ok: true, program, ...(notes.length > 0 ? { notes } : {}) };
  } catch (error) {
    if (!handedOff) {
      release();
    }
    throw error;
  }
};

export default compileWorld;
