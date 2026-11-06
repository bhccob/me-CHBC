// Builds the site's models in Blender, headless, and packs them into public/models.
//   npm run build:models                 (BLENDER names another Blender than the one on Bob's PC)
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe';
const temp = mkdtempSync(join(tmpdir(), 'models-'));

const machine = join(temp, 'machine.glb');
execFileSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/machine.py', '--', machine, 'tests/fixtures/machine-pose.json', 'tests/fixtures/machine-anchors.json'], { stdio: 'ignore' });
execFileSync(process.execPath, ['tools/blender/pack.mjs', machine, 'public/models/machine.glb'], { stdio: 'inherit' });
