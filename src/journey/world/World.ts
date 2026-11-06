import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { HalfFloatType, NoToneMapping, Vector3, VSMShadowMap, type WebGLRenderer } from 'three';
import { projects } from '~/data/projects';
import type { Locale } from '~/i18n/Translator';
import { flightLayout } from '../flight/layout';
import type { TagName } from '../layers';
import { cameraPose } from '../machine/camera';
import { machinePose } from '../machine/choreography';
import type { Timeline } from '../timeline';
import { type FlightProject, type FlightState, type StopReport, TunnelScene } from './flight/TunnelScene';
import { IrisWindow } from './IrisWindow';
import { LookEffect } from './LookEffect';
import { blurShare } from './looks';
import { MachineScene } from './MachineScene';
import { canvasOpaque, irisWindowOn, windowReach } from './portalWindow';

export interface WorldInput {
  locale: Locale;
  timeline: Timeline;
  reduce: boolean;
  /** The built URL of the code screen's picture. */
  codeScreenUrl: string;
}

export interface WorldState {
  /** Where the stack's labels point, in CSS pixels. */
  anchors: Record<TagName, [number, number]>;
  hover: string | null;
  opaque: boolean;
  fired: number;
  flight: FlightState;
}

/** The blur below which depth of field is not worth drawing, as a share of the page's width: about a pixel at 1080p. */
const NO_BLUR_SHARE = 0.001;

const point = new Vector3();

/** The whole 3D journey on one renderer. Its parts arrive stage by stage. */
export class World {
  private readonly renderer: WebGLRenderer;
  private readonly machine: MachineScene;
  private readonly tunnel: TunnelScene;
  private readonly iris = new IrisWindow();
  private readonly composer: EffectComposer;
  private readonly depthOfField: DepthOfFieldEffect;
  private readonly bokehPass: EffectPass;
  private readonly state: WorldState;
  private readonly reduce: boolean;
  private width = 1;
  private height = 1;
  private drawn = -1;
  private dirty = true;

  constructor(renderer: WebGLRenderer, input: WorldInput) {
    this.renderer = renderer;
    this.reduce = input.reduce;
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
    this.tunnel = new TunnelScene({ layout: flightLayout(dated), projects: flying, locale: input.locale, timeline: input.timeline, reduce: input.reduce });
    this.state = { anchors: { armour: [0, 0], controls: [0, 0], brain: [0, 0], body: [0, 0] }, hover: null, opaque: false, fired: 0, flight: this.tunnel.state };
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.setClearAlpha(0);
    this.machine = new MachineScene(input.codeScreenUrl);
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(this.machine.scene, this.machine.camera));
    this.depthOfField = new DepthOfFieldEffect(this.machine.camera, { focusDistance: 1, focusRange: 0.5, bokehScale: 4, resolutionScale: 0.5 });
    this.bokehPass = new EffectPass(this.machine.camera, this.depthOfField);
    this.composer.addPass(this.bokehPass);
    const bloom = new BloomEffect({ intensity: 0.16, luminanceThreshold: 1.2, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.55 });
    this.composer.addPass(new EffectPass(this.machine.camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new LookEffect(), this.iris.effect));
  }

  /** Loads a stage of the journey. */
  async load(stage: 'machine' | 'flight' | 'void' | 'end', onProgress?: (share: number) => void): Promise<void> {
    if (stage === 'flight') {
      await this.tunnel.load(this.renderer, () => this.iris.drawTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera));
      this.dirty = true;
      return;
    }
    if (stage !== 'machine') return;
    await this.machine.load(onProgress);
    this.machine.update(0);
  }

  /** Draws everything once before anything shows, so that no shader or shadow is compiled in the middle of the journey. */
  warm(f: number): void {
    this.machine.showAll();
    this.renderer.compile(this.machine.scene, this.machine.camera);
    this.tunnel.prepare(this.renderer);
    this.iris.drawTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera);
    this.iris.close();
    this.composer.render();
    this.iris.present(this.renderer);
    this.drawn = -1;
    this.update(f, 0, 0);
  }

  update(f: number, dt: number, now: number): WorldState {
    const moved = f !== this.drawn;
    const inside = canvasOpaque(f);
    const window = irisWindowOn(f);
    if (moved) {
      this.drawn = f;
      this.dirty = true;
      if (!inside) this.moveMachine(f);
      if (window) {
        const { iris } = machinePose(f);
        this.iris.place(iris.center, iris.edge, this.machine.camera, windowReach(f));
      } else this.iris.close();
    }
    // The tunnel never stands still: its light runs on and its speed settles while you read. With less motion asked for, it moves only with you.
    if (window || inside) {
      this.tunnel.update(f, dt, now);
      if (!this.reduce) this.dirty = true;
    }
    this.state.opaque = inside;
    this.state.hover = inside ? this.tunnel.state.hover : null;
    return this.state;
  }

  private moveMachine(f: number): void {
    this.machine.update(f);
    const cam = cameraPose(f);
    const blur = blurShare(cam.lens, cam.fstop, cam.focus);
    this.bokehPass.enabled = blur > NO_BLUR_SHARE;
    if (this.bokehPass.enabled) {
      const material = this.depthOfField.cocMaterial;
      material.focusDistance = cam.focus;
      material.focusRange = cam.focus * 0.2;
      // The effect's kernel reaches about 22 px at scale 1, on the half-size picture it works on.
      this.depthOfField.bokehScale = Math.min(10, (blur * this.renderer.domElement.width) / 6);
    }
    const { labels } = machinePose(f);
    for (const name of Object.keys(labels) as TagName[]) {
      point.set(...labels[name]).project(this.machine.camera);
      this.state.anchors[name][0] = ((point.x + 1) / 2) * this.width;
      this.state.anchors[name][1] = ((1 - point.y) / 2) * this.height;
    }
  }

  /** Draws, only when something moved: a still page costs the GPU nothing. */
  render(): void {
    if (!this.dirty) return;
    const f = this.drawn;
    if (irisWindowOn(f) || canvasOpaque(f)) this.iris.drawTunnel(this.renderer, this.tunnel.scene, this.tunnel.camera);
    if (canvasOpaque(f)) this.iris.present(this.renderer);
    else this.composer.render();
    this.dirty = false;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.machine.resize(width, height);
    this.tunnel.resize(width, height, this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.iris.resize(this.renderer);
    this.drawn = -1;
    this.dirty = true;
  }

  /** The words in another language: the world stays, only they change. */
  setLocale(locale: Locale): void {
    this.tunnel.setLocale(locale);
  }

  /** Where a project's screen stands on the page: left, top, width, height. */
  screenRect(id: string): [number, number, number, number] | null {
    return this.tunnel.screenRect(id);
  }

  /** What stands in the flight, for those checking it. */
  report(): { stops: StopReport[]; walls: number } {
    return { stops: this.tunnel.report(), walls: this.tunnel.wallCount };
  }

  /** Where the pointer aims, -1 to 1 each way. */
  pointer(x: number, y: number): void {
    this.tunnel.pointer(x, y);
  }

  dispose(): void {
    this.machine.dispose();
    this.tunnel.dispose();
    this.iris.dispose();
    this.composer.dispose();
  }
}
