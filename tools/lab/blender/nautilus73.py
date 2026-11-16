# LAB ONLY (throwaway). Round 73: Bob's feedback on round 72 (2026-11-14): a unique intro with meaning; projects as
# simple objects on a ring you drag; the machine closer, less revealing, cinematic; an ending with meaning; "software
# engineer"; each study must look like what it is; a mythical, techy organism rather than a humanoid robot.
#
# The organism: a mechanical nautilus. A nautilus grows by building a new chamber behind itself and sealing the old one;
# it keeps every chamber, joined by one tube (the siphuncle) that keeps it afloat. So each study is a chamber, oldest
# inside: Software Engineering, Game & App Development, Cybersecurity, and Mechatronics, still being built. The shell's
# near half is smoked glass, so the chambers show. The intro is a gold fingerprint at the centre of the spiral (who made
# it is still unknown); the ending goes through its pinhole eye, which works like a camera obscura: the image that forms
# inside it is Bob's desk.
#   blender -b --factory-startup --python tools/lab/blender/nautilus73.py -- <out-dir> <job> [samples] [res%]
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unknown72 as U
D, S, K = U.D, U.S, U.K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'look'
I4 = Matrix.Identity(4)
V, mul, srgb, lerp, clamp, ease = U.V, U.mul, U.srgb, U.lerp, U.clamp, U.ease
cyl, ball, tube, torus, box, glow, spot, bezier = U.cyl, U.ball, U.tube, U.torus, U.box, U.glow, U.spot, U.bezier
ENV = U.ENV
OBS, DPUR, AME, VIO, GOLD, IVORY = U.OBS, U.DPUR, U.AME, U.VIO, U.GOLD, U.IVORY
LIGHT_VIO, GOLD_LIGHT = U.LIGHT_VIO, U.GOLD_LIGHT
LAV = srgb('#BBA0FF')

# ---------------------------------------------------------------- the spiral
B_ = math.log(3.0) / TAU            # the shell triples in size every turn
TH_END = 5 * math.pi
R_END = 3.0
A_ = R_END / math.exp(B_ * TH_END)
TH0 = -math.pi
HH, WW = 0.56, 0.44                 # the tube: half height (in the spiral's plane) and half width (across it), times r
DTH = TAU / 8                       # one chamber every 45 degrees
TH_L = TH_END - 0.8 * math.pi       # the living chamber: the last 144 degrees
STUDIES = ['mechatronics', 'cyber', 'game', 'software']   # chamber j = 0 is the newest, behind the body

def rr(th): return A_ * math.exp(B_ * th)
def frame(th):
    u = V(math.cos(th), 0, math.sin(th)); r = rr(th)
    t = (u * B_ + V(-math.sin(th), 0, math.cos(th))).normalized()
    return u * r, u, t, r
def sect(th, phi, s=1.0):
    C, u, t, r = frame(th)
    return C + u * (HH * r * math.cos(phi) * s) + V(0, 1, 0) * (WW * r * math.sin(phi) * s)

def chamber_centre(j):
    th = TH_L - (j + 0.5) * DTH
    C, u, t, r = frame(th)
    return C - u * (0.06 * r), th, r

# ---------------------------------------------------------------- materials
def nacre(name):
    m = principled(name, (0.045, 0.032, 0.070), 0.35, 0.22, coat=0.35)
    b = m.node_tree.nodes['Principled BSDF']
    setin(b, 'Thin Film Thickness', 380.0); setin(b, 'Thin Film IOR', 1.40)
    return m

def ridged(name, base, line, N=220, w=0.10, metal=0.0, rough=0.4, glass=False):
    """Growth lines across the shell (along its UV u): fine gold lines on dark stone, or on smoked glass."""
    if glass:
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.70, 0.60, 0.86, 1)
        pr = nt.nodes.new('ShaderNodeBsdfPrincipled'); setin(pr, 'Base Color', (0, 0, 0, 1)); setin(pr, 'Roughness', 0.03); setin(pr, 'Specular IOR Level', 0.8)
        gl = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(tr.outputs[0], gl.inputs[0]); nt.links.new(pr.outputs[0], gl.inputs[1])
        au = nt.nodes.new('ShaderNodeBsdfPrincipled'); setin(au, 'Base Color', (*line, 1)); setin(au, 'Metallic', 1.0); setin(au, 'Roughness', 0.3)
        mix = nt.nodes.new('ShaderNodeMixShader')
        b = None
    else:
        m = principled(name, base, metal, rough, coat=0.3); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    uv = nt.nodes.new('ShaderNodeUVMap'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs[0], sep.inputs[0])
    f = _math(nt, 'FRACT', _math(nt, 'MULTIPLY', sep.outputs['X'], N))
    mask = _math(nt, 'LESS_THAN', f, w)
    if glass:
        nt.links.new(mask, mix.inputs[0]); nt.links.new(gl.outputs[0], mix.inputs[1]); nt.links.new(au.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
    else:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; nt.links.new(mask, _sock(mx, 'Factor_Float'))
        _sock(mx, 'A_Color').default_value = (*base, 1); _sock(mx, 'B_Color').default_value = (*line, 1)
        nt.links.new(_sock(mx, 'Result_Color', True), b.inputs['Base Color'])
        nt.links.new(_math(nt, 'MULTIPLY_ADD', mask, 1.0 - metal, metal), b.inputs['Metallic'])
    return m

def fingerprint_mat():
    """A whorl of gold ridges: one spiral, pulled a little out of true by noise, like a print."""
    m = principled('fingerprint', mul(DPUR, 0.5), 0.0, 0.32, coat=0.4); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    x = _math(nt, 'MULTIPLY', sep.outputs['X'], 1.18); y = _math(nt, 'ADD', _math(nt, 'MULTIPLY', sep.outputs['Y'], 0.86), 0.04)
    r = _math(nt, 'SQRT', _math(nt, 'ADD', _math(nt, 'MULTIPLY', x, x), _math(nt, 'MULTIPLY', y, y)))
    a = _math(nt, 'DIVIDE', _math(nt, 'ARCTAN2', y, x), TAU)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.6; nz.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    rd = _math(nt, 'ADD', _math(nt, 'MULTIPLY', r, 1.0 + 0.0), _math(nt, 'MULTIPLY', _math(nt, 'SUBTRACT', nz.outputs['Fac'], 0.5), 0.09))
    ph = _math(nt, 'SUBTRACT', _math(nt, 'DIVIDE', rd, 0.0118), a)
    ridge = _math(nt, 'MULTIPLY_ADD', _math(nt, 'SINE', _math(nt, 'MULTIPLY', ph, TAU)), 0.5, 0.5)
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.52; mr.inputs['From Max'].default_value = 0.70
    nt.links.new(ridge, mr.inputs['Value'])
    nb = nt.nodes.new('ShaderNodeTexVoronoi'); nb.inputs['Scale'].default_value = 34.0
    nt.links.new(tc.outputs['Object'], nb.inputs['Vector'])
    breaks = _math(nt, 'GREATER_THAN', nb.outputs['Distance'], 0.10)     # small gaps: ridges end and split, as in a real print
    fade = _math(nt, 'LESS_THAN', r, 0.40)
    mask = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', mr.outputs['Result'], breaks), fade)
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; nt.links.new(mask, _sock(mx, 'Factor_Float'))
    _sock(mx, 'A_Color').default_value = (*mul(DPUR, 0.45), 1); _sock(mx, 'B_Color').default_value = (*GOLD, 1)
    nt.links.new(_sock(mx, 'Result_Color', True), b.inputs['Base Color'])
    nt.links.new(_math(nt, 'MULTIPLY', mask, 1.0), b.inputs['Metallic'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.7; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(mask, bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    setin(b, 'Emission Color', (*GOLD_LIGHT, 1))
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; nt.links.new(mask, k.inputs[0]); nt.links.new(k.outputs[0], b.inputs['Emission Strength'])
    U.reg('print', k.inputs[1], 0.35)
    return m

class Mats(U.Mats):
    def __init__(self):
        super().__init__()
        self.nacre = nacre('nacre')
        self.shell = ridged('shell-outer', mul(DPUR, 0.55), mul(GOLD, 0.8), N=90, w=0.06, metal=0.0, rough=0.34)
        self.glass = ridged('shell-glass', None, mul(GOLD, 0.9), N=64, w=0.018, glass=True)
        self.print = fingerprint_mat()
        self.ghost = U.emit_g('ghost', LAV, 1.6, 'ghost')
        self.code = U.code_mat('chamber-code')
        self.code2 = U.code_mat('chamber-code-2')
        self.screen = U.emit_g('app-screen', mul(LAV, 0.9), 1.2, 'rooms')
        self.room_gold = U.emit_g('room-gold', GOLD_LIGHT, 3.0, 'rooms')
        self.room_vio = U.emit_g('room-violet', LIGHT_VIO, 3.0, 'rooms')
        self.cable = principled('cable', (0.030, 0.022, 0.045), 0.6, 0.32, coat=0.4)

# ---------------------------------------------------------------- mesh helpers
def grid(name, f, nu, nv, mat, uv_range=((0, 1), (0, 1)), closed_v=False, smooth=True):
    """A surface from f(i/nu, j/nv) -> point, with UVs."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('uv'); rows = []
    nvv = nv if closed_v else nv + 1
    for i in range(nu + 1):
        rows.append([bm.verts.new(f(i / nu, j / nv)) for j in range(nvv)])
    for i in range(nu):
        for j in range(nv):
            j2 = (j + 1) % nv if closed_v else j + 1
            try:
                fc = bm.faces.new([rows[i][j], rows[i + 1][j], rows[i + 1][j2], rows[i][j2]]); fc.smooth = smooth
            except ValueError:
                continue
            for lp, (a, b) in zip(fc.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (lerp(*uv_range[0], a / nu), lerp(*uv_range[1], b / nv))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))

def solid(ob, t):
    s = ob.modifiers.new('solid', 'SOLIDIFY'); s.thickness = t; s.offset = 0.0; s.use_even_offset = True
    return ob

# ---------------------------------------------------------------- the shell
ROOMS = {}
def build_shell(m):
    nth = 700
    u0 = lambda a: TH0 + (TH_END - TH0) * a
    # the far half: dark stone outside, nacre inside
    back = grid('shell-back', lambda a, b: sect(u0(a), math.pi * b), nth, 24, m.nacre)
    solid(back, 0.02)
    outer = grid('shell-back-outer', lambda a, b: sect(u0(a), math.pi * b, 1.012), nth, 24, m.shell)
    # the near half: smoked glass with gold growth lines
    grid('shell-glass', lambda a, b: sect(u0(a), math.pi + math.pi * b), nth, 24, m.glass)
    # the aperture's lip
    pts = [sect(TH_END, TAU * k / 96) for k in range(97)]
    tube('lip', pts, [0.05] * len(pts), m.gold, res=4)
    tube('lip-dark', [p * 1.0 for p in pts], [0.085] * len(pts), m.obs, res=4)
    # the median line where glass meets stone, both edges, in gold
    for ph, nm in ((0.0, 'outer'), (math.pi, 'inner')):
        P = [sect(u0(k / 500), ph) for k in range(501)]
        tube(f'seam-{nm}', P, [0.004 + 0.010 * (rr(u0(k / 500)) / R_END) for k in range(501)], m.gold, res=3)
    # septa: nacre walls, each drawn in gold where it meets the median plane
    k = 0; th = TH_L
    while th > TH0 + 0.6:
        septum(m, k, th)
        k += 1; th -= DTH
    # the siphuncle: one lit tube through every chamber, into the living chamber
    P = []
    for i in range(401):
        a = TH0 + 0.4 + (TH_L + 0.25 - TH0 - 0.4) * i / 400
        C, u, t, r = frame(a); P.append(C - u * (0.62 * HH * r) + V(0, 0.24 * WW * r, 0))     # along the inner wall, as on a real shell
    tube('siphuncle', P, [0.008 + 0.020 * rr(TH0 + 0.4 + (TH_L + 0.25 - TH0 - 0.4) * i / 400) / R_END for i in range(401)], m.path, res=4)

def septum(m, k, th):
    C, u, t, r = frame(th)
    depth = 0.30
    def f(a, b):
        s = a * 0.985; ph = TAU * b
        return sect(th, ph, s) - t * (depth * (1 - s * s) * r)
    if k == 0:
        # the newest wall is still being laid: part nacre, the rest only drawn
        ob = grid(f'septum{k}', lambda a, b: f(0.88 + 0.12 * a, b * 0.4 + 0.55), 3, 20, m.nacre)
        for s in (0.33, 0.55, 0.78, 1.0):
            pts = [sect(th, TAU * q / 64, s * 0.985) - t * (depth * (1 - (s * 0.985) ** 2) * r) for q in range(65)]
            tube(f'septum{k}-ghost{s}', pts, [0.006] * 65, m.ghost, res=2)
    else:
        ob = grid(f'septum{k}', lambda a, b: f(0.88 + 0.12 * a, b), 3, 48, m.nacre, closed_v=True)
        solid(ob, 0.008 * r + 0.002)
    prof = [f(1 - q / 20, 0.0) for q in range(21)] + [f(q / 20, 0.5) for q in range(1, 21)]
    tube(f'septum{k}-line', prof, [0.004 + 0.008 * r / R_END] * len(prof), m.gold if k else m.ghost, res=3)
    # the septal neck where the siphuncle passes
    torus(f'neck{k}', 0.028 * r + 0.01, 0.005 + 0.003 * r, m.gold, S.along(C - u * (0.62 * HH * r) + V(0, 0.24 * WW * r, 0), t), seg=24, rseg=6)

# ---------------------------------------------------------------- the four rooms
def place(name, j):
    c, th, r = chamber_centre(j)
    ROOMS[name] = dict(c=c, th=th, r=r)
    return c, r

def room_software(m):
    """Software Engineering: a system laid out as it is designed: modules of code in tiers, joined by their interfaces."""
    c, r = place('software', 3); s = r * ENV('R73_ROOM', 0.36)
    tiers = [(-0.55, 3), (0.0, 2), (0.55, 1)]
    nodes = []
    for z, n in tiers:
        for q in range(n):
            x = (q - (n - 1) / 2) * 0.62
            p = c + V(x * s, 0.05 * s, z * s)
            box(f'sw-pane{z}{q}', (0.46 * s, 0.012 * s, 0.30 * s), m.dark, T(*p) @ Rx(0), bevel=0.004 * s)
            D.quad(f'sw-code{z}{q}', 0.42 * s, 0.26 * s, m.code if (q + n) % 2 else m.code2, T(*(p + V(0, -0.0075 * s, 0))) @ Rx(0))
            box(f'sw-edge{z}{q}', (0.46 * s, 0.014 * s, 0.010 * s), m.room_gold, T(*(p + V(0, 0, 0.155 * s))), bevel=0)
            nodes.append((z, p))
    for (z0, p0) in nodes:
        for (z1, p1) in nodes:
            if abs(z1 - z0 - 0.55) < 1e-6 and abs(p1.x - p0.x) < 0.75 * s:
                cyl(f'sw-link{p0.x:.2f}{p1.x:.2f}{z0}', p0 + V(0, 0.01 * s, 0.15 * s), p1 - V(0, -0.01 * s, 0.15 * s), 0.006 * s, m.path, seg=8)
    # braces either side: a function's body, cast in gold
    for sgn in (-1, 1):
        pts = []
        for q in range(41):
            v = q / 40 * 2 - 1
            x = sgn * (0.95 + 0.08 * (1 - abs(v)) ** 6 - 0.10 * math.exp(-(v / 0.10) ** 2)) * s
            pts.append(c + V(x - sgn * 0.0 * s, 0.02 * s, v * 0.78 * s))
        tube(f'sw-brace{sgn}', [pts[0] + (pts[0] - pts[1])] + pts, [0.018 * s] * 42, m.gold, res=3)
    box('sw-caret', (0.018 * s, 0.01 * s, 0.07 * s), m.room_gold, T(*(c + V(0.12 * s, -0.02 * s, 0.55 * s))), bevel=0)
    glow('sw-light', c + V(0, -0.35 * s, 0.4 * s), (0.85, 0.75, 1.0), 4.0 * s, size=0.1)

def room_game(m):
    """Game & App Development: a small level you could play, and a grid of apps above it."""
    c, r = place('game', 2); s = r * ENV('R73_ROOM', 0.36)
    # the level: steps of blocks rising to a goal, a coin floating over a gap, a spring pad
    base = c + V(-0.78 * s, 0, -0.62 * s); bs = 0.16 * s
    cols = [1, 1, 2, 0, 0, 3, 3, 4]
    for i, h in enumerate(cols):
        for k in range(h):
            p = base + V(i * bs * 1.02, 0, k * bs * 1.02)
            box(f'gm-block{i}{k}', (bs, bs, bs), m.vmetal if (i + k) % 2 else m.obs, T(*p), bevel=0.012 * s)
            if k == h - 1: box(f'gm-top{i}{k}', (bs * 1.01, bs * 1.01, 0.02 * s), m.room_vio, T(*(p + V(0, 0, bs * 0.5))), bevel=0)
    gap = base + V(3.5 * bs * 1.02, 0, 1.6 * bs)
    K.lathe('gm-coin', [(0, -0.012 * s), (0.055 * s, -0.012 * s), (0.055 * s, 0.012 * s), (0, 0.012 * s)], m.room_gold, T(*gap) @ Rx(90) @ Ry(25), 32, sharp=30)
    goal = base + V(7 * bs * 1.02, 0, 4.5 * bs)
    cyl('gm-pole', goal, goal + V(0, 0, 0.42 * s), 0.008 * s, m.gold, seg=8)
    box('gm-flag', (0.12 * s, 0.006 * s, 0.07 * s), m.room_gold, T(*(goal + V(0.06 * s, 0, 0.37 * s))), bevel=0)
    ball('gm-player', base + V(1.0 * bs, 0, 1.25 * bs), 0.055 * s, m.ivory, seg=20)
    # a controller, its d-pad and buttons, hung in the middle of the room
    cc = c + V(0.05 * s, 0.05 * s, 0.05 * s)
    for sgn in (-1, 1):
        S.sphere(f'gm-grip{sgn}', 0.13 * s, m.dark, T(*(cc + V(sgn * 0.20 * s, 0, -0.05 * s))) @ Matrix.Diagonal((1, 0.6, 1.15, 1)), seg=32)
    box('gm-pad', (0.44 * s, 0.10 * s, 0.20 * s), m.dark, T(*cc), bevel=0.06 * s)
    for d in ((1, 0), (0, 1)):
        box(f'gm-dpad{d}', (0.10 * s if d[0] else 0.032 * s, 0.03 * s, 0.032 * s if d[0] else 0.10 * s), m.gold, T(*(cc + V(-0.13 * s, -0.055 * s, 0.01 * s))), bevel=0.004 * s)
    for k, (dx, dz) in enumerate(((0.10, 0.0), (0.16, 0.05), (0.16, -0.05), (0.22, 0.0))):
        ball(f'gm-btn{k}', cc + V(dx * s, -0.055 * s, dz * s + 0.01 * s), 0.022 * s, m.room_gold if k == 1 else m.ivory, seg=12)
    # apps: a grid of rounded tiles, three lit
    for i in range(3):
        for k in range(3):
            p = c + V((0.38 + i * 0.17) * s, 0.0, (0.45 + k * 0.17) * s)
            box(f'gm-app{i}{k}', (0.13 * s, 0.02 * s, 0.13 * s), m.screen if (i + 2 * k) % 4 == 1 else m.vmetal, T(*p), bevel=0.03 * s)
    glow('gm-light', c + V(0, -0.35 * s, 0.4 * s), (0.85, 0.75, 1.0), 4.0 * s, size=0.1)

def room_cyber(m):
    """Cybersecurity: a vault door with a dial, a padlock hung in front of it, a wall of hexagonal cells behind."""
    c, r = place('cyber', 1); s = r * ENV('R73_ROOM', 0.36) * 0.95
    Md = T(*(c + V(0, 0.10 * s, 0.02 * s))) @ Rx(90)
    K.lathe('cy-door', [(0, -0.05 * s), (0.62 * s, -0.05 * s), (0.66 * s, -0.02 * s), (0.66 * s, 0.03 * s), (0.60 * s, 0.05 * s), (0, 0.05 * s)], m.dark, Md, 96, sharp=30)
    K.ring('cy-door-ring', 0.50 * s, 0.56 * s, 0.05 * s, 0.07 * s, m.ring_g, Md, c=0.004 * s, seg=96)
    K.lathe('cy-dial', [(0, 0.05 * s), (0.20 * s, 0.05 * s), (0.20 * s, 0.10 * s), (0.17 * s, 0.12 * s), (0, 0.12 * s)], m.gold, Md, 64, sharp=30)
    for k in range(24):
        a = TAU * k / 24
        box(f'cy-tick{k}', (0.01 * s, 0.035 * s, 0.006 * s), m.dark, Md @ T(0.18 * math.cos(a) * s, 0.18 * math.sin(a) * s, 0.123 * s) @ Rz(math.degrees(a) + 90), bevel=0)
    for k in range(6):
        a = TAU * k / 6
        cyl(f'cy-bolt{k}', Md @ V(0.66 * s * math.cos(a), 0.66 * s * math.sin(a), 0), Md @ V(0.82 * s * math.cos(a), 0.82 * s * math.sin(a), 0), 0.035 * s, m.gold, seg=16)
    # the padlock in front: a body with a keyhole, its shackle closed
    pc = c + V(0.30 * s, -0.32 * s, -0.30 * s)
    box('cy-lock', (0.26 * s, 0.10 * s, 0.22 * s), m.gold, T(*pc), bevel=0.03 * s)
    torus('cy-shackle', 0.085 * s, 0.022 * s, m.vmetal, T(*(pc + V(0, 0, 0.11 * s))) @ Rx(90), seg=40, rseg=8)
    ball('cy-keyhole', pc + V(0, -0.051 * s, 0.02 * s), 0.022 * s, m.black, seg=12)
    box('cy-keyslot', (0.016 * s, 0.01 * s, 0.05 * s), m.black, T(*(pc + V(0, -0.052 * s, -0.015 * s))), bevel=0)
    # a firewall: hexagonal cells along the back of the room, a few lit
    rs = random.Random(31)
    for i in range(-5, 6):
        for k in range(-3, 4):
            x = (i + 0.5 * (k % 2)) * 0.17 * s; z = k * 0.148 * s
            if math.hypot(x, z) > 0.95 * s: continue
            p = c + V(x, 0.42 * s, z)
            K.lathe(f'cy-hex{i}{k}', [(0, -0.01 * s), (0.08 * s, -0.01 * s), (0.08 * s, 0.01 * s), (0, 0.01 * s)], m.room_vio if rs.random() < 0.15 else m.obs, T(*p) @ Rx(90) @ Rz(30), 6, sharp=1)
    glow('cy-light', c + V(0, -0.40 * s, 0.4 * s), (0.85, 0.75, 1.0), 4.0 * s, size=0.1)

def room_mech(m):
    """Mechatronics, next: gears, a motor and an arm on a circuit board; half of it still only drawn."""
    c, r = place('mechatronics', 0); s = r * ENV('R73_ROOM', 0.36)
    board = c + V(0, 0.15 * s, -0.55 * s)
    box('mc-board', (1.1 * s, 0.6 * s, 0.03 * s), m.board if hasattr(m, 'board') else m.vmetal, T(*board), bevel=0.004 * s)
    for k in range(7):
        box(f'mc-trace{k}', (0.9 * s, 0.008 * s, 0.004 * s), m.room_gold, T(*(board + V(0, (-0.24 + 0.08 * k) * s, 0.017 * s))), bevel=0)
    for k, (x, y) in enumerate(((-0.3, -0.1), (0.1, 0.12), (0.35, -0.15))):
        box(f'mc-chip{k}', (0.12 * s, 0.12 * s, 0.03 * s), m.obs, T(*(board + V(x * s, y * s, 0.03 * s))), bevel=0.004 * s)
    # two gears in mesh, upright
    g1 = c + V(-0.35 * s, 0.0, 0.05 * s); g2 = g1 + V(0.34 * s, 0, 0.14 * s)
    K.gear('mc-gear1', 0.22 * s, 22, 0.05 * s, 0.03 * s, m.gold, T(*g1) @ Rx(90))
    K.gear('mc-gear2', 0.14 * s, 14, 0.05 * s, 0.03 * s, m.vmetal, T(*g2) @ Rx(90) @ Rz(8))
    for g, rad in ((g1, 0.05), (g2, 0.035)):
        cyl(f'mc-axle{g.x:.2f}', g - V(0, 0.06 * s, 0), g + V(0, 0.06 * s, 0), rad * s, m.dark, seg=16)
    # a motor and a two-link arm on the board
    mpos = board + V(0.30 * s, 0, 0.12 * s)
    cyl('mc-motor', mpos - V(0, 0, 0.1 * s), mpos + V(0, 0, 0.1 * s), 0.08 * s, m.dark, seg=24, round_=0.01 * s)
    j1 = mpos + V(0, 0, 0.12 * s); j2 = j1 + V(-0.10 * s, 0, 0.36 * s); tip = j2 + V(-0.30 * s, 0, 0.12 * s)
    cyl('mc-arm1', j1, j2, 0.03 * s, m.obs, seg=16); cyl('mc-arm2', j2, tip, 0.024 * s, m.obs, seg=16)
    for p in (j1, j2): ball(f'mc-joint{p.z:.2f}', p, 0.045 * s, m.gold, seg=16)
    # the parts still to come: a second arm and a bigger gear, only drawn
    K.lathe('mc-ghost-gear', [(0.2 * s, -0.002), (0.21 * s, -0.002), (0.21 * s, 0.002), (0.2 * s, 0.002)], m.ghost, T(*(c + V(0.40 * s, 0.0, 0.52 * s))) @ Rx(90), 64, sharp=30)
    for k in range(16):
        a = TAU * k / 16
        cyl(f'mc-ghost-tooth{k}', c + V(0.40 * s, 0, 0.52 * s) + V(math.cos(a), 0, math.sin(a)) * 0.21 * s, c + V(0.40 * s, 0, 0.52 * s) + V(math.cos(a), 0, math.sin(a)) * 0.25 * s, 0.004 * s, m.ghost, seg=6)
    cyl('mc-ghost-arm', tip, tip + V(-0.1 * s, 0, 0.3 * s), 0.004 * s, m.ghost, seg=6)
    glow('mc-light', c + V(0, -0.40 * s, 0.4 * s), (0.85, 0.75, 1.0), 4.0 * s, size=0.1)

# ---------------------------------------------------------------- the body: hood, eye, arms, the jet
HEAD = {}
def build_body(m):
    C, u, t, r = frame(TH_END)
    H0 = C + t * (0.45 * r) - u * (0.12 * r)
    HEAD['c'] = H0
    # the mantle filling the living chamber, seen through the glass
    def f(a, b):
        th = TH_L + 0.06 + (TH_END - TH_L - 0.02) * a
        return sect(th, TAU * b, 0.86)
    grid('mantle', f, 60, 40, m.obs, closed_v=True)
    # the head: a smooth capsule out of the aperture, a hood over it
    S.sphere('head', 1.0, m.obs, T(*H0) @ Matrix.Diagonal((0.46 * r, 0.40 * r, 0.42 * r, 1)), seg=64)
    U.shell('hood', H0 + V(0.06 * r, 0, 0.06 * r), (0.50 * r, 0.44 * r, 0.48 * r), -120, 195, 8, 88, 0.05, m.dark, nu=56, nv=18)
    U.shell('hood-rim', H0 + V(0.06 * r, 0, 0.06 * r), (0.51 * r, 0.452 * r, 0.492 * r), -120, 195, 6, 11, 0.02, m.gold, nu=56, nv=2)
    # the eye on the near side: a pinhole in an aperture of blades, inside a ring
    E = H0 + V(-0.06 * r, -0.40 * r * 0.99, -0.02 * r); HEAD['eye'] = E
    Me = T(*E) @ Rx(90)
    HEAD['Me'] = Me
    K.ring('eye-ring', 0.17 * r, 0.21 * r, -0.02 * r, 0.02 * r, m.ring_g, Me, c=0.004, seg=96)
    torus('eye-gold', 0.215 * r, 0.010 * r, m.gold, Me, seg=96, rseg=8)
    K.lathe('eye-iris', [(0.030 * r, 0.0), (0.17 * r, 0.0), (0.17 * r, 0.006 * r), (0.030 * r, 0.006 * r)], m.vmetal, Me, 96, sharp=30)
    for k in range(18):
        box(f'eye-blade{k}', (0.12 * r, 0.003 * r, 0.004 * r), m.eye if k % 3 == 0 else m.gold, Me @ Rz(360 * k / 18) @ T(0.10 * r, 0, 0.008 * r) @ Rz(18), bevel=0)
    torus('pinhole-rim', 0.030 * r, 0.004 * r, m.eye, Me @ T(0, 0, 0.007 * r), seg=48, rseg=6)
    K.lathe('pinhole', [(0, -0.001), (0.026 * r, -0.001), (0.026 * r, 0.0072 * r), (0, 0.0072 * r)], m.black, Me, 48, sharp=30)
    # the jet under the eye
    J0 = H0 + V(-0.30 * r, -0.30 * r, -0.30 * r)
    K.lathe('jet', [(0.0, 0.0), (0.09 * r, 0.0), (0.07 * r, 0.22 * r), (0.05 * r, 0.24 * r), (0.0, 0.24 * r)], m.dark, S.along(J0, V(-0.5, -0.3, -1)), 48, sharp=30)
    torus('jet-glow', 0.055 * r, 0.008 * r, m.room_vio, S.along(J0 + V(-0.5, -0.3, -1).normalized() * 0.235 * r, V(-0.5, -0.3, -1)), seg=48, rseg=6)
    # arms: cables with gold tips, curling down and out
    rs = random.Random(17)
    for k in range(28):
        a = TAU * k / 28 + rs.uniform(-0.08, 0.08)
        base = H0 + V(-0.30 * r, 0.0, -0.10 * r) + V(0, math.cos(a), math.sin(a)) * 0.30 * r
        d = (t * 1.0 + V(-0.6, math.cos(a) * 0.45, math.sin(a) * 0.35)).normalized()
        L = rs.uniform(1.4, 2.6) * r * 0.55
        curl = V(rs.uniform(0.3, 0.8), rs.uniform(-0.4, 0.4), rs.uniform(0.2, 0.7))
        pts = bezier(base, base + d * L * 0.4, base + d * L * 0.8 + curl * L * 0.25, base + d * L + curl * L * 0.45, 30)
        rad = [lerp(0.045, 0.010, (q / 30) ** 0.8) * r for q in range(31)]
        tube(f'arm{k}', pts, rad, m.cable, res=4)
        if k % 3 == 0:
            tube(f'arm{k}-line', pts[2:28], [x * 0.35 for x in rad[2:28]], m.path, res=2)
        ball(f'arm{k}-tip', pts[-1], rad[-1] * 1.4, m.gold, seg=12)

# ---------------------------------------------------------------- the intro: a fingerprint at the centre of the spiral
def build_print(m):
    P0 = V(0.0, -0.36, 0.0)
    Mp = T(*P0) @ Rx(90)
    K.lathe('print', [(0, -0.02), (0.42, -0.02), (0.44, 0.0), (0.42, 0.02), (0, 0.02)], m.print, Mp, 192, sharp=30)
    torus('print-rim', 0.44, 0.012, m.gold, Mp, seg=192, rseg=8)
    HEAD['print'] = P0

# ---------------------------------------------------------------- the ending: inside the eye, the image it forms
def build_obscura(m, image=None):
    """A dark room behind the pinhole; on its far wall, upside down, the light that came in: Bob's desk."""
    E = HEAD['eye']; r = R_END
    Cb = E + V(0, 0.42 * r * 0.55, 0)
    room = principled('obscura-room', (0.020, 0.014, 0.030), 0.0, 0.85)
    S.sphere('obscura', 0.40 * r * 0.55, room, T(*Cb), seg=48)
    beam = bpy.data.materials.new('obscura-beam'); beam.use_nodes = True; nt = beam.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*GOLD_LIGHT, 1); em.inputs['Strength'].default_value = 0.012
    ad = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(tr.outputs[0], ad.inputs[0]); nt.links.new(em.outputs[0], ad.inputs[1]); nt.links.new(ad.outputs[0], o.inputs['Surface'])
    K.lathe('obscura-beam', [(0.0, 0.0), (0.012, 0.0), (0.30 * r * 0.55, 0.92 * 0.55 * r * 0.62), (0.0, 0.92 * 0.55 * r * 0.62)], beam, T(*(E + V(0, 0.01, 0))) @ Rx(-90), 48, sharp=30)
    w, h = 0.36 * r * 0.55 * 1.6, 0.36 * r * 0.55 * 0.9
    mt = U.screen_mat('obscura-image'); HEAD['obscura_mat'] = mt
    q = D.quad('obscura-wall', w, h, mt, T(*(Cb + V(0, 0.20 * r * 0.55, 0))) @ Rz(180) @ Ry(180))
    HEAD['obscura'] = dict(c=Cb, wall=Cb + V(0, 0.20 * r * 0.55, 0))
    if image and os.path.exists(image):
        mt.node_tree.nodes['pic'].image = bpy.data.images.load(image, check_existing=True)

# ---------------------------------------------------------------- the place: deep water or deep space, never said
def build_lights(m):
    L = {}
    L['key'] = K.area('key', (-7, -10, 6), (-1, 0, 0), 4.0, ENV('R73_KEY', 900), (0.92, 0.84, 1.0), size_y=3.0)
    L['rim-r'] = K.area('rim-r', (9, 7, 4), (-1, 0, 0), 3.0, ENV('R73_RIM', 3400), LIGHT_VIO, size_y=8.0)
    L['rim-l'] = K.area('rim-l', (-10, 6, -3), (-1, 0, 0), 3.0, ENV('R73_RIM', 3400) * 0.7, LIGHT_VIO, size_y=6.0)
    L['under'] = K.area('under', (-2, -6, -9), (-1, 0, -1), 4.0, 500, (0.6, 0.4, 1.0), size_y=4.0)
    for k, ob in L.items(): ob.visible_volume_scatter = False; ob.visible_glossy = k == 'key'
    L['shaft'] = spot('shaft', (1.5, 4.0, 26.0), (-1.0, 0.0, 0.0), ENV('R73_SHAFT', 16000), LIGHT_VIO, size=11, blend=0.9, radius=1.0)
    L['wash'] = K.area('wash', (0, 40, 0), (0, 0, 0), 40.0, ENV('R73_WASH', 420), LIGHT_VIO, size_y=20.0)
    L['wash'].visible_volume_scatter = True; L['wash'].visible_glossy = False; L['wash'].visible_diffuse = False
    for name, loc, tgt, w, h, s, col in (('panel-l', (-6, -8, 6), (-1, 0, 0), 6.0, 8.0, 1.4, (0.80, 0.70, 1.0)),
                                         ('panel-r', (6, -7, 2), (-1, 0, 0), 3.0, 8.0, 1.0, (0.66, 0.42, 1.0)),
                                         ('panel-top', (0, -4, 10), (-1, 0, 0), 8.0, 4.0, 0.8, (0.80, 0.70, 1.0))):
        L[name] = S.softpanel(name, loc, tgt, w, h, s, col)
    L['eye'] = glow('eye-light', HEAD['eye'] + V(0, -0.5, 0), GOLD_LIGHT, 0.0, size=0.05)
    return L

def build_snow(m):
    rs = random.Random(5)
    base = S.sphere('snow-base', 1.0, m.mote, T(0, 0, -300), seg=8); base.hide_render = True
    for k in range(110):
        p = V(rs.uniform(-12, 10), rs.uniform(-7, 9), rs.uniform(-8, 8))
        if (p - V(-1, 0, 0)).length < 2.0: continue
        ob = link(bpy.data.objects.new(f'snow{k}', base.data))
        ob.matrix_world = T(*p) @ Matrix.Scale(rs.choice((0.008, 0.011, 0.014, 0.018)), 4); ob.visible_shadow = False

# ---------------------------------------------------------------- scene and jobs
def scene():
    s = K.fresh()
    s.cycles.volume_bounces = 0; s.cycles.transmission_bounces = 10; s.cycles.max_bounces = 12
    s.cycles.transparent_max_bounces = 64
    m = Mats()
    S.HAZE = ENV('R73_HAZE', 0.008)
    S.world(m)
    w = s.world.node_tree
    w.nodes['Background'].inputs['Color'].default_value = (*mul(DPUR, 0.16), 1)
    vol = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.80, 0.52, 1.0, 1); vol.inputs['Anisotropy'].default_value = 0.45
    build_shell(m); room_software(m); room_game(m); room_cyber(m); room_mech(m)
    build_body(m); build_print(m); build_snow(m)
    U.build_desk(m)
    L = build_lights(m)
    cam = S.cam('cam', loc=(0, -14, 0), target=(-1, 0, 0), lens=35)
    cam.data.clip_start = 0.003; cam.data.clip_end = 600; s.camera = cam
    return s, m, L, cam

def look(cam, pos, tgt, lens, fstop=None, focus=None, roll=0.0):
    pos, tgt = Vector(pos), Vector(tgt)
    cam.location = pos
    q = (tgt - pos).to_track_quat('-Z', 'Y') @ Matrix.Rotation(math.radians(roll), 4, 'Z').to_quaternion()
    cam.rotation_euler = q.to_euler(); cam.data.lens = lens; cam.data.shift_x = 0
    cam.data.dof.use_dof = bool(fstop)
    if fstop: cam.data.dof.aperture_fstop = fstop; cam.data.dof.focus_distance = focus or (tgt - pos).length

def main():
    os.makedirs(OUT, exist_ok=True)
    s, m, L, cam = scene()
    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)
    job, _, arg = JOB.partition(':')
    E = HEAD['eye']; P0 = HEAD['print']
    rc = {k: ROOMS[k]['c'] for k in ROOMS}; rr_ = {k: ROOMS[k]['r'] for k in ROOMS}
    def room_view(k, lens=20):
        # inside the chamber, just behind the glass: its two walls frame the room
        c, r = rc[k], rr_[k]
        return (c + V(0.10 * r, -0.40 * r, 0.0), c + V(-0.10 * r, 0.20 * r, 0.0), lens)
    views = {
        'whole': ((0.5, -16, 0.5), (-0.6, 0, 0), 30, None),
        'origin': ((P0.x + 0.26, P0.y - 0.62, P0.z + 0.16), (P0.x - 0.05, P0.y, P0.z - 0.02), 50, 5.6),
        'origin-out': ((0.9, -2.9, 0.45), (-0.55, 0, 0.0), 34, None),
        'software': room_view('software') + (None,),
        'game': room_view('game') + (None,),
        'cyber': room_view('cyber') + (None,),
        'mechatronics': room_view('mechatronics') + (None,),
        'works': ((2.2, -9.4, -3.4), (-1.0, 0, -0.4), 30, None),
        'awakening': ((E.x + 1.9, E.y - 4.0, E.z - 1.1), (E.x + 2.3, E.y + 0.4, E.z + 0.7), 30, None),
        'eye': ((E.x + 0.22, E.y - 1.6, E.z + 0.10), (E.x - 0.05, E.y, E.z), 50, None),
    }
    levels = {
        'whole': dict(eye=0.6), 'origin': dict(print=1.0, eye=0.0), 'origin-out': dict(print=1.0),
        'awakening': dict(paths=2.4, rooms=1.6, glyph=1.8, eye=1.4, print=1.6), 'eye': dict(eye=1.6, paths=1.6),
    }
    only = arg.split(',') if arg else None
    if job in ('look', 'keys'):
        for name, (pos, tgt, lens, fstop) in views.items():
            if only and name not in only: continue
            U.energy(levels.get(name, {}))
            L['eye'].data.energy = 14.0 if name in ('awakening', 'eye') else 0.0
            for o in U.DESK['lights']: o.hide_render = True
            look(cam, pos, tgt, lens, fstop=fstop, focus=(Vector(tgt) - Vector(pos)).length * 0.97 if fstop else None)
            shoot(os.path.join(OUT, f'{job}-{name}.jpg'))
        if not only or 'desk' in only or 'obscura' in only:
            # the desk first: it is what the eye's image shows
            for k in ('key', 'rim-r', 'rim-l', 'under', 'shaft', 'wash'): L[k].hide_render = True
            for o in U.DESK['lights']: o.hide_render = False
            U.set_screen(os.path.join(OUT, f'{job}-awakening.jpg'))
            look(cam, U.DX + V(0.03, -0.60, 1.22), U.DX + V(-0.04, 0.62, 1.04), 26)
            desk = os.path.join(OUT, f'{job}-desk.jpg'); shoot(desk)
            for k in ('key', 'rim-r', 'rim-l', 'under', 'shaft', 'wash'): L[k].hide_render = False
            for o in U.DESK['lights']: o.hide_render = True
            build_obscura(m, desk)
            ob = HEAD['obscura']
            look(cam, E + V(0.10, 0.14, -0.06), ob['wall'] + V(-0.05, 0, 0.0), 20)
            shoot(os.path.join(OUT, f'{job}-obscura.jpg'))
        return

if __name__ == '__main__':
    main()
