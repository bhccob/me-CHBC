# LAB ONLY (throwaway). Round 67: Bob's "Experimental Universe" brief (2026-11-13): the central 3D identity object.
# One floating sculpture in a dark violet haze:
#   shell   a smoked-violet glass egg cut open by one spiral slot (the experiment: opened up, never finished);
#           a titanium rail rides the slot's trailing edge on clamps, a violet filament lights its leading edge
#   spine   a machined titanium axle through both poles: violet anodised collars, a tripod of struts, a ball
#           bearing, a knurled grip, an amber-lit cap on top, a turned foot and a needle below
#   core    liquid chrome poured round the axle, a gear half swallowed by it
#   stream  the liquid leaves through the slot, wraps over the back, swells, beads and breaks into drops
#   trail   the drops turn into what the experiment threw off: shell shards and machined parts, round the left
# (A yoke and a full chrome ring were tried first and dropped: together they read as a gyroscope / an orbit.)
# Amber only in three small lights. No text, no logos, no planet, atom or orb.
#   blender -b --factory-startup --python tools/lab/blender/sculpture67.py -- <out-dir> [hero,three,macro] [samples] [res%]
# Blender is Z up; the camera looks along +Y. Saves <out-dir>/sculpture67.blend next to the stills.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import instrument64 as K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
ONLY = argv[1].split(',') if len(argv) > 1 and argv[1] else None

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

NEAR, DPUR, VIOLET, YEL = srgb('#09080D'), srgb('#191322'), srgb('#8155D9'), srgb('#EBCB51')
def mul(c, k): return tuple(x * k for x in c)
# Light colour: a touch redder than #8155D9 itself, because AgX pulls saturated violet light toward indigo.
LIGHT_VIO = (0.44, 0.13, 1.0)

# The sculpture's own frame: the axle is local Z, leaning right and a little away.
M0 = Ry(16) @ Rx(-6)
HAZE = float(os.environ.get('R67_HAZE', 0.012))      # world haze density
HALO = float(os.environ.get('R67_HALO', 15000))      # watts in the violet beam behind the sculpture
PANEL = float(os.environ.get('R67_PANEL', 8.0))      # strength of the soft reflection panels

# ---------------------------------------------------------------- materials

def noise_rough(nt, b, lo, hi, scale=4.0):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6.0
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.35; mr.inputs['From Max'].default_value = 0.68
    mr.inputs['To Min'].default_value = lo; mr.inputs['To Max'].default_value = hi
    nt.links.new(n.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], b.inputs['Roughness'])

def fine_bump(nt, b, scale=70.0, strength=0.02):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 3.0
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(n.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])

def smoked_glass(name, density=10.0, absorb=(0.40, 0.24, 0.80)):
    """Thick smoked glass: real refraction, the smoke is an absorbing volume, so long paths (the cut edges) go deep violet."""
    m = principled(name, (0.88, 0.82, 1.0), 0.0, 0.02, spec=0.5)
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    setin(b, 'Transmission Weight', 1.0); setin(b, 'IOR', 1.46)
    noise_rough(nt, b, 0.003, 0.022, 3.2)       # faint smudges; rougher read as smoke behind the glass
    fine_bump(nt, b, 55.0, 0.012)
    v = nt.nodes.new('ShaderNodeVolumeAbsorption')
    v.inputs['Color'].default_value = (*absorb, 1); v.inputs['Density'].default_value = density
    nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    return m

class Mats:
    def __init__(self):
        self.chrome = principled('liquid-chrome', (0.96, 0.96, 0.98), 1.0, 0.03)
        nt = self.chrome.node_tree; noise_rough(nt, nt.nodes['Principled BSDF'], 0.018, 0.07, 6.0)
        self.ti = principled('titanium', (0.56, 0.56, 0.60), 1.0, 0.24, aniso=0.55)
        self.graphite = principled('graphite', (0.045, 0.045, 0.052), 0.85, 0.36, coat=0.15)
        nt = self.graphite.node_tree; noise_rough(nt, nt.nodes['Principled BSDF'], 0.32, 0.40, 9.0)
        self.gear = principled('gear-steel', (0.07, 0.07, 0.08), 1.0, 0.30, aniso=0.6)   # turned, brushed round its axis
        self.anod = principled('violet-anodised', (0.075, 0.040, 0.16), 1.0, 0.30, aniso=0.3)
        self.rail = principled('rail-titanium', (0.60, 0.60, 0.64), 1.0, 0.18)
        self.glass = smoked_glass('smoked-violet-glass')
        self.violet = emit('violet-light', mul(VIOLET, 1.0), 9.0)
        self.violet_soft = emit('violet-filament', mul(VIOLET, 1.0), 5.0)
        self.amber = emit('amber-light', YEL, 16.0)

# ---------------------------------------------------------------- geometry helpers

def torus(name, R, r, mat, M, seg=256, rseg=20):
    pts = [(R + r * math.cos(TAU * k / rseg), r * math.sin(TAU * k / rseg)) for k in range(rseg)]
    return K.lathe(name, pts, mat, M, seg, closed=True, sharp=90)

def sphere(name, r, mat, M, seg=64):
    pts = [(r * math.sin(math.pi * i / 32), -r * math.cos(math.pi * i / 32)) for i in range(33)]
    pts[0] = (0, -r); pts[-1] = (0, r)
    return K.lathe(name, pts, mat, M, seg, closed=False, sharp=90)

def shell_mods(ob, thick, bevel):
    s = ob.modifiers.new('solid', 'SOLIDIFY'); s.thickness = thick; s.offset = -1.0
    s.use_even_offset = True; s.use_quality_normals = True
    b = ob.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4
    b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40)
    try: b.harden_normals = True
    except Exception: pass

def grid_mesh(name, P, mat, M, smooth=True):
    """P: rows of points; faces wound so the normal points out of the egg (rows run along v, columns along u)."""
    bm = bmesh.new()
    V = [[bm.verts.new(p) for p in row] for row in P]
    for i in range(len(V) - 1):
        for j in range(len(V[i]) - 1):
            f = bm.faces.new([V[i][j], V[i + 1][j], V[i + 1][j + 1], V[i][j + 1]]); f.smooth = smooth
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def hexnut(name, ro, ri, h, mat, M, per=4):
    bm = bmesh.new(); outer = []
    for k in range(6):
        a0, a1 = TAU * k / 6, TAU * (k + 1) / 6
        p0 = Vector((ro * math.cos(a0), ro * math.sin(a0))); p1 = Vector((ro * math.cos(a1), ro * math.sin(a1)))
        outer += [p0.lerp(p1, s / per) for s in range(per)]
    inner = [Vector((ri * math.cos(math.atan2(p.y, p.x)), ri * math.sin(math.atan2(p.y, p.x)))) for p in outer]
    ot = [bm.verts.new((p.x, p.y, h / 2)) for p in outer]; ob_ = [bm.verts.new((p.x, p.y, -h / 2)) for p in outer]
    it = [bm.verts.new((p.x, p.y, h / 2)) for p in inner]; ib = [bm.verts.new((p.x, p.y, -h / 2)) for p in inner]
    n = len(outer)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([ot[k], ot[j], it[j], it[k]]); bm.faces.new([ob_[k], ib[k], ib[j], ob_[j]])
        bm.faces.new([ob_[k], ob_[j], ot[j], ot[k]]); bm.faces.new([ib[k], it[k], it[j], ib[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    b = ob.modifiers.new('bevel', 'BEVEL'); b.width = 0.004; b.segments = 2; b.limit_method = 'ANGLE'
    return ob

def ring_gear(name, r, teeth, thick, depth, ri, mat, M):
    """A gear with an open centre: toothed outside, a plain circle inside of radius ri."""
    bm = bmesh.new(); pts = []
    for t in range(teeth):
        a0 = TAU * t / teeth; da = TAU / teeth
        for frac, rr in ((0.0, r - depth), (0.20, r - depth), (0.32, r), (0.60, r), (0.72, r - depth)):
            a = a0 + frac * da; pts.append((rr * math.cos(a), rr * math.sin(a)))
    inner = [(ri * math.cos(math.atan2(y, x)), ri * math.sin(math.atan2(y, x))) for x, y in pts]
    ot = [bm.verts.new((x, y, thick / 2)) for x, y in pts]; ob_ = [bm.verts.new((x, y, -thick / 2)) for x, y in pts]
    it = [bm.verts.new((x, y, thick / 2)) for x, y in inner]; ib = [bm.verts.new((x, y, -thick / 2)) for x, y in inner]
    n = len(pts)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([ot[k], ot[j], it[j], it[k]]); bm.faces.new([ob_[k], ib[k], ib[j], ob_[j]])
        bm.faces.new([ob_[k], ob_[j], ot[j], ot[k]]); bm.faces.new([ib[k], it[k], it[j], ib[j]]).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    b = ob.modifiers.new('bevel', 'BEVEL'); b.width = 0.0025; b.segments = 2; b.limit_method = 'ANGLE'
    return ob

def filament(name, pts, r, mat, M):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, P in zip(sp.points, pts): p.co = (P.x, P.y, P.z, 1.0)
    cu.materials.append(mat)
    ob = link(bpy.data.objects.new(name, cu)); ob.matrix_world = M
    return ob

def along(p, d):
    """Matrix at point p whose local Z runs along direction d."""
    return T(*p) @ Vector(d).to_track_quat('Z', 'Y').to_matrix().to_4x4()

# ---------------------------------------------------------------- the egg and its spiral cut

A, H = 1.0, 1.28
TURNS = 1.15
V0, V1 = 0.07, 0.93

def egg(v, u, s=1.0):
    th = math.pi * v; ph = TAU * u
    R = A * (1 - 0.09 * math.cos(th)) * (1 + 0.022 * math.sin(3 * ph + 2.0 * th)) * s
    return Vector((R * math.sin(th) * math.cos(ph), R * math.sin(th) * math.sin(ph), H * math.cos(th) * s))

def gap(v): return 0.10 + 0.30 * math.sin(math.pi * v) ** 1.5
U0 = 0.75 - gap(0.5) / 2 + TURNS * 0.5          # the widest part of the slot faces the camera (-Y)
def uof(v, q): return q - TURNS * v + U0          # q: 0..gap(v) is the slot, gap(v)..1 is glass

def build_shell(m):
    nv, nq = 200, 240
    P = []
    for i in range(nv + 1):
        v = V0 + (V1 - V0) * i / nv; g = gap(v)
        P.append([egg(v, uof(v, g + (1 - g) * j / nq)) for j in range(nq + 1)])
    ob = grid_mesh('shell', P, m.glass, M0)
    shell_mods(ob, 0.045, 0.012)
    # a violet filament runs just inside the slot's leading edge
    pts = []
    for i in range(161):
        v = V0 + 0.015 + (V1 - V0 - 0.03) * i / 160
        pts.append(egg(v, uof(v, gap(v) + 0.006), 0.935))
    filament('slot-filament', pts, 0.0055, m.violet_soft, M0)
    # a titanium rail rides the slot's trailing edge on the outside, held to the glass by small clamps
    rail = []
    for i in range(241):
        v = V0 + (V1 - V0) * i / 240
        rail.append(egg(v, uof(v, 1.0 - 0.002), 1.016))
    filament('slot-rail', rail, 0.017, m.rail, M0)
    for i, v in enumerate((0.17, 0.31, 0.46, 0.61, 0.76, 0.86)):
        p = egg(v, uof(v, 1.0 - 0.004)); p2 = egg(v + 0.004, uof(v + 0.004, 1.0 - 0.004))
        g = egg(v, uof(v, 1.0 - 0.04))
        x = (p2 - p).normalized(); n = p.normalized(); z = (n - x * n.dot(x)).normalized(); y = z.cross(x)
        if y.dot(g - p) < 0: y = -y
        R = Matrix((x, y, z)).transposed().to_4x4()
        K.box(f'clamp{i}', (0.055, 0.06, 0.034), m.graphite, M0 @ T(*(p + n * 0.008 + y * 0.016)) @ R, bevel=0.004)

def tri_shard(name, centre, size, mat, M, seed, n=12, thick=0.03):
    """A three-cornered piece of the egg's own surface (so it keeps the shell's curve), centred on its own origin."""
    rnd = random.Random(seed); v0, u0 = centre
    dv, du = size / (math.pi * H), size / TAU
    c = [(v0 + dv * math.cos(a) * rnd.uniform(0.6, 1.0), u0 + du * math.sin(a) * rnd.uniform(0.6, 1.0))
         for a in (rnd.uniform(0, 0.5), rnd.uniform(1.9, 2.6), rnd.uniform(3.8, 4.6))]
    bm = bmesh.new(); P = {}
    for i in range(n + 1):
        for j in range(n + 1 - i):
            a, b = i / n, j / n; w = 1 - a - b
            P[i, j] = egg(c[0][0] * w + c[1][0] * a + c[2][0] * b, c[0][1] * w + c[1][1] * a + c[2][1] * b)
    ctr = sum(P.values(), Vector()) / len(P)
    V = {k: bm.verts.new(p - ctr) for k, p in P.items()}
    for i in range(n):
        for j in range(n - i):
            bm.faces.new([V[i, j], V[i + 1, j], V[i, j + 1]]).smooth = True
            if j < n - i - 1:
                bm.faces.new([V[i + 1, j], V[i + 1, j + 1], V[i, j + 1]]).smooth = True
    bm.normal_update(); bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.dot(ctr) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    shell_mods(ob, thick, 0.008)
    return ob

def catmull(pts, n=12):
    P = [Vector(p) for p in pts]; P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out

# ---------------------------------------------------------------- the core

def build_core(m):
    # axle, needle, cap, knurl
    K.lathe('axle', [(0, -1.68), (0.030, -1.68), (0.030, 1.64), (0, 1.64)], m.ti, M0, 64, sharp=80)
    K.lathe('needle', [(0, -2.22), (0.004, -2.19), (0.026, -1.74), (0.034, -1.70), (0.034, -1.64), (0, -1.64)], m.chrome, M0, 64, sharp=50)
    K.lathe('cap', [(0, 1.60), (0.034, 1.60), (0.072, 1.63), (0.072, 1.69), (0.052, 1.705), (0.052, 1.745), (0.088, 1.76),
                    (0.088, 1.80), (0.060, 1.83), (0.018, 1.885), (0, 1.89)], m.graphite, M0, 96, sharp=30)
    torus('cap-led', 0.054, 0.0075, m.amber, M0 @ T(0, 0, 1.725), seg=96, rseg=12)
    d = bpy.data.lights.new('cap-glow', 'POINT'); d.energy = 2.5; d.color = YEL; d.shadow_soft_size = 0.02
    link(bpy.data.objects.new('cap-glow', d)).matrix_world = M0 @ T(0.09, 0, 1.725)
    # collars where the axle passes through the shell's poles (violet anodised)
    zt, zb = H * math.cos(math.pi * V0), H * math.cos(math.pi * V1)
    K.lathe('collar-top', [(0.030, zt - 0.05), (0.20, zt - 0.05), (0.27, zt - 0.01), (0.27, zt + 0.03), (0.23, zt + 0.06),
                           (0.07, zt + 0.07), (0.030, zt + 0.11)], m.anod, M0, 160, sharp=25)
    K.lathe('collar-bot', [(0.030, zb - 0.11), (0.08, zb - 0.07), (0.27, zb - 0.06), (0.31, zb - 0.03), (0.31, zb + 0.01),
                           (0.24, zb + 0.05), (0.030, zb + 0.05)], m.anod, M0, 160, sharp=25)
    K.ring('collar-top-race', 0.030, 0.12, zt + 0.07, zt + 0.10, m.chrome, M0)
    # knurled grip just under the cap
    knurl = K.scale_mat('knurl', (0.5, 0.5, 0.54), 1.0, 0.3, (0.5, 0.5, 0.54), N=8, every=1, knurl=90, knurl_band=(0, 1))
    K.lathe('grip', [(0.030, 1.375), (0.046, 1.385), (0.046, 1.475), (0.030, 1.485)], knurl, M0, 96, sharp=40)
    # a turned foot under the bottom collar, with a violet groove, tapering into the needle
    K.lathe('foot', [(0.030, zb - 0.11), (0.11, zb - 0.12), (0.11, zb - 0.15), (0.07, zb - 0.16), (0.07, zb - 0.20),
                     (0.15, zb - 0.21), (0.15, zb - 0.25), (0.09, zb - 0.27), (0.05, zb - 0.35), (0.034, -1.64), (0.030, -1.64)],
            m.graphite, M0, 128, sharp=25)
    K.ring('foot-groove', 0.069, 0.0725, zb - 0.188, zb - 0.172, m.violet, M0, c=0.0005)
    # three thin titanium struts from the top collar's rim up to the cap: a tripod round the axle
    for a in (15, 135, 255):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        p0 = M0 @ Vector((0.215 * ca, 0.215 * sa, zt + 0.045)); p1 = M0 @ Vector((0.062 * ca, 0.062 * sa, 1.605))
        K.rod(f'strut{a}', p0, p1, 0.0075, m.ti, seg=16)
        sphere(f'strut-foot{a}', 0.014, m.chrome, T(*p0), seg=24)
    # a ball bearing above the liquid: two graphite races, twelve chrome balls
    K.ring('race-lo', 0.030, 0.13, 0.715, 0.737, m.graphite, M0)
    K.ring('race-hi', 0.030, 0.13, 0.773, 0.795, m.graphite, M0)
    for i in range(12):
        a = TAU * i / 12
        sphere(f'ball{i}', 0.019, m.chrome, M0 @ T(0.098 * math.cos(a), 0.098 * math.sin(a), 0.755), seg=24)
    # hubs and violet light grooves where the axle leaves the liquid
    for name, z, gz in (('top', 0.58, 0.655), ('bot', -0.66, -0.685)):
        K.ring(f'hub-{name}', 0.030, 0.078, z, z + 0.06, m.ti, M0)
        K.ring(f'groove-{name}', 0.031, 0.052, gz, gz + 0.012, m.violet, M0)

    # liquid chrome: metaballs (visible radius is about 0.575 x the element radius at threshold 0.6, stiffness 2)
    mb = bpy.data.metaballs.new('liquid'); mb.resolution = 0.06; mb.render_resolution = 0.0075; mb.threshold = 0.6
    mb.materials.append(m.chrome)
    lq = link(bpy.data.objects.new('liquid', mb)); lq.matrix_world = M0
    k = 1 / 0.575
    def ball(co, vis, neg=False, stiff=2.0):
        e = mb.elements.new(type='BALL'); e.co = co; e.radius = vis * k; e.use_negative = neg; e.stiffness = stiff
    def capsule(p0, p1, vis):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0
        e = mb.elements.new(type='CAPSULE'); e.co = (p0 + p1) / 2; e.radius = vis * k; e.stiffness = 2.0
        e.size_x = d.length / 2; e.rotation = d.to_track_quat('X', 'Z')
    ball((0.0, 0.0, 0.04), 0.40, stiff=1.6)
    ball((0.14, -0.10, 0.32), 0.24)
    ball((-0.18, 0.12, -0.26), 0.26)
    ball((0.08, 0.24, 0.14), 0.20)
    capsule((-0.05, -0.12, -0.30), (-0.10, -0.26, -0.60), 0.06)
    ball((-0.11, -0.28, -0.66), 0.045)

    # the stream: the liquid pours out through the slot, wraps the egg rising like a helix, thins, beads and breaks
    # it leaves by the slot's upper right (where the slot faces front-right) and wraps over the back
    ctrl = [(0.15, -0.12, 0.28), (0.42, -0.36, 0.48), (0.92, -0.70, 0.60), (1.25, -0.55, 0.75), (1.42, -0.10, 0.92),
            (1.38, 0.45, 1.08), (1.05, 0.95, 1.22), (0.45, 1.28, 1.32), (-0.25, 1.32, 1.38)]
    path = catmull(ctrl, 18)
    cum = [0.0]
    for p, q in zip(path, path[1:]): cum.append(cum[-1] + (q - p).length)
    L = cum[-1]
    def at(d):
        for k in range(1, len(cum)):
            if cum[k] >= d:
                f = (d - cum[k - 1]) / max(cum[k] - cum[k - 1], 1e-9)
                return path[k - 1].lerp(path[k], f)
        return path[-1]
    d = 0.0; rs = random.Random(5)
    while d < L:
        s = d / L
        base = 0.075 if s < 0.12 else 0.016 + 0.059 * (1 - (s - 0.12) / 0.88) ** 1.6
        vis = base * (1 + 0.30 * math.sin(TAU * 7.5 * s) * min(1, s * 6))   # swells along the jet, like real liquid
        if s < 0.70:
            ball(tuple(at(d)), vis); d += max(vis, 0.012) * 0.3
        else:                                   # beading: the jet pinches into uneven drops, then they separate
            sz = base * rs.uniform(1.0, 1.9)
            ball(tuple(at(d) + Vector((0, 0, rs.uniform(-0.02, 0.02)))), sz); d += sz * (3.2 + 22.0 * (s - 0.70)) * rs.uniform(0.8, 1.6)
    STREAM_END.extend([path[-1], (path[-1] - path[-4]).normalized()])

    # a ring gear the liquid has half swallowed (open in the middle: a solid disc showed its finish as fog)
    ring_gear('gear', 0.33, 36, 0.045, 0.028, 0.24, m.gear, M0 @ T(0.24, 0.02, -0.20) @ Rz(25) @ Rx(68))

    # violet light inside the shell, between the glass and the liquid
    for name, p, e in (('inner-a', (0.35, 0.55, 0.62), 14), ('inner-b', (-0.48, -0.20, -0.58), 12), ('inner-c', (0.55, -0.35, -0.2), 6)):
        d = bpy.data.lights.new(name, 'POINT'); d.energy = e; d.color = LIGHT_VIO; d.shadow_soft_size = 0.05
        ob = link(bpy.data.objects.new(name, d)); ob.matrix_world = M0 @ T(*p)
        if name != 'inner-a':
            ob.visible_volume_scatter = False     # their glow in the haze read as smoke over the gear

# ---------------------------------------------------------------- what the stream breaks into

STREAM_END = []   # filled by build_core: the stream's last point and direction

def build_trail(m):
    """Past the stream's end its last drops fly on, then the trail turns into the things the experiment threw off:
    pieces of the shell and machined parts, each a little further and smaller. Two pieces fall away below-right."""
    rnd = random.Random(67)
    def rot(): return Rz(rnd.uniform(0, 360)) @ Rx(rnd.uniform(-70, 70)) @ Ry(rnd.uniform(-70, 70))
    end, dirn = STREAM_END
    for i, (f, r) in enumerate(((0.10, 0.028), (0.24, 0.022), (0.40, 0.017))):
        sphere(f'drop-{i}', r, m.chrome, M0 @ T(*(end + dirn * f)))
    # the trail comes round the left side and out toward the viewer, a little lower each time
    F = [Vector(p) for p in ((-0.85, 1.15, 1.40), (-1.40, 0.70, 1.36), (-1.85, 0.10, 1.26), (-2.12, -0.50, 1.10),
                             (-2.26, -1.05, 0.92), (-2.32, -1.55, 0.72), (-2.34, -2.00, 0.52))]
    tri_shard('shard-a', (0.47, 0.70), 0.26, m.glass, M0 @ T(*F[0]) @ rot(), seed=1)
    hexnut('nut', 0.10, 0.056, 0.065, m.ti, M0 @ T(*F[1]) @ rot())
    sphere('drop-big', 0.075, m.chrome, M0 @ T(*F[2]))
    tri_shard('shard-b', (0.40, 0.62), 0.18, m.glass, M0 @ T(*F[3]) @ rot(), seed=2)
    Mc = M0 @ T(*F[4]) @ rot()
    K.box('cube', (0.09, 0.09, 0.09), m.graphite, Mc, bevel=0.007)
    sphere('cube-led', 0.011, m.amber, Mc @ T(0.0, 0.0, 0.046))
    K.gear('gear-small', 0.085, 16, 0.022, 0.016, m.graphite, M0 @ T(*F[5]) @ rot())
    Mp = M0 @ T(*F[6]) @ rot()
    K.lathe('pin', [(0, -0.09), (0.011, -0.09), (0.011, 0.06), (0.017, 0.066), (0.017, 0.09), (0, 0.09)], m.ti, Mp, 32, sharp=40)
    sphere('pin-led', 0.010, m.amber, Mp @ T(0, 0, -0.093))
    # falling away below-right, for balance
    tri_shard('shard-c', (0.62, 0.20), 0.30, m.glass, M0 @ T(1.50, -0.45, -0.92) @ Rz(40) @ Rx(-30), seed=4)
    sphere('drop-low', 0.065, m.chrome, M0 @ T(1.12, -0.80, -1.30))
    hexnut('shim', 0.07, 0.045, 0.012, m.anod, M0 @ T(1.88, -0.2, -1.40) @ rot(), per=1)

# ---------------------------------------------------------------- scene, haze, lights, cameras

def world(m):
    w = bpy.context.scene.world; nt = w.node_tree
    nt.nodes['Background'].inputs['Color'].default_value = (*mul(NEAR, 0.6), 1)
    v = nt.nodes.new('ShaderNodeVolumePrincipled'); v.inputs['Density'].default_value = HAZE
    v.inputs['Color'].default_value = (0.70, 0.55, 1.0, 1); v.inputs['Anisotropy'].default_value = 0.5
    nt.links.new(v.outputs[0], nt.nodes['World Output'].inputs['Volume'])

def spot(name, loc, target, power, color, size=30, blend=0.7, radius=0.6):
    d = bpy.data.lights.new(name, 'SPOT'); d.energy = power; d.color = color
    d.spot_size = math.radians(size); d.spot_blend = blend; d.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, d)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def lights():
    lav = (0.88, 0.82, 1.0); vio = LIGHT_VIO
    # studio softboxes: seen in the chrome and glass, but they do not light the haze (that would fog the whole frame)
    for args in (('key', (-4.6, -5.2, 4.4), (0, 0, 0.3), 3.0, 900, lav, 2.0),
                 ('top', (0.4, 0.8, 6.2), (0, 0, 0), 4.0, 420, (0.78, 0.70, 1.0), 1.2),
                 ('rim-r', (3.6, 6.2, 1.0), (0, 0, 0.1), 0.4, 2200, vio, 6.0),        # behind: they draw the outline
                 ('rim-l', (-3.9, 6.0, -0.4), (0, 0, 0), 0.4, 1800, mul(vio, 0.9), 5.5),
                 ('under', (0.5, -3.2, -5.0), (0, 0, -0.3), 3.0, 160, vio, 1.5),
                 ('strip-front', (2.8, -6.0, -1.6), (0, 0, 0), 0.25, 260, lav, 3.5)):
        ob = K.area(*args[:6], size_y=args[6])
        ob.visible_volume_scatter = False
    # soft gradient panels the chrome and glass reflect (unseen by the camera)
    softpanel('sky', (-0.8, -2.8, 5.8), (0, 0, 0.2), 6.0, 3.0, PANEL, (0.90, 0.86, 1.0))
    softpanel('side', (5.6, -1.6, 0.5), (0, 0, 0), 1.4, 5.0, PANEL * 0.6, (0.62, 0.48, 1.0))
    softpanel('front', (2.2, -7.5, 3.2), (0, 0, 0.1), 4.0, 2.4, PANEL * 0.45, (0.80, 0.74, 1.0))
    # a violet beam from above and behind, passing behind the sculpture through the haze (its source is out of frame)
    spot('beam', (-3.2, 10.0, 7.5), (0.8, -3.0, -1.8), HALO, vio, size=16, blend=0.85, radius=0.8)

def softpanel(name, loc, target, w, h, strength, color):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(w, h, 1), verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    mt = bpy.data.materials.new(name); mt.use_nodes = True; nt = mt.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    dx = _math(nt, 'MULTIPLY', _math(nt, 'SUBTRACT', sep.outputs['X'], 0.5), 2.0)
    dy = _math(nt, 'MULTIPLY', _math(nt, 'SUBTRACT', sep.outputs['Y'], 0.5), 2.0)
    dd = _math(nt, 'SQRT', _math(nt, 'ADD', _math(nt, 'MULTIPLY', dx, dx), _math(nt, 'MULTIPLY', dy, dy)))
    fall = _math(nt, 'POWER', _math(nt, 'MAXIMUM', _math(nt, 'SUBTRACT', 1.0, dd), 0.0), 1.6)
    nt.links.new(_math(nt, 'MULTIPLY', fall, strength), e.inputs['Strength'])
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    me.materials.append(mt)
    ob = link(bpy.data.objects.new(name, me)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('Z', 'Y').to_euler()
    ob.visible_camera = False; ob.visible_volume_scatter = False; ob.visible_shadow = False
    return ob

def cam(name, loc, target, lens, fstop=None, focus=None):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36
    ob = link(bpy.data.objects.new(name, cd)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if fstop:
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = ((Vector(focus or target)) - Vector(loc)).length
    return ob

VIEWS = {
    'hero':  dict(loc=(0.0, -15.5, 1.3), target=(-0.15, 0, -0.08), lens=65),
    'three': dict(loc=(-10.3, -11.1, -2.1), target=(-0.1, 0, 0.05), lens=65),
    # close on the stream leaving the slot
    'macro': dict(loc=tuple(M0 @ Vector((1.6, -6.6, 0.75))), target=tuple(M0 @ Vector((0.22, -0.78, 0.18))), lens=135,
                  fstop=6.3, focus=tuple(M0 @ Vector((0.22, -0.70, 0.20)))),
}

def bake_liquid(m):
    """Metaballs leave small ridges where the blobs meet, and chrome shows every one: turn the liquid into a mesh at
    render resolution and relax it."""
    lq = bpy.data.objects['liquid']; mb = lq.data
    mb.resolution = mb.render_resolution
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(lq.evaluated_get(dg))
    me.materials.clear(); me.materials.append(m.chrome)
    for p in me.polygons: p.use_smooth = True
    ob = link(bpy.data.objects.new('liquid-mesh', me)); ob.matrix_world = lq.matrix_world.copy()
    bpy.data.objects.remove(lq)
    sm = ob.modifiers.new('relax', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 6
    print('liquid mesh', len(me.vertices), 'verts', flush=True)

def main():
    os.makedirs(OUT, exist_ok=True)
    s = K.fresh()
    s.cycles.volume_bounces = 1
    s.cycles.transmission_bounces = 14; s.cycles.max_bounces = 16
    s.view_settings.exposure = 0.0
    m = Mats()
    world(m); lights()
    build_shell(m); build_core(m); build_trail(m)
    bake_liquid(m)
    cams = {k: cam(k, **v) for k, v in VIEWS.items()}
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'sculpture67.blend'))
    for key in (ONLY or list(VIEWS)):
        s.camera = cams[key]
        s.render.resolution_x, s.render.resolution_y = 1920, 1080
        s.render.filepath = os.path.join(OUT, f'r67-{key}.jpg')
        bpy.ops.render.render(write_still=True)
        print('wrote', s.render.filepath, flush=True)

if __name__ == '__main__':
    main()
