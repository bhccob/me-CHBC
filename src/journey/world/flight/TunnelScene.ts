import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineLoop, PerspectiveCamera, Scene } from 'three';
import { ease } from '../../math';

/** A dark stand-in for the tunnel, so that the iris opens onto something until the real flight arrives. */
export class TunnelScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(54, 16 / 9, 0.05, 900);

  constructor() {
    this.scene.background = new Color(0x000000);
    const positions: number[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * (Math.PI / 4);
      positions.push(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0);
    }
    const ring = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
    const gold = new LineBasicMaterial({ color: new Color().setRGB(1.0, 0.7, 0.28) });
    for (let i = 0; i < 40; i++) {
      const loop = new LineLoop(ring, gold);
      loop.position.z = -i * 4;
      this.scene.add(loop);
    }
  }

  update(f: number): void {
    this.camera.position.set(0, 0, 4 - ease(f, 340, 600) * 120);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof LineLoop) {
        object.geometry.dispose();
        (object.material as LineBasicMaterial).dispose();
      }
    });
  }
}
