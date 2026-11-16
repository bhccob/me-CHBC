# LAB ONLY (throwaway). Round 68: the site's first view with the round 67 sculpture (Bob: "Looks right").
# His name stands far behind the sculpture as real letters, BOB top-left and CHUNG bottom-right, so the glass egg bends
# them and the liquid passes in front of them. The camera can orbit a few degrees round the sculpture, rendered as frames,
# so the page can turn it with the pointer. A portrait plate stacks the name for phones.
#   blender -b --factory-startup --python tools/lab/blender/firstview68.py -- <out-dir> [plate,orbit,phone] [samples] [res%]
import bpy, math, os, sys
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sculpture67 as S
K = S.K
from instrument64 import principled, link

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOBS = argv[1].split(',') if len(argv) > 1 and argv[1] else ['plate']
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
FONT = os.path.join(REPO, 'node_modules', '@fontsource', 'barlow', 'files', 'barlow-latin-600-normal.woff')
ORBIT, STEPS = 6.0, 17           # degrees each way, frames across the orbit (the middle one is the plate)
FOLLOW = 0.8                     # share of the orbit the name follows (1 = fixed on screen, 0 = full parallax)
PW, PH = 1080, 2340              # phone plate

def frame_size(cam, d):
    s = bpy.context.scene; cd = cam.data
    W, H = s.render.resolution_x, s.render.resolution_y
    if W >= H:
        fw = 2 * d * 18 / cd.lens; fh = fw * H / W
    else:
        fh = 2 * d * 18 / cd.lens; fw = fh * W / H
    return fw, fh

def word(name, body, cam, d, u, v, cap, align, mat, font, span=None, k=None):
    """Real letters on a plane facing `cam` at distance d. (u, v) is where the word's left (or right) edge and baseline
    land on screen, 0..1 from the bottom-left. Size: `cap` is the cap height as a share of the frame's height, or
    `span` the word's width as a share of the frame's width, or `k` a scale taken from another word. Sets ob['k']."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.font = font; cu.size = 1.0
    cu.align_x = align; cu.extrude = 0.012; cu.bevel_depth = 0.002; cu.bevel_resolution = 1   # low relief, no WordArt bevel
    cu.materials.append(mat)
    ob = link(bpy.data.objects.new(name, cu))
    bpy.context.view_layer.update()
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    xs = [p.co.x for p in me.vertices]; ys = [p.co.y for p in me.vertices]
    x0, x1, ytop = min(xs), max(xs), max(ys)
    ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    fw, fh = frame_size(cam, d)
    if k is None:
        k = span * fw / (x1 - x0) if span else cap * fh / ytop
    ob['k'] = k
    edge = x0 if align == 'LEFT' else x1
    local = Vector(((u - 0.5) * fw - edge * k, (v - 0.5) * fh, -d))
    R = cam.matrix_world.to_3x3().normalized()
    ob.matrix_world = Matrix.Translation(cam.matrix_world @ local) @ R.to_4x4() @ Matrix.Diagonal((k, k, k, 1))
    return ob

def letter_light(name, loc, target, w, h, energy):
    ob = K.area(name, loc, target, w, energy, (0.86, 0.82, 1.0), size_y=h)
    ob.visible_glossy = False; ob.visible_volume_scatter = False     # lights the letters only, never seen in the chrome
    return ob

def orbit(cam_loc, target, a):
    p = Vector(cam_loc) - Vector(target)
    return tuple(Matrix.Rotation(math.radians(a), 3, 'Z') @ p + Vector(target))

def main():
    os.makedirs(OUT, exist_ok=True)
    s = K.fresh()
    s.cycles.volume_bounces = 1; s.cycles.transmission_bounces = 14; s.cycles.max_bounces = 16
    m = S.Mats(); S.world(m); S.lights()
    S.build_shell(m); S.build_core(m); S.build_trail(m); S.bake_liquid(m)
    font = bpy.data.fonts.load(FONT, check_existing=True)
    tone = tuple(float(x) for x in os.environ.get('R68_INK', '0.11,0.09,0.16').split(','))
    ink = principled('letter-ink', tone, 0.0, 0.55)

    hero = dict(loc=(0.0, -13.8, 1.2), target=(-0.15, 0, -0.1), lens=65)   # a little closer than round 67's hero
    # desktop: letters about 23 m from the camera, behind the rim lights so they never block them
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    c0 = S.cam('desk', **hero)
    D = 23.0
    # inset 8.5% so a 16:10 screen's crop keeps the whole name (r68.css works out the same edges from the crop)
    desk = [word('BOB', 'BOB', c0, D, 0.085, 0.585, 0.30, 'LEFT', ink, font),
            word('CHUNG', 'CHUNG', c0, D, 0.915, 0.115, 0.30, 'RIGHT', ink, font)]
    desk.append(letter_light('letters-key', (-1.5, 3.5, 7.5), (0, 9.2, -0.5), 12.0, 4.0, LETTER_W))
    # phone: the name stacked above and below the sculpture, the sculpture larger and its trail running off the edge;
    # a phone's own proportions (9 : 19.5), so the crop does not cut the name
    s.render.resolution_x, s.render.resolution_y = PW, PH
    ph = S.cam('phone', loc=(0.0, -14.0, 0.9), target=(-0.1, 0, -0.05), lens=60)
    chung = word('CHUNG-p', 'CHUNG', ph, 24.0, 0.93, 0.15, None, 'RIGHT', ink, font, span=0.86)   # 7% to 93% across
    phone = [word('BOB-p', 'BOB', ph, 24.0, 0.07, 0.80, None, 'LEFT', ink, font, k=chung['k']), chung]
    phone.append(letter_light('letters-key-p', (-1.5, 5.0, 8.0), (0, 10.0, -0.5), 14.0, 6.0, LETTER_W))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'firstview68.blend'))

    def show(objs, on):
        for o in objs: o.hide_render = not on

    def shoot(cam, path, W, H):
        s.camera = cam; s.render.resolution_x, s.render.resolution_y = W, H
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)

    if 'plate' in JOBS or 'orbit' in JOBS:
        show(desk, True); show(phone, False)
        base = {o.name: o.matrix_world.copy() for o in desk}
        pivot = Vector(hero['target'])
        angles = [ORBIT * (2 * i / (STEPS - 1) - 1) for i in range(STEPS)] if 'orbit' in JOBS else [0.0]
        for a in angles:
            i = round((a / ORBIT + 1) * (STEPS - 1) / 2)
            c = S.cam(f'desk{i}', loc=orbit(hero['loc'], hero['target'], a), target=hero['target'], lens=hero['lens'])
            # the name swings round with the camera most of the way: it keeps its place on screen (the page's type
            # lines up with it) and only a little depth is left; the sculpture turns in full
            Rl = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(a * FOLLOW), 4, 'Z') @ Matrix.Translation(-pivot)
            for o in desk: o.matrix_world = Rl @ base[o.name]
            shoot(c, os.path.join(OUT, f'r68-desk-{i:02d}.jpg'), 1920, 1080)
    if 'phone' in JOBS:
        show(desk, False); show(phone, True)
        shoot(ph, os.path.join(OUT, 'r68-phone.jpg'), PW, PH)

LETTER_W = float(os.environ.get('R68_LETTER_W', 0))

if __name__ == '__main__':
    main()
