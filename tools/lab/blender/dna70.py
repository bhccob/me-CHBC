# LAB ONLY (throwaway). Round 70: Bob's "Digital DNA" brief (2026-11-13). One tall structure, one camera.
# The helix is made, not grown: every rung joins two different materials, so "built through connections" is literal.
#   strand A  smoked-violet glass, a bead at every rung, a violet filament inside   (software: logic, architecture)
#   strand B  machined sleeves on a titanium rail, a ball joint at every rung        (mechatronics: the physical side)
#   rungs     a glass half meets a titanium pin in a coupling; a few couplings are lit amber (the active sequences)
# Time runs up the structure, so moving the camera along it is the story:
#   below 0   it has not assembled yet: loose rungs, beads, sleeves, drops, a few cells      (01 Origin)
#   0..22     the clean double helix; fine traces hop between its couplings                   (first view, 02 Foundation)
#   24..37    six arms leave the helix, each ending in a glass node with a small emblem       (03 Development)
#   38..50    arms that have let go: four glass slides, each a project                        (04 Experiments)
#   whole     seen from far away                                                              (05 Identity)
#   above 50  the strands thin out into a small network of nodes                              (06 Connection)
#   blender -b --factory-startup --python tools/lab/blender/dna70.py -- <out-dir> <job> [samples] [res%]
# job: keys[:a,b] stills per stop · spin the first view turning ±16° · seq the whole move + frames.json ·
#      hover the six arms lit one at a time · close one still per project · layout only writes layout.json ·
#      mids a check: the middle of every move and the two ends of the turn · phone a tall plate of the first view
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sculpture67 as S
import firstview68 as F
K = S.K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'keys'
REPO = F.REPO
I4 = Matrix.Identity(4)

def srgb(h): return S.srgb(h)
YEL, PALE, LAV = srgb('#F5D547'), srgb('#FFE98A'), srgb('#BBA0FF')
LIGHT_VIO = S.LIGHT_VIO

M0 = Ry(22) @ Rx(-10)                 # the helix's own frame: its axis is local Z, leaning right and away
R, PITCH, NPT = 0.62, 2.2, 10         # radius, rise per turn, rungs per turn
DPH = math.radians(144)               # strand B sits 144 degrees round from A: a wide and a narrow groove, like DNA
DZ = PITCH / NPT
I_SEG_END, I_TOP = 56, 64             # the sleeves stop at 56; both strands end at 64
I_THIN = I_TOP - 12                   # where the glass strand starts to thin
ACTIVE = {5, 12, 13, 19, 29, 41, 48}      # rungs whose coupling is lit amber
DIM = {2, 8, 16, 22, 27, 34, 45, 52}      # rungs whose coupling has a faint violet line

def A(i): a = TAU * i / NPT; return Vector((R * math.cos(a), R * math.sin(a), DZ * i))
def B(i): a = TAU * i / NPT + DPH; return Vector((R * math.cos(a), R * math.sin(a), DZ * i))
def tangent(f, i, e=0.01): return (f(i + e) - f(i - e)).normalized()
def Lp(x, y, z): return M0 @ Vector((x, y, z))
def lerp(a, b, t): return a + (b - a) * t
def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))

# ---------------------------------------------------------------- materials

def pane_glass(name):
    """A slide's cover glass: see-through, with only a weak reflection so a softbox never whites the picture out."""
    mt = K.thin_glass(name, (0.93, 0.91, 1.0), 0.03)
    setin(mt.node_tree.nodes['Principled BSDF'], 'Specular IOR Level', 0.16)
    return mt

class Mats(S.Mats):
    def __init__(self):
        super().__init__()
        self.strand = S.smoked_glass('strand-glass', density=5.0, absorb=(0.76, 0.20, 0.88))
        self.rung = S.smoked_glass('rung-glass', density=2.4, absorb=(0.72, 0.40, 0.92))
        self.bubble = S.smoked_glass('cell-glass', density=1.2, absorb=(0.60, 0.48, 0.92))
        self.pane = pane_glass('slide-glass')
        self.amber = emit('amber', YEL, 18.0)
        self.amber_soft = emit('amber-soft', YEL, 7.0)
        self.vio_dim = emit('violet-dim', S.VIOLET, 3.0)
        self.core = emit('strand-filament', S.VIOLET, 2.4)
        self.trace = principled('trace', (0.70, 0.66, 0.78), 1.0, 0.22)
        self.ink = principled('letter-ink', (0.105, 0.075, 0.175), 0.0, 0.55)
        self.sleeve = [self.anod, self.graphite]
        self.fil = []                                    # one filament material per arm, so each can be lit alone
        for k in range(6):
            self.fil.append(emit(f'arm-filament-{k}', S.VIOLET, 5.0))

# ---------------------------------------------------------------- small builders (all take a local matrix X first)

def cyl(name, p0, p1, r, mat, X=I4, seg=24, round_=0.0):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if round_:
        c = min(round_, L / 2 - 1e-4)
        prof = [(0, -L / 2), (r * 0.55, -L / 2), (r, -L / 2 + c), (r, L / 2 - c), (r * 0.55, L / 2), (0, L / 2)]
    else:
        prof = [(0, -L / 2), (r, -L / 2), (r, L / 2), (0, L / 2)]
    return K.lathe(name, prof, mat, M0 @ X @ S.along((p0 + p1) / 2, d), seg, sharp=50)

def ball(name, p, r, mat, X=I4, seg=32):
    return S.sphere(name, r, mat, M0 @ X @ T(*p), seg=seg)

def tube(name, pts, radii, mat, X=I4, res=6):
    """A round tube through pts with its own radius at every point (one mesh, so glass refracts as one piece)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, P, r in zip(sp.points, pts, radii):
        p.co = (P.x, P.y, P.z, 1.0); p.radius = r
    cu.materials.append(mat)
    ob = link(bpy.data.objects.new(name, cu)); ob.matrix_world = M0 @ X
    return ob

def torus(name, Rr, r, mat, M, seg=40, rseg=10):
    return S.torus(name, Rr, r, mat, M, seg=seg, rseg=rseg)

def glow(name, p, color, watts, X=I4, size=0.02):
    d = bpy.data.lights.new(name, 'POINT'); d.energy = watts; d.color = color; d.shadow_soft_size = size
    ob = link(bpy.data.objects.new(name, d)); ob.matrix_world = M0 @ X @ T(*p)
    ob.visible_volume_scatter = False
    return ob

# ---------------------------------------------------------------- the helix

BEAD = 0.156
def bead_r(i):
    return BEAD * (1.0 if i < I_THIN else lerp(1.0, 0.34, clamp((i - I_THIN) / 12)))

def build_strand_a(m):
    pts, rad = [], []
    n = 14
    for k in range(I_TOP * n + 1):
        i = k / n
        taper = 1.0 if i < I_THIN else lerp(1.0, 0.28, clamp((i - I_THIN) / 12))
        f = i - round(i)
        swell = 0.078 * math.exp(-(f / 0.17) ** 2)
        pts.append(A(i)); rad.append((0.078 + swell) * taper)
    tube('strand-a', pts, rad, m.strand)
    S.filament('strand-a-filament', [A(k / 6) for k in range(2, I_TOP * 6 - 1)], 0.0065, m.core, M0)

def sleeve(i, m, X=I4):
    p, t = B(i), tangent(B, i)
    M = M0 @ X @ S.along(p, t)
    prof = [(0.024, -0.15), (0.060, -0.15), (0.070, -0.136), (0.070, -0.062), (0.056, -0.050), (0.056, 0.050),
            (0.070, 0.062), (0.070, 0.136), (0.060, 0.15), (0.024, 0.15)]
    K.lathe(f'sleeve{i}', prof, m.sleeve[i % 2], M, 40, sharp=25)
    K.ring(f'waist{i}', 0.0555, 0.0605, -0.014, 0.014, m.chrome, M, c=0.002, seg=40)
    K.ring(f'band{i}a', 0.0695, 0.0725, -0.118, -0.106, m.ti, M, c=0.001, seg=40)
    K.ring(f'band{i}b', 0.0695, 0.0725, 0.106, 0.118, m.ti, M, c=0.001, seg=40)

def build_strand_b(m):
    pts, rad = [], []
    for i in range(0, I_TOP + 1):
        p, t = B(i), tangent(B, i)
        taper = 1.0 if i < I_SEG_END else lerp(1.0, 0.4, clamp((i - I_SEG_END) / 8))
        for s in (-0.15, 0.15):
            pts.append(p + t * s); rad.append(0.020 * taper)     # straight through each sleeve, like a chain of links
    tube('strand-b-rail', pts, rad, m.rail, res=4)
    for i in range(0, I_SEG_END + 1):
        sleeve(i, m)
    for i in range(I_SEG_END + 1, I_TOP + 1):                  # past the last sleeve only small joints stay on the rail
        ball(f'joint-top{i}', B(i), 0.03 * lerp(1.0, 0.6, (i - I_SEG_END) / 8), m.chrome)

def rung(i, m, Xg=I4, Xc=I4, Xp=I4, parts='gcp'):
    """Rung i in three parts (glass half, coupling, pin), each with its own transform so loose ones can drift apart."""
    a, b = A(i), B(i); d = b - a; L = d.length; u = d / L
    rs = random.Random(1000 + i)
    f = rs.choice((0.42, 0.58)); J = a + u * (L * f); rb = bead_r(i)
    if 'g' in parts:
        Mf = M0 @ Xg @ S.along(a + u * (rb + 0.014), u)
        K.ring(f'ferrule{i}', 0.034, 0.060, -0.016, 0.016, m.ti, Mf, c=0.003, seg=32)
        cyl(f'rung-glass{i}', a + u * (rb + 0.034), J - u * 0.052, 0.044, m.rung, Xg, seg=32, round_=0.014)
    if 'c' in parts:
        Mc = M0 @ Xc @ S.along(J, u)
        prof = [(0.020, -0.056), (0.058, -0.056), (0.066, -0.047), (0.066, -0.014), (0.054, -0.010), (0.054, 0.010),
                (0.066, 0.014), (0.066, 0.047), (0.058, 0.056), (0.020, 0.056)]
        K.lathe(f'coupling{i}', prof, m.sleeve[rs.randrange(2)], Mc, 40, sharp=25)
        if i in ACTIVE:
            torus(f'led{i}', 0.0555, 0.0072, m.amber, Mc)
            glow(f'led-glow{i}', J + Vector((0, 0, 0.09)), YEL, 1.6, Xc)
        elif i in DIM:
            torus(f'led{i}', 0.0555, 0.0050, m.vio_dim, Mc)
        else:
            torus(f'led{i}', 0.0555, 0.0050, m.chrome, Mc)
    if 'p' in parts:
        cyl(f'pin{i}', J + u * 0.056, b - u * 0.062, 0.018, m.ti, Xp, seg=20)
        ball(f'joint{i}', b - u * 0.058, 0.034, m.chrome, Xp, seg=24)

def thin_rung(i, m):
    a, b = A(i), B(i); u = (b - a).normalized(); rb = bead_r(i)
    cyl(f'thin-rung{i}', a + u * rb, b - u * 0.02, 0.0075, m.ti, seg=12)

def build_helix(m):
    build_strand_a(m); build_strand_b(m)
    for i in range(0, I_SEG_END + 1):
        rung(i, m)
    for i in range(I_SEG_END + 1, I_TOP):
        if i < I_SEG_END + 4 or i % 2 == 0:
            thin_rung(i, m)

def build_traces(m):
    """Fine right-angled traces hop from one coupling to the next along the upper clean helix: the helix read as a
    circuit when you come close (02 Foundation)."""
    rs = random.Random(42)
    for i in range(9, 23):
        a0, b0 = A(i), B(i); a1, b1 = A(i + 1), B(i + 1)
        for k, s in enumerate((0.30, 0.70)):
            if rs.random() < 0.25: continue
            p0 = a0.lerp(b0, s); p3 = a1.lerp(b1, s)
            out = Vector((p0.x, p0.y, 0)); out = out.normalized() * 0.075 if out.length > 0.05 else Vector((0.075, 0, 0))
            q0 = p0 + out; q1 = Vector((q0.x, q0.y, p3.z)); q2 = p3 + out
            pts = [p0, q0, q1, q2, p3]
            S.filament(f'trace{i}-{k}', pts, 0.0042, m.trace, M0)
            for j, q in enumerate((q0, q1, q2)):
                ball(f'via{i}-{k}-{j}', q, 0.0085, m.chrome, seg=12)
            if (i, k) in ((12, 0), (18, 1)):
                ball(f'trace-led{i}', q1, 0.012, m.amber, seg=12)

# ---------------------------------------------------------------- 01 Origin: what has not assembled yet

def drift(i, c, salt, spread=1.0):
    """A loose part's transform: further below the helix, further from its place and more turned."""
    s = -i; rs = random.Random(7000 + i * 13 + salt)
    amp = 0.030 * s ** 1.55 * spread
    off = Vector((rs.uniform(-1, 1), rs.uniform(-1, 1), rs.uniform(-0.7, 0.5))) * amp
    rad = Vector((c.x, c.y, 0))
    if rad.length > 1e-4: off += rad.normalized() * 0.016 * s ** 1.5
    ang = min(175, 5.0 * s ** 1.4)
    Rr = Rz(rs.uniform(-ang, ang)) @ Rx(rs.uniform(-ang, ang)) @ Ry(rs.uniform(-ang, ang))
    return T(*(c + off)) @ Rr @ T(*(-c))

def build_origin(m):
    rs = random.Random(70)
    for i in range(-1, -27, -1):
        s = -i; keep = clamp(1.08 - s / 24, 0.22, 1.0)
        a, b = A(i), B(i); mid = (a + b) / 2
        if rs.random() < keep:
            if s <= 7:
                X = drift(i, mid, 1); rung(i, m, X, X, X)
            else:
                rung(i, m, drift(i, a.lerp(b, 0.3), 2), I4, I4, 'g') if rs.random() < 0.7 else None
                rung(i, m, I4, drift(i, mid, 3), I4, 'c') if rs.random() < 0.7 else None
                rung(i, m, I4, I4, drift(i, a.lerp(b, 0.8), 4), 'p') if rs.random() < 0.6 else None
        if rs.random() < keep:
            ball(f'loose-bead{i}', a, BEAD * lerp(1.0, 0.5, s / 26), m.strand, drift(i, a, 5), seg=48)
        if rs.random() < keep:
            X = drift(i, b, 6); sleeve(i, m, X)
            t = tangent(B, i); cyl(f'loose-rail{i}', b - t * 0.21, b + t * 0.21, 0.020, m.rail, X, seg=16)
    # cells: thin glass bubbles with something small inside
    for k, (p, r) in enumerate((((1.55, -0.9, -2.3), 0.46), ((-1.5, -0.4, -3.6), 0.62), ((0.5, 1.5, -4.6), 0.38),
                                ((-0.7, -1.7, -1.5), 0.27), ((1.9, 0.9, -5.4), 0.52), ((-2.3, 1.0, -2.2), 0.33))):
        ob = S.sphere(f'cell{k}', r, m.bubble, M0 @ T(*p), seg=96)
        sm = ob.modifiers.new('solid', 'SOLIDIFY'); sm.thickness = r * 0.05; sm.offset = -1.0
        q = Vector(p) + Vector((r * 0.22, -r * 0.1, r * 0.12))
        ball(f'nucleus{k}', q, r * 0.26, m.chrome if k % 2 else m.strand, seg=40)
        ball(f'nucleus{k}b', Vector(p) - Vector((r * 0.3, r * 0.1, r * 0.25)), r * 0.09, m.chrome, seg=24)
        if k in (0, 4):
            ball(f'nucleus{k}c', Vector(p) + Vector((-r * 0.1, r * 0.2, -r * 0.35)), r * 0.05, m.amber_soft, seg=16)

def loose_part(k, c, m, seed):
    """A stray piece of the helix, far from it: a rung, half a rung, a sleeve or a coupling."""
    rs = random.Random(seed); i = -40 - k                    # rung numbers no real rung uses, so names never clash
    ctr = (A(i) + B(i)) / 2
    X = T(*c) @ Rz(rs.uniform(0, 360)) @ Rx(rs.uniform(0, 360)) @ Ry(rs.uniform(0, 360)) @ Matrix.Scale(rs.uniform(0.75, 1.0), 4) @ T(*(-ctr))
    kind = rs.choice(('gcp', 'gcp', 'gc', 'cp', 'c', 'sleeve'))
    if kind == 'sleeve':
        Xs = X @ T(*(ctr - B(i))); sleeve(i, m, Xs)
    else:
        rung(i, m, X, X, X, kind)

def build_dust(m):
    """Small beads and molecules floating round the whole structure, more of them near the origin."""
    rs = random.Random(11)
    base = {}
    for key, mat in (('glass', m.rung), ('chrome', m.chrome), ('amber', m.amber_soft), ('dark', m.graphite)):
        ob = S.sphere(f'dust-{key}', 1.0, mat, T(0, 0, -200), seg=16); ob.hide_render = True; base[key] = ob.data
    n = 0
    def put(key, p, r):
        nonlocal n
        ob = link(bpy.data.objects.new(f'dust{n}', base[key])); n += 1
        ob.matrix_world = M0 @ T(*p) @ Matrix.Scale(r, 4)
    for _ in range(230):
        z = rs.uniform(-8.5, 18.5)
        if z > 0 and rs.random() < 0.45: z = rs.uniform(-8.0, 0.5)       # denser where it starts
        rad = rs.uniform(1.05, 4.8); a = rs.uniform(0, TAU)
        r = rs.choice((0.008, 0.010, 0.013, 0.017, 0.022, 0.034))
        put(rs.choice(('glass', 'glass', 'chrome', 'chrome', 'dark')), (rad * math.cos(a), rad * math.sin(a), z), r)
    for _ in range(12):
        z = rs.uniform(-7.0, 16.0); rad = rs.uniform(1.0, 3.6); a = rs.uniform(0, TAU)
        put('amber', (rad * math.cos(a), rad * math.sin(a), z), rs.choice((0.007, 0.009, 0.012)))
    for k in range(20):
        z = rs.uniform(-7.5, 2.5) if k < 14 else rs.uniform(2.5, 15.0)
        rad = rs.uniform(1.5, 3.6); a = rs.uniform(0, TAU)
        loose_part(k, Vector((rad * math.cos(a), rad * math.sin(a), z)), m, 300 + k)

# ---------------------------------------------------------------- 03 Development: six arms

ARMS = [  # name, strand, rung, length, lift (degrees), curl
    ('logic', 'A', 25, 1.30, -12, 0.14),
    ('architecture', 'B', 26, 1.45, 30, -0.10),
    ('circuits', 'B', 30, 1.50, -8, 0.12),
    ('mechanics', 'A', 31, 1.20, 34, -0.14),
    ('intelligence', 'A', 34, 1.40, -14, 0.10),
    ('creativity', 'B', 35, 1.15, 28, -0.12),
]
ARM_TIP = {}

def emblem(k, c, r, m):
    """A small thing inside each arm's glass node. c: the node's centre (local), r: the node's radius."""
    X = T(*c)
    if k == 0:      # logic: eight small cubes, one of them lit
        for j in range(8):
            o = Vector(((j & 1) - 0.5, ((j >> 1) & 1) - 0.5, ((j >> 2) & 1) - 0.5)) * r * 0.52
            K.box(f'logic-cube{j}', (r * 0.36,) * 3, m.amber_soft if j == 5 else m.chrome, M0 @ X @ Rz(25) @ Rx(20) @ T(*o), bevel=r * 0.03)
    elif k == 1:    # architecture: stacked plates on four posts
        Xr = X @ Rz(35) @ Rx(-12)
        for j, zz in enumerate((-0.38, -0.12, 0.14, 0.40)):
            K.box(f'arch-plate{j}', (r * (0.95 - 0.14 * j), r * (0.95 - 0.14 * j), r * 0.07), m.ti, M0 @ Xr @ T(0, 0, zz * r), bevel=r * 0.012)
        for j in range(4):
            px = r * 0.24 * (1 if j & 1 else -1); py = r * 0.24 * (1 if j & 2 else -1)
            cyl(f'arch-post{j}', (px, py, -0.38 * r), (px, py, 0.40 * r), r * 0.03, m.graphite, Xr, seg=10)
    elif k == 2:    # circuits: a chip on its pins
        Xr = X @ Rz(-20) @ Rx(55)
        K.box('chip', (r * 0.80, r * 0.80, r * 0.20), m.graphite, M0 @ Xr, bevel=r * 0.02)
        for j in range(5):
            o = (j - 2) * r * 0.16
            for sx in (-1, 1):
                K.box(f'chip-pin{j}{sx}', (r * 0.16, r * 0.05, r * 0.04), m.trace, M0 @ Xr @ T(sx * r * 0.47, o, -r * 0.06), bevel=0)
                K.box(f'chip-pin{j}{sx}y', (r * 0.05, r * 0.16, r * 0.04), m.trace, M0 @ Xr @ T(o, sx * r * 0.47, -r * 0.06), bevel=0)
        ball('chip-led', (0, 0, 0), r * 0.07, m.amber, Xr @ T(r * 0.24, r * 0.24, r * 0.11), seg=12)
    elif k == 3:    # mechanics: two meshed gears on an axle
        Xr = X @ Rz(15) @ Rx(70)
        K.gear('mech-gear-a', r * 0.50, 14, r * 0.14, r * 0.09, m.gear, M0 @ Xr @ T(-r * 0.16, 0, 0))
        K.gear('mech-gear-b', r * 0.30, 9, r * 0.14, r * 0.08, m.ti, M0 @ Xr @ T(r * 0.56, 0.04 * r, 0) @ Rz(18))
        cyl('mech-axle', (-r * 0.16, 0, -r * 0.5), (-r * 0.16, 0, r * 0.5), r * 0.06, m.chrome, Xr, seg=16)
    elif k == 4:    # intelligence: a faceted solid inside a ring
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 0.42)
        me = bpy.data.meshes.new('mind'); bm.to_mesh(me); bm.free(); me.materials.append(m.chrome)
        link(bpy.data.objects.new('mind', me)).matrix_world = M0 @ X @ Rz(20) @ Rx(15)
        torus('mind-ring', r * 0.66, r * 0.022, m.ti, M0 @ X @ Rx(68) @ Ry(20), seg=64, rseg=8)
    else:           # creativity: a drop of liquid chrome that has not picked a shape
        mb = bpy.data.metaballs.new('idea'); mb.resolution = 0.012; mb.render_resolution = 0.006; mb.threshold = 0.6
        mb.materials.append(m.chrome)
        ob = link(bpy.data.objects.new('idea', mb)); ob.matrix_world = M0 @ X
        for co, vis in (((0, 0, 0), 0.40), ((0.30, 0.12, 0.22), 0.26), ((-0.26, -0.10, 0.30), 0.20), ((0.05, 0.30, -0.30), 0.22), ((-0.2, 0.2, -0.05), 0.15)):
            e = mb.elements.new(type='BALL'); e.co = Vector(co) * r; e.radius = vis * r / 0.575; e.stiffness = 2.0

def build_arms(m):
    for k, (name, strand, i, L, lift, curl) in enumerate(ARMS):
        f = A if strand == 'A' else B
        p0 = f(i); out = Vector((p0.x, p0.y, 0)).normalized()
        u = (out * math.cos(math.radians(lift)) + Vector((0, 0, 1)) * math.sin(math.radians(lift))).normalized()
        w = Vector((0, 0, 1)).cross(u).normalized()
        start = p0 + out * (BEAD + 0.02 if strand == 'A' else 0.085)
        def at(t): return start + u * (L * t) + w * (curl * L * math.sin(math.pi * t)) + Vector((0, 0, 1)) * (0.10 * L * t * t)
        rN = 0.30
        n = 72; pts = [at(t / n) for t in range(n + 1)]
        tip = pts[-1] + (pts[-1] - pts[-2]).normalized() * (rN + 0.03)
        nb = max(3, round(L / 0.27))                      # beads along the arm, like the glass strand it grew from
        rad = [0.046 + 0.050 * math.exp(-((((t / n) * nb + 0.5) % 1 - 0.5) / 0.20) ** 2) for t in range(n + 1)]
        tube(f'arm{k}', pts, rad, m.rung, res=6)
        fil = S.filament(f'arm{k}-filament', [at(0.03 + 0.94 * t / 30) for t in range(31)], 0.0058, m.fil[k], M0)
        d0 = (pts[1] - pts[0]).normalized()
        K.lathe(f'arm{k}-socket', [(0.02, -0.035), (0.064, -0.035), (0.074, -0.024), (0.074, 0.024), (0.064, 0.035), (0.02, 0.035)],
                m.graphite, M0 @ S.along(start - d0 * 0.012, d0), 32, sharp=25)
        d1 = (pts[-1] - pts[-2]).normalized()
        K.lathe(f'arm{k}-collar', [(0.02, -0.035), (0.062, -0.035), (0.072, -0.024), (0.072, 0.035), (0.02, 0.035)],
                m.ti, M0 @ S.along(pts[-1] + d1 * 0.012, d1), 32, sharp=25)
        node = S.sphere(f'arm{k}-node', rN, m.bubble, M0 @ T(*tip), seg=96)
        sm = node.modifiers.new('solid', 'SOLIDIFY'); sm.thickness = 0.016; sm.offset = -1.0
        emblem(k, tip, rN * 0.82, m)
        g = glow(f'arm{k}-glow', tip + Vector((0, 0, rN * 0.5)), YEL, 0.0, size=0.03)
        g2 = glow(f'arm{k}-glow-mid', at(0.5) + Vector((0, 0, 0.16)), YEL, 0.0, size=0.03)
        ARM_TIP[k] = dict(tip=tip, glow=g, glow2=g2, fil=fil, base=start)
    # the nodes are linked to each other: hairlines between neighbours on the same side
    for a, b in ((0, 2), (2, 4), (1, 3), (3, 5)):
        pa, pb = ARM_TIP[a]['tip'], ARM_TIP[b]['tip']; d = (pb - pa).normalized()
        cyl(f'link{a}{b}', pa + d * 0.315, pb - d * 0.315, 0.0055, m.ti, seg=10)

def bake_metaballs(m):
    """Metaballs do not parent or instance cleanly: turn each into a relaxed mesh."""
    for ob in [o for o in bpy.data.objects if o.type == 'META']:
        mb = ob.data; mb.resolution = mb.render_resolution
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.materials.clear(); me.materials.append(m.chrome)
        for p in me.polygons: p.use_smooth = True
        nb = link(bpy.data.objects.new(ob.name + '-mesh', me)); nb.matrix_world = ob.matrix_world.copy()
        bpy.data.objects.remove(ob)
        sm = nb.modifiers.new('relax', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 5

# ---------------------------------------------------------------- 04 Experiments: arms that let go, each a project

PROJECTS = [  # key, picture, offset from the stop's target (right, toward the camera is -y, up), width, aspect (w/h)
    ('jontai', os.path.join(REPO, 'public', 'flight', 'jontai.webp'), (-1.80, -1.9, 0.80), 1.62, 16 / 9),
    ('lumo', os.path.join(REPO, 'tools', 'lab', 'mock', 'img', 'lumo.webp'), (0.24, -1.4, 0.66), 0.65, 540 / 1050),
    ('cookies', os.path.join(REPO, 'public', 'flight', 'cookies.webp'), (1.68, -1.7, -0.52), 1.57, 16 / 10),
    ('locked', None, (-0.52, -2.2, -0.60), 0.65, 540 / 1050),
]
SLIDES = {}

def picture(name, path):
    mt = bpy.data.materials.new(name); mt.use_nodes = True; nt = mt.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(path, check_existing=True); tx.extension = 'EXTEND'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    S._sock(mix, 'Factor_Float').default_value = 1.0; S._sock(mix, 'B_Color').default_value = (0.80, 0.74, 1.0, 1)
    nt.links.new(tx.outputs['Color'], S._sock(mix, 'A_Color')); nt.links.new(S._sock(mix, 'Result_Color', True), e.inputs['Color'])
    e.inputs['Strength'].default_value = 0.40
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return mt

def quad(name, w, h, mat, Mw):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('uv')
    vs = [bm.verts.new((x * w / 2, 0, z * h / 2)) for x, z in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = (u, v)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = Mw
    return ob

def build_projects(m, look_from, centre):
    """Each project is a glass slide in a hairline frame, upright in the world and turned to the camera that visits it,
    trailing the last beads of the arm it came from."""
    empty = principled('slide-empty', (0.035, 0.028, 0.06), 0.0, 0.35)
    for k, (key, path, p, w, asp) in enumerate(PROJECTS):
        c = centre + Vector(p); h = w / asp
        n = Vector((look_from.x - c.x, look_from.y - c.y, 0)).normalized()
        yaw = math.atan2(n.x, -n.y) + math.radians((-7, 5, 8, -5)[k])
        Mw = T(*c) @ Matrix.Rotation(yaw, 4, 'Z') @ Rx((4, -3, 2, -4)[k])      # local -Y faces the camera, Z is up
        if path: quad(f'slide-{key}-pic', w, h, picture(f'pic-{key}', path), Mw @ T(0, 0.012, 0))
        K.box(f'slide-{key}-glass', (w + 0.10, 0.02, h + 0.10), m.pane, Mw @ T(0, -0.004, 0), bevel=0.004)
        hw, hh = w / 2 + 0.07, h / 2 + 0.07
        corners = [Vector((sx * hw, 0, sz * hh)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        Minv = M0.inverted()
        for j in range(4):
            a, b = corners[j], corners[(j + 1) % 4]
            pa, pb = Minv @ (Mw @ a), Minv @ (Mw @ b)
            cyl(f'slide-{key}-edge{j}', pa, pb, 0.0075, m.ti, seg=10)
            ball(f'slide-{key}-corner{j}', pa, 0.030, m.chrome, seg=20)
        # the tail: beads from one corner back toward the helix, where the arm used to be
        cl = Minv @ (Mw @ corners[(3, 0, 0, 2)[k]]); axis = Vector((0, 0, cl.z + (0.5, -0.4, -0.5, 0.45)[k]))
        prev = cl
        for j, t in enumerate((0.16, 0.32, 0.50)):
            q = cl.lerp(axis, t) + Vector((0, 0, 0.05 * math.sin(3 * t)))
            cyl(f'slide-{key}-tail{j}', prev, q, 0.012, m.rung if j < 2 else m.ti, seg=12)
            ball(f'slide-{key}-bead{j}', q, 0.055 - 0.011 * j, m.strand if j % 2 == 0 else m.chrome, seg=28)
            prev = q
        if key == 'jontai':
            ball('slide-led', Minv @ (Mw @ corners[2]), 0.016, m.amber, seg=12)
        SLIDES[key] = dict(c=c, w=w, h=h, Mw=Mw, n=n)

# ---------------------------------------------------------------- 06 Connection: the strands thin into a network

NET = []
def build_network(m):
    rs = random.Random(606)
    top = Vector((0, 0, DZ * I_TOP))
    pts = [A(I_TOP), B(I_TOP)]
    for k in range(13):
        z = top.z + 0.45 + 0.21 * k + rs.uniform(-0.12, 0.12)
        a = rs.uniform(0, TAU); rad = rs.uniform(0.3, 0.5 + 0.09 * k)
        pts.append(Vector((rad * math.cos(a), rad * math.sin(a) * 0.55, z)))
    keys = (4, 8, 12)                       # three larger nodes: the links
    for k, p in zip(keys, ((-0.95, -0.55, top.z + 1.05), (0.80, -0.60, top.z + 1.85), (-0.40, -0.45, top.z + 2.75))):
        pts[k] = Vector(p)
    for k, p in enumerate(pts[2:], start=2):
        if k in keys:
            ball(f'net-node{k}', p, 0.17, m.strand, seg=64)
        else:
            ball(f'net-node{k}', p, rs.choice((0.03, 0.04, 0.05)), rs.choice((m.chrome, m.chrome, m.graphite)), seg=24)
    ball('net-spark', pts[8] + Vector((0.0, -0.26, 0.10)), 0.026, m.amber, seg=16)
    glow('net-spark-glow', pts[8] + Vector((0.0, -0.34, 0.14)), YEL, 1.6)
    done = set()
    for k, p in enumerate(pts):
        near = sorted(range(len(pts)), key=lambda j: (pts[j] - p).length)[1:3]
        for j in near:
            e = (min(k, j), max(k, j))
            if e in done: continue
            done.add(e); d = (pts[j] - p).normalized()
            cyl(f'net-edge{e[0]}-{e[1]}', p + d * (0.18 if k in keys else 0.02), pts[j] - d * (0.18 if j in keys else 0.02), 0.0055, m.ti, seg=10)
    NET.extend([pts[k] for k in keys])

# ---------------------------------------------------------------- light: one rig that travels with the camera's subject

RIG = []
def build_rig():
    lav = (0.88, 0.82, 1.0); vio = LIGHT_VIO
    for name, loc, tgt, size, watts, color, size_y in (
            ('key', (-4.6, -5.2, 4.4), (0, 0, 0.3), 3.0, 900, lav, 2.0),
            ('top', (0.4, 0.8, 6.2), (0, 0, 0), 4.0, 420, (0.78, 0.70, 1.0), 1.2),
            ('rim-r', (3.6, 6.2, 1.0), (0, 0, 0.1), 0.4, 2200, vio, 6.0),
            ('rim-l', (-3.9, 6.0, -0.4), (0, 0, 0), 0.4, 1800, tuple(x * 0.9 for x in vio), 5.5),
            ('under', (0.5, -3.2, -5.0), (0, 0, -0.3), 3.0, 160, vio, 1.5),
            ('strip-front', (2.8, -6.0, -1.6), (0, 0, 0), 0.25, 260, lav, 3.5)):
        ob = K.area(name, loc, tgt, size, watts, color, size_y=size_y); ob.visible_volume_scatter = False
        RIG.append(dict(ob=ob, loc=Vector(loc), tgt=Vector(tgt), size=size, size_y=size_y, watts=watts, kind='area'))
    for name, loc, tgt, w, h, strength, color in (
            ('sky', (-0.8, -2.8, 5.8), (0, 0, 0.2), 6.0, 3.0, S.PANEL, (0.90, 0.86, 1.0)),
            ('side', (5.6, -1.6, 0.5), (0, 0, 0), 1.4, 5.0, S.PANEL * 0.6, (0.62, 0.48, 1.0)),
            ('front', (2.2, -7.5, 3.2), (0, 0, 0.1), 4.0, 2.4, S.PANEL * 0.45, (0.80, 0.74, 1.0))):
        ob = S.softpanel(name, loc, tgt, w, h, strength, color)
        RIG.append(dict(ob=ob, loc=Vector(loc), tgt=Vector(tgt), kind='panel'))
    d = bpy.data.lights.new('beam', 'SPOT'); d.color = vio; d.spot_size = math.radians(16); d.spot_blend = 0.85; d.shadow_soft_size = 0.8
    ob = link(bpy.data.objects.new('beam', d))
    RIG.append(dict(ob=ob, loc=Vector((-3.2, 10.0, 7.5)), tgt=Vector((0.8, -3.0, -1.8)), watts=S.HALO, kind='spot'))

def place_rig(c, s, beam=1.0):
    for r in RIG:
        ob = r['ob']; loc = c + r['loc'] * s; tgt = c + r['tgt'] * s
        ob.location = loc
        ob.rotation_euler = (tgt - loc).to_track_quat('Z' if r['kind'] == 'panel' else '-Z', 'Y').to_euler()
        if r['kind'] == 'area':
            ob.data.size = r['size'] * s; ob.data.size_y = r['size_y'] * s; ob.data.energy = r['watts'] * s * s
        elif r['kind'] == 'panel':
            ob.scale = (s, s, s)
        else:
            ob.data.energy = r['watts'] * s * s * beam; ob.data.shadow_soft_size = 0.8 * s

# ---------------------------------------------------------------- the stops

def stops():
    exp_c = Lp(0, 0, 11.2) + Vector((0, -0.2, 0))
    return [
        dict(name='hero', tgt=Lp(0, 0, 1.95), off=Vector((0.0, -7.9, 0.5)), lens=58, rig=1.4, fstop=8, beam=0.75),
        dict(name='origin', tgt=Lp(0.2, -0.3, -2.6), off=Vector((1.3, -6.2, 0.9)), lens=50, rig=1.5, fstop=5.6, shift=-0.16),
        dict(name='foundation', tgt=Lp(0, 0, 3.55), off=Vector((1.1, -3.3, 0.5)), lens=50, rig=1.0, fstop=5.6, shift=-0.20),
        dict(name='development', tgt=Lp(0, 0, 6.85), off=Vector((0.3, -13.2, 0.7)), lens=50, rig=2.1, fstop=9, shift=-0.06),
        dict(name='experiments', tgt=exp_c, off=Vector((0.0, -10.6, 0.15)), lens=50, rig=1.8, fstop=9),
        dict(name='identity', tgt=Lp(0, 0, 6.0), off=Vector((1.5, -47.0, 2.0)), lens=62, rig=6.0, roll=33, shift=-0.05),
        dict(name='connection', tgt=Lp(0, -0.1, 15.55), off=Vector((0.4, -9.0, 0.3)), lens=50, rig=1.5, fstop=6.3, shift=-0.18),
    ]

MOVES = [22, 26, 18, 18, 22, 22]

def ease(t): return t * t * (3 - 2 * t)

def pose(cam, a, b, t):
    e = ease(t)
    tgt = a['tgt'].lerp(b['tgt'], e)
    off = a['off'].lerp(b['off'], e)
    # long moves swing a little wide so the camera never cuts through the helix
    off = off + Vector((0, -1, 0)) * math.sin(math.pi * t) * 0.10 * (a['tgt'] - b['tgt']).length
    loc = tgt + off
    cam.location = loc
    roll = math.radians(lerp(a.get('roll', 0.0), b.get('roll', 0.0), e))
    cam.rotation_euler = ((tgt - loc).to_track_quat('-Z', 'Y') @ Matrix.Rotation(roll, 3, 'Z').to_quaternion()).to_euler()
    cd = cam.data
    cd.lens = lerp(a['lens'], b['lens'], e); cd.shift_x = lerp(a.get('shift', 0.0), b.get('shift', 0.0), e)
    fa, fb = a.get('fstop'), b.get('fstop')
    cd.dof.use_dof = bool(fa or fb)
    if cd.dof.use_dof:
        cd.dof.aperture_fstop = lerp(fa or 22, fb or 22, e); cd.dof.focus_distance = off.length
    place_rig(tgt, lerp(a['rig'], b['rig'], e), lerp(a.get('beam', 0.5), b.get('beam', 0.5), e))

# ---------------------------------------------------------------- main

def main():
    os.makedirs(OUT, exist_ok=True)
    s = K.fresh()
    s.cycles.volume_bounces = 1; s.cycles.transmission_bounces = 14; s.cycles.max_bounces = 16
    try: s.render.use_persistent_data = True
    except Exception: pass
    m = Mats(); S.world(m)
    w = s.world.node_tree
    w.nodes['Background'].inputs['Color'].default_value = (*S.mul(srgb('#100B19'), 0.55), 1)
    build_rig()
    st = stops()
    before = set(bpy.data.objects)
    build_helix(m); build_traces(m); build_origin(m); build_dust(m); build_arms(m)
    exp = next(k for k in st if k['name'] == 'experiments')
    build_projects(m, exp['tgt'] + exp['off'], exp['tgt'])
    build_network(m)
    bake_metaballs(m)
    root = link(bpy.data.objects.new('dna', None))
    for ob in set(bpy.data.objects) - before:
        if ob is not root and ob.parent is None: ob.parent = root
    def turn(deg): root.matrix_world = M0 @ Rz(deg) @ M0.inverted()

    # the title stands far behind the helix as real letters, so the glass bends it (as round 68 did with the name)
    font = bpy.data.fonts.load(F.FONT, check_existing=True)
    nt = m.ink.node_tree; pb = nt.nodes['Principled BSDF']; outn = nt.nodes['Material Output']
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(pb.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], outn.inputs['Surface'])
    def title_alpha(a): mx.inputs[0].default_value = a
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    h = st[0]
    c0 = S.cam('title-cam', loc=tuple(h['tgt'] + h['off']), target=tuple(h['tgt']), lens=h['lens'])
    desk = [F.word('DIGITAL', 'DIGITAL', c0, 24.0, 0.085, 0.610, 0.255, 'LEFT', m.ink, font),
            F.word('DNA', 'DNA', c0, 24.0, 0.915, 0.115, 0.255, 'RIGHT', m.ink, font)]
    tall = []
    if JOB == 'phone':
        s.render.resolution_x, s.render.resolution_y = F.PW, F.PH
        hp = dict(tgt=Lp(0, 0, 2.3), off=Vector((0.0, -9.4, 0.4)), lens=58, rig=1.5, fstop=8, beam=0.75)
        cp = S.cam('title-cam-phone', loc=tuple(hp['tgt'] + hp['off']), target=tuple(hp['tgt']), lens=hp['lens'])
        top = F.word('DIGITAL-p', 'DIGITAL', cp, 24.0, 0.07, 0.775, None, 'LEFT', m.ink, font, span=0.86)
        tall = [top, F.word('DNA-p', 'DNA', cp, 24.0, 0.93, 0.235, None, 'RIGHT', m.ink, font, k=top['k'])]
        for o in desk: o.hide_render = True

    cam = S.cam('journey', loc=(0, -10, 0), target=(0, 0, 0), lens=50)
    s.camera = cam

    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)

    def screen(p):
        bpy.context.view_layer.update()
        v = world_to_camera_view(s, cam, Vector(p)); return [round(v.x, 4), round(1 - v.y, 4)]

    def layout():
        out = {}
        d = next(k for k in st if k['name'] == 'development'); pose(cam, d, d, 0); title_alpha(0)
        out['arms'] = [dict(name=ARMS[k][0], tip=screen(M0 @ ARM_TIP[k]['tip']), base=screen(M0 @ ARM_TIP[k]['base'])) for k in range(6)]
        pose(cam, exp, exp, 0)
        out['slides'] = {}
        for key, v in SLIDES.items():
            hw, hh = v['w'] / 2 + 0.05, v['h'] / 2 + 0.05
            out['slides'][key] = dict(c=screen(v['c']), tl=screen(v['Mw'] @ Vector((-hw, 0, hh))), br=screen(v['Mw'] @ Vector((hw, 0, -hh))))
        c = next(k for k in st if k['name'] == 'connection'); pose(cam, c, c, 0)
        out['net'] = [screen(M0 @ p) for p in NET]
        with open(os.path.join(OUT, 'layout.json'), 'w') as fh: json.dump(out, fh, indent=1)
        print('layout', json.dumps(out), flush=True)

    job, _, arg = JOB.partition(':')
    if job == 'phone':
        title_alpha(1.0); turn(0); pose(cam, hp, hp, 0.0)
        shoot(os.path.join(OUT, 'phone-hero.jpg')); return
    if job == 'layout':
        layout(); return
    if job == 'keys':
        only = arg.split(',') if arg else None
        for i, k in enumerate(st):
            if only and k['name'] not in only: continue
            title_alpha(1.0 if i == 0 else 0.0); turn(0)
            pose(cam, k, k, 0.0); shoot(os.path.join(OUT, f'k{i}-{k["name"]}.jpg'))
        layout(); return
    if job == 'mids':                       # a check only: the middle of every move, and the turn's two ends
        for i in range(len(MOVES)):
            title_alpha(0.0); turn(0); pose(cam, st[i], st[i + 1], 0.5); shoot(os.path.join(OUT, f'mid{i}.jpg'))
        title_alpha(1.0); pose(cam, st[0], st[0], 0.0)
        for a in (-16, 16):
            turn(a); shoot(os.path.join(OUT, f'turn{a}.jpg'))
        return
    if job == 'spin':
        N, RANGE = 41, 16.0
        title_alpha(1.0); pose(cam, st[0], st[0], 0.0)
        os.makedirs(os.path.join(OUT, 'spin'), exist_ok=True)
        for i in range(N):
            turn(RANGE * (2 * i / (N - 1) - 1)); shoot(os.path.join(OUT, 'spin', f's{i:02d}.jpg'))
        with open(os.path.join(OUT, 'spin', 'spin.json'), 'w') as fh: json.dump({'count': N, 'range': RANGE}, fh)
        return
    if job == 'hover':
        d = next(k for k in st if k['name'] == 'development'); title_alpha(0); turn(0); pose(cam, d, d, 0)
        os.makedirs(os.path.join(OUT, 'hover'), exist_ok=True)
        for k in range(6):
            em = m.fil[k].node_tree.nodes['Emission']
            t = ARM_TIP[k]
            em.inputs['Color'].default_value = (*YEL, 1); em.inputs['Strength'].default_value = 30.0
            t['fil'].data.bevel_depth = 0.017; t['glow'].data.energy = 34.0; t['glow2'].data.energy = 14.0
            shoot(os.path.join(OUT, 'hover', f'h{k}.jpg'))
            em.inputs['Color'].default_value = (*S.VIOLET, 1); em.inputs['Strength'].default_value = 5.0
            t['fil'].data.bevel_depth = 0.0058; t['glow'].data.energy = 0.0; t['glow2'].data.energy = 0.0
        return
    if job == 'close':
        title_alpha(0); turn(0)
        os.makedirs(os.path.join(OUT, 'close'), exist_ok=True)
        for key, v in SLIDES.items():
            wide = v['w'] > 1.0
            dist = 4.5 if wide else 4.1
            k = dict(tgt=v['c'], off=v['n'] * dist + Vector((0.45 if wide else 0.7, 0, 0.12)), lens=50, rig=1.0, fstop=4.5, shift=-0.21 if wide else -0.17)
            pose(cam, k, k, 0); shoot(os.path.join(OUT, 'close', f'c-{key}.jpg'))
        return
    if job == 'seq':
        os.makedirs(os.path.join(OUT, 'seq'), exist_ok=True)
        f = 0; at = [0]; turn(0)
        title_alpha(1.0); pose(cam, st[0], st[0], 0.0); shoot(os.path.join(OUT, 'seq', f'f{f:03d}.jpg'))
        for i, n in enumerate(MOVES):
            for j in range(1, n + 1):
                f += 1; pose(cam, st[i], st[i + 1], j / n)
                title_alpha(max(0.0, 1.0 - (j / n) / 0.5) if i == 0 else 0.0)
                shoot(os.path.join(OUT, 'seq', f'f{f:03d}.jpg'))
            at.append(f)
        with open(os.path.join(OUT, 'seq', 'frames.json'), 'w') as fh:
            json.dump({'count': f + 1, 'stops': {k['name']: a for k, a in zip(st, at)}}, fh)
        print('frames', f + 1, at, flush=True)

if __name__ == '__main__':
    main()
