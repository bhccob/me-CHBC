import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { HalfFloatType, NoToneMapping, VSMShadowMap, type WebGLRenderer } from 'three';
import { projects } from '~/data/projects';
import { flightLayout } from '~/journey/flight/layout';
import { journeyQuality } from '~/journey/quality';
import type { Timeline } from '~/journey/timeline';
import { type FlightProject, TunnelScene } from '~/journey/world/flight/TunnelScene';
import { IrisWindow } from '~/journey/world/IrisWindow';
import { LookEffect } from '~/journey/world/LookEffect';
import { canvasOpaque } from '~/journey/world/portalWindow';
import type { Look, World } from '../concepts/types';
import { FilmEffect } from './film';

/**
 * LAB ONLY (throwaway). One renderer for the whole preview: the concept's world through its film chain (depth of field,
 * bloom, AgX, the site's look, grain and vignette), the real, unmodified tunnel through the world's window (the live
 * site's IrisWindow), and the tunnel alone from frame 372. Frames from 350 are the live site's flight and head.
 */
export class Stage {
  readonly tunnel: TunnelScene;
  private readonly renderer: WebGLRenderer;
  private readonly world: World;
  private readonly composer: EffectComposer;
  private readonly dof: DepthOfFieldEffect;
  private readonly dofPass: EffectPass;
  private readonly film = new FilmEffect();
  private readonly iris = new IrisWindow();

  constructor(renderer: WebGLRenderer, world: World, timeline: Timeline, reduce: boolean) {
    this.renderer = renderer;
    this.world = world;
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.setClearAlpha(0);
    const dated = projects.byDate();
    const flying: FlightProject[] = dated.map((project) => ({
      id: project.id,
      year: project.year,
      tint: project.flight.tint,
      titleLines: project.flight.titleLines,
      screens: project.flight.screens,
      piece: project.flight.piece,
      images: project.flight.images,
      pieceImage: project.flight.pieceImage,
      words: {
        en: { kind: project.copy('en').flightKind, line: project.copy('en').flightLine },
        nl: { kind: project.copy('nl').flightKind, line: project.copy('nl').flightLine },
      },
    }));
    this.tunnel = new TunnelScene({ layout: flightLayout(dated), projects: flying, locale: 'en', timeline, reduce });
    this.tunnel.setQuality(journeyQuality(0, true));

    const post = world.post ?? { bloom: 0.5, threshold: 1, contrast: 1.16, saturation: 1.1 };
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(world.scene, world.camera));
    this.dof = new DepthOfFieldEffect(world.camera, { focusDistance: 4, focusRange: 1, bokehScale: 0, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(world.camera, this.dof);
    this.composer.addPass(this.dofPass);
    const bloom = new BloomEffect({ intensity: post.bloom, luminanceThreshold: post.threshold, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.6 });
    this.composer.addPass(new EffectPass(world.camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new LookEffect(post.contrast, post.saturation), this.film, this.iris.effect));
  }

  /** Readies the world's shaders and draws it once, behind the loader. */
  async warm(): Promise<void> {
    await this.renderer.compileAsync(this.world.scene, this.world.camera);
    this.composer.render();
  }

  /** The tunnel's stages, behind the opening: the gates and the projects, then the head. */
  async loadTunnel(): Promise<void> {
    const draw = (): void => this.iris.drawTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera);
    const compile = (): Promise<unknown> => this.iris.compileTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera);
    this.tunnel.prepare(this.renderer, draw);
    await this.tunnel.loadFlight(this.renderer, draw);
    await this.tunnel.loadHead(draw, compile);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.iris.resize(this.renderer);
    this.tunnel.resize(width, height, this.renderer.getPixelRatio());
  }

  /** Draws frame `f`. `t` is the head's own time, for the tunnel past the flight. */
  render(f: number, dt: number, now: number, t: number, look: Look): void {
    const window = this.world.window?.(f) ?? null;
    const inside = canvasOpaque(f);
    if (window || inside) {
      this.tunnel.update(f, dt, now, t);
      this.iris.drawTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera);
    }
    if (inside) {
      this.iris.present(this.renderer);
      return;
    }
    if (window) this.iris.place(window.center, window.edge, this.world.camera, window.reach);
    else this.iris.close();
    const blur = look.blur;
    this.dofPass.enabled = blur > 0.05;
    if (this.dofPass.enabled) {
      this.dof.cocMaterial.focusDistance = look.focus;
      this.dof.cocMaterial.focusRange = Math.max(0.05, look.focus * 0.15);
      this.dof.bokehScale = blur;
    }
    this.film.set(look.grain, look.vignette, look.flash, (now % 10000) / 997);
    this.composer.render();
  }

  dispose(): void {
    this.tunnel.dispose();
    this.iris.dispose();
    this.composer.dispose();
  }
}
