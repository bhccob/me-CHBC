# LAB ONLY (throwaway). Round 69: the pages after the first view, as one camera move round the round 67 sculpture.
# The rule: the site never leaves the sculpture. Scrolling moves the camera to the part that carries each page.
#   0 first   the round 68 first view (name behind the glass)
#   1 about   closer, the whole experiment on the right
#   2 soft    the liquid core            (Software Engineering)
#   3 game    the stream leaving the slot (Game & App Development)
#   4 sec     the shell, its rail and a clamp (Cybersecurity)
#   5 mech    the gear and the axle      (Mechatronics)
#   6 work    out along the trail of parts (the works are what the experiment threw off)
#   7 talk    the amber light on the cap (the only amber: contact)
#   blender -b --factory-startup --python tools/lab/blender/journey69.py -- <out-dir> keys|seq [samples] [res%]
# keys: one still per stop (k0..k7). seq: the whole move as frames f000.., and frames.json with each stop's frame.
import bpy, json, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sculpture67 as S
import firstview68 as F
K = S.K
from instrument64 import principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'keys'
M0 = S.M0
def L(x, y, z): return M0 @ Vector((x, y, z))          # a point given in the sculpture's own frame

def rail_point():
    """The clamp on the slot's rail that faces the camera side (-Y) most."""
    best = None
    for v in (0.17, 0.31, 0.46, 0.61, 0.76, 0.86):
        p = M0 @ S.egg(v, S.uof(v, 1.0 - 0.004))
        if best is None or p.y < best.y: best = p
    return best

def stops():
    rp = rail_point(); n = Vector((rp.x, rp.y, 0)).normalized()
    cap = L(0, 0, 1.74)
    return [
        dict(name='first', loc=Vector((0.0, -13.8, 1.2)), tgt=Vector((-0.15, 0, -0.1)), shift=0.0),
        dict(name='about', loc=Vector((-0.5, -6.6, 0.7)), tgt=L(0, 0, 0.05), shift=-0.21),
        dict(name='soft', loc=L(0.05, -0.1, 0.1) + Vector((-0.35, -2.7, 0.55)), tgt=L(0.05, -0.1, 0.1), shift=-0.2),
        dict(name='game', loc=L(1.1, -0.6, 0.7) + Vector((0.7, -2.4, 0.3)), tgt=L(1.1, -0.6, 0.7), shift=-0.2),
        dict(name='sec', loc=rp + n * 2.0 + Vector((0.3, -0.6, 0.35)), tgt=rp, shift=-0.2),
        dict(name='mech', loc=L(0.2, -0.05, -0.25) + Vector((-0.5, -2.5, -0.45)), tgt=L(0.2, -0.05, -0.25), shift=-0.2),
        dict(name='work', loc=Vector((-7.6, -11.4, 2.6)), tgt=Vector((-1.0, -0.6, 0.15)), shift=-0.2),
        dict(name='talk', loc=cap + Vector((0.45, -1.9, 0.3)), tgt=cap, shift=-0.2),
    ]

MOVES = [26, 14, 14, 14, 14, 26, 26]        # frames in each move between stops (the stop frames are counted once)

def ease(t): return t * t * (3 - 2 * t)

def pose(cam, a, b, t):
    e = ease(t)
    loc = a['loc'].lerp(b['loc'], e); tgt = a['tgt'].lerp(b['tgt'], e)
    # lift the path a little mid-move so long moves arc round the sculpture and never cut through it
    bulge = math.sin(math.pi * t) * 0.12 * (a['loc'] - b['loc']).length
    out = Vector((loc.x, loc.y, 0)); out = out.normalized() if out.length > 1e-6 else Vector((0, -1, 0))
    loc = loc + out * bulge
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.data.shift_x = a['shift'] + (b['shift'] - a['shift']) * e

def main():
    os.makedirs(OUT, exist_ok=True)
    s = K.fresh()
    s.cycles.volume_bounces = 1; s.cycles.transmission_bounces = 14; s.cycles.max_bounces = 16
    try: s.render.use_persistent_data = True
    except Exception: pass
    m = S.Mats(); S.world(m); S.lights()
    S.build_shell(m); S.build_core(m); S.build_trail(m); S.bake_liquid(m)
    font = bpy.data.fonts.load(F.FONT, check_existing=True)
    ink = principled('letter-ink', (0.11, 0.09, 0.16), 0.0, 0.55)
    # the name belongs to the first view only: it fades out as the camera leaves it
    nt = ink.node_tree; pb = nt.nodes['Principled BSDF']; outn = nt.nodes['Material Output']
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(pb.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], outn.inputs['Surface'])
    def name_alpha(a): mx.inputs[0].default_value = a
    name_alpha(1.0)
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    c0 = S.cam('first', loc=(0.0, -13.8, 1.2), target=(-0.15, 0, -0.1), lens=65)
    F.word('BOB', 'BOB', c0, 23.0, 0.085, 0.585, 0.30, 'LEFT', ink, font)
    F.word('CHUNG', 'CHUNG', c0, 23.0, 0.915, 0.115, 0.30, 'RIGHT', ink, font)
    # a soft fill that travels with the camera, for the close stops (unseen in the haze, weak at a distance)
    cam = S.cam('journey', loc=(0, -13.8, 1.2), target=(-0.15, 0, -0.1), lens=65)
    s.camera = cam
    st = stops()

    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)

    if JOB == 'keys':
        for i, k in enumerate(st):
            name_alpha(1.0 if i == 0 else 0.0)
            pose(cam, k, k, 0.0); shoot(os.path.join(OUT, f'k{i}-{k["name"]}.jpg'))
        return
    f = 0; at = [0]
    pose(cam, st[0], st[0], 0.0); shoot(os.path.join(OUT, f'f{f:03d}.jpg'))
    for i, n in enumerate(MOVES):
        for j in range(1, n + 1):
            f += 1; pose(cam, st[i], st[i + 1], j / n)
            name_alpha(max(0.0, 1.0 - (j / n) / 0.55) if i == 0 else 0.0)
            shoot(os.path.join(OUT, f'f{f:03d}.jpg'))
        at.append(f)
    with open(os.path.join(OUT, 'frames.json'), 'w') as fh:
        json.dump({'count': f + 1, 'stops': {k['name']: a for k, a in zip(st, at)}}, fh)
    print('frames', f + 1, at, flush=True)

if __name__ == '__main__':
    main()
