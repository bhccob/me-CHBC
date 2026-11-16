# LAB ONLY (throwaway). Round 74: Bob on round 73 (2026-11-14): "fingerprint idea was good maybe keep the robot looking
# thing since studies and selected work doesnt really blend well or make sense". Back to round 72's automaton, with his
# round 72 notes applied:
#   origin       a gold fingerprint, the maker's mark, is the automaton's heart; the camera pulls back from it
#   software     the torso is a pair of giant braces { } round tiers of code modules wired to the heart
#   game & app   the forearms are the two halves of a controller (d-pad, buttons, sticks); apps on a wrist screen
#   cyber        a vault door with a dial, bolts and a padlock swings shut over the heart; a porthole keeps the print in
#                sight; firewall cells on the shoulders
#   mechatronics gears at the knees, pistons on the shins, servos at the hips, a board on the thighs; some only drawn
#   ending       it rises, reaches toward you and touches the glass; its fingertip leaves the same print; the glass was
#                Bob's monitor, and we are at his desk
#   blender -b --factory-startup --python tools/lab/blender/robot74.py -- <out-dir> <job> [samples] [res%]
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unknown72 as U
import nautilus73 as NT
D, S, K = U.D, U.S, U.K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
JOB = argv[1] if len(argv) > 1 else 'look'
I4 = Matrix.Identity(4)
V, mul, srgb, lerp, clamp, ease, eout = U.V, U.mul, U.srgb, U.lerp, U.clamp, U.ease, U.eout
cyl, ball, tube, torus, box, glow, spot, bezier = U.cyl, U.ball, U.tube, U.torus, U.box, U.glow, U.spot, U.bezier
part, REST, J, CORE, EYE = U.part, U.REST, U.J, U.CORE, U.EYE
ENV = U.ENV
GOLD_LIGHT, LIGHT_VIO = U.GOLD_LIGHT, U.LIGHT_VIO
LAV = srgb('#BBA0FF')

HEART = CORE + V(0, -0.20, 0.0)          # the print faces out of the chest
DOOR = CORE + V(0, -0.98, 0.0)           # the vault door's centre, closed
HINGE = DOOR + V(-0.66, 0, 0)

class Mats(U.Mats):
    def __init__(self):
        super().__init__()
        self.print = NT.fingerprint_mat()
        self.code = U.code_mat('chest-code'); self.code2 = U.code_mat('chest-code-2')
        self.ghost = U.emit_g('ghost', LAV, 1.4, 'ghost')
        self.lit_vio = U.emit_g('lit-violet', LIGHT_VIO, 2.6, 'rooms')
        self.lit_gold = U.emit_g('lit-gold', GOLD_LIGHT, 2.6, 'rooms')
        self.app = U.emit_g('app', mul(LAV, 0.8), 1.4, 'rooms')
        self.glassp = K.thin_glass('porthole', (0.80, 0.72, 0.92), 0.02)
        self.screen_glass = K.thin_glass('the-glass', (0.96, 0.94, 1.0), 0.0)
        self.print_lit = NT.fingerprint_mat()
        self.door = principled('vault', (0.045, 0.036, 0.062), 0.7, 0.55, aniso=0.2)

# ---------------------------------------------------------------- the heart and the code round it (software)
def build_heart(m):
    Mh = T(*HEART) @ Rx(90)
    with part('chest', 0.0, 0.0):
        K.lathe('heart', [(0, -0.03), (0.30, -0.03), (0.31, -0.01), (0.31, 0.01), (0.30, 0.03), (0, 0.03)], m.print, Mh, 160, sharp=30)
        torus('heart-rim', 0.315, 0.014, m.gold, Mh @ T(0, 0, 0.012), seg=160, rseg=8)
        K.lathe('heart-back', [(0, 0.03), (0.34, 0.03), (0.34, 0.16), (0, 0.18)], m.dark, Mh @ Rx(180), 64, sharp=30)
    with part('chest', 0.0, 0.0, spin=0.5):
        K.ring('heart-code', 0.34, 0.41, -0.02, 0.02, m.ring_g, Mh, c=0.004, seg=160)

def pane(name, p, w, h, mat, m):
    M = T(*p) @ Rz(0)
    box(name + '-bezel', (w + 0.03, 0.025, h + 0.03), m.dark, M @ T(0, 0.012, 0), bevel=0.006)
    D.quad(name + '-code', w, h, mat, M @ T(0, -0.002, 0))
    box(name + '-edge', (w + 0.03, 0.03, 0.012), m.lit_gold, M @ T(0, 0.0, h / 2 + 0.02), bevel=0)

SW = []
def build_software(m):
    y = HEART.y + 0.10; c = HEART
    tiers = [((0.0, 0.66),), ((-0.66, 0.02), (0.66, 0.02)), ((-0.58, -0.66), (0.0, -0.70), (0.58, -0.66))]
    k = 0; pts = {}
    for ti, tier in enumerate(tiers):
        for (x, z) in tier:
            p = V(c.x + x, y, c.z + z)
            with part('chest', 0.30 + 0.10 * k, 0.75 + 0.06 * k, off=V(x, 0.0, z) * 0.9 + V(0, -0.4, 0), rot=25 * (1 if x >= 0 else -1), ax='Z', anchor=p):
                pane(f'sw{k}', p, 0.34, 0.21, m.code if k % 2 else m.code2, m)
            pts[(ti, x)] = p; k += 1
    # interfaces: each module wired to the ones it calls, and the top one to the heart
    links = [((0, 0.0), (1, -0.66)), ((0, 0.0), (1, 0.66)), ((1, -0.66), (2, -0.58)), ((1, -0.66), (2, 0.0)), ((1, 0.66), (2, 0.0)), ((1, 0.66), (2, 0.58))]
    with part('chest', 0.95, 1.0):
        for a, b in links:
            p0, p1 = pts[a] - V(0, 0, 0.13), pts[b] + V(0, 0, 0.13)
            cyl(f'sw-link{a}{b}', p0, p1, 0.008, m.path, seg=8)
        cyl('sw-heart-link', pts[(0, 0.0)] - V(0, 0, 0.13), HEART + V(0, 0.05, 0.33), 0.008, m.path, seg=8)
    # the braces: the torso's two sides are a pair of braces, a function's body round its parts
    for sgn in (-1, 1):
        P, R = [], []
        for q in range(81):
            v = q / 40 - 1
            x = sgn * (1.10 + 0.24 * math.exp(-(v / 0.07) ** 2) - 0.20 * abs(v) ** 9)
            yv = HEART.y + 0.05 + 0.32 * v * v
            P.append(V(x, yv, CORE.z + 0.98 * v)); R.append(0.045 + 0.04 * math.exp(-(v / 0.25) ** 2))
        with part('chest', 0.60, 1.0, off=(sgn * 1.2, -0.4, 0), rot=-sgn * 20, ax='Z', anchor=V(sgn * 1.1, HEART.y, CORE.z)):
            tube(f'brace{sgn}', P, R, m.gold, res=5)

# ---------------------------------------------------------------- the vault door, the shoulders' firewall (cybersecurity)
DOORP, BOLTS = [], []
def build_armor(m):
    Md = T(*DOOR) @ Rx(90)
    with part('chest', 2.0, 2.2) as pp:
        K.lathe('door', [(0.30, -0.06), (0.64, -0.06), (0.67, -0.03), (0.67, 0.04), (0.64, 0.07), (0.30, 0.07)], m.door, Md, 128, sharp=30)
        K.ring('door-dial', 0.30, 0.40, 0.07, 0.10, m.ring_g, Md, c=0.006, seg=128)
        torus('door-rim', 0.665, 0.018, m.gold, Md @ T(0, 0, 0.04), seg=128, rseg=8)
        K.lathe('porthole', [(0, 0.00), (0.30, 0.00), (0.30, 0.004), (0, 0.004)], m.glassp, Md @ T(0, 0, 0.02), 96, sharp=30)
        for k in range(36):
            a = TAU * k / 36
            box(f'door-tick{k}', (0.006, 0.05 if k % 3 == 0 else 0.03, 0.006), m.gold, Md @ T(0.37 * math.cos(a), 0.37 * math.sin(a), 0.102) @ Rz(math.degrees(a) + 90), bevel=0)
        # the handle: a spoked wheel at the side; the padlock hangs under the door
        for s in (-1, 1):
            cyl(f'door-hinge{s}', HINGE + V(0, 0.0, s * 0.42 - 0.08), HINGE + V(0, 0.0, s * 0.42 + 0.08), 0.045, m.gold, seg=16)
        pc = DOOR + V(0.0, -0.10, -0.80)
        box('padlock', (0.20, 0.07, 0.17), m.gold, T(*pc), bevel=0.025)
        torus('padlock-shackle', 0.065, 0.016, m.vmetal, T(*(pc + V(0, 0, 0.085))) @ Rx(90), seg=40, rseg=8)
        ball('padlock-keyhole', pc + V(0, -0.036, 0.015), 0.018, m.black, seg=12)
        box('padlock-slot', (0.012, 0.01, 0.04), m.black, T(*(pc + V(0, -0.037, -0.012))), bevel=0)
        cyl('padlock-hasp', DOOR + V(0, -0.08, -0.67), pc + V(0, 0, 0.13), 0.012, m.gold, seg=10)
    DOORP.append(pp)
    with part('chest', 2.0, 2.2) as pb:
        for k in range(8):
            a = TAU * (k + 0.5) / 8
            u = V(math.cos(a), 0, math.sin(a))
            cyl(f'bolt{k}', DOOR + u * 0.58 + V(0, -0.0, 0), DOOR + u * 0.72, 0.035, m.gold, seg=16)
    BOLTS.append(pb)
    # the back of the chest, the collar
    with part('chest', 2.2, 2.7, off=(0, 1.6, 0)):
        U.shell('back-shield', CORE + V(0, 0.02, 0), (1.34, 0.98, 1.22), 22, 158, -46, 64, 0.08, m.dark, nu=36, nv=22)
        U.shell('spine-plate', CORE + V(0, 0.10, 0), (1.40, 1.04, 1.26), 78, 102, -56, 70, 0.06, m.gold, nu=8, nv=24)
    with part('chest', 2.7, 3.0, off=(0, 0, 0.8)):
        K.ring('collar', 0.30, 0.52, 8.02 - 0.05, 8.02 + 0.05, m.gold, I4, c=0.01, seg=96)
        K.ring('collar-low', 0.40, 0.66, 7.90 - 0.06, 7.90 + 0.04, m.obs, I4, c=0.01, seg=96)
    # firewall cells over each shoulder plate, a few lit
    rs = random.Random(3)
    for s in (-1, 1):
        sg = '+' if s > 0 else '-'; sh = REST[f'sh{sg}']; c = sh + V(0, 0.02, 0.02); rad = V(0.80, 0.76, 0.68)
        with part(f'sh{sg}', 2.4, 3.0, off=(s * 0.6, 0, 0.6)):
            for i in range(9):
                for j in range(5):
                    lo = math.radians((-62 + 15 * i + (7.5 if j % 2 else 0)) if s > 0 else (118 + 15 * i + (7.5 if j % 2 else 0)))
                    la = math.radians(16 + 14 * j)
                    if la > math.radians(80): continue
                    d = V(math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))
                    p = c + V(rad.x * d.x, rad.y * d.y, rad.z * d.z) * 1.012
                    n = V(d.x / rad.x, d.y / rad.y, d.z / rad.z).normalized()
                    K.lathe(f'hex{sg}{i}{j}', [(0, 0), (0.058, 0), (0.058, 0.014), (0, 0.014)], m.lit_vio if rs.random() < 0.18 else m.dark, S.along(p, n) @ Rz(30), 6, sharp=1)

def door_state(B):
    k = 1 - eout(clamp((B - 2.2) / 0.6)); lock = eout(clamp((B - 2.85) / 0.15))
    R = T(*HINGE) @ Rz(-105 * k) @ T(*(-HINGE))
    for p in DOORP[0].obs: p['ob'].matrix_basis = R @ p['ob'].matrix_basis
    for i, p in enumerate(BOLTS[0].obs):
        a = TAU * (i + 0.5) / 8; u = V(math.cos(a), 0, math.sin(a))
        p['ob'].matrix_basis = R @ T(*(-u * 0.12 * (1 - lock))) @ p['ob'].matrix_basis

# ---------------------------------------------------------------- the forearms are a controller (game & app)
def arm_frame(sg, t=0.55, out=0.33):
    el, wr = REST[f'el{sg}'], REST[f'wr{sg}']
    ax = (wr - el).normalized(); o = V(0, -1, 0); o = (o - ax * o.dot(ax)).normalized(); side = ax.cross(o)
    M = Matrix((side, o, ax)).transposed().to_4x4(); M.translation = el + (wr - el) * t + o * out
    return M

def build_game(m):
    for s in (-1, 1):
        sg = '+' if s > 0 else '-'
        M = arm_frame(sg)
        with part(f'el{sg}', 1.45 + (0.12 if s > 0 else 0), 1.8 + (0.08 if s > 0 else 0), off=(s * 1.2, -0.6, 0)):
            box(f'pad{sg}', (0.40, 0.05, 0.66), m.dark, M, bevel=0.05)
            if s < 0:   # on the viewer's left: the d-pad and a stick
                for d in ((1, 0), (0, 1)):
                    box(f'dpad{d}', (0.17 if d[0] else 0.055, 0.035, 0.055 if d[0] else 0.17), m.gold, M @ T(0, 0.035, 0.15), bevel=0.008)
                cyl('stick-l', M @ V(0.02, 0.02, -0.14), M @ V(0.02, 0.08, -0.14), 0.035, m.obs, seg=20)
                K.lathe('stick-l-cap', [(0, 0), (0.06, 0), (0.065, 0.01), (0.06, 0.02), (0, 0.015)], m.vmetal, M @ T(0.02, 0.08, -0.14) @ Rx(-90), 32, sharp=30)
            else:       # on the right: four buttons and a stick
                for k, (dx, dz, mat) in enumerate(((0.0, 0.25, m.lit_gold), (0.09, 0.16, m.ivory), (-0.09, 0.16, m.ivory), (0.0, 0.07, m.lit_vio))):
                    cyl(f'btn{k}', M @ V(dx, 0.02, dz), M @ V(dx, 0.055, dz), 0.038, mat, seg=20, round_=0.01)
                cyl('stick-r', M @ V(-0.02, 0.02, -0.14), M @ V(-0.02, 0.08, -0.14), 0.035, m.obs, seg=20)
                K.lathe('stick-r-cap', [(0, 0), (0.06, 0), (0.065, 0.01), (0.06, 0.02), (0, 0.015)], m.vmetal, M @ T(-0.02, 0.08, -0.14) @ Rx(-90), 32, sharp=30)
            box(f'pad{sg}-trim', (0.405, 0.052, 0.012), m.gold, M @ T(0, 0, 0.33), bevel=0.003)
        # wrist screens: apps on the right, a level on the left
        Mw = arm_frame(sg, t=0.93, out=0.27)
        with part(f'el{sg}', 1.6, 1.88, off=(s * 0.8, -0.5, -0.3)):
            box(f'wrist{sg}', (0.30, 0.03, 0.22), m.dark, Mw, bevel=0.02)
            if s > 0:
                for i in range(3):
                    for j in range(3):
                        box(f'app{i}{j}', (0.060, 0.012, 0.050), m.app if (i + j) % 3 else m.lit_gold, Mw @ T(-0.08 + 0.08 * i, 0.016, -0.06 + 0.06 * j), bevel=0.012)
            else:
                for i, h in enumerate((1, 1, 2, 0, 3, 3)):
                    for j in range(h):
                        box(f'lvl{i}{j}', (0.036, 0.012, 0.03), m.lit_vio, Mw @ T(-0.10 + 0.04 * i, 0.016, -0.075 + 0.032 * j), bevel=0)
                ball('lvl-coin', Mw @ V(0.02, 0.02, 0.03), 0.012, m.lit_gold, seg=10)

# ---------------------------------------------------------------- the legs are machines (mechatronics, next)
def build_mech(m):
    for s in (-1, 1):
        sg = '+' if s > 0 else '-'
        kn, an, hip = REST[f'kn{sg}'], REST[f'an{sg}'], REST[f'hip{sg}']
        ghost = s < 0            # the viewer's left leg is less far along: some of its parts are only drawn
        gp = kn + V(s * 0.25, 0, 0)
        with part(f'kn{sg}', 3.55, 3.95, off=(s * 0.8, 0, 0), spin=0.8 * s):
            K.gear(f'knee-gear{sg}', 0.32, 24, 0.05, 0.035, m.gold, T(*gp) @ Ry(90))
        pp = gp + V(0, 0.08, 0.44)
        with part(f'kn{sg}', 3.65, 4.05, off=(s * 0.8, 0, 0.4), spin=-1.6 * s):
            if ghost: torus(f'pinion-ghost{sg}', 0.15, 0.006, m.ghost, T(*pp) @ Ry(90), seg=64, rseg=4)
            else: K.gear(f'pinion{sg}', 0.15, 12, 0.05, 0.03, m.vmetal, T(*pp) @ Ry(90))
        with part(f'kn{sg}', 3.7, 4.1, off=(s * 0.4, 0.6, 0)):
            a0 = kn + V(s * 0.12, 0.30, -0.30); a1 = an + V(s * 0.06, 0.26, 0.40)
            mid = a0 + (a1 - a0) * 0.58
            if ghost:
                for dx in (-0.06, 0.06): cyl(f'piston-ghost{sg}{dx}', a0 + V(dx, 0, 0), mid + V(dx, 0, 0), 0.004, m.ghost, seg=6)
                cyl(f'rod-ghost{sg}', mid, a1, 0.004, m.ghost, seg=6)
            else:
                cyl(f'piston{sg}', a0, mid, 0.075, m.dark, seg=24, round_=0.01)
                cyl(f'rod{sg}', mid - (a1 - a0) * 0.05, a1, 0.03, m.gold, seg=16)
                K.ring(f'piston{sg}-band', 0.075, 0.085, -0.01, 0.01, m.gold, S.along(a0 + (a1 - a0) * 0.1, a1 - a0), c=0.002, seg=32)
        with part(f'hip{sg}', 3.5, 3.9, off=(s * 0.8, 0, 0)):
            sp = hip + V(s * 0.38, 0, 0.02)
            box(f'servo{sg}', (0.16, 0.34, 0.30), m.dark, T(*sp), bevel=0.02)
            box(f'servo{sg}-label', (0.162, 0.20, 0.03), m.lit_gold, T(*(sp + V(0, 0, 0.06))), bevel=0)
            K.lathe(f'servo{sg}-horn', [(0, 0), (0.07, 0), (0.07, 0.02), (0, 0.02)], m.gold, T(*(sp + V(s * 0.08, 0, 0))) @ Ry(90 * s), 32, sharp=30)
            kb = hip + (REST[f'kn{sg}'] - hip) * 0.45 + V(s * 0.34, -0.02, 0)
            box(f'board{sg}', (0.02, 0.30, 0.62), m.vmetal if not ghost else m.dark, T(*kb), bevel=0.004)
            for k in range(5):
                box(f'trace{sg}{k}', (0.022, 0.006, 0.52), m.lit_gold if not ghost else m.ghost, T(*(kb + V(s * 0.002, -0.12 + 0.06 * k, 0))), bevel=0)

def strip_loose_plates():
    for name in ('farm-plate+', 'farm-plate-', 'shin-plate+', 'shin-plate-'):
        ob = bpy.data.objects.get(name)
        if ob:
            U.PARTS[:] = [p for p in U.PARTS if p['ob'] is not ob]; bpy.data.objects.remove(ob)

# ---------------------------------------------------------------- the touch: a pane of glass, the print it leaves
TOUCH = {}
def build_touch(m):
    g = box('the-glass', (8.0, 0.008, 8.0), m.screen_glass, I4, bevel=0); g.hide_render = True
    disc = K.lathe('glass-print', [(0, -0.002), (0.085, -0.002), (0.085, 0.002), (0, 0.002)], m.print_lit, I4, 96, sharp=30); disc.hide_render = True
    rings = [torus(f'ripple{k}', 0.12 + 0.09 * k, 0.0018, U.emit_g(f'ripple-{k}', GOLD_LIGHT, 0.9 - 0.4 * k, 'ripple'), I4, seg=96, rseg=4) for k in range(2)]
    for r in rings: r.hide_render = True
    TOUCH.update(glass=g, disc=disc, rings=rings)

def fingertip_rest(sg):
    s = 1 if sg == '+' else -1
    wr = REST[f'wr{sg}']; pc = wr + V(0, -0.02, -0.28)
    p = pc + V(0, -0.13, -0.20); d = V(-s * 0.05, -0.06, -1).normalized()
    for L in (0.26, 0.21, 0.16):
        p = p + d * L; d = (d + V(-s * 0.18, 0, 0.02)).normalized()
    return p

POSES = {
    'kneel': dict(U.POSES['kneel'], **{'sh+': (-40, 13, 0), 'sh-': (-40, -13, 0), 'el+': (-30, 0, 6), 'el-': (-30, 0, -6), 'wr+': (-12, 0, 0), 'wr-': (-12, 0, 0)}),
    'stand': U.POSES['stand'],
    'reach': {'root': V(0, 0, 0), 'chest': (5, 0, 0), 'neck': (2, 0, 0), 'head': (4, 0, -6),
              'sh-': (-74, 10, 0), 'el-': (-10, 0, 0), 'wr-': (-6, 0, 0), 'sh+': (4, -9, 0), 'el+': (-14, 0, 0)},
}
def pose(a, b, w):
    A, Bp = POSES[a], POSES[b]
    for k, e in J.items():
        ra, rb = Vector(A.get(k, (0, 0, 0))), Vector(Bp.get(k, (0, 0, 0)))
        r = ra.lerp(rb, w)
        loc = REST[k] + (A['root'].lerp(Bp['root'], w) if k == 'pelvis' else V(0, 0, 0))
        e.matrix_basis = T(*loc) @ Euler([math.radians(x) for x in r]).to_matrix().to_4x4()

def state(pa, pb, w, B, g=0):
    pose(pa, pb, w); U.assemble(B, g); door_state(B)
    U.set_iris(0.07, 2.0 * g)
    for name in [o.name for o in U.EYE_PARTS['blades']] + [U.EYE_PARTS['rim'].name]:
        p = U.PART_OF[name]
        if not p['ob'].hide_render: p['ob'].matrix_basis = p['M']
    bpy.context.view_layer.update()

def W(j, p): return J[j].matrix_world @ T(*REST[j]).inverted() @ Vector(p)

# ---------------------------------------------------------------- scene
def scene():
    s = K.fresh()
    s.cycles.volume_bounces = 0; s.cycles.transmission_bounces = 10; s.cycles.max_bounces = 12; s.cycles.transparent_max_bounces = 48
    m = Mats()
    S.HAZE = ENV('R74_HAZE', 0.009)
    S.world(m)
    w = s.world.node_tree
    w.nodes['Background'].inputs['Color'].default_value = (*mul(U.DPUR, 0.22), 1)
    vol = next(n for n in w.nodes if n.bl_idname == 'ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.80, 0.52, 1.0, 1); vol.inputs['Anisotropy'].default_value = 0.4
    U.build_joints()
    build_heart(m); build_software(m); U.build_head(m); build_armor(m)
    n0 = len(U.PARTS); U.build_body(m)
    # the arms come with game & app development: the hands are where software meets a person
    arm = {J[k] for k in ('sh+', 'sh-', 'el+', 'el-', 'wr+', 'wr-')}
    for p in U.PARTS[n0:]:
        if p['ob'].parent in arm or p['ob'].name.startswith('sh-axle'):
            p['t0'] -= 2.15; p['t1'] -= 2.15
    build_game(m); build_mech(m)
    strip_loose_plates()
    for p in U.PARTS: U.PART_OF[p['ob'].name] = p
    U.build_place(m); U.build_dust(m); U.build_desk(m); build_touch(m)
    L = U.build_lights(m)
    L['wash'].data.energy *= 0.6; L['beam'].data.energy *= 0.7
    L['heart'] = glow('heart-light', HEART + V(0, -0.35, 0), GOLD_LIGHT, 6.0, size=0.05)
    M = L['heart'].matrix_world.copy(); L['heart'].parent = J['chest']; L['heart'].matrix_parent_inverse = T(*REST['chest']).inverted(); L['heart'].matrix_basis = M
    cam = S.cam('cam', loc=(0, -14, 5), target=(0, 0, 5), lens=35)
    cam.data.clip_start = 0.004; cam.data.clip_end = 500; s.camera = cam
    return s, m, L, cam

def look(cam, pos, tgt, lens, fstop=None, focus=None):
    pos, tgt = Vector(pos), Vector(tgt)
    cam.location = pos; cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens; cam.data.shift_x = 0
    cam.data.dof.use_dof = bool(fstop)
    if fstop: cam.data.dof.aperture_fstop = fstop; cam.data.dof.focus_distance = focus or (tgt - pos).length

def main():
    os.makedirs(OUT, exist_ok=True)
    s, m, L, cam = scene()
    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)
    HALL = ['key', 'fill', 'rim-r', 'rim-l', 'top', 'beam', 'wash']
    def hall(on, k=1.0):
        for n in HALL: L[n].hide_render = not on
        for o in U.DESK['lights']: o.hide_render = on
    def chest_frame():
        H = W('chest', HEART); n = (W('chest', HEART + V(0, -1, 0)) - H).normalized()
        up = (W('chest', HEART + V(0, 0, 1)) - H).normalized(); side = n.cross(up).normalized()
        return H, n, up, side
    stops = {}
    # kneeling stops
    state('kneel', 'kneel', 0, 1.0)
    H, n, up, side = chest_frame()
    stops['origin'] = dict(st=('kneel', 'kneel', 0, 0.0), pos=H + n * 0.46 + side * 0.17 + up * 0.10, tgt=H - side * 0.03, lens=50, fstop=5.6)
    stops['software'] = dict(st=('kneel', 'kneel', 0, 1.0), pos=H + n * 4.3 + side * 0.35 + up * 0.2, tgt=H + side * 0.95 + up * 0.05, lens=32)
    state('kneel', 'kneel', 0, 1.9)
    fa = (W('el+', U.REST['el+'] + (U.REST['wr+'] - U.REST['el+']) * 0.55) + W('el-', U.REST['el-'] + (U.REST['wr-'] - U.REST['el-']) * 0.55)) / 2
    print('GAME fa', tuple(round(x, 2) for x in fa), 'el+', tuple(round(x, 2) for x in W('el+', REST['el+'])), 'wr+', tuple(round(x, 2) for x in W('wr+', REST['wr+'])), 'hidden', bpy.data.objects['pad+'].hide_render, flush=True)
    stops['game'] = dict(st=('kneel', 'kneel', 0, 1.9), pos=fa + V(-0.1, -5.6, 1.9), tgt=fa + V(-1.45, 0, 0.15), lens=22)
    state('kneel', 'kneel', 0, 3.0)
    H, n, up, side = chest_frame(); Dc = W('chest', DOOR)
    stops['cyber'] = dict(st=('kneel', 'kneel', 0, 3.0), pos=Dc + n * 3.6 + side * 0.3 + up * 0.5, tgt=Dc + side * 0.95 + up * 0.15, lens=33)
    state('kneel', 'kneel', 0, 4.2)
    Kp = W('kn+', REST['kn+'])
    stops['mechatronics'] = dict(st=('kneel', 'kneel', 0, 4.2), pos=Kp + V(2.9, -1.3, 1.6), tgt=Kp + V(-0.5, 0.7, 0.55), lens=30)
    stops['works'] = dict(st=('kneel', 'kneel', 0, 5.0), pos=V(2.4, -9.8, 1.6), tgt=V(0.6, 0, 3.3), lens=32)
    state('stand', 'stand', 0, 6.0)
    E1 = W('head', EYE)
    stops['awakening'] = dict(st=('stand', 'stand', 0, 6.0), pos=V(3.4, -7.4, 3.0), tgt=V(0.9, 0, 7.3), lens=30, lit=True)
    state('reach', 'reach', 0, 6.0)
    F = W('wr-', fingertip_rest('-'))
    TOUCH['F'] = F
    stops['touch'] = dict(st=('reach', 'reach', 0, 6.0), pos=F + V(0.30, -1.55, -0.30), tgt=F + V(0.70, 1.0, 0.80), lens=26, lit=True, touch=True)
    order = ['origin', 'software', 'game', 'cyber', 'mechatronics', 'works', 'awakening', 'touch']
    def setup(k, g=0):
        st = stops[k]; state(*st['st'], g)
        lit = st.get('lit'); U.energy(dict(eye=1.6 if lit else 0.12, paths=2.0 if lit else 1.0, rooms=1.4 if lit else 1.0, print=1.6 if k in ('origin', 'touch') else 1.0, glyph=1.5 if lit else 1.0, floor=1.0 if lit else 0.6))
        L['eye'].data.energy = 18.0 if lit else 0.0
        on = bool(st.get('touch'))
        for o in [TOUCH['glass'], TOUCH['disc']] + TOUCH['rings']: o.hide_render = not on
        if on:
            Fp = TOUCH['F']; Mg = T(Fp.x, Fp.y - 0.012, Fp.z)
            TOUCH['glass'].matrix_world = Mg
            TOUCH['disc'].matrix_world = Mg @ T(0, -0.006, 0) @ Rx(90)
            for r in TOUCH['rings']: r.matrix_world = Mg @ T(0, -0.006, 0) @ Rx(90)
        hall(True)
        look(cam, st['pos'], st['tgt'], st['lens'], fstop=st.get('fstop'))
    job, _, arg = JOB.partition(':')
    only = arg.split(',') if arg else None
    if job in ('look', 'keys'):
        for k in order:
            if only and k not in only: continue
            setup(k); shoot(os.path.join(OUT, f'{job}-{k}.jpg'))
        if not only or 'desk' in only:
            hall(False)
            for o in [TOUCH['glass'], TOUCH['disc']] + TOUCH['rings']: o.hide_render = True
            U.set_screen(os.path.join(OUT, f'{job}-touch.jpg'))
            look(cam, U.DX + V(0.03, -0.60, 1.22), U.DX + V(-0.04, 0.62, 1.04), 26)
            shoot(os.path.join(OUT, f'{job}-desk.jpg'))
        # where things land on screen, for the page
        out = {}
        from bpy_extras.object_utils import world_to_camera_view
        setup('works'); out['works'] = [round(x, 4) for x in world_to_camera_view(s, cam, W('chest', CORE))[:2]]
        look(cam, U.DX + V(0.03, -0.60, 1.22), U.DX + V(-0.04, 0.62, 1.04), 26)
        hall(False); bpy.context.view_layer.update()
        corners = [world_to_camera_view(s, cam, U.DX + V(x, 0.66, 1.08) + V(0, 0, 0)) for x in (0,)]
        mon = [world_to_camera_view(s, cam, U.DX + p) for p in (V(-0.32, 0.66 - 0.019, 1.08 - 0.18), V(0.32, 0.66 + 0.019, 1.08 + 0.18))]
        out['monitor'] = dict(x0=round(mon[0].x, 4), y0=round(1 - mon[1].y, 4), x1=round(mon[1].x, 4), y1=round(1 - mon[0].y, 4))
        with open(os.path.join(OUT, 'layout.json'), 'w') as fh: json.dump(out, fh, indent=1)
        print('layout', out, flush=True)

if __name__ == '__main__':
    main()
