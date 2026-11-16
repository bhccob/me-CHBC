# LAB ONLY (throwaway). Round 71: Bob's revised "Digital DNA: Inside the Living Machine" brief (2026-11-13).
# Round 70 showed the helix as an object floating in the dark, with the projects on glass slides; Bob: "selected works
# are not as good". This round follows the revised brief: one monumental helix you stand under, then go inside.
# Units are round 70's (1 unit ~ 11 m), so its glass and metal read the same; the camera's eye is 0.15 above the floor.
# Time runs up the structure, and the structure turns from biology into machine as it rises:
#   floor      a dark polished hall floor, a walkway lit with small amber points leading to the dais        (first view, 01)
#   0..4.8     the double helix: two glass strands (A smoked violet with a filament; B clear with a titanium rail
#              inside and machined collars), rungs that are glass meeting titanium in a coupling, some with gears
#   4.8..8.4   inside, the rungs turn into circuit boards: traces, chips, lit paths            (02 Foundation: software)
#   8.6..11.2  the rungs turn into shafts, gears and actuators, less and less finished: missing parts are drawn as
#              faint lavender outlines, because mechatronics is a future direction, not a finished one   (02: future)
#   11.6       a deck round the new spine carries six systems, one per capability, joined by lit conduits  (03)
#   14.6       the workshop deck: four installations, one per real project, each its own machine        (04)
#   17.3       the energy core; above it the strands thin into a network of nodes                        (06)
#   whole      seen from far away, the whole machine standing in the haze                                (05)
#   blender -b --factory-startup --python tools/lab/blender/dna71.py -- <out-dir> <job> [samples] [res%]
# job: keys[:a,b] one still per stop · mids the middle of every move · seq the whole move + frames.json ·
#      spin the first view turning · hover the six systems lit one at a time · layout writes layout.json · phone
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sculpture67 as S
import firstview68 as F
K = S.K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'keys'
REPO = F.REPO
I4 = Matrix.Identity(4)
ENV = lambda k, d: float(os.environ.get(k, d))

def srgb(h): return S.srgb(h)
YEL, PALE, LAV, OFF = srgb('#F5D547'), srgb('#FFE98A'), srgb('#BBA0FF'), srgb('#E9E5F0')
VIO = S.VIOLET
LIGHT_VIO = S.LIGHT_VIO
WARM = (1.0, 0.86, 0.62)

def lerp(a, b, t): return a + (b - a) * t
def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))
def ease(t): return t * t * (3 - 2 * t)
def V(*a): return Vector(a)

# ---------------------------------------------------------------- the helix
R, PITCH, NPT = 0.62, 2.2, 10
DZ = PITCH / NPT
DPH = math.radians(144)                      # strand B 144 degrees round from A: a major and a minor groove
PH0 = math.radians(-39.3)                    # so the major groove faces the walkway (-Y) at the floor
I_LO, I_RUNG0, I_DNA, I_PCB, I_MECH, I_RUNG1, I_TOP = -2, 2, 21, 25, 39, 51, 79
DEV_Z, WS_Z, CORE_Z = 11.6, 14.6, 17.42
SPINE0 = 11.42

def ang(i, b=False): return TAU * i / NPT + PH0 + (DPH if b else 0.0)
def A(i): a = ang(i); return V(R * math.cos(a), R * math.sin(a), DZ * i)
def B(i): a = ang(i, True); return V(R * math.cos(a), R * math.sin(a), DZ * i)
def tangent(f, i, e=0.01): return (f(i + e) - f(i - e)).normalized()

# ---------------------------------------------------------------- materials

def pane_glass(name):
    mt = K.thin_glass(name, (0.93, 0.91, 1.0), 0.03)
    setin(mt.node_tree.nodes['Principled BSDF'], 'Specular IOR Level', 0.14)
    return mt

def floor_mat():
    """Dark polished stone in 2 m tiles (0.18 units): the floor is the only thing that says how big the rest is."""
    m = principled('hall-floor', (0.016, 0.012, 0.024), 0.35, 0.22, coat=0.25)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    S.noise_rough(nt, b, 0.14, 0.34, 0.6)
    tc = nt.nodes.new('ShaderNodeTexCoord'); br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0; br.squash = 1.0
    br.inputs['Scale'].default_value = 1.0 / 0.18
    br.inputs['Brick Width'].default_value = 1.0; br.inputs['Row Height'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.004; br.inputs['Mortar Smooth'].default_value = 0.2
    br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (1, 1, 1, 1)
    br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(br.outputs['Color'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def deck_mat():
    m = principled('deck', (0.030, 0.026, 0.040), 0.75, 0.34, aniso=0.2)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.5; br.squash = 1.0
    br.inputs['Scale'].default_value = 1.0 / 0.12
    br.inputs['Brick Width'].default_value = 2.0; br.inputs['Row Height'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.006
    br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.92, 0.92, 0.92, 1)
    br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(br.outputs['Color'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def picture(name, path, strength=1.0, tint=(0.94, 0.90, 1.0)):
    mt = bpy.data.materials.new(name); mt.use_nodes = True; nt = mt.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(path, check_existing=True); tx.extension = 'EXTEND'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    _sock(mix, 'Factor_Float').default_value = 1.0; _sock(mix, 'B_Color').default_value = (*tint, 1)
    nt.links.new(tx.outputs['Color'], _sock(mix, 'A_Color')); nt.links.new(_sock(mix, 'Result_Color', True), e.inputs['Color'])
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return mt

class Mats(S.Mats):
    def __init__(self):
        super().__init__()
        self.strand = S.smoked_glass('strand-glass', density=5.0, absorb=(0.76, 0.20, 0.88))
        self.strand_b = S.smoked_glass('strand-b-glass', density=1.6, absorb=(0.70, 0.48, 0.94))
        self.rung = S.smoked_glass('rung-glass', density=2.4, absorb=(0.72, 0.40, 0.92))
        self.bubble = S.smoked_glass('cell-glass', density=1.2, absorb=(0.60, 0.48, 0.92))
        self.pane = pane_glass('screen-glass')
        self.amber = emit('amber', YEL, 18.0)
        self.amber_soft = emit('amber-soft', YEL, 7.0)
        self.amber_path = emit('amber-path', YEL, 4.0)
        self.vio_dim = emit('violet-dim', VIO, 3.0)
        self.edge_glow = emit('deck-edge', VIO, 9.0)
        self.core = emit('strand-filament', VIO, 2.6)
        self.core_hot = emit('filament-pcb', VIO, 5.0)
        self.core_low = emit('filament-mech', VIO, 1.1)
        self.trace = principled('trace', (0.70, 0.66, 0.78), 1.0, 0.22)
        self.trace_glow = emit('trace-glow', VIO, 7.0)
        self.board = principled('board', (0.020, 0.013, 0.034), 0.0, 0.30, coat=0.5)
        self.chip = principled('chip', (0.012, 0.011, 0.016), 0.2, 0.45)
        self.ghost = emit('blueprint', LAV, 1.6)
        self.floor = floor_mat()
        self.deck = deck_mat()
        self.ink = emit('screen-ink', OFF, 2.2)
        self.ink_dim = emit('screen-ink-dim', LAV, 1.0)
        self.screen_dark = emit('screen-dark', srgb('#1A1028'), 0.6)
        self.sleeve = [self.anod, self.graphite]
        self.sysfil = [emit(f'system-filament-{k}', VIO, 4.0) for k in range(6)]     # one per system, lit on hover
        self.arcfil = [emit(f'link-filament-{k}', VIO, 2.0) for k in range(6)]       # link k joins system k and k+1
        self.focus = [emit(f'installation-amber-{k}', YEL, 0.0) for k in range(4)]   # lit as the camera arrives

# ---------------------------------------------------------------- small builders (world coordinates)

def cyl(name, p0, p1, r, mat, seg=24, round_=0.0, X=I4):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-6: return None
    if round_:
        c = min(round_, L / 2 - 1e-4)
        prof = [(0, -L / 2), (r * 0.55, -L / 2), (r, -L / 2 + c), (r, L / 2 - c), (r * 0.55, L / 2), (0, L / 2)]
    else:
        prof = [(0, -L / 2), (r, -L / 2), (r, L / 2), (0, L / 2)]
    return K.lathe(name, prof, mat, X @ S.along((p0 + p1) / 2, d), seg, sharp=50)

def ball(name, p, r, mat, seg=32, X=I4):
    return S.sphere(name, r, mat, X @ T(*p), seg=seg)

def tube(name, pts, radii, mat, res=6, X=I4):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, P, r in zip(sp.points, pts, radii):
        p.co = (P.x, P.y, P.z, 1.0); p.radius = r
    cu.materials.append(mat)
    ob = link(bpy.data.objects.new(name, cu)); ob.matrix_world = X
    return ob

def line(name, pts, r, mat, X=I4):
    return S.filament(name, [Vector(p) for p in pts], r, mat, X)

def torus(name, Rr, r, mat, M, seg=48, rseg=10):
    return S.torus(name, Rr, r, mat, M, seg=seg, rseg=rseg)

def box(name, size, mat, M, bevel=0.002):
    return K.box(name, size, mat, M, bevel=bevel)

def glow(name, p, color, watts, size=0.02, scatter=False):
    d = bpy.data.lights.new(name, 'POINT'); d.energy = watts; d.color = color; d.shadow_soft_size = size
    ob = link(bpy.data.objects.new(name, d)); ob.location = Vector(p)
    ob.visible_volume_scatter = scatter
    return ob

def spot(name, loc, tgt, watts, color, size=30, blend=0.6, radius=0.05, scatter=True):
    d = bpy.data.lights.new(name, 'SPOT'); d.energy = watts; d.color = color
    d.spot_size = math.radians(size); d.spot_blend = blend; d.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, d)); ob.location = Vector(loc)
    ob.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob.visible_volume_scatter = scatter
    return ob

def bezier(p0, p1, p2, p3, n=24):
    p0, p1, p2, p3 = map(Vector, (p0, p1, p2, p3))
    return [p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t * t + p3 * t ** 3 for t in (k / n for k in range(n + 1))]

def frame_at(p, ang_deg):
    """Local frame on a deck: origin p, local -Y faces out from the axis (toward a visitor on the deck), Z up."""
    return T(*p) @ Rz(ang_deg + 90)

def gear_at(name, M, r, teeth, thick, mat):
    return K.gear(name, r, teeth, thick, r * 0.12, mat, M)

# ---------------------------------------------------------------- strands

BEAD = 0.156
def build_strand_a(m):
    n = 14
    for (i0, i1, fil) in ((I_LO, I_DNA + 1.5, m.core), (I_DNA + 1.5, I_MECH - 0.5, m.core_hot),
                          (I_MECH - 0.5, I_RUNG1 + 1, m.core_low), (I_RUNG1 + 1, I_TOP, m.core)):
        pts = [A(i0 + (i1 - i0) * k / (6 * (i1 - i0))) for k in range(int(6 * (i1 - i0)) + 1)]
        S.filament(f'strand-a-filament-{i0}', pts, 0.0075, fil, I4)
    pts, rad = [], []
    for k in range(int((I_TOP - I_LO) * n) + 1):
        i = I_LO + k / n
        taper = 1.0 if i < I_TOP - 6 else lerp(1.0, 0.30, clamp((i - (I_TOP - 6)) / 6))
        f = i - round(i)
        swell = 0.078 * math.exp(-(f / 0.17) ** 2) if I_RUNG0 - 1 <= round(i) <= I_RUNG1 else 0.020 * math.exp(-(f / 0.2) ** 2)
        pts.append(A(i)); rad.append((0.078 + swell) * taper)
    tube('strand-a', pts, rad, m.strand)

def collar(name, i, m, mat=None, X=I4):
    p, t = B(i), tangent(B, i)
    M = X @ S.along(p, t)
    prof = [(0.071, -0.085), (0.088, -0.085), (0.096, -0.076), (0.096, -0.026), (0.090, -0.020), (0.090, 0.020),
            (0.096, 0.026), (0.096, 0.076), (0.088, 0.085), (0.071, 0.085)]
    K.lathe(name, prof, mat or m.sleeve[i % 2], M, 48, sharp=25)
    K.ring(name + '-waist', 0.089, 0.093, -0.010, 0.010, m.chrome, M, c=0.001, seg=48)

def build_strand_b(m):
    pts, rad = [], []
    for k in range(int((I_TOP - I_LO) * 8) + 1):
        i = I_LO + k / 8
        taper = 1.0 if i < I_TOP - 6 else lerp(1.0, 0.35, clamp((i - (I_TOP - 6)) / 6))
        pts.append(B(i)); rad.append(0.070 * taper)
    tube('strand-b', pts, rad, m.strand_b)
    tube('strand-b-rail', pts, [r * 0.30 for r in rad], m.rail, res=4)
    rs = random.Random(5)
    for i in range(I_LO + 1, I_TOP - 2):
        if I_RUNG0 <= i <= I_RUNG1 or i % 2 == 0:
            collar(f'collar{i}', i, m)
        if rs.random() < 0.18 and i < I_RUNG1:                   # energy on the rail: small yellow points inside the glass
            ball(f'rail-spark{i}', B(i + 0.5), 0.012, m.amber_soft, seg=12)

# ---------------------------------------------------------------- rungs

ACTIVE = {4, 9, 13, 18}
GEARED = {3, 8, 11, 16, 20}

def rung_dna(i, m):
    a, b = A(i), B(i); d = b - a; L = d.length; u = d / L
    rs = random.Random(1000 + i)
    f = rs.choice((0.44, 0.56)); J = a + u * (L * f)
    Mf = S.along(a + u * (BEAD + 0.014), u)
    K.ring(f'ferrule{i}', 0.034, 0.060, -0.016, 0.016, m.ti, Mf, c=0.003, seg=32)
    cyl(f'rung-glass{i}', a + u * (BEAD + 0.034), J - u * 0.052, 0.044, m.rung, seg=32, round_=0.014)
    Mc = S.along(J, u)
    prof = [(0.020, -0.056), (0.058, -0.056), (0.066, -0.047), (0.066, -0.014), (0.054, -0.010), (0.054, 0.010),
            (0.066, 0.014), (0.066, 0.047), (0.058, 0.056), (0.020, 0.056)]
    K.lathe(f'coupling{i}', prof, m.sleeve[rs.randrange(2)], Mc, 40, sharp=25)
    if i in GEARED:                                           # an exposed gear on the coupling, with a small idler
        gear_at(f'rung-gear{i}', Mc, 0.098, 20, 0.024, m.gear)
        w = u.cross(V(0, 0, 1)).normalized()
        gear_at(f'rung-idler{i}', S.along(J + w * 0.150 + V(0, 0, 0.02), u) @ Rz(9), 0.060, 12, 0.022, m.ti)
        cyl(f'rung-idler-pin{i}', J + w * 0.150 + V(0, 0, 0.02) - u * 0.03, J + w * 0.150 + V(0, 0, 0.02) + u * 0.03, 0.010, m.chrome, seg=12)
    if i in ACTIVE:
        torus(f'led{i}', 0.0555, 0.0072, m.amber, Mc)
        glow(f'led-glow{i}', J + V(0, 0, 0.10), YEL, 2.2)
    else:
        torus(f'led{i}', 0.0555, 0.0050, m.vio_dim if i % 3 == 0 else m.chrome, Mc)
    cyl(f'pin{i}', J + u * 0.056, b - u * 0.094, 0.018, m.ti, seg=20)
    return J

def board(i, m, width, a0, a1, glass_core=False):
    """A circuit-board rung from a0 to a1: components on both faces, because the visitor looks up at it from below."""
    d = a1 - a0; L = d.length; u = d / L
    w = V(0, 0, 1).cross(u).normalized(); n = u.cross(w).normalized()
    M = Matrix((u, w, n)).transposed().to_4x4(); M.translation = (a0 + a1) / 2
    rs = random.Random(2000 + i)
    box(f'board{i}', (L, width, 0.014), m.board, M, bevel=0.002)
    for s in (-1, 1):                                        # clamps where the board meets each strand
        box(f'board{i}-clamp{s}', (0.050, width + 0.024, 0.030), m.ti, M @ T(s * (L / 2 - 0.025), 0, 0), bevel=0.003)
    for face in (-1, 1):
        z = face * 0.0078
        ys = sorted(rs.sample([-0.42, -0.30, -0.18, -0.06, 0.06, 0.18, 0.30, 0.42], 5))
        lit = rs.sample(range(5), 2)
        for k, y in enumerate(ys):
            y *= width; x0 = -L / 2 + 0.06; x1 = L / 2 - 0.06
            xm = rs.uniform(-0.25, 0.25) * L; jog = rs.choice((-1, 1)) * width * 0.12
            mat = m.trace_glow if k in lit else m.trace
            # a trace: along, a 45 degree step sideways, along again
            box(f'tr{i}-{face}-{k}a', (xm - x0, 0.0052, 0.0016), mat, M @ T((x0 + xm) / 2, y, z), bevel=0)
            st = math.hypot(0.03, jog)
            box(f'tr{i}-{face}-{k}b', (st, 0.0052, 0.0016), mat, M @ T(xm + 0.015, y + jog / 2, z) @ Rz(math.degrees(math.atan2(jog, 0.03))), bevel=0)
            box(f'tr{i}-{face}-{k}c', (x1 - xm - 0.03, 0.0052, 0.0016), mat, M @ T((xm + 0.03 + x1) / 2, y + jog, z), bevel=0)
            for xx in (x0, x1):
                yy = y if xx == x0 else y + jog
                cyl(f'via{i}-{face}-{k}-{xx:.2f}', M @ V(xx, yy, z), M @ V(xx, yy, z + 0.0025 * face), 0.0075, m.chrome, seg=12)
            if k == lit[0] and rs.random() < 0.7:                # a pulse travelling on a lit trace
                box(f'pulse{i}-{face}', (0.024, 0.0080, 0.0030), m.amber, M @ T(rs.uniform(x0 + 0.05, xm - 0.03), y, z), bevel=0)
        for c in range(rs.choice((1, 2))):
            cx = rs.uniform(-0.28, 0.28) * L; cy = rs.choice((-0.2, 0.2)) * width
            box(f'chip{i}-{face}-{c}-pins', (0.070, 0.050, 0.004), m.trace, M @ T(cx, cy, face * 0.009), bevel=0)
            box(f'chip{i}-{face}-{c}', (0.058, 0.058, 0.010), m.chip, M @ T(cx, cy, face * 0.013), bevel=0.0015)
            if rs.random() < 0.35:
                ball(f'chip-led{i}-{face}-{c}', M @ V(cx + 0.02, cy + 0.02, face * 0.0185), 0.004, m.amber, seg=10)
    if glass_core:
        cyl(f'board{i}-glass', a0 - u * 0.02, a0 + u * (L * 0.45), 0.032, m.rung, seg=24, round_=0.01)
    return M

def rung_pcb(i, m):
    a, b = A(i), B(i); u = (b - a).normalized()
    a0 = a + u * (BEAD - 0.01); a1 = b - u * 0.09
    k = i - I_DNA                                      # 1..3: the board grows out of the glass rung
    if i < I_PCB:
        width = (0.05, 0.09, 0.12)[k - 1]
        board(i, m, width, a0, a1, glass_core=True)
        cyl(f'pin{i}', a0 + (a1 - a0) * 0.5, a1, 0.016, m.ti, seg=16)
    else:
        board(i, m, 0.15, a0, a1)
    if i in (27, 31, 35, 38):
        glow(f'pcb-glow{i}', (a + b) / 2 + V(0, 0, -0.08), LIGHT_VIO, 3.0)

def ghost_ring(name, M, r, mat):
    torus(name, r, 0.0022, mat, M, seg=64, rseg=6)

def ghost_line(name, p0, p1, mat, dash=0.035, gap=0.025):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length; u = d / L; s = 0.0; k = 0
    while s < L:
        e = min(L, s + dash)
        cyl(f'{name}-{k}', p0 + u * s, p0 + u * e, 0.0022, m_ghost(), seg=6); s = e + gap; k += 1

_MG = []
def m_ghost(): return _MG[0]

def rung_mech(i, m):
    """A shaft with bearings, a gear pair and an actuator. Further up, more of it is still only an outline."""
    a, b = A(i), B(i); d = b - a; L = d.length; u = d / L
    w = u.cross(V(0, 0, 1)).normalized()
    a0 = a + u * (BEAD - 0.01); a1 = b - u * 0.09
    t = (i - I_MECH) / (I_RUNG1 - I_MECH)          # 0 finished .. 1 barely started
    rs = random.Random(3000 + i)
    for s, p in (('a', a0 + u * 0.04), ('b', a1 - u * 0.04)):
        box(f'bearing{i}{s}', (0.070, 0.090, 0.090), m.graphite, S.along(p, u), bevel=0.006)
        K.ring(f'bearing{i}{s}-race', 0.022, 0.034, 0.035, 0.047, m.chrome, S.along(p, u), c=0.002, seg=32)
    if t < 0.75:
        cyl(f'shaft{i}', a0, a1, 0.021, m.ti, seg=20)
    else:
        cyl(f'shaft{i}a', a0, a0 + u * 0.14, 0.021, m.ti, seg=20); cyl(f'shaft{i}b', a1 - u * 0.14, a1, 0.021, m.ti, seg=20)
        ghost_line(f'shaft-ghost{i}', a0 + u * 0.15, a1 - u * 0.15, m.ghost)
    f = rs.uniform(0.38, 0.55); G = a0 + (a1 - a0) * f
    g2c = G + w * 0.146
    # the big gear: on the shaft, pulled off it, or only drawn
    if t < 0.45:
        gear_at(f'mech-gear{i}', S.along(G, u), 0.100, 22, 0.030, m.gear)
        K.ring(f'mech-hub{i}', 0.020, 0.036, -0.022, 0.022, m.chrome, S.along(G, u), c=0.002, seg=32)
    else:
        ghost_ring(f'mech-gear-ghost{i}', S.along(G, u), 0.100, m.ghost)
        if t < 0.9:
            off = G + V(0, 0, 0.13) + u * 0.06
            gear_at(f'mech-gear{i}-loose', S.along(off, u) @ Rx(18) @ Rz(rs.uniform(0, 30)), 0.100, 22, 0.030, m.gear)
    # the small gear on its stub axle
    if t < 0.25:
        gear_at(f'mech-pinion{i}', S.along(g2c, u) @ Rz(8), 0.054, 12, 0.028, m.ti)
        cyl(f'mech-stub{i}', g2c - u * 0.04, g2c + u * 0.04, 0.010, m.chrome, seg=12)
        box(f'mech-bracket{i}', (0.020, 0.030, 0.12), m.graphite, S.along(g2c - u * 0.045 + V(0, 0, -0.05), u) @ Rx(90), bevel=0.003)
    else:
        ghost_ring(f'mech-pinion-ghost{i}', S.along(g2c, u), 0.054, m.ghost)
    # the actuator under the shaft
    p0 = a0 + u * 0.12 + V(0, 0, -0.075); p1 = a0 + u * (L * 0.62) + V(0, 0, -0.075)
    if t < 0.6:
        cyl(f'actuator{i}', p0, p0 + (p1 - p0) * 0.62, 0.028, m.anod, seg=24, round_=0.006)
        cyl(f'actuator-rod{i}', p0 + (p1 - p0) * 0.6, p1, 0.011, m.chrome, seg=14)
        K.ring(f'actuator{i}-band', 0.028, 0.031, -0.004, 0.004, m.ti, S.along(p0 + (p1 - p0) * 0.3, u), c=0.001, seg=24)
    else:
        ghost_line(f'actuator-ghost{i}', p0, p1, m.ghost)
        ghost_ring(f'actuator-ghost{i}-r0', S.along(p0, u), 0.028, m.ghost)
        ghost_ring(f'actuator-ghost{i}-r1', S.along(p0 + (p1 - p0) * 0.62, u), 0.028, m.ghost)

def build_helix(m):
    build_strand_a(m); build_strand_b(m)
    for i in range(I_RUNG0, I_DNA + 1): rung_dna(i, m)
    for i in range(I_DNA + 1, I_MECH): rung_pcb(i, m)
    for i in range(I_MECH, I_RUNG1 + 1): rung_mech(i, m)
    # where the rungs end, the base pairs have fused into a spine; the strands are tied to it by struts
    for i in range(I_RUNG1 + 2, I_TOP - 3, 2):
        for f, tag in ((A, 'a'), (B, 'b')):
            p = f(i); q = V(0, 0, p.z); u = (p - q).normalized()
            cyl(f'strut{i}{tag}', q + u * 0.13, p - u * (BEAD * 0.7 if tag == 'a' else 0.09), 0.013, m.ti, seg=16)

# ---------------------------------------------------------------- the floor, the dais, the walkway

def build_ground(m):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=160)
    me = bpy.data.meshes.new('floor'); bm.to_mesh(me); bm.free(); me.materials.append(m.floor)
    link(bpy.data.objects.new('floor', me))
    prof = [(0, 0.0), (1.30, 0.0), (1.30, 0.018), (1.285, 0.030), (1.06, 0.030), (1.05, 0.040), (0.0, 0.040)]
    K.lathe('dais', prof, m.graphite, I4, 192, sharp=30)
    K.ring('dais-edge', 1.298, 1.312, 0.0, 0.020, m.ti, I4, c=0.002, seg=192)
    K.ring('dais-inlay', 0.96, 0.975, 0.0395, 0.0415, m.vio_dim, I4, c=0.0005, seg=192)
    K.ring('dais-centre', 0.16, 0.175, 0.0395, 0.0415, m.amber_path, I4, c=0.0005, seg=96)
    for k in range(3):
        K.ring(f'dais-groove{k}', 0.40 + 0.12 * k, 0.405 + 0.12 * k, 0.0395, 0.0410, m.ti, I4, c=0.0005, seg=128)
    # where each strand enters the dais: a heavy collar
    for tag, f, rr in (('a', A, 0.20), ('b', B, 0.13)):
        i = 0.04 / DZ
        p, t = f(i), tangent(f, i)
        M = S.along(p, t)
        K.ring(f'anchor-{tag}', rr * 0.86, rr * 1.30, -0.06, 0.05, m.ti, M, c=0.006, seg=64)
        K.ring(f'anchor-{tag}-band', rr * 1.30, rr * 1.36, -0.02, 0.02, m.anod, M, c=0.002, seg=64)
    # the walkway to the major groove, with small amber points along both edges every 1.6 m
    y0, y1, wd, gz = -16.0, -1.20, 0.26, 0.03
    box('walkway', (wd, y1 - y0, 0.014), m.graphite, T(0, (y0 + y1) / 2, gz - 0.007), bevel=0.002)
    box('walkway-top', (wd - 0.02, y1 - y0, 0.002), m.anod, T(0, (y0 + y1) / 2, gz), bevel=0)
    for s in (-1, 1):
        box(f'walkway-edge{s}', (0.008, y1 - y0, 0.018), m.ti, T(s * (wd / 2 + 0.004), (y0 + y1) / 2, gz - 0.006), bevel=0.001)
    y = y1 - 0.06; k = 0
    while y > y0:
        for s in (-1, 1):
            x = s * (wd / 2 - 0.006)
            cyl(f'rail-post{k}{s}', (x, y, gz), (x, y, gz + 0.095), 0.0028, m.ti, seg=8)
            if k % 2 == 0: ball(f'path-light{k}{s}', (s * (wd / 2 - 0.022), y, gz + 0.0015), 0.0034, m.amber_path, seg=10)
        y -= 0.12; k += 1
    for s in (-1, 1):
        x = s * (wd / 2 - 0.006)
        cyl(f'rail-top{s}', (x, y0, gz + 0.095), (x, y1 - 0.06, gz + 0.095), 0.0040, m.ti, seg=10)
        cyl(f'rail-mid{s}', (x, y0, gz + 0.05), (x, y1 - 0.06, gz + 0.05), 0.0022, m.ti, seg=8)
    for k in range(int((y1 - y0) / 0.6)):
        yy = y1 - 0.3 - 0.6 * k
        box(f'walkway-leg{k}', (wd * 0.7, 0.03, gz), m.graphite, T(0, yy, gz / 2), bevel=0.002)
    # thin inlays radiating from the dais
    for k in range(12):
        a = math.radians(15 + 30 * k)
        if abs(((math.degrees(a) - 270 + 180) % 360) - 180) < 20: continue
        p0 = V(math.cos(a), math.sin(a), 0) * 1.40; p1 = V(math.cos(a), math.sin(a), 0) * 9.0
        box(f'inlay{k}', ((p1 - p0).length, 0.006, 0.0012), m.ti, T(*((p0 + p1) / 2)) @ Rz(math.degrees(a)), bevel=0)

# ---------------------------------------------------------------- the spine, the decks, the core

def build_spine(m):
    # the bell where the last shafts meet
    prof = [(0.0, SPINE0 - 0.06), (0.36, SPINE0 - 0.06), (0.38, SPINE0 - 0.035), (0.34, SPINE0), (0.16, SPINE0 + 0.12),
            (0.12, SPINE0 + 0.20), (0.0, SPINE0 + 0.20)]
    K.lathe('spine-bell', prof, m.graphite, I4, 96, sharp=30)
    K.ring('spine-bell-ring', 0.355, 0.385, SPINE0 - 0.05, SPINE0 - 0.035, m.ti, I4, c=0.002, seg=96)
    z = SPINE0 + 0.2; k = 0
    while z < CORE_Z - 0.32:
        L = 0.30 if k % 2 == 0 else 0.10
        L = min(L, CORE_Z - 0.32 - z)
        if k % 2 == 0:
            K.lathe(f'spine{k}', [(0, z), (0.11, z), (0.115, z + 0.01), (0.115, z + L - 0.01), (0.11, z + L), (0, z + L)], m.graphite, I4, 64, sharp=30)
            K.ring(f'spine{k}-band', 0.115, 0.123, z + L * 0.45, z + L * 0.55, m.ti, I4, c=0.002, seg=64)
        else:
            K.lathe(f'spine{k}', [(0, z), (0.10, z), (0.10, z + L), (0, z + L)], m.rung, I4, 48, sharp=30)
            cyl(f'spine{k}-core', (0, 0, z - 0.01), (0, 0, z + L + 0.01), 0.028, m.core_hot, seg=16)
        z += L; k += 1
    # the core: a glass sphere with a knot of light in it
    K.lathe('core-cup', [(0, CORE_Z - 0.38), (0.13, CORE_Z - 0.38), (0.20, CORE_Z - 0.30), (0.20, CORE_Z - 0.27), (0.0, CORE_Z - 0.27)], m.ti, I4, 64, sharp=30)
    ob = S.sphere('core-glass', 0.30, m.bubble, T(0, 0, CORE_Z), seg=96)
    sm = ob.modifiers.new('solid', 'SOLIDIFY'); sm.thickness = 0.014; sm.offset = -1.0
    pts = []
    for k in range(241):
        t = TAU * k / 240; p, q = 2, 3
        r = 0.14 + 0.05 * math.cos(q * t)
        pts.append(V(r * math.cos(p * t), r * math.sin(p * t), CORE_Z + 0.05 * math.sin(q * t)))
    S.filament('core-knot', pts, 0.006, emit('core-light', VIO, 14.0), I4)
    ball('core-seed', (0, 0, CORE_Z), 0.030, m.amber, seg=24)
    glow('core-glow', (0, 0, CORE_Z), LIGHT_VIO, 40.0, size=0.1, scatter=True)
    glow('core-seed-glow', (0, 0, CORE_Z + 0.05), YEL, 6.0, size=0.03)

def build_deck(name, z, r0, r1, m, beams=8, rail=True):
    prof = [(r0, z - 0.05), (r1 - 0.01, z - 0.05), (r1, z - 0.04), (r1, z), (r0, z)]
    K.lathe(name, prof, m.deck, I4, 192, sharp=30)
    K.ring(name + '-edge', r1 - 0.002, r1 + 0.010, z - 0.05, z + 0.004, m.ti, I4, c=0.002, seg=192)
    K.ring(name + '-inner', r0 - 0.008, r0 + 0.004, z - 0.05, z + 0.004, m.ti, I4, c=0.002, seg=128)
    for k in range(beams):
        a = math.radians(22.5 + 360 * k / beams); u = V(math.cos(a), math.sin(a), 0)
        p0 = V(0, 0, z - 0.08) + u * 0.12; p1 = V(0, 0, z - 0.08) + u * (r1 - 0.12)
        box(f'{name}-beam{k}', ((p1 - p0).length, 0.035, 0.06), m.graphite, T(*((p0 + p1) / 2)) @ Rz(math.degrees(a)), bevel=0.004)
        K.lathe(f'{name}-knee{k}', [(0, 0), (0.05, 0), (0.05, 0.05), (0, 0.05)], m.ti, T(*(p1 + V(0, 0, -0.035))), 24, sharp=40)
    torus(name + '-underlight', r1 - 0.035, 0.005, m.edge_glow, T(0, 0, z - 0.054), seg=256, rseg=6)
    for k in range(12):
        a = TAU * (k + 0.5) / 12
        ball(f'{name}-nav{k}', (r1 * math.cos(a) * 1.003, r1 * math.sin(a) * 1.003, z - 0.024), 0.008, m.amber_soft, seg=10)
    if rail:
        n = int(TAU * r1 / 0.16)
        for k in range(n):
            a = TAU * k / n; p = V(math.cos(a), math.sin(a), 0) * (r1 - 0.025)
            cyl(f'{name}-post{k}', (p.x, p.y, z), (p.x, p.y, z + 0.095), 0.0035, m.ti, seg=8)
        torus(name + '-rail', r1 - 0.025, 0.0045, m.ti, T(0, 0, z + 0.095), seg=256, rseg=8)
        torus(name + '-rail-mid', r1 - 0.025, 0.0025, m.ti, T(0, 0, z + 0.05), seg=256, rseg=6)

# ---------------------------------------------------------------- 03 Development: six systems on a deck

SYS = ['logic', 'architecture', 'circuits', 'mechanics', 'intelligence', 'creativity']
SYS_ANG = [165, 207, 249, 291, 333, 375]
SYS_R = 1.86
SYS_AT = {}
SYS_SPOT = []

def pad(name, M, m, r=0.21):
    K.lathe(name, [(0, 0), (r, 0), (r, 0.016), (r - 0.01, 0.022), (0, 0.022)], m.graphite, M, 64, sharp=30)
    K.ring(name + '-edge', r - 0.002, r + 0.006, 0.0, 0.018, m.ti, M, c=0.001, seg=64)

def sys_logic(M, m, fil):
    for j in range(7):
        z = 0.07 + j * 0.044
        box(f'logic-wafer{j}', (0.30, 0.30, 0.010), m.board, M @ T(0, 0, z), bevel=0.002)
        box(f'logic-edge{j}', (0.27, 0.004, 0.004), fil if j % 2 == 0 else m.trace, M @ T(0, -0.1505, z), bevel=0)
        box(f'logic-chip{j}', (0.11, 0.11, 0.010), m.chip, M @ T(0.02 * (j % 3 - 1), 0.02 * ((j + 1) % 3 - 1), z + 0.010), bevel=0.0015)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f'logic-post{sx}{sy}', M @ V(sx * 0.14, sy * 0.14, 0.02), M @ V(sx * 0.14, sy * 0.14, 0.37), 0.008, m.ti, seg=12)
    ball('logic-led', M @ V(0.11, -0.11, 0.345), 0.009, m.amber, seg=12)

def sys_architecture(M, m, fil):
    lv = [(0.06, 0.36), (0.20, 0.29), (0.33, 0.21), (0.44, 0.13)]
    for j, (z, s) in enumerate(lv):
        for k in range(4):
            Mr = M @ Rz(90 * k) @ T(0, -s / 2, z)
            box(f'arch-beam{j}{k}', (s, 0.012, 0.012), fil if j == len(lv) - 1 else m.ti, Mr, bevel=0.001)
        if j < len(lv) - 1:
            box(f'arch-floor{j}', (s - 0.02, s - 0.02, 0.004), m.rung, M @ T(0, 0, z - 0.004), bevel=0)
            z2, s2 = lv[j + 1]
            for sx in (-1, 1):
                for sy in (-1, 1):
                    cyl(f'arch-col{j}{sx}{sy}', M @ V(sx * s / 2, sy * s / 2, z), M @ V(sx * s2 / 2, sy * s2 / 2, z2), 0.006, m.graphite, seg=10)
            cyl(f'arch-brace{j}', M @ V(-s / 2, -s / 2, z), M @ V(s2 / 2, -s2 / 2, z2), 0.004, m.ti, seg=8)
    cyl('arch-mast', M @ V(0, 0, 0.02), M @ V(0, 0, 0.50), 0.010, m.chrome, seg=12)

def sys_circuits(M, m, fil):
    K.lathe('circ-glass', [(0, 0.04), (0.075, 0.04), (0.075, 0.40), (0, 0.40)], m.rung, M, 64, sharp=30)
    for z0, z1 in ((0.02, 0.05), (0.39, 0.42)):
        K.ring(f'circ-cap{z0}', 0.0, 0.088, z0, z1, m.ti, M, c=0.003, seg=64)
    cyl('circ-core', M @ V(0, 0, 0.05), M @ V(0, 0, 0.39), 0.010, fil, seg=12)
    pts = [M @ V(0.090 * math.cos(TAU * 9 * t), 0.090 * math.sin(TAU * 9 * t), 0.07 + 0.30 * t) for t in (k / 360 for k in range(361))]
    S.filament('circ-coil', pts, 0.0055, m.ti, I4)
    for k, (x, y, h) in enumerate(((0.17, 0.02, 0.15), (0.14, -0.12, 0.11), (-0.16, -0.06, 0.13))):
        K.lathe(f'circ-can{k}', [(0, 0), (0.034, 0), (0.034, h), (0.030, h + 0.006), (0, h + 0.006)], m.graphite, M @ T(x, y, 0.02), 32, sharp=30)
        K.ring(f'circ-can{k}-top', 0.0, 0.028, h + 0.006, h + 0.010, m.ti, M @ T(x, y, 0.02), c=0.001, seg=32)

def sys_mechanics(M, m, fil):
    box('mech-plate', (0.36, 0.05, 0.40), m.graphite, M @ T(0, 0.07, 0.22), bevel=0.006)
    g1 = V(-0.07, 0.0, 0.22); g2 = g1 + V(math.cos(math.radians(28)), 0, math.sin(math.radians(28))) * (0.160 + 0.094 - 0.018)
    gear_at('mech-g1', M @ T(*g1) @ Rx(90), 0.160, 28, 0.034, m.gear)
    gear_at('mech-g2', M @ T(*g2) @ Rx(90) @ Rz(6), 0.094, 16, 0.032, m.ti)
    for k, (c, r) in enumerate(((g1, 0.030), (g2, 0.022))):
        cyl(f'mech-axle{k}', M @ (c + V(0, -0.03, 0)), M @ (c + V(0, 0.06, 0)), r * 0.6, m.chrome, seg=16)
        torus(f'mech-hubring{k}', r, 0.004, fil, M @ T(*(c + V(0, -0.019, 0))) @ Rx(90), seg=32, rseg=6)

def sys_intelligence(M, m, fil):
    box('opt-rail', (0.50, 0.03, 0.016), m.ti, M @ T(0, 0, 0.10), bevel=0.002)
    for x in (-0.20, 0.20):
        box(f'opt-foot{x}', (0.03, 0.10, 0.09), m.graphite, M @ T(x, 0, 0.046), bevel=0.004)
    for k, (x, r) in enumerate(((-0.12, 0.085), (0.0, 0.070), (0.11, 0.055))):
        Ml = M @ T(x, 0, 0.20) @ Ry(90)
        K.lens(f'opt-lens{k}', r * 0.92, 0.012, m.rung, Ml, seg=64)
        K.ring(f'opt-mount{k}', r * 0.9, r * 1.06, -0.010, 0.010, m.ti, Ml, c=0.002, seg=64)
        box(f'opt-post{k}', (0.016, 0.016, 0.20 - r - 0.11), m.graphite, M @ T(x, 0, 0.11 + (0.20 - r - 0.11) / 2), bevel=0.001)
    box('opt-source', (0.06, 0.07, 0.07), m.anod, M @ T(-0.25, 0, 0.20), bevel=0.006)
    cyl('opt-beam', M @ V(-0.22, 0, 0.20), M @ V(0.20, 0, 0.20), 0.0035, fil, seg=8)
    ball('opt-focus', M @ V(0.205, 0, 0.20), 0.011, m.amber, seg=12)

def sys_creativity(M, m, fil):
    K.lathe('crea-stand', [(0, 0), (0.07, 0), (0.07, 0.02), (0.025, 0.05), (0.025, 0.12), (0.05, 0.14), (0, 0.14)], m.ti, M, 48, sharp=30)
    R0 = 0.15; c = 0.27
    pts = [(R0 * math.sin(t), c - R0 * math.cos(t)) for t in [math.radians(a) for a in range(0, 141, 5)]]
    bowl = K.lathe('crea-bowl', [(0, c - R0)] + pts[1:], m.rung, M, 96, closed=False, sharp=90)
    sm = bowl.modifiers.new('solid', 'SOLIDIFY'); sm.thickness = 0.008; sm.offset = -1.0
    rim_r, rim_z = pts[-1]
    torus('crea-rim', rim_r, 0.004, fil, M @ T(0, 0, rim_z), seg=64, rseg=6)
    mb = bpy.data.metaballs.new('idea'); mb.resolution = 0.012; mb.render_resolution = 0.006; mb.threshold = 0.6
    mb.materials.append(m.chrome)
    ob = link(bpy.data.objects.new('idea', mb)); ob.matrix_world = M
    for co, r in (((0, 0, 0.19), 0.085), ((0.03, 0.02, 0.27), 0.060), ((-0.04, -0.01, 0.33), 0.045), ((0.05, -0.03, 0.39), 0.034),
                  ((0.0, 0.03, 0.44), 0.022)):
        e = mb.elements.new(type='BALL'); e.co = co; e.radius = r / 0.575; e.stiffness = 2.0
    ball('crea-drop', M @ V(0.08, -0.06, 0.48), 0.014, m.chrome, seg=16)
    ball('crea-drop2', M @ V(0.10, -0.08, 0.53), 0.008, m.chrome, seg=12)

SYS_BUILD = [sys_logic, sys_architecture, sys_circuits, sys_mechanics, sys_intelligence, sys_creativity]

def strand_point_near(theta_deg, z0, z1):
    """The point on either strand between heights z0 and z1 closest in angle to theta (degrees)."""
    best = None
    for f, b in ((A, False), (B, True)):
        for k in range(int(z0 / DZ * 20), int(z1 / DZ * 20)):
            i = k / 20; a = math.degrees(ang(i, b)) % 360
            dd = abs(((a - theta_deg + 180) % 360) - 180)
            if best is None or dd < best[0]: best = (dd, f(i))
    return best[1]

def build_development(m):
    build_deck('dev-deck', DEV_Z, 0.86, 2.62, m, beams=8)
    for k in range(6):
        th = SYS_ANG[k]; c = V(SYS_R * math.cos(math.radians(th)), SYS_R * math.sin(math.radians(th)), DEV_Z)
        M = frame_at(c, th)
        pad(f'sys{k}-pad', M, m)
        SYS_BUILD[k](M, m, m.sysfil[k])
        # its conduit back into the structure: glass with a filament, up and over to the nearest strand
        p0 = M @ V(0, 0.17, 0.05); p3 = strand_point_near(th, DEV_Z + 0.45, DEV_Z + 1.6)
        mid = (p0 + p3) / 2
        pts = bezier(p0, p0 + V(0, 0, 0.35), p3 + (V(c.x, c.y, 0).normalized() * 0.6) + V(0, 0, 0.05), p3, 30)
        tube(f'sys{k}-conduit', pts, [0.020] * len(pts), m.rung, res=4)
        S.filament(f'sys{k}-conduit-fil', pts, 0.006, m.sysfil[k], I4)
        SYS_AT[k] = dict(c=c, top=c + V(0, 0, 0.42), M=M)
        SYS_SPOT.append(spot(f'sys{k}-lamp', c + V(0, 0, 2.6) + V(c.x, c.y, 0).normalized() * 0.4, c + V(0, 0, 0.2), 70, (0.86, 0.80, 1.0), size=26, blend=0.7, radius=0.06))
    # links along the deck between neighbours (related systems sit side by side); the last runs round the back
    for k in range(6):
        a0, a1 = SYS_ANG[k] + 7, SYS_ANG[(k + 1) % 6] - 7 + (360 if k == 5 else 0)
        n = max(8, int((a1 - a0) / 2))
        rr = SYS_R + (0.0 if k < 5 else 0.0)
        pts = [V(rr * math.cos(math.radians(a)), rr * math.sin(math.radians(a)), DEV_Z + 0.022) for a in (a0 + (a1 - a0) * j / n for j in range(n + 1))]
        tube(f'link{k}', pts, [0.010] * len(pts), m.rung, res=3)
        S.filament(f'link{k}-fil', pts, 0.0035, m.arcfil[k], I4)

# ---------------------------------------------------------------- 04 Selected work: the workshop and four installations

WORKS = [  # key, deck angle, picture
    ('jontai', 315, os.path.join(REPO, 'src', 'assets', 'projects', 'jontai-type.webp')),
    ('lumo', 45, os.path.join(REPO, 'tools', 'lab', 'mock', 'img', 'lumo.webp')),
    ('locked', 135, None),
    ('cookies', 225, os.path.join(REPO, 'src', 'assets', 'projects', 'cookies-playing.webp')),
]
WORK_R = 1.95
WS_R = 3.25
WORK_AT = {}
WORK_SPOT = []

def screen(name, M, w, h, mat, m, depth=0.024, border=0.014, phone=False):
    """A screen in a machined frame. M: its centre, facing local -Y."""
    if phone:
        box(name + '-body', (w + 2 * border, depth, h + 2 * border), m.graphite, M @ T(0, depth / 2, 0), bevel=0.012)
    else:
        box(name + '-body', (w + 2 * border, depth, h + 2 * border), m.graphite, M @ T(0, depth / 2, 0), bevel=0.004)
        for s in (-1, 1):
            box(name + f'-lip{s}', (w + 2 * border + 0.006, depth + 0.004, 0.006), m.ti, M @ T(0, depth / 2, s * (h / 2 + border)), bevel=0.001)
    if mat is not None:
        quad(name + '-pic', w, h, mat, M @ T(0, -0.0012, 0))
    box(name + '-cover', (w + 0.004, 0.003, h + 0.004), m.pane, M @ T(0, -0.003, 0), bevel=0.0008)

def quad(name, w, h, mat, Mw):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('uv')
    vs = [bm.verts.new((x * w / 2, 0, z * h / 2)) for x, z in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = (u, v)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = Mw
    return ob

def plinth(name, M, m, w, d, focus):
    box(name, (w, d, 0.030), m.graphite, M @ T(0, 0, 0.015), bevel=0.004)
    box(name + '-top', (w - 0.03, d - 0.03, 0.004), m.anod, M @ T(0, 0, 0.031), bevel=0.001)
    box(name + '-strip', (w * 0.6, 0.004, 0.004), focus, M @ T(0, -d / 2 - 0.001, 0.020), bevel=0)

def inst_jontai(M, m, pic, focus):
    """The day machine: the site on a panel that tracks a small sun along an arc (its home page is one Aruban day)."""
    plinth('jt-plinth', M, m, 0.70, 0.36, focus)
    K.lathe('jt-slew', [(0, 0.034), (0.10, 0.034), (0.10, 0.06), (0.08, 0.07), (0, 0.07)], m.ti, M, 48, sharp=30)
    cyl('jt-post', M @ V(0, 0, 0.06), M @ V(0, 0, 0.23), 0.024, m.graphite, seg=24)
    # the yoke holds the panel at its sides, on trunnions at its pivot, never in front of it
    Myoke = M @ T(0, 0.02, 0.23)
    box('jt-yoke', (0.66, 0.04, 0.03), m.ti, Myoke, bevel=0.004)
    for s in (-1, 1):
        box(f'jt-arm{s}', (0.03, 0.04, 0.13), m.ti, Myoke @ T(s * 0.315, 0, 0.065), bevel=0.004)
    w, h = 0.52, 0.52 * 810 / 1440
    Mp = M @ T(0, -0.01, 0.335) @ Rx(-10)
    screen('jt-screen', Mp, w, h, pic, m)
    for s in (-1, 1):
        cyl(f'jt-trunnion{s}', M @ V(s * 0.272, -0.005, 0.335), M @ V(s * 0.302, 0.02, 0.335), 0.014, m.chrome, seg=16)
    # the sun's arc behind the panel, and the sun on it at mid-morning
    Ma = M @ T(0, 0.10, 0.23) @ Rx(90)
    K.arc_band('jt-arc', 0.46, 8, 172, 0.016, 0.010, m.ti, Ma, seg=120)
    for a in (8, 172):
        box(f'jt-arc-foot{a}', (0.03, 0.03, 0.23), m.graphite, M @ T(0.46 * math.cos(math.radians(a)), 0.10, 0.23 / 2 + 0.03), bevel=0.003)
    sa = math.radians(122); sp = M @ V(0.46 * math.cos(sa), 0.10, 0.23 + 0.46 * math.sin(sa))
    out = M.to_3x3() @ V(0, -1, 0)
    box('jt-carriage', (0.05, 0.03, 0.03), m.anod, T(*sp) @ M.to_3x3().to_4x4() @ Ry(-math.degrees(sa) + 90), bevel=0.004)
    ball('jt-sun', sp + out * 0.03, 0.026, m.amber, seg=32)
    glow('jt-sun-glow', sp + out * 0.07, YEL, 2.0, size=0.02)
    for k in range(13):                                   # the hours along the arc
        a = math.radians(14 + 152 * k / 12)
        ball(f'jt-hour{k}', M @ V(0.46 * math.cos(a), 0.088, 0.23 + 0.46 * math.sin(a)), 0.004, m.chrome, seg=8)
    return dict(c=M @ V(0, 0, 0.33), w=0.95, h=0.75)

def inst_lumo(M, m, pic, focus):
    """The sorter: the list held up by a robot arm over a tray of parts lined up in aisle order."""
    plinth('lm-plinth', M, m, 0.64, 0.38, focus)
    base = M @ T(0.14, 0.04, 0.034)
    K.lathe('lm-turret', [(0, 0), (0.07, 0), (0.07, 0.03), (0.055, 0.05), (0, 0.05)], m.ti, base, 48, sharp=30)
    j1 = base @ V(0, 0, 0.07)
    j2 = M @ V(0.09, 0.02, 0.30); j3 = M @ V(-0.02, 0.0, 0.38)
    for k, (p, q, r) in enumerate(((j1, j2, 0.022), (j2, j3, 0.017))):
        cyl(f'lm-link{k}', p, q, r, m.anod if k == 0 else m.graphite, seg=24, round_=0.006)
    for k, p in enumerate((j1, j2, j3)):
        ball(f'lm-joint{k}', p, 0.030 - 0.004 * k, m.chrome, seg=24)
    w, h = 0.20, 0.20 * 1050 / 540
    Mp = M @ T(-0.09, -0.05, 0.36) @ Rz(8) @ Rx(-6)
    screen('lm-phone', Mp, w, h, pic, m, depth=0.018, border=0.010, phone=True)
    for s in (-1, 1):
        box(f'lm-jaw{s}', (0.026, 0.040, 0.05), m.ti, Mp @ T(s * (w / 2 + 0.018), 0.014, -0.04), bevel=0.003)
    box('lm-wrist', (w + 0.07, 0.016, 0.02), m.graphite, Mp @ T(0, 0.028, -0.04), bevel=0.003)
    cyl('lm-wrist-pin', j3, Mp @ V(0, 0.03, -0.04), 0.010, m.chrome, seg=12)
    # the tray: eight parts in a row, sorted
    box('lm-tray', (0.30, 0.07, 0.016), m.ti, M @ T(0.10, -0.12, 0.042), bevel=0.003)
    for k in range(8):
        hgt = 0.012 + 0.006 * k
        box(f'lm-part{k}', (0.026, 0.044, hgt), m.chrome if k % 3 else m.anod, M @ T(-0.03 + 0.036 * k, -0.12, 0.050 + hgt / 2), bevel=0.003)
    ball('lm-led', M @ V(0.24, -0.12, 0.06), 0.006, m.amber, seg=10)
    return dict(c=M @ V(-0.04, 0, 0.33), w=0.70, h=0.75)

def inst_locked(M, m, pic, focus):
    """The progression rack: the log mounted on a bar loaded with plates, each larger than the last, and a streak."""
    plinth('lk-plinth', M, m, 0.70, 0.34, focus)
    for s in (-1, 1):
        box(f'lk-upright{s}', (0.034, 0.05, 0.56), m.graphite, M @ T(s * 0.30, 0.06, 0.31), bevel=0.005)
        for k in range(9):
            box(f'lk-hole{s}{k}', (0.010, 0.002, 0.010), m.chrome, M @ T(s * 0.30, 0.034, 0.12 + 0.045 * k), bevel=0)
    bar_z = 0.28
    cyl('lk-bar', M @ V(-0.36, -0.01, bar_z), M @ V(0.36, -0.01, bar_z), 0.012, m.chrome, seg=20)
    for s in (-1, 1):
        box(f'lk-hook{s}', (0.04, 0.05, 0.03), m.ti, M @ T(s * 0.30, 0.02, bar_z - 0.02), bevel=0.003)
    for k, (r, t) in enumerate(((0.050, 0.016), (0.070, 0.018), (0.090, 0.020), (0.112, 0.022))):
        x = 0.18 + 0.026 * k                         # on the open side of the frame, so the plates are seen
        Mp = M @ T(x, -0.01, bar_z) @ Ry(90)
        K.lathe(f'lk-plate{k}', [(0.014, -t / 2), (r - 0.004, -t / 2), (r, -t / 2 + 0.004), (r, t / 2 - 0.004), (r - 0.004, t / 2), (0.014, t / 2)],
                m.graphite if k % 2 == 0 else m.anod, Mp, 64, sharp=25)
        K.ring(f'lk-plate{k}-hub', 0.012, 0.022, -t / 2 - 0.002, t / 2 + 0.002, m.ti, Mp, c=0.001, seg=32)
    K.ring('lk-collar', 0.012, 0.024, -0.012, 0.012, m.chrome, M @ T(0.08, -0.01, bar_z) @ Ry(90), c=0.002, seg=32)
    # the phone on its carriage, left of centre
    w, h = 0.19, 0.19 * 1050 / 540
    Mp = M @ T(-0.10, -0.05, 0.34) @ Rx(-4)
    screen('lk-phone', Mp, w, h, pic, m, depth=0.018, border=0.010, phone=True)
    box('lk-carriage', (0.07, 0.03, 0.06), m.ti, M @ T(-0.10, -0.02, bar_z), bevel=0.004)
    if pic is None:                                       # no screens yet: the name and a plain line, nothing made up
        Ms = Mp @ T(0, -0.0035, 0)
        quad('lk-screen', w, h, m.screen_dark, Ms)
        F_ = bpy.data.fonts.load(F.FONT, check_existing=True)
        t = K.text('lk-name', 'Locked', 0.034, m.ink, Ms @ T(0, -0.001, 0.02) @ Rx(90), F_)
        t2 = K.text('lk-soon', 'screens to come', 0.012, m.ink_dim, Ms @ T(0, -0.001, -0.03) @ Rx(90), F_)
    # the streak: seven small lights up the left upright, five lit
    for k in range(7):
        ball(f'lk-streak{k}', M @ V(-0.30, 0.031, 0.14 + 0.05 * k), 0.006, m.amber if k < 5 else m.chrome, seg=10)
    return dict(c=M @ V(0.0, 0, 0.33), w=0.82, h=0.75)

def inst_cookies(M, m, pic, focus):
    """The loop press: one press, a counter and a belt that never stops (click, earn, reinvest)."""
    plinth('ck-plinth', M, m, 0.74, 0.36, focus)
    w, h = 0.44, 0.44 * 900 / 1440
    for s in (-1, 1):
        box(f'ck-post{s}', (0.03, 0.04, 0.50), m.graphite, M @ T(-0.06 + s * (w / 2 + 0.035), 0.03, 0.28), bevel=0.004)
    box('ck-beam', (w + 0.10, 0.04, 0.03), m.ti, M @ T(-0.06, 0.03, 0.53), bevel=0.004)
    Mp = M @ T(-0.06, 0.0, 0.33)
    screen('ck-screen', Mp, w, h, pic, m)
    # the press on the right
    px = 0.27
    box('ck-press-col', (0.05, 0.05, 0.50), m.graphite, M @ T(px, 0.05, 0.28), bevel=0.005)
    box('ck-press-arm', (0.12, 0.05, 0.04), m.ti, M @ T(px - 0.02, 0.0, 0.50), bevel=0.004)
    cyl('ck-plunger', M @ V(px - 0.04, -0.02, 0.48), M @ V(px - 0.04, -0.02, 0.30), 0.020, m.chrome, seg=24)
    cyl('ck-plunger-body', M @ V(px - 0.04, -0.02, 0.48), M @ V(px - 0.04, -0.02, 0.40), 0.032, m.anod, seg=32, round_=0.006)
    K.lathe('ck-button', [(0, 0), (0.060, 0), (0.060, 0.020), (0.050, 0.030), (0, 0.030)], m.ti, M @ T(px - 0.04, -0.02, 0.034), 64, sharp=30)
    K.lathe('ck-button-top', [(0, 0.030), (0.046, 0.030), (0.046, 0.044), (0.040, 0.050), (0, 0.050)], m.anod, M @ T(px - 0.04, -0.02, 0.034), 64, sharp=30)
    torus('ck-button-led', 0.052, 0.003, m.amber, M @ T(px - 0.04, -0.02, 0.0575), seg=48, rseg=6)
    # the counter: five drums
    for k in range(5):
        Md = M @ T(px - 0.10 + 0.024 * k, -0.04, 0.18) @ Ry(90)
        K.lathe(f'ck-drum{k}', [(0.0, -0.009), (0.022, -0.009), (0.022, 0.009), (0.0, 0.009)], m.chrome if k != 3 else m.anod, Md, 32, sharp=40)
    box('ck-counter-case', (0.15, 0.03, 0.06), m.graphite, M @ T(px - 0.052, -0.02, 0.18), bevel=0.004)
    # the belt loop under the screen, round two pulleys
    yb, zb, xa, xb, rp = -0.04, 0.085, -0.25, 0.13, 0.034
    for k, x in enumerate((xa, xb)):
        K.lathe(f'ck-pulley{k}', [(0.0, -0.014), (rp, -0.014), (rp, 0.014), (0.0, 0.014)], m.ti, M @ T(x, yb, zb) @ Rx(90), 48, sharp=40)
    pts = []
    for k in range(61):
        t = k / 60
        if t < 0.25:   p = V(lerp(xa, xb, t / 0.25), yb, zb + rp + 0.004)
        elif t < 0.5:  a = math.pi / 2 - math.pi * (t - 0.25) / 0.25; p = V(xb + (rp + 0.004) * math.cos(a), yb, zb + (rp + 0.004) * math.sin(a))
        elif t < 0.75: p = V(lerp(xb, xa, (t - 0.5) / 0.25), yb, zb - rp - 0.004)
        else:          a = -math.pi / 2 - math.pi * (t - 0.75) / 0.25; p = V(xa + (rp + 0.004) * math.cos(a), yb, zb + (rp + 0.004) * math.sin(a))
        pts.append(M @ p)
    tube('ck-belt', pts, [0.005] * len(pts), m.graphite, res=3)
    S.filament('ck-belt-glow', [p + (M.to_3x3() @ V(0, -0.006, 0)) for p in pts[2:14]], 0.0018, m.amber_soft, I4)
    return dict(c=M @ V(0.0, 0, 0.33), w=0.88, h=0.70)

INST = {'jontai': inst_jontai, 'lumo': inst_lumo, 'locked': inst_locked, 'cookies': inst_cookies}

def build_workshop(m):
    build_deck('ws-deck', WS_Z, 0.86, WS_R, m, beams=10)
    # the gantry: a ring rail over the installations, hung from the spine
    gz = WS_Z + 1.05
    K.ring('ws-gantry', WORK_R - 0.05, WORK_R + 0.05, gz, gz + 0.045, m.ti, I4, c=0.004, seg=256)
    for k in range(4):
        a = math.radians(90 * k); u = V(math.cos(a), math.sin(a), 0)
        cyl(f'ws-hanger{k}', V(0, 0, gz + 0.70) + u * 0.12, V(0, 0, gz + 0.045) + u * WORK_R, 0.014, m.graphite, seg=16)
    K.ring('ws-hanger-collar', 0.115, 0.15, gz + 0.62, gz + 0.74, m.ti, I4, c=0.004, seg=64)
    for k, (key, th, path) in enumerate(WORKS):
        c = V(WORK_R * math.cos(math.radians(th)), WORK_R * math.sin(math.radians(th)), WS_Z)
        M = frame_at(c, th)
        pic = picture(f'pic-{key}', path, strength=1.15) if path else None
        info = INST[key](M, m, pic, m.focus[k])
        # the lamp over it, on the gantry
        lamp = c + V(0, 0, 1.0)
        K.lathe(f'{key}-lamp', [(0, 0.0), (0.05, 0.0), (0.06, 0.07), (0.03, 0.10), (0, 0.10)], m.graphite, T(*lamp), 32, sharp=30)
        cyl(f'{key}-lamp-rod', lamp + V(0, 0, 0.10), V(c.x, c.y, gz), 0.006, m.ti, seg=8)
        WORK_SPOT.append(spot(f'{key}-spot', lamp - V(0, 0, 0.01) - V(c.x, c.y, 0).normalized() * 0.05, c + V(0, 0, 0.25), 18, (0.92, 0.88, 1.0), size=44, blend=0.75, radius=0.04))
        WORK_AT[key] = dict(c=info['c'], w=info['w'], h=info['h'], M=M, ang=th, base=c)
    # workshop fill: soft light from above, kept out of the haze
    a = K.area('ws-fill', (0, 0, WS_Z + 3.2), (0, 0, WS_Z), 5.0, ENV('R71_FILL', 480), (0.80, 0.74, 1.0)); a.visible_volume_scatter = False; a.visible_glossy = False

# ---------------------------------------------------------------- 06 Connection: the strands thin into a network

NET = []
def build_network(m):
    rs = random.Random(616)
    tip_a, tip_b = A(I_TOP), B(I_TOP)
    pts = [tip_a, tip_b]
    for k in range(15):
        z = CORE_Z + 0.55 + 0.17 * k + rs.uniform(-0.1, 0.1)
        a = rs.uniform(0, TAU); rad = rs.uniform(0.25, 0.45 + 0.06 * k)
        pts.append(V(rad * math.cos(a), rad * math.sin(a), z))
    keys = {5: V(-0.85, -0.55, CORE_Z + 1.25), 10: V(0.75, -0.65, CORE_Z + 2.0), 15: V(-0.30, -0.70, CORE_Z + 2.75)}
    for k, p in keys.items(): pts[k] = p
    for k, p in enumerate(pts[2:], start=2):
        if k in keys:
            ob = S.sphere(f'net-node{k}', 0.16, m.bubble, T(*p), seg=64)
            sm = ob.modifiers.new('solid', 'SOLIDIFY'); sm.thickness = 0.012; sm.offset = -1.0
            ball(f'net-node{k}-seed', p, 0.022, m.amber_soft if k == 10 else m.core, seg=16)
        else:
            ball(f'net-node{k}', p, rs.choice((0.026, 0.034, 0.042)), rs.choice((m.chrome, m.chrome, m.graphite)), seg=24)
    ball('net-spark', pts[10] + V(0.0, -0.24, 0.10), 0.022, m.amber, seg=16)
    glow('net-spark-glow', pts[10] + V(0.0, -0.32, 0.14), YEL, 1.8)
    done = set()
    for k, p in enumerate(pts):
        near = sorted(range(len(pts)), key=lambda j: (pts[j] - p).length)[1:3]
        for j in near:
            e = (min(k, j), max(k, j))
            if e in done: continue
            done.add(e); d = (pts[j] - p).normalized()
            mat = m.core if (k in keys or j in keys) else m.ti
            cyl(f'net-edge{e[0]}-{e[1]}', p + d * (0.17 if k in keys else 0.02), pts[j] - d * (0.17 if j in keys else 0.02), 0.0045, mat, seg=8)
    NET.extend(keys.values())

# ---------------------------------------------------------------- floating motes and the far light

def build_conduits(m):
    """Glass conduits with light in them, on the far side: dais to the systems' deck, that deck to the workshop."""
    runs = [(50, 1.15, 0.05, 2.30, DEV_Z - 0.055), (128, 1.15, 0.05, 2.25, DEV_Z - 0.055),
            (70, 2.35, DEV_Z, 2.45, WS_Z - 0.055), (112, 2.35, DEV_Z, 2.40, WS_Z - 0.055), (160, 2.3, DEV_Z, 2.5, WS_Z - 0.055)]
    for k, (deg, r0, z0, r1, z1) in enumerate(runs):
        a = math.radians(deg); u = V(math.cos(a), math.sin(a), 0); h = z1 - z0
        p0 = u * r0 + V(0, 0, z0); p3 = u * r1 + V(0, 0, z1)
        pts = bezier(p0, p0 + V(0, 0, h * 0.45) + u * 0.6, p3 - V(0, 0, h * 0.45) + u * 0.5, p3, 60)
        tube(f'conduit{k}', pts, [0.034] * len(pts), m.rung, res=4)
        S.filament(f'conduit{k}-fil', pts, 0.008, m.core_hot, I4)
        for e, p in (('a', p0), ('b', p3)):
            K.ring(f'conduit{k}-{e}', 0.034, 0.05, -0.03, 0.03, m.ti, T(*p), c=0.003, seg=32)

def build_dust(m):
    rs = random.Random(11)
    base = {}
    for key, mat in (('glass', m.rung), ('chrome', m.chrome), ('amber', m.amber_soft), ('dark', m.graphite)):
        ob = S.sphere(f'dust-{key}', 1.0, mat, T(0, 0, -200), seg=12); ob.hide_render = True; base[key] = ob.data
    n = 0
    def put(key, p, r):
        nonlocal n
        ob = link(bpy.data.objects.new(f'dust{n}', base[key])); n += 1
        ob.matrix_world = T(*p) @ Matrix.Scale(r, 4)
    for _ in range(420):
        z = rs.uniform(0.2, 20.0); rad = rs.uniform(0.9, 7.0); a = rs.uniform(0, TAU)
        if abs(((math.degrees(a) - 270 + 180) % 360) - 180) < 12 and rad < 6: continue      # keep the walkway's air clear
        put(rs.choice(('glass', 'glass', 'chrome', 'dark')), (rad * math.cos(a), rad * math.sin(a), z), rs.choice((0.006, 0.008, 0.011, 0.015, 0.02)))
    for _ in range(30):
        z = rs.uniform(0.3, 18.0); rad = rs.uniform(0.9, 4.0); a = rs.uniform(0, TAU)
        put('amber', (rad * math.cos(a), rad * math.sin(a), z), rs.choice((0.005, 0.007, 0.009)))

def build_lights(m):
    """Fixed lights for one big hall: a violet beam down the structure that lights the haze, a violet wash behind,
    a cool key and rims that the haze never sees, and soft panels for the glass to reflect."""
    L = {}
    L['beam'] = spot('sky-beam', (3.0, 7.0, 46.0), (0, 0, 7.0), ENV('R71_BEAM', 110000), LIGHT_VIO, size=13, blend=0.9, radius=2.0)
    L['wash'] = K.area('back-wash', (0, 70, 2.5), (0, 0, 4), 40.0, ENV('R71_WASH', 9000), LIGHT_VIO, size_y=5.0)
    L['wash'].visible_volume_scatter = True; L['wash'].visible_glossy = False; L['wash'].visible_diffuse = False
    for name, loc, tgt, size, watts, col, sy in (('key', (-16, -18, 22), (0, 0, 5), 10.0, 20000, (0.86, 0.80, 1.0), 6.0),
                                                ('rim-r', (14, 16, 14), (0, 0, 7), 6.0, 22000, LIGHT_VIO, 20.0),
                                                ('rim-l', (-15, 12, 6), (0, 0, 5), 6.0, 16000, LIGHT_VIO, 18.0),
                                                ('low', (6, -14, 1.0), (0, 0, 1.5), 8.0, 9000, (0.80, 0.74, 1.0), 2.0)):
        ob = K.area(name, loc, tgt, size, watts * ENV('R71_KEY', 1.0), col, size_y=sy); ob.visible_volume_scatter = False
        ob.visible_glossy = False                      # the floor and the glass reflect the soft panels, never a hard lamp
        L[name] = ob
    for name, loc, tgt, w, h, s, col in (('panel-l', (-6, -6, 9), (0, 0, 6), 5.0, 18.0, 6.0, (0.90, 0.86, 1.0)),
                                         ('panel-r', (7, -4, 11), (0, 0, 7), 3.0, 16.0, 4.0, (0.66, 0.52, 1.0)),
                                         ('panel-top', (0, -3, 26), (0, 0, 10), 10.0, 6.0, 3.0, (0.80, 0.74, 1.0))):
        L[name] = S.softpanel(name, loc, tgt, w, h, s, col)
    return L

# ---------------------------------------------------------------- the journey

def ring_pos(r, deg, z): a = math.radians(deg); return V(r * math.cos(a), r * math.sin(a), z)

def work_stop(key):
    w = WORK_AT[key]; th = w['ang']
    pos = ring_pos(WS_R - 0.32, th - 5, WS_Z + 0.30)
    tgt = w['c'] + (w['M'].to_3x3() @ V(0.04, 0, -0.04))
    return dict(name=f'w-{key}', pos=pos, tgt=tgt, lens=24, shift=-0.17)

def stops():
    st = [
        dict(name='hero', pos=V(0.03, -2.70, 0.20), tgt=V(0.0, 0.0, 1.25), lens=15, shift=0.0),
        dict(name='origin', pos=V(0.02, -1.55, 0.20), tgt=V(0.0, 0.0, 1.65), lens=16, shift=-0.15),
        dict(name='foundation', pos=V(0.0, 0.0, 2.53), tgt=V(0.0, 0.10, 9.0), lens=24, shift=0.0),
        dict(name='development', pos=V(0.20, -3.15, 12.75), tgt=V(0.0, 0.2, 11.85), lens=20, shift=0.0),
        dict(name='works', pos=V(0.4, -3.6, 15.05), tgt=V(0.0, 0.0, 15.0), lens=18, shift=0.0),
    ]
    st += [work_stop(k) for k, _, _ in WORKS]
    st += [
        dict(name='identity', pos=V(-6.15, -9.12, 2.5), tgt=V(0, 0, 9.5), lens=14, shift=-0.10),
        dict(name='connection', pos=V(-1.95, -3.38, 17.9), tgt=V(0.0, 0.0, 18.3), lens=22, shift=-0.12),
    ]
    return st

def vias():
    """Extra points each move passes through: (pos, tgt). Keyed by the stop the move starts from."""
    return {
        'hero': [],
        'origin': [(V(0.0, -0.62, 0.21), V(0, 0.8, 1.3)), (V(0.0, -0.06, 0.55), V(0, 0.3, 4.0)), (V(0.0, 0.0, 1.6), V(0, 0.12, 7.0))],
        'foundation': [(V(0.0, 0.0, 7.6), V(0.0, 0.12, 12.0)), (V(0.0, 0.0, 10.95), V(0.0, 3.0, 11.6)),
                       (V(0.0, -1.3, 11.24), V(0.0, 1.5, 11.5)), (V(0.05, -2.9, 11.28), V(0.0, 0.6, 11.55)), (V(0.12, -3.3, 11.95), V(0, 0.3, 11.8))],
        'development': [(V(0.12, -4.1, 14.2), V(0, 0.1, 13.9))],
        'works': [(ring_pos(3.15, 300, 15.05), ring_pos(1.3, 305, 14.95))],
        'w-jontai': [(ring_pos(WS_R - 0.22, 0, WS_Z + 0.24), ring_pos(1.4, 10, WS_Z + 0.3))],
        'w-lumo': [(ring_pos(WS_R - 0.22, 90, WS_Z + 0.24), ring_pos(1.4, 100, WS_Z + 0.3))],
        'w-locked': [(ring_pos(WS_R - 0.22, 180, WS_Z + 0.24), ring_pos(1.4, 190, WS_Z + 0.3))],
        'w-cookies': [(ring_pos(WS_R + 0.5, 222, WS_Z + 0.5), ring_pos(0.0, 0, WS_Z + 0.2)), (ring_pos(8.0, 230, 10.5), V(0, 0, 9.5))],
        'identity': [(ring_pos(9.5, 238, 15.4), V(0, 0, 16.4))],
    }

MOVES = {'hero': 14, 'origin': 28, 'foundation': 36, 'development': 18, 'works': 16, 'w-jontai': 18, 'w-lumo': 18,
         'w-locked': 18, 'w-cookies': 30, 'identity': 26}

def catmull(P, t):
    """Centripetal-ish Catmull-Rom through P (list of Vectors), t in 0..1 spread evenly over the segments."""
    n = len(P) - 1
    if n == 0: return P[0].copy()
    x = clamp(t) * n; i = min(int(x), n - 1); u = x - i
    p0 = P[i - 1] if i > 0 else P[0] * 2 - P[1]
    p1, p2 = P[i], P[i + 1]
    p3 = P[i + 2] if i + 2 <= n else P[n] * 2 - P[n - 1]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)

def pose(cam, a, b, t, via):
    e = ease(t)
    P = [a['pos']] + [v[0] for v in via] + [b['pos']]
    Q = [a['tgt']] + [v[1] for v in via] + [b['tgt']]
    loc = catmull(P, e); tgt = catmull(Q, e)
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cd = cam.data
    cd.lens = lerp(a['lens'], b['lens'], e); cd.shift_x = lerp(a.get('shift', 0.0), b.get('shift', 0.0), e)
    cd.dof.use_dof = False
    return loc

# ---------------------------------------------------------------- main

def main():
    os.makedirs(OUT, exist_ok=True)
    s = K.fresh()
    s.cycles.volume_bounces = 0; s.cycles.transmission_bounces = 12; s.cycles.max_bounces = 14
    try: s.render.use_persistent_data = True
    except Exception: pass
    m = Mats(); _MG.append(m.ghost)
    S.HAZE = ENV('R71_HAZE', 0.030)
    S.world(m)
    w = s.world.node_tree
    w.nodes['Background'].inputs['Color'].default_value = (*S.mul(srgb('#100B19'), 0.5), 1)
    vol = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.66, 0.52, 1.0, 1); vol.inputs['Anisotropy'].default_value = 0.35
    L = build_lights(m)
    before = set(bpy.data.objects)
    build_ground(m)
    ground = set(bpy.data.objects) - before
    build_helix(m); build_spine(m); build_development(m); build_workshop(m); build_network(m); build_dust(m)
    # metaballs to meshes (they do not parent or instance cleanly)
    for ob in [o for o in bpy.data.objects if o.type == 'META']:
        mb = ob.data; mb.resolution = mb.render_resolution
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); me.materials.clear(); me.materials.append(m.chrome)
        for p in me.polygons: p.use_smooth = True
        nb = link(bpy.data.objects.new(ob.name + '-mesh', me)); nb.matrix_world = ob.matrix_world.copy()
        bpy.data.objects.remove(ob)
        sm = nb.modifiers.new('relax', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 5
    root = link(bpy.data.objects.new('machine', None))
    for ob in set(bpy.data.objects) - before - ground:
        if ob is not root and ob.parent is None: ob.parent = root
    def turn(deg): root.matrix_world = Rz(deg)

    W0 = {k: (ob.data.energy if hasattr(ob, 'data') and hasattr(ob.data, 'energy') else None) for k, ob in L.items()}
    def quiet(q):
        """The machine goes quiet as the camera nears its core: the hall's lights fall, the core stays."""
        for k, ob in L.items():
            if W0[k] is not None: ob.data.energy = W0[k] * (1 - 0.55 * q)
    def focus(cam_loc):
        for k, (key, _, _) in enumerate(WORKS):
            d = (cam_loc - WORK_AT[key]['c']).length
            a = clamp(1 - (d - 1.0) / 1.0)
            m.focus[k].node_tree.nodes['Emission'].inputs['Strength'].default_value = 9.0 * a
            WORK_SPOT[k].data.energy = 34 + 46 * a

    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    cam = S.cam('journey', loc=(0, -10, 1), target=(0, 0, 1), lens=24)
    cam.data.clip_start = 0.004; cam.data.clip_end = 400
    s.camera = cam
    st = stops(); VI = vias()
    byname = {k['name']: k for k in st}

    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)

    def at_stop(k):
        loc = pose(cam, k, k, 0.0, []); focus(loc); quiet(1.0 if k['name'] == 'connection' else 0.0)

    def screen_xy(p):
        bpy.context.view_layer.update()
        v = world_to_camera_view(s, cam, Vector(p)); return [round(v.x, 4), round(1 - v.y, 4)]

    def layout():
        out = {}
        at_stop(byname['development'])
        out['systems'] = [dict(name=SYS[k], top=screen_xy(SYS_AT[k]['top']), base=screen_xy(SYS_AT[k]['c'])) for k in range(6)]
        at_stop(byname['works'])
        out['works'] = {key: dict(c=screen_xy(WORK_AT[key]['c']), top=screen_xy(WORK_AT[key]['c'] + V(0, 0, 0.42))) for key, _, _ in WORKS}
        out['installations'] = {}
        for key, _, _ in WORKS:
            at_stop(byname[f'w-{key}'])
            wa = WORK_AT[key]; Mr = wa['M'].to_3x3()
            hw, hh = wa['w'] / 2, wa['h'] / 2
            pts = [screen_xy(wa['c'] + Mr @ V(sx * hw, 0, sz * hh)) for sx in (-1, 1) for sz in (-1, 1)]
            out['installations'][key] = dict(c=screen_xy(wa['c']), x0=min(p[0] for p in pts), x1=max(p[0] for p in pts),
                                             y0=min(p[1] for p in pts), y1=max(p[1] for p in pts))
        at_stop(byname['connection'])
        out['net'] = [screen_xy(p) for p in NET]
        with open(os.path.join(OUT, 'layout.json'), 'w') as fh: json.dump(out, fh, indent=1)
        print('layout', json.dumps(out), flush=True)

    order = [k['name'] for k in st]
    job, _, arg = JOB.partition(':')
    if job == 'layout':
        layout(); return
    if job == 'try':
        for k in json.load(open(arg)):
            k = dict(k, pos=V(*k['pos']), tgt=V(*k['tgt']))
            turn(0); at_stop(k); shoot(os.path.join(OUT, f'try-{k["name"]}.jpg'))
        return
    if job == 'keys':
        only = arg.split(',') if arg else None
        for i, k in enumerate(st):
            if only and k['name'] not in only: continue
            turn(0); at_stop(k); shoot(os.path.join(OUT, f'k{i:02d}-{k["name"]}.jpg'))
        if not only: layout()
        return
    if job == 'mids':
        only = arg.split(',') if arg else None
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            if only and a['name'] not in only: continue
            for t in (0.25, 0.5, 0.75):
                loc = pose(cam, a, b, t, VI[a['name']]); focus(loc); quiet(t if b['name'] == 'connection' else 0.0)
                shoot(os.path.join(OUT, f'mid{i:02d}-{a["name"]}-{int(t * 100)}.jpg'))
        return
    if job == 'spin':
        N, RANGE = 21, 9.0
        os.makedirs(os.path.join(OUT, 'spin'), exist_ok=True)
        at_stop(st[0])
        for i in range(N):
            turn(RANGE * (2 * i / (N - 1) - 1)); shoot(os.path.join(OUT, 'spin', f's{i:02d}.jpg'))
        turn(0)
        with open(os.path.join(OUT, 'spin', 'spin.json'), 'w') as fh: json.dump({'count': N, 'range': RANGE}, fh)
        return
    if job == 'hover':
        os.makedirs(os.path.join(OUT, 'hover'), exist_ok=True)
        at_stop(byname['development'])
        for k in range(6):
            lit = [m.sysfil[k], m.arcfil[k], m.arcfil[(k - 1) % 6]]
            for mt in lit:
                e = mt.node_tree.nodes['Emission']; e.inputs['Color'].default_value = (*YEL, 1); e.inputs['Strength'].default_value = 16.0
            SYS_SPOT[k].data.energy = 190; SYS_SPOT[k].data.color = (1.0, 0.92, 0.74)
            shoot(os.path.join(OUT, 'hover', f'h{k}.jpg'))
            for mt in lit:
                e = mt.node_tree.nodes['Emission']; e.inputs['Color'].default_value = (*VIO, 1)
            m.sysfil[k].node_tree.nodes['Emission'].inputs['Strength'].default_value = 4.0
            for mt in (m.arcfil[k], m.arcfil[(k - 1) % 6]): mt.node_tree.nodes['Emission'].inputs['Strength'].default_value = 2.0
            SYS_SPOT[k].data.energy = 70; SYS_SPOT[k].data.color = (0.86, 0.80, 1.0)
        return
    if job == 'phone':
        s.render.resolution_x, s.render.resolution_y = F.PW, F.PH
        hp = dict(name='phone', pos=V(0.22, -5.6, 0.15), tgt=V(0, 0, 2.2), lens=24, shift=0.0)
        at_stop(hp); shoot(os.path.join(OUT, 'phone-hero.jpg')); return
    if job == 'seq':
        os.makedirs(os.path.join(OUT, 'seq'), exist_ok=True)
        lo, _, hi = arg.partition('-')
        lo = int(lo) if lo else 0; hi = int(hi) if hi else 10 ** 6
        f = 0; at = [0]; turn(0)
        frames = [(st[0], st[0], 0.0, [])]
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            for j in range(1, MOVES[a['name']] + 1):
                frames.append((a, b, j / MOVES[a['name']], VI[a['name']]))
            at.append(len(frames) - 1)
        with open(os.path.join(OUT, 'seq', 'frames.json'), 'w') as fh:
            json.dump({'count': len(frames), 'stops': {k['name']: a for k, a in zip(st, at)}}, fh)
        for f, (a, b, t, via) in enumerate(frames):
            if not (lo <= f <= hi): continue
            path = os.path.join(OUT, 'seq', f'f{f:03d}.jpg')
            if os.path.exists(path) and os.environ.get('R71_SKIP', '1') == '1': continue
            loc = pose(cam, a, b, t, via); focus(loc)
            quiet(ease(t) if b['name'] == 'connection' else (1.0 if a['name'] == 'connection' else 0.0))
            shoot(path)
        print('frames', len(frames), at, flush=True)

if __name__ == '__main__':
    main()
