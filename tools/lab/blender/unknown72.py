# LAB ONLY (throwaway). Round 72: Bob's "The Making of an Unknown" brief (2026-11-14).
# One mythical automaton is assembled as you scroll, one study at a time, then it stands, its eye opens and the camera
# goes through the pupil into a stand-in of his desk. Stylised, not photoreal: clean turned and cast shapes, no wear.
# Palette from the brief: obsidian #09070D, deep purple #171020, amethyst #48266B, violet #8A5CC5, gold #C5A45A, ivory #E9E1D3.
#
# What each part means (my mapping, for Bob to check):
#   core      a cut amethyst heart in three turning rings engraved with code, six small modules docking on it   (software)
#   head      the eye socket and its rings, lit last: where software meets a person                    (game & app dev)
#   shell     ribs, two ivory chest plates, a back shield and a three-ring seal over the heart            (cybersecurity)
#   body      spine, pelvis, shoulders in big rings, arms, hands, legs; some plates still float loose    (mechatronics, next)
#   ring      a ring that opens out of the waist carrying four artifacts, one per real project; it becomes the halo
# Units: 1 unit = 1 m. The automaton stands about 10 m; it kneels until the awakening.
#   blender -b --factory-startup --python tools/lab/blender/unknown72.py -- <out-dir> <job> [samples] [res%]
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix, Euler
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dna71 as D
S, K = D.S, D.K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'look'
REPO = D.REPO
I4 = Matrix.Identity(4)
ENV = lambda k, d: float(os.environ.get(k, d))
cyl, ball, tube, torus, box, glow, spot, bezier = D.cyl, D.ball, D.tube, D.torus, D.box, D.glow, D.spot, D.bezier
lerp, clamp, ease = D.lerp, D.clamp, D.ease
def V(*a): return Vector(a)
def srgb(h): return S.srgb(h)
def mul(c, k): return tuple(x * k for x in c)
def eout(t): t = clamp(t); return 1 - (1 - t) ** 3

OBS, DPUR, AME, VIO, GOLD, IVORY = (srgb(h) for h in ('#09070D', '#171020', '#48266B', '#8A5CC5', '#C5A45A', '#E9E1D3'))
LIGHT_VIO = (0.58, 0.18, 1.0)           # AgX pulls saturated violet light toward indigo; a touch redder reads #8A5CC5
GOLD_LIGHT = (1.0, 0.62, 0.22)

# ---------------------------------------------------------------- energy: emission strengths that change per frame
EN = {}                                   # group -> [(socket, base strength)]
def reg(group, sock, base):
    EN.setdefault(group, []).append((sock, base)); sock.default_value = base
def energy(levels):
    for g, lst in EN.items():
        k = levels.get(g, 1.0)
        for s, b in lst: s.default_value = b * k

def emit_g(name, color, strength, group):
    m = emit(name, color, strength); reg(group, m.node_tree.nodes['Emission'].inputs['Strength'], strength); return m

# ---------------------------------------------------------------- materials

def glyph_mat(name, base, metal=1.0, rough=0.32, N=120, rows=3, h=0.028, z0=-0.042, lit=0.10, strength=2.4, seed=1.0,
              mode='z', aniso=0.3, group='glyph'):
    """A turned part engraved with rows of short code marks round its axis; a few marks are filled with lit gold.
    mode 'z': the marks run on the side face (rows along the axis); 'r': on a flat face (rows by radius)."""
    m = principled(name, base, metal, rough, aniso=aniso)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    x, y, z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    a01 = _math(nt, 'MULTIPLY_ADD', _math(nt, 'ARCTAN2', y, x), 1 / TAU, 0.5)
    r = _math(nt, 'SQRT', _math(nt, 'ADD', _math(nt, 'MULTIPLY', x, x), _math(nt, 'MULTIPLY', y, y)))
    coord = z if mode == 'z' else r
    u = _math(nt, 'MULTIPLY', a01, N); v = _math(nt, 'DIVIDE', _math(nt, 'SUBTRACT', coord, z0), h)
    cu, fu = _math(nt, 'FLOOR', u), _math(nt, 'FRACT', u)
    cv, fv = _math(nt, 'FLOOR', v), _math(nt, 'FRACT', v)
    inside = _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', fu, 0.14), _math(nt, 'LESS_THAN', fu, 0.86))
    inside = _math(nt, 'MULTIPLY', inside, _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', fv, 0.22), _math(nt, 'LESS_THAN', fv, 0.78)))
    inside = _math(nt, 'MULTIPLY', inside, _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', cv, -0.5), _math(nt, 'LESS_THAN', cv, rows - 0.5)))
    cmb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(cu, cmb.inputs[0]); nt.links.new(cv, cmb.inputs[1]); cmb.inputs[2].default_value = seed
    wn = nt.nodes.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; nt.links.new(cmb.outputs[0], wn.inputs['Vector'])
    rnd = wn.outputs['Value']
    mark = _math(nt, 'MULTIPLY', inside, _math(nt, 'GREATER_THAN', rnd, 0.40))
    litm = _math(nt, 'MULTIPLY', mark, _math(nt, 'GREATER_THAN', rnd, 1 - lit))
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(mark, _sock(mix, 'Factor_Float'))
    _sock(mix, 'A_Color').default_value = (*base, 1); _sock(mix, 'B_Color').default_value = (*mul(base, 0.35), 1)
    nt.links.new(_sock(mix, 'Result_Color', True), b.inputs['Base Color'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', mark, 0.25, rough), b.inputs['Roughness'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.8; bp.inputs['Distance'].default_value = 0.003
    nt.links.new(_math(nt, 'SUBTRACT', 1.0, mark), bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    setin(b, 'Emission Color', (*GOLD_LIGHT, 1))
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; nt.links.new(litm, k.inputs[0])
    nt.links.new(k.outputs[0], b.inputs['Emission Strength'])
    reg(group, k.inputs[1], strength)
    return m

def stone_mat():
    m = principled('dais-stone', mul(DPUR, 0.55), 0.0, 0.34, coat=0.35)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; S.noise_rough(nt, b, 0.26, 0.42, 0.9)
    return m

class Mats:
    def __init__(self):
        self.obs = principled('obsidian', mul(DPUR, 0.62), 0.0, 0.30, coat=0.45)                 # cast dark stone, satin
        setin(self.obs.node_tree.nodes['Principled BSDF'], 'Coat Roughness', 0.18)
        self.dark = principled('dark-metal', (0.050, 0.040, 0.070), 1.0, 0.30, aniso=0.45)       # brushed, violet cast
        self.vmetal = principled('amethyst-metal', mul(AME, 0.55), 1.0, 0.28, aniso=0.3)
        self.ivory = principled('ivory', mul(IVORY, 0.36), 0.0, 0.55, coat=0.10)                 # matte ceramic, used sparingly
        self.mote = emit_g('mote', GOLD_LIGHT, 3.0, 'motes')
        self.gold = principled('gold', GOLD, 1.0, 0.26, aniso=0.2)
        self.black = principled('pupil-black', (0.0, 0.0, 0.0), 0.0, 1.0, spec=0.0)
        self.crystal = S.smoked_glass('amethyst', density=2.6, absorb=(0.66, 0.30, 0.95))
        self.lens = S.smoked_glass('amethyst-clear', density=0.8, absorb=(0.70, 0.50, 0.95))
        self.path = emit_g('gold-path', GOLD_LIGHT, 2.6, 'paths')            # energy pathways
        self.seed = emit_g('core-seed', GOLD_LIGHT, 12.0, 'core')
        self.core_v = emit_g('core-violet', LIGHT_VIO, 6.0, 'core')
        self.eye = emit_g('eye-gold', GOLD_LIGHT, 4.5, 'eye')
        self.eye_v = emit_g('eye-violet', LIGHT_VIO, 3.0, 'eye')
        self.inlay = emit_g('dais-inlay', GOLD_LIGHT, 2.2, 'floor')
        self.ring_g = glyph_mat('glyph-ring', (0.055, 0.045, 0.075), N=140, rows=3, h=0.026, z0=-0.040, lit=0.12, seed=3)
        self.ring_g2 = glyph_mat('glyph-ring-2', (0.060, 0.050, 0.085), N=96, rows=2, h=0.030, z0=-0.030, lit=0.08, seed=7)
        self.ring_g3 = glyph_mat('glyph-ring-3', mul(AME, 0.45), N=72, rows=2, h=0.024, z0=-0.024, lit=0.15, seed=11)
        self.halo_g = glyph_mat('glyph-halo', (0.055, 0.045, 0.075), N=520, rows=2, h=0.030, z0=-0.030, lit=0.10, seed=19)
        self.dais_g = glyph_mat('glyph-dais', mul(DPUR, 0.5), metal=0.0, rough=0.36, N=300, rows=3, h=0.09, z0=4.62, lit=0.06,
                                strength=1.6, seed=23, mode='r', aniso=0.0, group='floor')
        self.stone = stone_mat()
        self.floor = principled('far-floor', mul(OBS, 0.8), 0.0, 0.5)

# ---------------------------------------------------------------- shapes

def shell(name, C, rad, lon0, lon1, lat0, lat1, thick, mat, nu=28, nv=18, bevel=0.012):
    """A curved plate cut from an ellipsoid round C (lon 0 = +X, -90 = front), thickness inward."""
    C = Vector(C); bm = bmesh.new(); rows = []
    for j in range(nv + 1):
        la = math.radians(lat0 + (lat1 - lat0) * j / nv); row = []
        for i in range(nu + 1):
            lo = math.radians(lon0 + (lon1 - lon0) * i / nu)
            row.append(bm.verts.new(C + V(rad[0] * math.cos(la) * math.cos(lo), rad[1] * math.cos(la) * math.sin(lo), rad[2] * math.sin(la))))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new([rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]]).smooth = True
    bm.normal_update(); bm.faces.ensure_lookup_table()
    f = bm.faces[len(bm.faces) // 2]
    if f.normal.dot(f.calc_center_median() - C) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    S.shell_mods(ob, thick, bevel)
    return ob

def lathe_along(name, p0, p1, prof, mat, seg=48, sharp=40):
    """Profile (t 0..1 along p0->p1, radius) spun round the segment."""
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    pts = [(r, -L / 2 + t * L) for t, r in prof]
    return K.lathe(name, pts, mat, S.along((p0 + p1) / 2, d), seg, sharp=sharp)

def flat(ob):
    for p in ob.data.polygons: p.use_smooth = False
    return ob

def taper_box(name, p0, p1, w0, w1, t0, t1, mat, up=V(0, 0, 1), bevel=0.01):
    """A plate from p0 to p1 whose width (along `side`) and thickness taper; local Y faces `up`-ish (out of the limb)."""
    p0, p1 = Vector(p0), Vector(p1); ax = (p1 - p0); L = ax.length; ax.normalize()
    side = ax.cross(Vector(up)).normalized(); nrm = side.cross(ax).normalized()
    bm = bmesh.new(); vs = []
    for t, w, th in ((0, w0, t0), (1, w1, t1)):
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vs.append(bm.verts.new(p0 + ax * (t * L) + side * (sx * w / 2) + nrm * (sy * th / 2)))
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))

# ---------------------------------------------------------------- the skeleton: joints are empties, parts hang on them
REST = {
    'pelvis': V(0, 0, 4.50), 'spine': V(0, 0, 4.95), 'chest': V(0, 0, 6.00), 'neck': V(0, 0, 8.12), 'head': V(0, -0.05, 8.62),
    'sh+': V(1.80, 0.05, 7.55), 'el+': V(2.04, 0.08, 5.58), 'wr+': V(2.10, -0.10, 3.78),
    'hip+': V(0.70, 0.0, 4.25), 'kn+': V(0.80, -0.10, 2.30), 'an+': V(0.84, 0.12, 0.44),
}
for k in list(REST):
    if k.endswith('+'): p = REST[k]; REST[k[:-1] + '-'] = V(-p.x, p.y, p.z)
PARENT = {'spine': 'pelvis', 'chest': 'spine', 'neck': 'chest', 'head': 'neck'}
for s in '+-':
    PARENT.update({f'sh{s}': 'chest', f'el{s}': f'sh{s}', f'wr{s}': f'el{s}', f'hip{s}': 'pelvis', f'kn{s}': f'hip{s}', f'an{s}': f'kn{s}'})
J = {}
CORE = V(0, -0.05, 6.95)                 # the heart, in the chest
EYE = V(0, -0.47, 8.92)                  # the eye's centre; the eye looks along -Y

def build_joints():
    for k, p in REST.items():
        e = link(bpy.data.objects.new('j-' + k, None)); e.matrix_world = T(*p); J[k] = e
    for k, par in PARENT.items():
        J[k].parent = J[par]; J[k].matrix_parent_inverse = T(*REST[par]).inverted(); J[k].matrix_basis = T(*REST[k])

POSES = {   # joint: (rx, ry, rz) degrees about the joint, in its parent's frame; 'root': pelvis offset
    'stand': {'root': V(0, 0, 0), 'sh+': (2, -7, 0), 'sh-': (2, 7, 0), 'el+': (-8, 0, 0), 'el-': (-8, 0, 0), 'head': (-3, 0, 0)},
    'kneel': {'root': V(0, 0.10, -1.96), 'spine': (11, 0, 0), 'chest': (13, 0, 0), 'neck': (8, 0, 0), 'head': (20, 0, 0),
              'sh+': (16, -4, 0), 'sh-': (16, 4, 0), 'el+': (22, 0, 0), 'el-': (22, 0, 0), 'wr+': (24, 0, 0), 'wr-': (24, 0, 0),
              'kn+': (89, 0, 0), 'kn-': (89, 0, 0), 'an+': (74, 0, 0), 'an-': (74, 0, 0)},
}
def apply_pose(w):
    """w: 0 kneeling .. 1 standing."""
    a, b = POSES['kneel'], POSES['stand']
    for k, e in J.items():
        ra, rb = Vector(a.get(k, (0, 0, 0))), Vector(b.get(k, (0, 0, 0)))
        r = ra.lerp(rb, w)
        loc = REST[k] + (a['root'].lerp(b['root'], w) if k == 'pelvis' else V(0, 0, 0))
        e.matrix_basis = T(*loc) @ Euler([math.radians(x) for x in r]).to_matrix().to_4x4()

# ---------------------------------------------------------------- assembly: each part has its moment
PARTS = []
class part:
    """Objects made inside hang on joint `j` and arrive between build times t0..t1: they travel in from `off` (metres,
    world at rest) and turn `rot` degrees about axis `ax` round `anchor` while they come. `spin`: degrees per frame."""
    def __init__(self, j, t0, t1, off=(0, 0, 0), rot=0.0, ax='Z', anchor=None, spin=0.0):
        self.j, self.t0, self.t1, self.off, self.rot, self.ax, self.anchor, self.spin = j, t0, t1, Vector(off), rot, ax, anchor, spin
    def __enter__(self): self.before = set(bpy.data.objects); self.obs = []; return self
    def __exit__(self, *a):
        obs = [o for o in set(bpy.data.objects) - self.before if o.parent is None and o.type != 'EMPTY']
        anchor = Vector(self.anchor) if self.anchor is not None else REST[self.j]
        for o in obs:
            M = o.matrix_world.copy()
            if self.j:
                o.parent = J[self.j]; o.matrix_parent_inverse = T(*REST[self.j]).inverted()
            o.matrix_basis = M
            PARTS.append(dict(ob=o, M=M, t0=self.t0, t1=self.t1, off=self.off, rot=self.rot, ax=self.ax, anchor=anchor, spin=self.spin))
            self.obs.append(PARTS[-1])

def assemble(B, g):
    """B: build time. g: global frame (for parts that keep turning)."""
    for p in PARTS:
        o = p['ob']
        if B < p['t0'] - 1e-6:
            o.hide_render = True; continue
        o.hide_render = False
        e = eout((B - p['t0']) / max(1e-6, p['t1'] - p['t0']))
        M = p['M']
        if p['spin']: M = M @ Rz(p['spin'] * g)
        if e < 1:
            R = Matrix.Rotation(math.radians(p['rot'] * (1 - e)), 4, p['ax'])
            M = T(*(p['off'] * (1 - e))) @ T(*p['anchor']) @ R @ T(*(-p['anchor'])) @ M
        o.matrix_basis = M

# ---------------------------------------------------------------- 02 the core (software)
def build_core(m):
    with part('chest', 0.0, 0.0):
        c = K.lathe('crystal', [(0, -0.58), (0.36, -0.10), (0.38, 0.04), (0.33, 0.16), (0, 0.62)], m.crystal, T(*CORE) @ Rz(11), 8, sharp=1)
        flat(c)
        inner = K.lathe('crystal-inner', [(0, -0.30), (0.17, -0.04), (0.17, 0.06), (0, 0.32)], m.core_v, T(*CORE) @ Rz(33), 6, sharp=1)
        flat(inner)
        ball('core-seed', CORE + V(0, 0, 0.02), 0.06, m.seed, seg=16)
    # three engraved rings turning round the heart at their own tilts; they arrive first, as the camera pulls out
    for k, (ri, ro, hw, tilt, sp, mat) in enumerate(((0.86, 0.95, 0.070, Rx(90) @ Ry(8), 0.55, m.ring_g),
                                                    (0.70, 0.77, 0.055, Ry(62) @ Rx(24), -0.85, m.ring_g2),
                                                    (0.56, 0.61, 0.045, Rx(-28) @ Ry(-18), 1.2, m.ring_g3))):
        with part('chest', 0.0 if k == 0 else 0.15 * k, 0.0 if k == 0 else 0.55 + 0.1 * k, off=(0, 0, 0), rot=0 if k == 0 else 70 + 30 * k, ax='X', anchor=CORE, spin=sp):
            K.ring(f'gimbal{k}', ri, ro, -hw, hw, mat, T(*CORE) @ tilt, c=0.006, seg=192)
            if k == 0:   # two gold pins where the outer ring is held
                for s in (-1, 1):
                    cyl(f'gimbal-pin{s}', T(*CORE) @ tilt @ V(s * (ro - 0.02), 0, 0), T(*CORE) @ tilt @ V(s * (ro + 0.06), 0, 0), 0.03, m.gold, seg=16)
    # six computing modules dock round the heart, each joined to it by a lit pathway
    rs = random.Random(4)
    for k in range(6):
        a = math.radians(30 + 60 * k); h = (0.42, -0.30, 0.18, -0.46, 0.36, -0.10)[k]
        p = CORE + V(1.12 * math.cos(a), 0.80 * math.sin(a), h)
        u = (p - CORE).normalized()
        with part('chest', 0.45 + 0.07 * k, 0.85 + 0.05 * k, off=u * 1.6, rot=90, ax='Z', anchor=p):
            Mm = S.along(p, u)
            box(f'module{k}', (0.16, 0.12, 0.20), m.ivory, Mm, bevel=0.018)
            box(f'module{k}-slit', (0.022, 0.125, 0.12), m.path, Mm @ T(0, 0, 0.004), bevel=0.0)
            box(f'module{k}-cap', (0.17, 0.13, 0.03), m.dark, Mm @ T(0, 0, 0.11), bevel=0.006)
        with part('chest', 0.80 + 0.05 * k, 1.0):
            q0 = CORE + u * 0.30; q3 = p - u * 0.12
            pts = bezier(q0, q0 + u * 0.25 + V(0, 0, 0.12), q3 - u * 0.25, q3, 16)
            S.filament(f'module{k}-path', pts, 0.008, m.path, I4)

# ---------------------------------------------------------------- 02b the head and eye (game & app: the interaction layer)
EYE_PARTS = {}
def build_head(m):
    Mf = T(*EYE) @ Rx(90)                 # local Z looks out of the eye (-Y)
    with part('neck', 1.25, 1.7, off=(0, 0, 0.7)):
        K.lathe('neck', [(0, 7.98), (0.19, 7.98), (0.15, 8.20), (0.18, 8.42), (0.15, 8.62), (0, 8.66)], m.dark, I4, 48, sharp=40)
        for z in (8.18, 8.42):
            K.ring(f'neck-ring{z}', 0.17, 0.215, z - 0.025, z + 0.025, m.gold, I4, c=0.004, seg=64)
    with part('head', 1.2, 1.7, off=(0, 0, 0.9), rot=-30, ax='X', anchor=EYE):
        cup = [(0, -0.80), (0.24, -0.77), (0.38, -0.62), (0.45, -0.38), (0.44, -0.16), (0.40, 0.00), (0.355, 0.05),
               (0.31, 0.03), (0.295, -0.06), (0.24, -0.20), (0.19, -0.20), (0.19, -0.72), (0, -0.72)]
        K.lathe('helm', cup, m.obs, Mf, 96, sharp=30)
        K.ring('helm-rim', 0.33, 0.37, 0.025, 0.055, m.gold, Mf, c=0.004, seg=96)
        # a brow: one ivory plate over the eye, swept back
        # chin plate
        shell('chin', EYE + V(0, 0.28, 0.02), (0.47, 0.78, 0.50), -140, -40, -62, -34, 0.035, m.dark, nu=20, nv=8)
    # a hood round the eye socket, open at the front: the silhouette's head
    with part('head', 1.3, 1.8, off=(0, 0.7, 0.8), rot=20, ax='X', anchor=EYE):
        HC = EYE + V(0, 0.50, 0.16)
        shell('hood', HC, (0.52, 0.88, 0.78), -38, 218, -36, 88, 0.05, m.obs, nu=48, nv=24)
        shell('hood-crest', HC + V(0, 0.02, 0), (0.545, 0.905, 0.805), 82, 98, -20, 88, 0.025, m.gold, nu=6, nv=24)
        for s2 in (-1, 1):
            lo = (-38, -30) if s2 > 0 else (210, 218)
            shell(f'hood-lip{s2}', HC, (0.535, 0.895, 0.795), lo[0], lo[1], -36, 74, 0.02, m.gold, nu=3, nv=20)
    # the eye: three rings, an iris of blades round a pupil that opens into the dark
    with part('head', 1.0, 1.5, off=(0, -0.9, 0.2), rot=0, anchor=EYE, spin=0.4):
        K.ring('eye-ring1', 0.245, 0.292, -0.06, 0.012, m.ring_g3, Mf, c=0.004, seg=128)
    with part('head', 1.05, 1.55, off=(0, -1.1, 0.1), spin=-0.9):
        K.ring('eye-ring2', 0.212, 0.232, -0.07, -0.02, m.gold, Mf, c=0.003, seg=128)
        for k in range(24):
            a = TAU * k / 24
            box(f'eye-notch{k}', (0.016, 0.020, 0.030), m.gold, Mf @ T(0.205 * math.cos(a), 0.205 * math.sin(a), -0.045) @ Rz(math.degrees(a)), bevel=0.002)
    with part('head', 1.1, 1.6, off=(0, -1.3, 0.0), spin=0.6):
        K.ring('eye-ring3', 0.168, 0.198, -0.09, -0.05, m.obs, Mf, c=0.003, seg=128)
    # the pupil's well: a dark tube behind the iris that the camera can fly into
    with part('head', 1.0, 1.0):
        K.tube('eye-well', 0.172, 0.186, -0.69, -0.10, m.black, Mf, seg=64)
        K.lathe('eye-well-cap', [(0, -0.70), (0.186, -0.70), (0.186, -0.685), (0, -0.685)], m.black, Mf, 64, sharp=60)
        K.ring('eye-glow-ring', 0.150, 0.172, -0.135, -0.118, m.eye_v, Mf, c=0.002, seg=96)
    blades = []
    with part('head', 1.15, 1.65, off=(0, -0.6, 0)):
        for k in range(14):
            blades.append(box(f'iris{k}', (0.105, 0.040, 0.010), m.vmetal, I4, bevel=0.003))
            blades.append(box(f'iris{k}-edge', (0.105, 0.004, 0.0112), m.eye, I4, bevel=0.0))
    lit = []
    with part('head', 1.15, 1.65):
        lit.append(torus('pupil-rim', 0.06, 0.0045, m.eye, Mf @ T(0, 0, -0.098), seg=64, rseg=8))
    EYE_PARTS.update(blades=blades, rim=lit[0], Mf=Mf)

def set_iris(rp, turn):
    """rp: pupil radius (0.05 closed .. 0.17 wide open). turn: degrees the iris has turned."""
    Mf = EYE_PARTS['Mf']; bl = EYE_PARTS['blades']
    outer = 0.172; mid = (rp + outer) / 2; ln = max(0.004, outer - rp) * 1.25
    for k in range(14):
        a = math.radians(turn + 360 * k / 14)
        for j, ob in enumerate(bl[2 * k:2 * k + 2]):
            dz = -0.103 + 0.0025 * (k % 2) + (0.0 if j == 0 else 0.0)
            M = Mf @ Rz(math.degrees(a)) @ T(mid, 0, dz) @ Rz(24) @ Matrix.Diagonal((ln / 0.105, 1, 1, 1))
            if j == 1: M = M @ T(0, 0.020, 0)
            PART_OF[ob.name]['M'] = M
    rim = EYE_PARTS['rim']; PART_OF[rim.name]['M'] = Mf @ T(0, 0, -0.098) @ Matrix.Scale(rp / 0.06, 4)

PART_OF = {}

# ---------------------------------------------------------------- 03 the shell (cybersecurity)
SEAL = []
def build_shell(m):
    C = CORE
    # ribs: bands round the chest, open at the front where the seal sits
    levels = ((-0.88, 0.80, 0.62, 0.13, 22), (-0.50, 0.98, 0.72, 0.15, 30), (-0.12, 1.14, 0.82, 0.16, 36),
              (0.26, 1.28, 0.88, 0.15, 36), (0.62, 1.36, 0.88, 0.14, 30))
    for k, (dz, rx, ry, w, gap) in enumerate(levels):
        for s in (-1, 1):
            d0, d1 = (-90 + gap, 82) if s > 0 else (98, 270 - gap)
            with part('chest', 2.0 + 0.08 * k, 2.45 + 0.08 * k, off=(s * 1.3, 0.6, 0), rot=-s * 28, ax='Z', anchor=C):
                K.arc_band(f'rib{k}{s}', 1.0, d0, d1, w, 0.075, m.obs, T(C.x, C.y + 0.06, C.z + dz) @ Rx(14) @ Matrix.Diagonal((rx, ry, 1, 1)), seg=96)
                if k in (1, 3):
                    Mr = T(C.x, C.y + 0.06, C.z + dz) @ Rx(14)
                    pts = [Mr @ V(rx * 1.035 * math.cos(math.radians(a)), ry * 1.035 * math.sin(math.radians(a)), 0)
                           for a in [d0 + 4 + (d1 - d0 - 8) * i / 60 for i in range(61)]]
                    S.filament(f'rib{k}{s}-path', pts, 0.010, m.path, I4)
    # two ivory chest plates and the back shield
    for s in (-1, 1):
        lo = (-62, -8) if s > 0 else (-172, -118)
        with part('chest', 2.35, 2.85, off=(s * 1.1, -0.9, 0.5), rot=s * 30, ax='Z', anchor=C):
            shell(f'pectoral{s}', C + V(0, 0.08, 0), (1.36, 0.96, 1.18), lo[0], lo[1], 14, 58, 0.07, m.obs)
            shell(f'pectoral{s}-edge', C + V(0, 0.08, 0), (1.375, 0.975, 1.195), lo[0], lo[1], 55, 58, 0.02, m.gold, nu=28, nv=2)
    with part('chest', 2.2, 2.7, off=(0, 1.6, 0), rot=0):
        shell('back-shield', C + V(0, 0.02, 0), (1.34, 0.98, 1.22), 22, 158, -46, 64, 0.08, m.dark, nu=36, nv=22)
        shell('spine-plate', C + V(0, 0.10, 0), (1.40, 1.04, 1.26), 78, 102, -56, 70, 0.06, m.gold, nu=8, nv=24)
    # the seal over the heart: three rings that turn until their gaps line up and they lock
    Cs = C + V(0, -0.93, 0.0); Ms = T(*Cs) @ Rx(90)
    with part('chest', 2.55, 2.95, off=(0, -1.4, 0)):
        K.ring('seal-outer', 0.43, 0.54, -0.05, 0.05, m.ring_g, Ms, c=0.006, seg=128)
    for k, (ri, ro, z, gaps, mat) in enumerate(((0.355, 0.405, 0.02, 3, m.gold), (0.29, 0.335, 0.035, 4, m.vmetal))):
        with part('chest', 2.62 + 0.06 * k, 3.0, off=(0, -1.6, 0)) as pp:
            n = gaps; span = 360 / n
            for g in range(n):
                K.arc_band(f'seal{k}-{g}', (ri + ro) / 2, g * span + 9, (g + 1) * span - 9, 0.05, ro - ri, mat, Ms @ T(0, 0, z), seg=48)
                if k == 1:
                    a = math.radians(g * span + span / 2)
                    box(f'seal-latch{g}', (0.06, 0.05, 0.05), m.gold, Ms @ T(0.27 * math.cos(a), 0.27 * math.sin(a), z) @ Rz(math.degrees(a)), bevel=0.006)
        SEAL.append((pp, Ms, (75, -110)[k]))
    # the collar where the neck leaves the chest
    with part('chest', 2.7, 3.0, off=(0, 0, 0.8)):
        K.ring('collar', 0.30, 0.52, 8.02 - 0.05, 8.02 + 0.05, m.gold, I4, c=0.01, seg=96)
        K.ring('collar-low', 0.40, 0.66, 7.90 - 0.06, 7.90 + 0.04, m.obs, I4, c=0.01, seg=96)

# ---------------------------------------------------------------- 04 the body (mechatronics: next)
def limb_path(name, p0, p1, m):
    S.filament(name, [Vector(p0), Vector(p1)], 0.012, m.path, I4)

def build_body(m):
    R = REST
    # spine and pelvis: the heart's energy runs down a lit rod through floating vertebrae
    with part('spine', 3.0, 3.5, off=(0, 0, -0.8)):
        cyl('spine-rod', R['spine'] + V(0, 0, -0.1), R['chest'] + V(0, 0, 0.05), 0.055, m.path, seg=16)
        for k in range(5):
            z = 5.06 + 0.21 * k
            K.lathe(f'vert{k}', [(0, z - 0.05), (0.26, z - 0.05), (0.33, z - 0.02), (0.33, z + 0.02), (0.26, z + 0.05), (0, z + 0.05)], m.dark, I4, 64, sharp=30)
            K.ring(f'vert{k}-edge', 0.33, 0.345, z - 0.008, z + 0.008, m.gold, I4, c=0.002, seg=64)
    with part('pelvis', 3.05, 3.55, off=(0, 0, -1.2)):
        K.lathe('pelvis', [(0, 4.10), (0.46, 4.14), (0.78, 4.40), (0.80, 4.58), (0.62, 4.70), (0.30, 4.78), (0, 4.78)], m.obs, I4, 96, sharp=30)
        K.ring('pelvis-band', 0.80, 0.84, 4.46, 4.56, m.ring_g2, I4, c=0.006, seg=128)
        shell('tasset-f', V(0, 0.0, 4.55), (0.98, 0.82, 1.0), -128, -52, -48, -6, 0.05, m.dark, nu=16, nv=10)
        for side in (-1, 1):
            for k in range(5):
                zc = 4.16 - 0.34 * k; w = 0.66 + 0.07 * k; y = side * (0.80 + 0.05 * k)
                Mp = T(0, y, zc) @ Rx(side * -(5 + 2.5 * k))
                box(f'skirt{side}{k}', (w, 0.05, 0.29), m.obs if k % 2 == 0 else m.dark, Mp, bevel=0.012)
                box(f'skirt{side}{k}-edge', (w + 0.004, 0.056, 0.022), m.gold, Mp @ T(0, 0, -0.135), bevel=0.003)
        for s2 in (-1, 1):
            lo2 = (-40, 40) if s2 > 0 else (140, 220)
            shell(f'hip-guard{s2}', V(0, 0.0, 4.50), (1.05, 0.88, 1.0), lo2[0], lo2[1], -52, -4, 0.06, m.obs, nu=16, nv=10)
    for s in (-1, 1):
        sg = '+' if s > 0 else '-'
        sh, el, wr = R[f'sh{sg}'], R[f'el{sg}'], R[f'wr{sg}']
        hip, kn, an = R[f'hip{sg}'], R[f'kn{sg}'], R[f'an{sg}']
        # shoulders: a sphere in an oversized ring, joined to the chest by a short axle
        with part('chest', 3.1, 3.6, off=(s * 1.4, 0, 0.4)):
            cyl(f'sh-axle{sg}', V(s * 1.10, 0.05, 7.55), sh, 0.13, m.dark, seg=24)
        with part(f'sh{sg}', 3.15, 3.65, off=(s * 1.6, 0, 0.6), rot=s * 40, ax='Y'):
            S.sphere(f'sh-ball{sg}', 0.46, m.dark, T(*sh), seg=48)
            Mr = S.along(sh, V(s, -0.85, 0.10))
            torus(f'sh-ring{sg}', 0.98, 0.070, m.obs, Mr, seg=160, rseg=14)
            K.ring(f'sh-ring{sg}-g', 0.86, 0.91, -0.03, 0.03, m.ring_g, Mr, c=0.004, seg=160)
            lo = (-70, 70) if s > 0 else (110, 250)
            shell(f'pauldron{sg}', sh + V(0, 0.02, 0.02), (0.78, 0.74, 0.66), lo[0], lo[1], 4, 84, 0.06, m.obs)
            shell(f'pauldron{sg}-2', sh + V(0, 0.02, 0.20), (0.62, 0.60, 0.52), lo[0] + 10, lo[1] - 10, 10, 86, 0.05, m.dark)
            shell(f'pauldron{sg}-edge', sh + V(0, 0.02, 0.02), (0.795, 0.755, 0.675), lo[0], lo[1], 4, 9, 0.02, m.gold, nu=28, nv=2)
        # upper arm
        with part(f'sh{sg}', 3.3, 3.75, off=(s * 1.0, 0, -1.2)):
            cyl(f'uarm{sg}', sh, el, 0.16, m.dark, seg=24)
            limb_path(f'uarm{sg}-path', sh + (el - sh) * 0.15 + V(0, -0.125, 0), sh + (el - sh) * 0.85 + V(0, -0.125, 0), m)
            taper_box(f'uarm-plate{sg}', sh + (el - sh) * 0.22 + V(s * 0.19, 0, 0), sh + (el - sh) * 0.82 + V(s * 0.17, 0, 0), 0.30, 0.20, 0.07, 0.05, m.obs, up=V(s, 0, 0))
        # elbow, forearm (a heavy gauntlet), wrist
        with part(f'el{sg}', 3.4, 3.85, off=(s * 1.2, -0.4, -1.4)):
            cyl(f'elbow{sg}', el - V(0.17, 0, 0), el + V(0.17, 0, 0), 0.21, m.obs, seg=32, round_=0.04)
            torus(f'elbow-ring{sg}', 0.29, 0.032, m.gold, T(*el) @ Ry(90), seg=96, rseg=8)
            lathe_along(f'forearm{sg}', el, wr, [(0.0, 0.10), (0.06, 0.20), (0.30, 0.31), (0.62, 0.33), (0.92, 0.25), (1.0, 0.16)], m.obs)
            K.ring(f'forearm-band{sg}', 0.312, 0.335, -0.06, 0.06, m.ring_g2, S.along(el + (wr - el) * 0.36, wr - el), c=0.004, seg=96)
            limb_path(f'farm{sg}-path', el + (wr - el) * 0.42 + V(0, -0.33, 0), el + (wr - el) * 0.90 + V(0, -0.255, 0), m)
        # one forearm plate still floats loose: the body is still being built
        with part(f'el{sg}', 3.6, 4.0, off=(s * 1.5, -0.6, 0)):
            taper_box(f'farm-plate{sg}', el + (wr - el) * 0.30 + V(s * 0.46, 0, 0), el + (wr - el) * 0.86 + V(s * 0.40, 0, 0), 0.30, 0.20, 0.05, 0.04, m.ivory, up=V(s, 0, 0))
        with part(f'wr{sg}', 3.5, 3.95, off=(s * 1.0, -0.6, -1.0)):
            S.sphere(f'wrist{sg}', 0.14, m.gold, T(*wr), seg=24)
            pc = wr + V(0, -0.02, -0.28)
            box(f'palm{sg}', (0.16, 0.36, 0.40), m.dark, T(*pc), bevel=0.04)
            for f, fy in enumerate((-0.13, 0.0, 0.13)):
                p = pc + V(0, fy, -0.20); d = V(-s * 0.05, -0.06, -1).normalized()
                for seg, L in enumerate((0.26, 0.21, 0.16)):
                    q = p + d * L
                    cyl(f'finger{sg}{f}{seg}', p, q, 0.048 - 0.006 * seg, m.obs if seg < 2 else m.ivory, seg=16, round_=0.02)
                    p = q; d = (d + V(-s * 0.18, 0, 0.02)).normalized()
            p = pc + V(-s * 0.10, -0.14, -0.05)
            cyl(f'thumb{sg}', p, p + V(-s * 0.18, -0.10, -0.22), 0.05, m.obs, seg=16, round_=0.02)
        # legs: hip, thigh, a big ringed knee, a tapered shin, a long arched foot
        with part(f'hip{sg}', 3.2, 3.7, off=(s * 1.2, 0, -1.4)):
            S.sphere(f'hip-ball{sg}', 0.30, m.dark, T(*hip), seg=32)
            cyl(f'thigh{sg}', hip, kn, 0.21, m.dark, seg=24)
            lathe_along(f'thigh-shell{sg}', hip + (kn - hip) * 0.10, hip + (kn - hip) * 0.86, [(0.0, 0.20), (0.12, 0.31), (0.55, 0.33), (1.0, 0.24)], m.obs)
            K.ring(f'thigh-band{sg}', 0.325, 0.345, -0.05, 0.05, m.ring_g2, S.along(hip + (kn - hip) * 0.40, kn - hip), c=0.004, seg=96)
            limb_path(f'thigh{sg}-path', hip + (kn - hip) * 0.15 + V(s * 0.33, 0, 0), hip + (kn - hip) * 0.78 + V(s * 0.30, 0, 0), m)
        with part(f'kn{sg}', 3.3, 3.8, off=(s * 1.0, -1.0, -0.8)):
            cyl(f'knee{sg}', kn - V(0.22, 0, 0), kn + V(0.22, 0, 0), 0.34, m.dark, seg=40, round_=0.05)
            torus(f'knee-ring{sg}', 0.42, 0.04, m.gold, T(*kn) @ Ry(90), seg=96, rseg=8)
            lathe_along(f'shin{sg}', kn, an, [(0.0, 0.18), (0.08, 0.32), (0.30, 0.41), (0.75, 0.26), (1.0, 0.15)], m.obs)
            limb_path(f'shin{sg}-path', kn + (an - kn) * 0.18 + V(0, -0.35, 0), kn + (an - kn) * 0.70 + V(0, -0.25, 0), m)
        with part(f'kn{sg}', 3.55, 4.0, off=(s * 0.6, -1.4, 0)):
            taper_box(f'shin-plate{sg}', kn + (an - kn) * 0.12 + V(0, -0.52, 0), kn + (an - kn) * 0.60 + V(0, -0.42, 0), 0.34, 0.22, 0.05, 0.04, m.ivory, up=V(0, -1, 0))
        with part(f'an{sg}', 3.45, 3.9, off=(s * 0.8, -1.2, -0.4)):
            S.sphere(f'ankle{sg}', 0.16, m.gold, T(*an), seg=24)
            b0 = an + V(0, 0.10, -0.22)
            taper_box(f'foot{sg}', b0, b0 + V(s * 0.02, -1.10, -0.12), 0.44, 0.24, 0.22, 0.06, m.obs, up=V(0, 0, 1), bevel=0.03)
            taper_box(f'heel{sg}', b0, b0 + V(0, 0.38, -0.10), 0.24, 0.10, 0.16, 0.06, m.dark, up=V(0, 0, 1), bevel=0.02)
            limb_path(f'foot{sg}-path', b0 + V(0, -0.10, 0.105), b0 + V(s * 0.02, -0.80, 0.0), m)

# ---------------------------------------------------------------- 05 the ring of works, later the halo
WORKS = ['jontai', 'lumo', 'locked', 'cookies']
WORK_ANG = [-90, 0, 90, 180]       # front, right, back, left round the kneeling body; diagonals on the halo       # on the ring, degrees in its own plane
RING_R = 3.25
RING = {}
def build_ring(m):
    e = link(bpy.data.objects.new('ring', None)); RING['e'] = e
    obs = []
    obs.append(torus('halo', RING_R, 0.085, m.gold, I4, seg=384, rseg=14))
    obs.append(K.ring('halo-band', RING_R - 0.30, RING_R - 0.10, -0.045, 0.045, m.halo_g, I4, c=0.008, seg=384))
    obs.append(torus('halo-in', RING_R - 0.32, 0.024, m.obs, I4, seg=384, rseg=8))
    for k, a in enumerate(WORK_ANG):
        c = V(RING_R * math.cos(math.radians(a)), RING_R * math.sin(math.radians(a)), 0)
        obs.append(K.ring(f'cradle{k}', 0.10, 0.16, -0.09, 0.09, m.dark, T(*c) @ Rz(a) @ Ry(90), c=0.01, seg=48))
    for o in obs: o.parent = e
    RING['obs'] = obs
    # the artifacts stay upright wherever the ring carries them
    RING['art'] = {}
    for k, key in enumerate(WORKS):
        a = link(bpy.data.objects.new(f'art-{key}', None)); before = set(bpy.data.objects)
        ART_BUILD[key](m)
        for o in set(bpy.data.objects) - before:
            if o.parent is None: o.parent = a
        RING['art'][key] = a

def art_jontai(m):
    """Jontai Energy, a site that plays one Aruban day: a dial with a small sun on its arc and a panel that tracks it."""
    K.lathe('jt-foot', [(0, 0), (0.16, 0), (0.16, 0.03), (0.06, 0.06), (0.04, 0.16), (0, 0.16)], m.dark, I4, 48, sharp=30)
    Md = T(0, 0, 0.46) @ Rx(90)
    K.lathe('jt-dial', [(0, -0.025), (0.30, -0.025), (0.31, -0.01), (0.31, 0.01), (0.30, 0.025), (0, 0.025)], m.obs, Md, 96, sharp=30)
    K.lathe('jt-dial-glass', [(0, -0.030), (0.21, -0.030), (0.21, -0.026), (0, -0.026)], m.lens, Md, 96, sharp=30)
    K.ring('jt-dial-rim', 0.30, 0.325, -0.03, 0.03, m.gold, Md, c=0.003, seg=96)
    for k in range(9):
        a = math.radians(180 * k / 8)
        box(f'jt-hour{k}', (0.010, 0.05, 0.006), m.gold, Md @ T(0.25 * math.cos(a), 0.25 * math.sin(a), -0.027) @ Rz(math.degrees(a) - 90), bevel=0)
    D.tube('jt-arc', [V(0.44 * math.cos(math.radians(a)), -0.02, 0.46 + 0.44 * math.sin(math.radians(a))) for a in range(0, 181, 4)], [0.012] * 46, m.gold, res=3)
    sun = V(0.44 * math.cos(math.radians(62)), -0.02, 0.46 + 0.44 * math.sin(math.radians(62)))
    ball('jt-sun', sun, 0.05, m.path, seg=24)
    n = (sun - V(0, -0.06, 0.30)).normalized()
    box('jt-panel', (0.16, 0.012, 0.11), m.vmetal, S.along(V(0, -0.06, 0.30), n) @ Rx(90), bevel=0.003)
    cyl('jt-panel-arm', V(0, -0.03, 0.22), V(0, -0.06, 0.30), 0.008, m.gold, seg=8)

def art_lumo(m):
    """Lumo, a grocery list sorted in aisle order: a frame of rods, each row of beads put in order."""
    for x in (-0.30, 0.30):
        cyl(f'lu-post{x}', V(x, 0, 0), V(x, 0, 0.62), 0.02, m.dark, seg=16)
        ball(f'lu-cap{x}', V(x, 0, 0.64), 0.03, m.gold, seg=16)
    box('lu-base', (0.70, 0.16, 0.04), m.dark, T(0, 0, 0.02), bevel=0.01)
    rs = random.Random(2)
    for r in range(4):
        z = 0.15 + 0.13 * r
        cyl(f'lu-rod{r}', V(-0.30, 0, z), V(0.30, 0, z), 0.006, m.gold, seg=8)
        n = 4 + r % 2; x = -0.25
        for b in range(n):
            rad = 0.022 + 0.008 * b
            mat = (m.lens, m.gold, m.vmetal, m.obs)[(r + b) % 4] if b < n - 1 else m.path
            if b == n - 1: rad = 0.022
            ball(f'lu-bead{r}{b}', V(x + rad, 0, z), rad, mat, seg=20); x += 2 * rad + 0.008

def art_locked(m):
    """Locked, a gym log that ranks you: graduated plates on a spindle, a small lock ring at the top."""
    K.lathe('lk-foot', [(0, 0), (0.18, 0), (0.18, 0.03), (0, 0.03)], m.dark, I4, 48, sharp=30)
    cyl('lk-spindle', V(0, 0, 0.03), V(0, 0, 0.78), 0.018, m.gold, seg=12)
    z = 0.05
    for k, r in enumerate((0.27, 0.24, 0.21, 0.18, 0.15, 0.12)):
        h = 0.05
        K.lathe(f'lk-plate{k}', [(0.03, z), (r, z), (r, z + h), (0.03, z + h)], m.obs if k % 2 == 0 else m.vmetal, I4, 64, sharp=30)
        K.ring(f'lk-plate{k}-edge', r - 0.002, r + 0.004, z + h * 0.35, z + h * 0.65, m.gold, I4, c=0.001, seg=64) if k % 2 == 0 else None
        z += h + 0.018
    torus('lk-lock', 0.07, 0.014, m.gold, T(0, 0, z + 0.07) @ Rx(90), seg=48, rseg=8)
    ball('lk-light', V(0, 0, z + 0.07), 0.02, m.path, seg=16)
    box('lk-shackle', (0.10, 0.04, 0.05), m.gold, T(0, 0, z + 0.015), bevel=0.008)

def art_cookies(m):
    """Cookies Clicker, one loop that compounds: a button, and coins in a rising spiral that grow as they go."""
    K.lathe('ck-foot', [(0, 0), (0.20, 0), (0.20, 0.03), (0.12, 0.05), (0, 0.05)], m.dark, I4, 48, sharp=30)
    S.sphere('ck-button', 0.11, m.crystal, T(0, 0, 0.08) @ Matrix.Diagonal((1, 1, 0.65, 1)), seg=48)
    ball('ck-button-light', V(0, 0, 0.09), 0.03, m.path, seg=16)
    K.ring('ck-button-ring', 0.11, 0.135, 0.05, 0.09, m.gold, I4, c=0.004, seg=64)
    for k in range(16):
        t = k / 15; a = math.radians(40 + 330 * t * 1.6); rr = 0.17 + 0.16 * t; zc = 0.10 + 0.48 * t
        cr = 0.018 + 0.030 * t
        Mc = T(rr * math.cos(a), rr * math.sin(a), zc) @ Rz(math.degrees(a)) @ Ry(70)
        K.lathe(f'ck-coin{k}', [(0, -0.006), (cr, -0.006), (cr, 0.006), (0, 0.006)], m.gold if k % 3 else m.obs, Mc, 32, sharp=30)

ART_BUILD = {'jontai': art_jontai, 'lumo': art_lumo, 'locked': art_locked, 'cookies': art_cookies}

def ring_state(w, B, g):
    """w 0: lying round the kneeling body's waist (opened out of it as B goes 4..5); w 1: standing behind it as a halo."""
    open_ = eout(clamp(B - 4.05)); r = lerp(0.55, 1.0, open_)
    c0 = V(0, 0.55, 2.85); c1 = V(0, 1.05, 8.15)
    c = c0.lerp(c1, ease(w))
    tilt = Rx(90 * ease(w))
    turn = 45.0 * ease(w)
    e = RING['e']; e.matrix_world = T(*c) @ tilt @ Rz(turn) @ Matrix.Scale(r, 4)
    vis = B > 4.05
    for o in RING['obs']: o.hide_render = not vis
    for k, key in enumerate(WORKS):
        a = math.radians(WORK_ANG[k] + turn)
        local = V(RING_R * r * math.cos(a), RING_R * r * math.sin(a), 0)
        p = c + (tilt.to_3x3() @ local)
        rise = eout(clamp((B - 4.35 - 0.12 * k) / 0.5))
        art = RING['art'][key]
        face = math.degrees(math.atan2(p.x - c.x, -(p.y - c.y))) if w < 0.5 else 0.0
        s = 0.25 + 0.75 * rise
        lift = V(0, 0, 0.10) if w < 0.5 else V(0, 0, -0.5 * ease(w))
        art.matrix_world = T(*(p + lift - V(0, 0, 0.8 * (1 - rise)))) @ Rz(face * (1 - ease(w))) @ Matrix.Scale(s * (1.6 + 0.4 * ease(w)), 4)
        for o in art.children: o.hide_render = rise <= 0.001
    return c

# ---------------------------------------------------------------- the place: a dais in a hall of monoliths
def build_place(m):
    K.lathe('dais', [(0, -0.30), (5.6, -0.30), (5.6, -0.05), (5.52, 0.0), (0, 0.0)], m.stone, I4, 256, sharp=30)
    K.lathe('dais-step', [(5.6, -0.30), (6.6, -0.30), (6.6, -0.18), (5.6, -0.18)], m.stone, I4, 256, sharp=30)
    K.ring('dais-code', 4.60, 4.90, -0.004, 0.0015, m.dais_g, I4, c=0.0, seg=512)
    for r in (2.05, 3.55, 5.20):
        K.ring(f'dais-inlay{r}', r, r + 0.018, -0.002, 0.0018, m.inlay, I4, c=0.0, seg=384)
    for k in range(24):
        a = math.radians(7.5 + 15 * k); u = V(math.cos(a), math.sin(a), 0)
        box(f'dais-spoke{k}', (0.62, 0.012, 0.003), m.gold, T(*(u * 4.25)) @ Rz(math.degrees(a)), bevel=0)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=220)
    me = bpy.data.meshes.new('ground'); bm.to_mesh(me); bm.free(); me.materials.append(m.floor)
    g = link(bpy.data.objects.new('ground', me)); g.location = (0, 0, -0.30)
    # monoliths far off, in a broken circle, and one colossal ring half sunk behind: an older version of the same idea
    rs = random.Random(9)
    for k in range(16):
        a = math.radians(-90 + 22.5 * k + rs.uniform(-6, 6))
        if abs(((math.degrees(a) + 90 + 180) % 360) - 180) < 24: continue
        r = rs.uniform(20, 26); h = rs.uniform(12, 30); w = rs.uniform(1.4, 2.6)
        box(f'monolith{k}', (w, w * 0.6, h), m.obs, T(r * math.cos(a), r * math.sin(a), h / 2 - 0.3) @ Rz(math.degrees(a) + 90) @ Ry(rs.uniform(-3, 3)), bevel=0.05)
    torus('far-ring', 15.0, 0.55, m.dark, T(0, 34, 4.0) @ Rx(90), seg=256, rseg=24)
    K.ring('far-ring-band', 13.6, 14.3, -0.25, 0.25, m.halo_g, T(0, 34.0, 4.0) @ Rx(90), c=0.02, seg=512)

def build_dust(m):
    rs = random.Random(5)
    base = S.sphere('dust-base', 1.0, m.mote, T(0, 0, -300), seg=10); base.hide_render = True
    for k in range(70):
        a = rs.uniform(0, TAU); r = rs.uniform(1.6, 9.0); z = rs.uniform(0.3, 12.0)
        ob = link(bpy.data.objects.new(f'mote{k}', base.data))
        ob.matrix_world = T(r * math.cos(a), r * math.sin(a), z) @ Matrix.Scale(rs.choice((0.006, 0.008, 0.010, 0.013)), 4)
        ob.visible_shadow = False

def build_lights(m):
    L = {}
    L['key'] = K.area('key', (-8, -11, 13), (0, 0, 4.5), 5.0, ENV('R72_KEY', 2600), (0.92, 0.86, 1.0), size_y=4.0)
    L['fill'] = K.area('fill', (9, -9, 3), (0, 0, 4), 6.0, ENV('R72_FILL', 700), (0.62, 0.48, 1.0), size_y=3.0)
    L['rim-r'] = K.area('rim-r', (8, 9, 9), (0, 0, 5), 3.0, ENV('R72_RIM', 5200), LIGHT_VIO, size_y=10.0)
    L['rim-l'] = K.area('rim-l', (-9, 8, 5), (0, 0, 4), 3.0, ENV('R72_RIM', 5200) * 0.8, LIGHT_VIO, size_y=8.0)
    L['top'] = K.area('top', (0, 1, 16), (0, 0, 5), 4.0, ENV('R72_TOP', 1400), (0.80, 0.72, 1.0), size_y=4.0)
    for k, ob in L.items(): ob.visible_volume_scatter = False; ob.visible_glossy = k in ('key', 'top')
    L['beam'] = spot('beam', (2.5, 7.0, 32.0), (0, 0.5, 4.0), ENV('R72_BEAM', 22000), LIGHT_VIO, size=15, blend=0.85, radius=1.5)
    L['wash'] = K.area('wash', (0, 48, 3), (0, 0, 5), 50.0, ENV('R72_WASH', 2400), LIGHT_VIO, size_y=8.0)
    L['wash'].visible_volume_scatter = True; L['wash'].visible_glossy = False; L['wash'].visible_diffuse = False
    L['core'] = glow('core-light', CORE, LIGHT_VIO, 40.0, size=0.1)
    L['core-gold'] = glow('core-gold', CORE + V(0, -0.2, 0), GOLD_LIGHT, 8.0, size=0.05)
    L['eye'] = glow('eye-light', EYE + V(0, -0.35, 0), GOLD_LIGHT, 0.0, size=0.05)
    for name, loc, tgt, w, h, s, col in (('panel-l', (-6, -7, 10), (0, 0, 5), 5.0, 10.0, 1.6, (0.80, 0.70, 1.0)),
                                         ('panel-r', (7, -5, 8), (0, 0, 5), 3.0, 10.0, 1.2, (0.66, 0.42, 1.0)),
                                         ('panel-top', (0, -3, 18), (0, 0, 6), 8.0, 4.0, 0.8, (0.80, 0.70, 1.0))):
        L[name] = S.softpanel(name, loc, tgt, w, h, s, col)
    # the core and the eye are parented so they follow the body
    for k, j in (('core', 'chest'), ('core-gold', 'chest'), ('eye', 'head')):
        M = L[k].matrix_world.copy(); L[k].parent = J[j]; L[k].matrix_parent_inverse = T(*REST[j]).inverted(); L[k].matrix_basis = M
    return L

# ---------------------------------------------------------------- scene

def scene():
    s = K.fresh()
    s.cycles.volume_bounces = 0; s.cycles.transmission_bounces = 10; s.cycles.max_bounces = 12
    try: s.render.use_persistent_data = True
    except Exception: pass
    m = Mats()
    S.HAZE = ENV('R72_HAZE', 0.010)
    S.world(m)
    w = s.world.node_tree
    w.nodes['Background'].inputs['Color'].default_value = (*mul(DPUR, 0.35), 1)
    vol = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.80, 0.52, 1.0, 1); vol.inputs['Anisotropy'].default_value = 0.4
    build_joints()
    build_core(m); build_head(m); build_shell(m); build_body(m)
    for p in PARTS: PART_OF[p['ob'].name] = p
    set_iris(0.06, 0.0)
    build_ring(m); build_place(m); build_dust(m); build_desk(m)
    L = build_lights(m)
    cam = S.cam('cam', loc=(0, -14, 5), target=(0, 0, 5), lens=35)
    cam.data.clip_start = 0.005; cam.data.clip_end = 500; s.camera = cam
    return s, m, L, cam

def lock_seal(B):
    """The seal's inner rings turn until their gaps line up: locked when the shell is done."""
    k = 1 - eout(clamp((B - 2.62) / 0.5))
    for pp, Ms, deg in SEAL:
        R = Ms @ Rz(deg * k) @ Ms.inverted()
        for p in pp.obs: p['ob'].matrix_basis = R @ p['ob'].matrix_basis

# ---------------------------------------------------------------- 07 behind the eye: a stand-in of Bob's desk
DX = V(400, 0, 0)
DESK = {}
def code_mat(name):
    """A screen of code: rows of short lit marks, indented, in ivory and violet on a dark ground."""
    mt = bpy.data.materials.new(name); mt.use_nodes = True; nt = mt.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['UV'], sep.inputs[0])
    u, v = sep.outputs['X'], sep.outputs['Y']
    rows = 34
    rv = _math(nt, 'MULTIPLY', v, rows); row = _math(nt, 'FLOOR', rv); fv = _math(nt, 'FRACT', rv)
    cmb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(row, cmb.inputs[0])
    wn = nt.nodes.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; nt.links.new(cmb.outputs[0], wn.inputs['Vector'])
    cmb2 = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(row, cmb2.inputs[0]); cmb2.inputs[1].default_value = 7.0
    wn2 = nt.nodes.new('ShaderNodeTexWhiteNoise'); wn2.noise_dimensions = '3D'; nt.links.new(cmb2.outputs[0], wn2.inputs['Vector'])
    indent = _math(nt, 'MULTIPLY_ADD', _math(nt, 'FLOOR', _math(nt, 'MULTIPLY', wn2.outputs['Value'], 4)), 0.045, 0.06)
    length = _math(nt, 'MULTIPLY_ADD', wn.outputs['Value'], 0.55, 0.06)
    on = _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', u, indent), _math(nt, 'LESS_THAN', u, _math(nt, 'ADD', indent, length)))
    on = _math(nt, 'MULTIPLY', on, _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', fv, 0.32), _math(nt, 'LESS_THAN', fv, 0.68)))
    on = _math(nt, 'MULTIPLY', on, _math(nt, 'GREATER_THAN', wn.outputs['Value'], 0.12))
    gaps = _math(nt, 'GREATER_THAN', _math(nt, 'FRACT', _math(nt, 'MULTIPLY', _math(nt, 'ADD', u, _math(nt, 'MULTIPLY', row, 0.37)), 11)), 0.1)
    on = _math(nt, 'MULTIPLY', on, gaps)
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(_math(nt, 'GREATER_THAN', wn2.outputs['Value'], 0.55), _sock(mix, 'Factor_Float'))
    _sock(mix, 'A_Color').default_value = (*mul(IVORY, 0.9), 1); _sock(mix, 'B_Color').default_value = (*LIGHT_VIO, 1)
    bg = nt.nodes.new('ShaderNodeMix'); bg.data_type = 'RGBA'; nt.links.new(on, _sock(bg, 'Factor_Float'))
    _sock(bg, 'A_Color').default_value = (*mul(DPUR, 0.5), 1); nt.links.new(_sock(mix, 'Result_Color', True), _sock(bg, 'B_Color'))
    nt.links.new(_sock(bg, 'Result_Color', True), e.inputs['Color']); e.inputs['Strength'].default_value = 1.4
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return mt

def screen_mat(name):
    mt = bpy.data.materials.new(name); mt.use_nodes = True; nt = mt.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); tx = nt.nodes.new('ShaderNodeTexImage')
    tx.extension = 'EXTEND'; tx.name = 'pic'
    nt.links.new(tx.outputs['Color'], e.inputs['Color']); e.inputs['Strength'].default_value = 1.5
    e.inputs['Color'].default_value = (*mul(DPUR, 0.6), 1)
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return mt

def build_desk(m):
    X = T(*DX)
    wood = principled('desk-top', (0.018, 0.014, 0.022), 0.0, 0.42, coat=0.3)
    wall = principled('wall', mul(DPUR, 0.75), 0.0, 0.92)
    fabric = principled('mat', (0.010, 0.009, 0.013), 0.0, 1.0)
    cap = principled('keycap', (0.030, 0.026, 0.036), 0.0, 0.55)
    glassp = K.thin_glass('case-glass', (0.70, 0.62, 0.80), 0.02)
    fan = emit('fan-light', LIGHT_VIO, 5.0); led = emit('bias-light', LIGHT_VIO, 24.0); warm = emit('lamp', GOLD_LIGHT, 30.0)
    DESK['screen'] = screen_mat('screen-main'); DESK['code'] = code_mat('screen-code')
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4)
    me = bpy.data.meshes.new('desk-floor'); bm.to_mesh(me); bm.free(); me.materials.append(principled('desk-floor', (0.012, 0.010, 0.015), 0.0, 0.6))
    f = link(bpy.data.objects.new('desk-floor', me)); f.matrix_world = X
    box('back-wall', (5.0, 0.10, 3.0), wall, X @ T(0, 1.20, 1.5), bevel=0)
    box('side-wall', (0.10, 3.0, 3.0), wall, X @ T(-1.85, 0.0, 1.5), bevel=0)
    box('desk', (1.80, 0.80, 0.040), wood, X @ T(0, 0.40, 0.730), bevel=0.004)
    for x in (-0.84, 0.84):
        box(f'desk-leg{x}', (0.05, 0.70, 0.71), m.dark, X @ T(x, 0.42, 0.355), bevel=0.004)
    box('desk-mat', (1.00, 0.42, 0.004), fabric, X @ T(0.05, 0.26, 0.752), bevel=0.001)
    # keyboard
    box('kb', (0.44, 0.145, 0.022), m.dark, X @ T(-0.06, 0.22, 0.765), bevel=0.004)
    box('kb-glow', (0.43, 0.135, 0.004), emit('kb-under', LIGHT_VIO, 6.0), X @ T(-0.06, 0.22, 0.756), bevel=0)
    rs = random.Random(3)
    for r in range(5):
        for c in range(15):
            w = 0.024 if not (r == 4 and 4 <= c <= 9) else 0.0
            if r == 4 and c == 4: w = 0.024 * 6 + 0.004 * 5
            if w == 0: continue
            x = -0.06 - 0.205 + c * 0.0285 + (w - 0.024) / 2; y = 0.22 + 0.055 - r * 0.0285
            box(f'key{r}-{c}', (w, 0.024, 0.012), m.ivory if (r, c) in ((1, 1), (2, 2), (2, 3), (2, 1)) else cap, X @ T(x, y, 0.782), bevel=0.002)
    S.sphere('mouse', 1.0, m.dark, X @ T(0.40, 0.24, 0.762) @ Matrix.Diagonal((0.033, 0.058, 0.020, 1)), seg=32)
    # the coin: round with a square hole, next to the keyboard
    K.ring('coin', 0.0075, 0.021, 0.0, 0.003, m.gold, X @ T(0.23, 0.11, 0.7535), c=0.0006, seg=48)
    for k in range(4):
        box(f'coin-sq{k}', (0.016, 0.0022, 0.0035), m.gold, X @ T(0.23, 0.11, 0.7535) @ Rz(90 * k) @ T(0, 0.0075, 0.0015), bevel=0)
    # monitors
    def monitor(name, c, rz, w, h, mat, portrait=False):
        M = X @ T(*c) @ Rz(rz) @ Rx(-6)
        box(name + '-bezel', (w + 0.016, 0.022, h + 0.016), m.dark, M @ T(0, 0.011, 0), bevel=0.004)
        D.quad(name + '-pic', w, h, mat, M @ T(0, -0.0015, 0))
        box(name + '-back', (w * 0.5, 0.05, h * 0.5), m.dark, M @ T(0, 0.045, 0), bevel=0.01)
        foot = X @ T(*c) @ Rz(rz)
        cyl(name + '-neck', (foot @ V(0, 0.09, -c[2] + 0.752)), (foot @ V(0, 0.09, -0.05)), 0.018, m.dark, seg=16)
        box(name + '-foot', (0.24, 0.17, 0.010), m.dark, foot @ T(0, 0.08, -c[2] + 0.757), bevel=0.003)
    monitor('mon-main', (0.0, 0.66, 1.08), 0, 0.64, 0.36, DESK['screen'])
    monitor('mon-side', (-0.70, 0.52, 1.08), 30, 0.52, 0.30, DESK['code'])
    # the PC beside the monitors: glass side, three lit fans
    P = X @ T(0.66, 0.62, 0.752)
    box('pc', (0.22, 0.46, 0.48), m.dark, P @ T(0, 0, 0.24), bevel=0.006)
    box('pc-glass', (0.004, 0.42, 0.44), glassp, P @ T(-0.112, 0, 0.24), bevel=0)
    for k in range(3):
        M = P @ T(-0.09, 0.0, 0.10 + 0.14 * k) @ Ry(90)
        torus(f'fan{k}', 0.055, 0.005, fan, M, seg=48, rseg=6)
        K.lathe(f'fan{k}-hub', [(0, -0.006), (0.016, -0.006), (0.016, 0.006), (0, 0.006)], m.dark, M, 24, sharp=30)
        for b in range(7):
            box(f'fan{k}-blade{b}', (0.036, 0.016, 0.002), m.vmetal, M @ Rz(360 * b / 7) @ T(0.032, 0, 0) @ Rx(25), bevel=0)
    box('gpu', (0.10, 0.30, 0.05), m.vmetal, P @ T(-0.02, -0.04, 0.18), bevel=0.004)
    box('gpu-strip', (0.004, 0.26, 0.006), emit('gpu-light', GOLD_LIGHT, 6.0), P @ T(-0.072, -0.04, 0.20), bevel=0)
    # a desk lamp, warm, and headphones on a stand
    L0 = X @ T(-1.05, 0.80, 0.752)
    K.lathe('lamp-base', [(0, 0), (0.07, 0), (0.07, 0.015), (0, 0.02)], m.dark, L0, 32, sharp=30)
    cyl('lamp-arm1', L0 @ V(0, 0, 0.01), L0 @ V(0.08, -0.06, 0.34), 0.008, m.gold, seg=12)
    cyl('lamp-arm2', L0 @ V(0.08, -0.06, 0.34), L0 @ V(0.26, -0.20, 0.40), 0.008, m.gold, seg=12)
    K.lathe('lamp-head', [(0, 0.0), (0.05, -0.01), (0.06, -0.06), (0, -0.06)], m.dark, L0 @ T(0.28, -0.22, 0.40) @ Rx(-20), 32, sharp=30)
    box('lamp-bulb', (0.08, 0.08, 0.004), warm, L0 @ T(0.28, -0.22, 0.345), bevel=0)
    H0 = X @ T(1.00, 0.30, 0.752)
    cyl('hp-stand', H0 @ V(0, 0, 0), H0 @ V(0, 0, 0.30), 0.010, m.dark, seg=12)
    torus('hp-band', 0.085, 0.012, m.dark, H0 @ T(0, 0, 0.22) @ Rx(90), seg=48, rseg=8)
    for s2 in (-1, 1):
        S.sphere(f'hp-cup{s2}', 0.045, m.obs, H0 @ T(s2 * 0.085, 0, 0.21) @ Matrix.Diagonal((0.6, 1, 1, 1)), seg=24)
    box('bias', (1.30, 0.01, 0.015), led, X @ T(0, 1.14, 0.90), bevel=0)
    # lights
    ll = []
    a = K.area('desk-bias', DX + V(0, 1.05, 1.05), DX + V(0, 1.4, 1.2), 1.2, 45, LIGHT_VIO, size_y=0.3); ll.append(a)
    a = K.area('desk-top', DX + V(0.2, -0.4, 2.6), DX + V(0, 0.4, 0.75), 1.2, 60, (0.80, 0.70, 1.0), size_y=1.0); ll.append(a)
    ll.append(spot('desk-lamp', DX + V(-0.77, 0.58, 1.12), DX + V(-0.55, 0.40, 0.75), 30, GOLD_LIGHT, size=70, blend=0.8, radius=0.05, scatter=False))
    ll.append(K.area('desk-screen', DX + V(0, 0.60, 1.10), DX + V(0, -0.5, 0.9), 0.6, 18, (0.70, 0.60, 1.0), size_y=0.35))
    for o in ll: o.visible_volume_scatter = False
    DESK['lights'] = ll

def set_screen(path):
    tx = DESK['screen'].node_tree.nodes['pic']
    if os.path.exists(path):
        tx.image = bpy.data.images.load(path, check_existing=True)

def look_at(cam, pos, tgt, lens, shift=0.0, roll=0.0):
    pos, tgt = Vector(pos), Vector(tgt)
    cam.location = pos
    q = (tgt - pos).to_track_quat('-Z', 'Y')
    cam.rotation_euler = (q @ Matrix.Rotation(math.radians(roll), 4, 'Z').to_quaternion()).to_euler()
    cam.data.lens = lens; cam.data.shift_x = shift

# ---------------------------------------------------------------- the journey
def W(j, p):
    return J[j].matrix_world @ T(*REST[j]).inverted() @ Vector(p)

def state(w, B, g=0):
    apply_pose(w); assemble(B, g); lock_seal(B); ring_state(w, B, g); bpy.context.view_layer.update()

def anchors(w, B):
    state(w, B)
    a = dict(core=W('chest', CORE), eye=W('head', EYE), out=(W('head', EYE + V(0, -1, 0)) - W('head', EYE)).normalized(),
             top=W('chest', CORE + V(0, 0, 0.95)), sh=W('sh+', REST['sh+']), kn=W('kn+', REST['kn+']), wr=W('wr+', REST['wr+']),
             ring=RING['e'].matrix_world.translation.copy())
    a['art'] = {k: RING['art'][k].matrix_world.translation.copy() for k in WORKS}
    return a

LEVELS = {   # emission groups per stop
    'origin': dict(core=0.55, paths=0.0, glyph=0.8, eye=0.0, floor=0.35, motes=0.8),
    'foundation': dict(core=1.0, paths=1.0, glyph=1.0, eye=0.0, floor=0.45, motes=1.0),
    'interaction': dict(core=1.0, paths=1.0, glyph=1.0, eye=0.35, floor=0.45, motes=1.0),
    'protection': dict(core=1.0, paths=1.0, glyph=1.0, eye=0.15, floor=0.5, motes=1.0),
    'evolution': dict(core=1.0, paths=1.0, glyph=1.0, eye=0.15, floor=0.6, motes=1.0),
    'works': dict(core=1.0, paths=1.0, glyph=1.0, eye=0.15, floor=0.7, motes=1.0),
    'awakening': dict(core=1.7, paths=2.4, glyph=1.8, eye=1.5, floor=1.3, motes=1.2),
    'eye': dict(core=1.7, paths=2.0, glyph=1.8, eye=1.9, floor=1.0, motes=1.0),
    'dive': dict(core=1.0, paths=1.0, glyph=1.0, eye=2.4, floor=0.4, motes=0.5),
}
for k in WORKS: LEVELS[f'w-{k}'] = LEVELS['works']

def stops():
    k0 = anchors(0.0, 1.0); kw = anchors(0.0, 5.0); k1 = anchors(1.0, 6.0)
    c, e, P = k0['core'], k0['eye'], k0['top']
    print('ANCHORS core', tuple(round(x, 3) for x in c), 'top', tuple(round(x, 3) for x in P), 'eye', tuple(round(x, 3) for x in e), flush=True)
    st = [
        dict(name='origin', B=0.0, w=0.0, pos=P + V(*map(float, os.environ.get('R72_OPOS', '0.30,-0.34,0.16').split(','))),
             tgt=P + V(*map(float, os.environ.get('R72_OTGT', '-0.26,0.10,-0.22').split(','))), lens=ENV('R72_OLENS', 55),
             fstop=ENV('R72_OF', 4.0), focus=ENV('R72_OFOCUS', 0.47)),
        dict(name='foundation', B=0.98, w=0.0, pos=c + V(-1.4, -3.2, -0.4), tgt=c + V(-0.75, 0.0, 0.05), lens=40),
        dict(name='interaction', B=1.85, w=0.0, pos=e + V(-1.0, -2.7, -1.5), tgt=e + V(-0.55, 0.0, -0.15), lens=42),
        dict(name='protection', B=3.0, w=0.0, pos=c + V(-4.3, -3.2, 0.5), tgt=c + V(-0.9, 0.0, -0.15), lens=40),
        dict(name='evolution', B=4.0, w=0.0, pos=V(6.4, -6.0, 1.3), tgt=V(1.0, -0.3, 3.1), lens=30, shift=-0.16),
        dict(name='works', B=5.0, w=0.0, pos=V(3.8, -9.0, 2.2), tgt=V(-0.6, 0.2, 2.6), lens=30, shift=-0.10),
    ]
    rc = kw['ring']
    for key in WORKS:
        A = kw['art'][key]; d = V(A.x - rc.x, A.y - rc.y, 0).normalized(); side = V(0, 0, 1).cross(d)
        st.append(dict(name=f'w-{key}', B=5.0, w=0.0, pos=A + d * 3.6 + side * 0.3 + V(0, 0, 1.45), tgt=A + V(0, 0, 0.60) - side * 0.80, lens=42, shift=0.0))
    E, o = k1['eye'], k1['out']
    st += [
        dict(name='awakening', B=6.0, w=1.0, pos=V(2.2, -17.0, 1.0), tgt=V(0, 0, 6.9), lens=36),
        dict(name='eye', B=6.0, w=1.0, pos=E + o * 1.55 + V(0.03, 0, 0.02), tgt=E, lens=50),
    ]
    return st, k0, k1

def vias(k0, k1):
    E, o = k1['eye'], k1['out']
    return {
        'origin': [(k0['top'] + V(0.5, -1.4, 0.3), k0['core'] + V(0.1, 0, 0.2))],
        'foundation': [],
        'interaction': [(k0['core'] + V(-2.6, -3.4, 0.2), k0['core'] + V(0.3, 0, 0.2))],
        'protection': [(V(0.5, -7.0, 2.6), V(0.6, 0, 3.6))],
        'evolution': [],
        'works': [],
        'w-jontai': [(V(5.2, -4.6, 2.8), V(1.2, 0.0, 2.6))],
        'w-lumo': [(V(5.0, 6.0, 2.9), V(0.6, 0.6, 2.6))],
        'w-locked': [(V(-5.0, 6.0, 2.9), V(-0.6, 0.6, 2.6))],
        'w-cookies': [(V(-6.8, -6.5, 2.2), V(-0.4, 0, 3.4)), (V(-2.2, -14.5, 1.5), V(0, 0, 5.6))],
        'awakening': [(V(1.6, -9.5, 6.2), E + V(0, 0, -0.6))],
    }

MOVES = {'origin': 24, 'foundation': 18, 'interaction': 18, 'protection': 20, 'evolution': 16, 'works': 12,
         'w-jontai': 14, 'w-lumo': 14, 'w-locked': 14, 'w-cookies': 34, 'awakening': 22}
DIVE, DESK_N = 12, 10

def lerp_levels(a, b, t):
    return {k: lerp(a.get(k, 1.0), b.get(k, 1.0), t) for k in set(a) | set(b)}

def main():
    os.makedirs(OUT, exist_ok=True)
    s, m, L, cam = scene()
    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)
    W0 = {k: (ob.data.energy if getattr(ob, 'type', '') == 'LIGHT' else None) for k, ob in L.items()}
    HALL = ['key', 'fill', 'rim-r', 'rim-l', 'top', 'beam', 'wash']
    artlamp = spot('art-lamp', (0, 0, 10), (0, 0, 0), 0, (0.92, 0.86, 1.0), size=34, blend=0.7, radius=0.1, scatter=False)
    def lights(stop, quiet=0.0, eye=0.0, cam_loc=None, desk=False):
        for k in HALL: L[k].data.energy = W0[k] * (1 - quiet) * (0.0 if desk else 1.0)
        L['eye'].data.energy = 22.0 * eye
        for o in DESK['lights']: o.hide_render = not desk
        artlamp.data.energy = 0.0
        if cam_loc is not None and not desk:
            best = min(WORKS, key=lambda k: (RING['art'][k].matrix_world.translation - cam_loc).length)
            A = RING['art'][best].matrix_world.translation; d = (A - cam_loc).length
            artlamp.location = A + V(0, 0, 2.6) + (cam_loc - A).normalized() * 0.6
            artlamp.rotation_euler = ((A + V(0, 0, 0.4)) - artlamp.location).to_track_quat('-Z', 'Y').to_euler()
            artlamp.data.energy = 260 * clamp(1 - (d - 2.8) / 2.5) if RING['art'][best].children[0].hide_render is False else 0.0
    def frame(a, b, t, via, g):
        e = ease(t)
        B = lerp(a['B'], b['B'], e); w = 0.0
        if b['name'] == 'awakening' and a['name'] != 'awakening': w = ease(clamp((t - 0.22) / 0.62)); B = lerp(5.0, 6.0, clamp(t / 0.5))
        if a['name'] in ('awakening', 'eye'): w = 1.0
        state(w, B, g)
        lv = lerp_levels(LEVELS[a['name']], LEVELS[b['name']], e)
        if b['name'] == 'awakening' and a['name'] != 'awakening':
            lv = lerp_levels(LEVELS['works'], LEVELS['awakening'], ease(clamp((t - 0.5) / 0.5)))
        energy(lv)
        rp = 0.06
        if a['name'] == 'awakening': rp = lerp(0.06, 0.075, e)
        if a['name'] == 'eye': rp = 0.075
        set_iris(rp, 2.0 * g); assemble_iris()
        loc = D.pose(cam, a, b, t, via)
        dof(a, b, e, loc)
        lights(a['name'], quiet=0.0, eye=lv.get('eye', 0) / 1.9, cam_loc=loc)
        return loc
    def dof(a, b, e, loc):
        fa, fb = a.get('fstop'), b.get('fstop')
        if fa or fb:
            cam.data.dof.use_dof = True
            cam.data.dof.aperture_fstop = lerp(fa or 22.0, fb or 22.0, e) if e < 0.999 else (fb or 22.0)
            cam.data.dof.focus_distance = lerp(a.get('focus', 3.0), b.get('focus', (b['tgt'] - b['pos']).length), e)
            if not fb and e > 0.6: cam.data.dof.use_dof = False
        else:
            cam.data.dof.use_dof = False
    def assemble_iris():
        for name in [o.name for o in EYE_PARTS['blades']] + [EYE_PARTS['rim'].name]:
            p = PART_OF[name]
            if not p['ob'].hide_render: p['ob'].matrix_basis = p['M']

    st, k0, k1 = stops(); VI = vias(k0, k1); byname = {x['name']: x for x in st}
    E, o = k1['eye'], k1['out']
    desk0 = dict(name='desk0', pos=DX + V(0.0, -0.46, 1.14), tgt=DX + V(0.05, 0.30, 0.78), lens=26)
    desk1 = dict(name='desk', pos=DX + V(0.03, -0.60, 1.22), tgt=DX + V(-0.04, 0.62, 1.04), lens=26)

    def build_frames():
        fr = [('stop', st[0], st[0], 0.0, [])]; at = [0]
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            for j in range(1, MOVES[a['name']] + 1): fr.append(('stop', a, b, j / MOVES[a['name']], VI.get(a['name'], [])))
            at.append(len(fr) - 1)
        for j in range(1, DIVE + 1): fr.append(('dive', None, None, j / DIVE, None))
        black = len(fr) - 1
        for j in range(DESK_N): fr.append(('desk', None, None, j / (DESK_N - 1), None))
        at.append(len(fr) - 1)
        return fr, at, black

    def render_frame(kind, a, b, t, via, g, path):
        if kind == 'stop':
            frame(a, b, t, via, g)
        elif kind == 'dive':
            state(1.0, 6.0, g); e = ease(t)
            energy(lerp_levels(LEVELS['eye'], LEVELS['dive'], e))
            set_iris(lerp(0.075, 0.168, ease(clamp(t / 0.6))), 2.0 * g); assemble_iris()
            p0 = byname['eye']['pos']; p1 = E - o * 0.42
            loc = p0.lerp(p1, e ** 1.6)
            cam.location = loc; cam.rotation_euler = (E - o * 2.0 - loc).to_track_quat('-Z', 'Y').to_euler()
            cam.data.lens = lerp(50, 34, e); cam.data.shift_x = 0; cam.data.dof.use_dof = False
            lights('eye', quiet=0.75 * e, eye=1.2)
        else:
            e = ease(t); state(1.0, 6.0, g)
            set_screen(os.path.join(OUT, 'seq', SCREEN_FRAME[0]) if kind != 'desk-key' else os.path.join(OUT, 'k10-awakening.jpg'))
            D.pose(cam, desk0, desk1, t, []); cam.data.dof.use_dof = False
            lights('desk', desk=True)
        shoot(path)

    job, _, arg = JOB.partition(':')
    fr, at, black = build_frames()
    names = [x['name'] for x in st] + ['desk']
    SCREEN_FRAME = [f"f{at[names.index('awakening')]:03d}.jpg"]
    if job == 'look':
        views = {
            'stand-front': (1.0, 99, (2.5, -17.5, 3.2), (0, 0, 5.4), 30),
            'kneel-front': (0.0, 99, (2.5, -15.0, 2.6), (0, 0, 3.4), 30),
            'head': (1.0, 99, (0.9, -3.6, 9.2), (0, -0.3, 8.95), 50),
            'hero': (1.0, 99, (3.0, -16.0, 1.2), (0, 0, 6.2), 30),
        }
        only = arg.split(',') if arg else None
        for name, (w, B, pos, tgt, lens) in views.items():
            if only and name not in only: continue
            state(w, B); energy({'eye': w, 'paths': 0.6 + 0.6 * w}); set_iris(0.07, 0); assemble_iris()
            look_at(cam, pos, tgt, lens); lights('', eye=w); shoot(os.path.join(OUT, f'look-{name}.jpg'))
        return
    if job == 'keys':
        only = arg.split(',') if arg else None
        for i, k in enumerate(st):
            if only and k['name'] not in only: continue
            g = at[i]; render_frame('stop', k, k, 0.0, [], g, os.path.join(OUT, f'k{i:02d}-{k["name"]}.jpg'))
        if not only or 'desk' in only:
            render_frame('desk-key', None, None, 1.0, None, at[-1], os.path.join(OUT, 'k99-desk.jpg'))
        return
    if job == 'mids':
        only = arg.split(',') if arg else None
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            if only and a['name'] not in only: continue
            for t in (0.33, 0.66):
                render_frame('stop', a, b, t, VI.get(a['name'], []), at[i] + int(t * MOVES[a['name']]), os.path.join(OUT, f'mid{i:02d}-{a["name"]}-{int(t * 100)}.jpg'))
        if not only or 'dive' in only:
            for t in (0.3, 0.6, 0.9):
                render_frame('dive', None, None, t, None, at[-2] + int(t * DIVE), os.path.join(OUT, f'dive-{int(t * 100)}.jpg'))
        return
    if job == 'drift':                        # the first view, turning a little round the ring under the pointer
        N, RANGE = 21, 5.0
        os.makedirs(os.path.join(OUT, 'drift'), exist_ok=True)
        k = st[0]; P = k0['top']
        for i in range(N):
            a = 2 * i / (N - 1) - 1
            R = T(*P) @ Rz(RANGE * a) @ T(*(-P))
            kk = dict(k, pos=R @ k['pos'], tgt=R @ k['tgt'])
            render_frame('stop', kk, kk, 0.0, [], 12 * a, os.path.join(OUT, 'drift', f'd{i:02d}.jpg'))
        with open(os.path.join(OUT, 'drift', 'drift.json'), 'w') as fh: json.dump({'count': N, 'range': RANGE}, fh)
        return
    if job == 'layout':
        out = {}
        def sxy(p):
            bpy.context.view_layer.update(); v = world_to_camera_view(s, cam, Vector(p)); return [round(v.x, 4), round(1 - v.y, 4)]
        k = byname['works']; frame(k, k, 0.0, [], at[names.index('works')])
        out['works'] = {key: dict(c=sxy(RING['art'][key].matrix_world.translation + V(0, 0, 0.6)),
                                  top=sxy(RING['art'][key].matrix_world.translation + V(0, 0, 1.25))) for key in WORKS}
        for key in WORKS:
            k = byname[f'w-{key}']; frame(k, k, 0.0, [], at[names.index(f'w-{key}')])
            out[f'w-{key}'] = dict(c=sxy(RING['art'][key].matrix_world.translation + V(0, 0, 0.6)))
        k = byname['awakening']; frame(k, k, 0.0, [], at[names.index('awakening')])
        out['awakening'] = dict(eye=sxy(k1['eye']), art={key: sxy(RING['art'][key].matrix_world.translation + V(0, 0, 0.5)) for key in WORKS})
        k = byname['eye']; frame(k, k, 0.0, [], at[names.index('eye')])
        out['eye'] = dict(c=sxy(k1['eye']))
        with open(os.path.join(OUT, 'layout.json'), 'w') as fh: json.dump(out, fh, indent=1)
        print('layout', json.dumps(out), flush=True)
        return
    if job == 'seq':
        os.makedirs(os.path.join(OUT, 'seq'), exist_ok=True)
        lo, _, hi = arg.partition('-'); lo = int(lo) if lo else 0; hi = int(hi) if hi else 10 ** 6
        with open(os.path.join(OUT, 'seq', 'frames.json'), 'w') as fh:
            json.dump({'count': len(fr), 'stops': {n: a for n, a in zip(names, at)}, 'black': black, 'desk0': black + 1}, fh)
        for f, (kind, a, b, t, via) in enumerate(fr):
            if not (lo <= f <= hi): continue
            path = os.path.join(OUT, 'seq', f'f{f:03d}.jpg')
            if os.path.exists(path) and os.environ.get('R72_SKIP', '1') == '1': continue
            render_frame(kind, a, b, t, via, f, path)
        print('frames', len(fr), at, flush=True)

if __name__ == '__main__':
    main()
