import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { HalfFloatType, NoToneMapping, VSMShadowMap, type WebGLRenderer } from 'three';
import type { Locale } from '~/i18n/Translator';
import { cameraPose } from '../machine/camera';
import type { Timeline } from '../timeline';
import { LookEffect } from './LookEffect';
import { blurShare } from './looks';
import { MachineScene } from './MachineScene';

export interface WorldInput {
  locale: Locale;
  timeline: Timeline;
  reduce: boolean;
  /** The built URL of the code screen's picture. */
  codeScreenUrl: string;
}

export interface WorldState {
  anchors: Record<'armour' | 'controls' | 'brain' | 'body', [number, number]>;
  hover: string | null;
  opaque: boolean;
  fired: number;
}

const NO_ANCHORS: WorldState['anchors'] = { armour: [0, 0], controls: [0, 0], brain: [0, 0], body: [0, 0] };

/** The blur below which depth of field is not worth drawing, as a share of the page's width: about a pixel at 1080p. */
const NO_BLUR_SHARE = 0.001;

/** The whole 3D journey on one renderer. Its parts arrive stage by stage; this stage has the machine. */
export class World {
  private readonly renderer: WebGLRenderer;
  private readonly machine: MachineScene;
  private readonly composer: EffectComposer;
  private readonly depthOfField: DepthOfFieldEffect;
  private readonly bokehPass: EffectPass;
  private drawn = -1;
  private dirty = true;

  constructor(renderer: WebGLRenderer, input: WorldInput) {
    this.renderer = renderer;
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
    this.composer.addPass(new EffectPass(this.machine.camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new LookEffect()));
  }

  /** Loads a stage of the journey. */
  async load(stage: 'machine' | 'flight' | 'void' | 'end'): Promise<void> {
    if (stage !== 'machine') return;
    await this.machine.load();
    this.machine.update(0);
  }

  /** Draws once before anything shows, so that no shader or shadow is compiled in the middle of the journey. */
  warm(f: number): void {
    this.machine.showAll();
    this.renderer.compile(this.machine.scene, this.machine.camera);
    this.composer.render();
    this.drawn = -1;
    this.update(f);
  }

  update(f: number): WorldState {
    if (f !== this.drawn) {
      this.machine.update(f);
      this.dirty = true;
      this.drawn = f;
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
    }
    return { anchors: NO_ANCHORS, hover: null, opaque: false, fired: 0 };
  }

  /** Draws, only when something moved: a still page costs the GPU nothing. */
  render(): void {
    if (!this.dirty) return;
    this.composer.render();
    this.dirty = false;
  }

  resize(width: number, height: number): void {
    this.machine.resize(width, height);
    this.composer.setSize(width, height);
    this.drawn = -1;
    this.dirty = true;
  }

  pointer(): void {}

  dispose(): void {
    this.machine.dispose();
    this.composer.dispose();
  }
}
