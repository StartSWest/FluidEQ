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
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { IScenePack } from 'common/scenePacks';
import { worldHasMirror, worldVarUniform } from 'common/sceneWorld';
import { controlDeclarations } from 'common/sceneUniformContract';
import type { TSceneArtworkArrival, TWorldCompileResult } from '../sceneGl';
import { markSceneStep, timeSceneStep } from '../sceneLoadMarks';
import { createWorldBloom } from './worldBloom';
import createWorldCamera from './worldCamera';
import { createWorldComposite } from './worldComposite';
import { createWorldSceneProgram } from './worldDraw';
import { createFormula } from './worldFormula';
import { createWorldInputs } from './worldInputs';
import type { IWorldMaterialContext } from './worldMaterials';
import { createWorldMirror } from './worldMirror';
import { parseWorldModels, type IWorldModelAsset } from './worldModels';
import createWorldEditor, { worldKeyOf } from './worldEditor';
import { buildWorldNodes } from './worldNodes';
import { createWorldPass } from './worldPasses';
import {
  deletePrograms,
  externalTargets,
  programReady,
  releaseModelResources,
  trackDrawnTargets,
  waitForPrograms,
} from './worldRenderer';
import worldSamples from './worldSamples';
import {
  compileWorldPrograms,
  drawWithEverythingShown,
  silentTrialFrame,
} from './worldTrial';

/**
 * A 3D world as a scene program: the same `draw`, on the same context, into
 * the same target, as a shader-only scene.
 *
 * That is the whole integration. The worker binds whatever the picture is to
 * be finished in — the finishing chain's for FSR, supersampling or FXAA, or
 * the canvas itself —
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
 * silhouette; a world of glows says it has no edge to smooth,
 * `worldSamples.ts`), light is kept in half floats so a lamp can outshine a wall,
 * and the glow reads that light (`worldBloom.ts`).
 */

const abortError = () => new DOMException('World load abandoned', 'AbortError');

const compileWorld = async (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  /** The picture, or its decode still under way (`TSceneArtworkArrival`). */
  artwork: TSceneArtworkArrival,
  signal: AbortSignal | undefined,
  hurry: AbortSignal | undefined,
  /**
   * Frees what `release` frees once `linked` says the links are done: the
   * worker's own tracker (`sceneCompile.ts`), which it waits for before it
   * is ended.
   */
  releaseWhenLinked: (linked: () => boolean, release: () => void) => void,
): Promise<TWorldCompileResult> => {
  const { world } = pack;
  if (!world) {
    return { ok: false, notes: [] };
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
  // Glass (a material with transmission) has three draw every solid thing a
  // second time into a picture of its own, at the frame's size and four
  // times multisampled: Prism Bloom's crystal heart cost 6.8 ms of a 20.6 ms
  // frame that way on Intel UHD graphics at 1080p. At half the size each
  // way the refraction, which three blurs by the glass's roughness anyway,
  // reads the same, and that frame took 16.1 ms.
  renderer.transmissionResolutionScale = 0.5;
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
    return { ok: false, notes: [{ code: 'engine-unsupported' }] };
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
  /** The models as the loader made them, which nothing else frees. */
  let models: Record<string, IWorldModelAsset> = {};
  let released = false;
  /**
   * Everything the world made, once, however its build ends: a build that
   * threw part way left its renderer, its listener on the canvas and every
   * picture made so far to the collector. The worker's context outlives every
   * world, and a renderer's own `dispose` frees nothing it put on the GPU, so
   * each model's buffers, textures and bitmaps and every program still held
   * are freed by hand, before it.
   */
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    targets.free([shown]);
    disposables.forEach((item) => item.dispose());
    releaseModelResources(Object.values(models).map((asset) => asset.scene));
    deletePrograms(renderer);
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
    // The picture's textures are made now and given the picture only once
    // the programs are linked (below): nothing before the first frame reads
    // a texture's pixels, and the decode runs beside the whole build instead
    // of in front of it.
    const hasArtwork = pack.artwork !== undefined;
    const contractArtwork = hasArtwork ? new Texture() : null;
    if (contractArtwork) {
      contractArtwork.flipY = false;
      disposables.push(contractArtwork);
    }
    const usesAtlas = Object.values(world.materials).some(
      (material) => material.map || material.emissiveMap,
    );
    const atlas = hasArtwork && usesAtlas ? new Texture() : null;
    if (atlas) {
      atlas.flipY = false;
      atlas.colorSpace = SRGBColorSpace;
      disposables.push(atlas);
    }

    const inputs = createWorldInputs(pack, contractArtwork);
    disposables.push(inputs);
    const read = await timeSceneStep('world-models', () =>
      parseWorldModels(world.models),
    );
    const buildStartedAt = performance.now();
    models = read.parsed;
    const { notes } = read;
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

    const declarations = `${controlDeclarations(pack)}${world.vars
      .map((known) => `uniform float ${worldVarUniform(known.name)};\n`)
      .join('')}`;
    const mirror = worldHasMirror(world.materials)
      ? createWorldMirror(floatTargets, inputs.uniforms.uWorldPointScale)
      : null;
    if (mirror) {
      disposables.push(mirror);
    }
    const context: IWorldMaterialContext = {
      inputs,
      declarations,
      atlas,
      fogToBackdrop:
        world.fog?.toBackdrop === true && world.backdrop === 'shader',
      mirror: mirror ? mirror.uniforms : null,
    };
    const build = buildWorldNodes(world, inputs, context, models, camera);
    disposables.push(build);
    scene.add(build.root);
    // The Studio's Edit mode; idle unless a frame asks for it.
    const editor = createWorldEditor(
      build.root,
      camera,
      worldKeyOf([world.nodes, world.camera]),
    );
    renderer.shadowMap.enabled = build.shadows;
    const aim = createWorldCamera(
      world.camera,
      camera,
      inputs,
      pack.camera?.pivot,
    );

    // Only the colour is read after the world is drawn, so only the colour
    // is resolved out of the samples. Three resolves the depth as well unless
    // told not to, and on Windows that is a shader pass per frame, not a
    // copy: it was 7.7 ms of a 32 ms frame on an Intel UHD at 1080p, the
    // largest single step of Dunes' frame, for a picture nothing looked at.
    // Nor is the multisampled depth kept past the resolve: every frame, and
    // every strip of a still, clears the rows it draws before drawing them.
    const samplesAt = (width: number, height: number) =>
      worldSamples(world, width, height, maxSamples);
    const drawn = new WebGLRenderTarget(1, 1, {
      type: floatTargets ? HalfFloatType : UnsignedByteType,
      samples: samplesAt(1, 1),
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      resolveDepthBuffer: false,
      storeMultisampledDepthBuffer: false,
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
    /** The world's targets at this size, and the reflection it shows. */
    const prepare = (width: number, height: number) => {
      const samples = samplesAt(width, height);
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
    };
    /** The world into its target: every row, or a strip of a still's. */
    const renderMain = (strip?: { from: number; rows: number }) => {
      if (strip) {
        drawn.scissor.set(0, strip.from, drawn.width, strip.rows);
      }
      drawn.scissorTest = strip !== undefined;
      renderer.setRenderTarget(drawn);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      drawn.scissorTest = false;
    };
    const finish = (width: number, height: number) => {
      const glow = bloom ? bloom.render(drawn.texture, width, height) : null;
      // The viewer's turn, as the sky sees it: the camera looks round by the
      // angle turned, which a sky at any distance shows as the shift a point
      // in the middle of the picture makes - through the lens's own
      // perspective, not the angle over the field of view, which put a
      // painted subject a fifth of a turn away from the world's copy of it
      // (a turn to the right moves it left, a raise up; `worldCamera.ts`).
      // A lens zoom (the eye pivot) magnifies it too, and the shift is in
      // the sky's own measure, so it is divided by that.
      const [yaw, pitch, zoom] = inputs.view;
      // Only a look round moves the sky: a world turned round its middle is a
      // thing on a turntable, and its sky the backdrop behind it, which a
      // whole turn could never slide round anyway.
      const looks = pack.camera?.pivot === 'eye';
      const lens = looks ? Math.max(zoom, 1e-3) : 1;
      const halfTall = (camera.fov * Math.PI) / 360;
      const halfWide = Math.atan(Math.tan(halfTall) * camera.aspect);
      const across =
        (-0.5 * Math.tan(yaw)) / Math.max(Math.tan(halfWide), 1e-3);
      const up = (-0.5 * Math.tan(pitch)) / Math.max(Math.tan(halfTall), 1e-3);
      composite.set(
        drawn.texture,
        glow,
        bloomStrength.value(),
        exposure.value(),
        looks ? [across / lens, up / lens, lens] : [0, 0, 1],
      );
    };
    const renderWorld = (width: number, height: number) => {
      prepare(width, height);
      renderMain();
      finish(width, height);
    };

    // Compiled before the first frame, never during it: every program is
    // linked on the driver's threads and waited for here.
    markSceneStep('world-build', buildStartedAt);
    const compileStartedAt = performance.now();
    const materials = compileWorldPrograms(
      renderer,
      { scene, camera, drawn },
      pass,
      // The glow's passes, then the final mix the pass is left with.
      [...(bloom?.materials ?? []), composite.material],
      {
        target: shown,
        // Pointed at the default framebuffer until a frame points it at the
        // worker's: set as a target before that, three would make one of its
        // own.
        point: () => external.point(shown, null),
      },
    );
    markSceneStep('world-compile-issue', compileStartedAt);
    await timeSceneStep('world-link', () =>
      waitForPrograms(renderer, [...materials], signal, hurry),
    );
    const trialStartedAt = performance.now();
    const abandon = () => {
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
      return abortError();
    };
    if (signal?.aborted) {
      throw abandon();
    }
    // The picture, decoded beside the build, is wanted from here on: the
    // trial frame uploads every texture.
    const picture = await artwork;
    if (signal?.aborted) {
      throw abandon();
    }
    if (hasArtwork && !picture) {
      throw new Error('scene artwork was not decoded');
    }
    [contractArtwork, atlas].forEach((texture) => {
      if (texture && picture) {
        texture.image = picture;
        texture.needsUpdate = true;
      }
    });
    // The frames drawn by the old program in the wait moved GL state under
    // three's cache of it.
    renderer.resetState();
    // One frame into its own targets with no music, so a material that fails
    // to link says so now — three reports a program on its first use — and so
    // the textures are on the GPU before anyone is watching.
    inputs.update(silentTrialFrame(), 2, 2);
    aim(1);
    build.update(0);
    drawWithEverythingShown(renderer, scene, [contractArtwork], () =>
      renderWorld(2, 2),
    );
    // The last pass too, into a target of its own: the pack's shader is linked
    // into it, and it is the one program the world's own frame does not use.
    const trial = new WebGLRenderTarget(2, 2, { depthBuffer: false });
    renderer.setRenderTarget(trial);
    pass.use(composite.material);
    renderer.render(pass.scene, pass.camera);
    trial.dispose();
    renderer.resetState();
    markSceneStep('world-trial', trialStartedAt);
    if (problems.length > 0) {
      release();
      return {
        ok: false,
        notes: problems.map((log) => ({ code: 'material' as const, log })),
      };
    }

    const program = createWorldSceneProgram({
      gl,
      renderer,
      inputs,
      camera,
      aim: (aspect) => {
        aim(aspect);
        editor.aim();
      },
      advance: (seconds) => {
        build.update(seconds);
        editor.place();
      },
      prepare,
      renderMain,
      finish: (width, height) => {
        finish(width, height);
        editor.measure();
      },
      editor,
      composite,
      pass,
      shown,
      external,
      free: () => targets.free([shown, ...kept]),
      release,
    });
    return { ok: true, program, notes };
  } catch (error) {
    if (!handedOff) {
      release();
    }
    throw error;
  }
};

export default compileWorld;
