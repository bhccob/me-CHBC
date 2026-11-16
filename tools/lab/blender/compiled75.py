# LAB ONLY (throwaway). Round 75: Bob picked idea A, "Compiled" (2026-11-14): one line of code becomes a real machine,
# each study is the next step of making it real, and the camera only moves forward, out of the screen into the room.
#   opening       a fingerprint on Bob's monitor glass (his finger touched his own screen); focus pulls to the cursor
#   (match cut)   the screen's picture is the first frame of the world inside it
#   software      the cursor types; the code lifts off and stacks into blocks; the blocks link into a structure
#   game & app    light comes on in the same blocks: platforms, a coin, a flag, a player; two blocks open into apps
#   cybersecurity glitches fly in; the outer panels fold up into walls; a lock ring closes on top
#   (match cut)   everything compiles down into one glowing chip, the same chip inside his PC
#   mechatronics  the signal leaves the chip along the board, out the cable, into a robot arm on the desk
#   selected work the arm builds each project as a tile on a turntable (drag to turn it)
#   ending        pull back: monitor, PC, arm and turntable on his desk, the print still on the glass
#   blender -b --factory-startup --python tools/lab/blender/compiled75.py -- <out-dir> <job> [samples] [res%]
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix
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
ENV = U.ENV
GOLD_LIGHT, LIGHT_VIO, DPUR, GOLD, IVORY = U.GOLD_LIGHT, U.LIGHT_VIO, U.DPUR, U.GOLD, U.IVORY
LAV = srgb('#BBA0FF')
REPO = U.REPO
def sm(t): t = clamp(t); return t * t * (3 - 2 * t)
def win(x, a, b): return clamp((x - a) / (b - a))

# ---------------------------------------------------------------- the desk (metres, origin on the floor)
DZ = 0.75                                   # desk top
MC = V(-0.15, 0.62, 1.10)                   # the monitor's screen centre
SW, SH = 0.72, 0.405
MON = T(*MC) @ Rx(-6)                       # screen frame: local X across, local Z up, local -Y out of the screen
PRINT_L = V(0.175, -0.0050, -0.075)         # where his finger touched the glass, in the screen frame
CUR_L = V(-0.27, -0.002, 0.155)             # where the cursor sits on the screen (matches the world inside)
PC = V(0.84, 0.56, DZ)                      # the PC's footprint centre
CHIP = V(0.84 + 0.085, 0.56, DZ + 0.30)     # the CPU die, facing -X through the glass side
AB = V(0.60, 0.16, DZ)                      # the arm's base
TT = V(0.32, 0.27, DZ)                      # the turntable's centre
SLOT_R = 0.095

def print_glass_mat():
    m = NT.fingerprint_mat(); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    k = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeMath' and n.outputs[0].links and n.outputs[0].links[0].to_socket == b.inputs['Emission Strength'])
    mask = k.inputs[0].links[0].from_socket
    nt.links.new(mask, b.inputs['Alpha'])
    U.reg('print', k.inputs[1], 0.45)
    return m

class Mats(U.Mats):
    def __init__(self):
        super().__init__()
        self.print = print_glass_mat()
        self.screen = U.screen_mat('monitor-screen')
        self.glass = K.thin_glass('monitor-glass', (0.97, 0.96, 1.0), 0.01)
        setin(self.glass.node_tree.nodes['Principled BSDF'], 'Specular IOR Level', 0.22)     # a matte screen: no bright reflections
        self.case_glass = K.thin_glass('case-glass', (0.78, 0.70, 0.88), 0.02)
        self.wall = principled('wall', mul(DPUR, 0.70), 0.0, 0.92)
        self.wood = principled('desk-top', (0.016, 0.012, 0.020), 0.0, 0.40, coat=0.3)
        self.fabric = principled('mat', (0.010, 0.009, 0.013), 0.0, 1.0)
        self.cap = principled('keycap', (0.030, 0.026, 0.036), 0.0, 0.55)
        self.board = principled('board', (0.018, 0.012, 0.030), 0.0, 0.35, coat=0.4)
        self.bias = U.emit_g('bias', LIGHT_VIO, 20.0, 'room')
        self.lamp = U.emit_g('lamp', GOLD_LIGHT, 18.0, 'room')
        self.fan = U.emit_g('fan', LIGHT_VIO, 4.0, 'room')
        self.die = U.emit_g('die', GOLD_LIGHT, 14.0, 'die')
        self.trace = U.emit_g('trace', GOLD_LIGHT, 2.2, 'signal')
        self.pulse = U.emit_g('pulse', GOLD_LIGHT, 30.0, 'pulse')
        self.armlit = U.emit_g('arm-light', GOLD_LIGHT, 3.0, 'arm')
        self.armvio = U.emit_g('arm-violet', LIGHT_VIO, 3.0, 'arm')
        self.ghost = U.emit_g('ghost', LAV, 1.2, 'ghost')
        self.nozzle = U.emit_g('nozzle', GOLD_LIGHT, 8.0, 'nozzle')
        # inside the screen
        self.tok = [U.emit_g(f'token-{k}', c, s, 'code') for k, (c, s) in enumerate(((mul(IVORY, 0.9), 2.4), (LIGHT_VIO, 3.0), (GOLD_LIGHT, 2.6), (mul(LAV, 0.8), 2.0)))]
        self.cursor = U.emit_g('cursor', GOLD_LIGHT, 9.0, 'cursor')
        self.code = U.code_mat('block-code'); self.code2 = U.code_mat('block-code-2')
        self.blockglass = principled('block', (0.035, 0.026, 0.055), 0.4, 0.28, coat=0.5)
        self.edge = U.emit_g('block-edge', LIGHT_VIO, 4.0, 'edges')
        self.plat = U.emit_g('platform', LIGHT_VIO, 3.0, 'game')
        self.coin = U.emit_g('coin', GOLD_LIGHT, 8.0, 'game')
        self.player = U.emit_g('player', mul(IVORY, 1.0), 10.0, 'game')
        self.app = U.emit_g('app', mul(LAV, 0.85), 1.6, 'game')
        self.shard = U.emit_g('shard', mul(LAV, 1.0), 6.0, 'shards')
        self.grid = U.emit_g('grid', LIGHT_VIO, 0.28, 'grid')

# ---------------------------------------------------------------- desk build
DESK = {}
def build_room(m):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=3)
    me = bpy.data.meshes.new('floor'); bm.to_mesh(me); bm.free(); me.materials.append(principled('floor', (0.010, 0.008, 0.012), 0.0, 0.6))
    link(bpy.data.objects.new('floor', me))
    box('back-wall', (5.0, 0.10, 3.0), m.wall, T(0, 1.02, 1.5), bevel=0)
    box('side-wall', (0.10, 3.0, 3.0), m.wall, T(-1.75, 0.0, 1.5), bevel=0)
    box('desk', (2.60, 0.86, 0.040), m.wood, T(0, 0.43, DZ - 0.02), bevel=0.004)
    for x in (-1.22, 1.22): box(f'desk-leg{x}', (0.05, 0.76, 0.71), m.dark, T(x, 0.44, 0.355), bevel=0.004)
    box('desk-mat', (1.05, 0.40, 0.004), m.fabric, T(-0.12, 0.21, DZ + 0.002), bevel=0.001)
    # keyboard
    kc = V(-0.16, 0.18, DZ + 0.015)
    box('kb', (0.44, 0.145, 0.022), m.dark, T(*kc), bevel=0.004)
    box('kb-glow', (0.43, 0.135, 0.004), emit('kb-under', LIGHT_VIO, 5.0), T(*(kc - V(0, 0, 0.009))), bevel=0)
    for r in range(5):
        for c in range(15):
            w = 0.024
            if r == 4 and 4 < c <= 9: continue
            if r == 4 and c == 4: w = 0.024 * 6 + 0.004 * 5
            x = kc.x - 0.205 + c * 0.0285 + (w - 0.024) / 2; y = kc.y + 0.055 - r * 0.0285
            box(f'key{r}-{c}', (w, 0.024, 0.012), m.ivory if (r, c) in ((1, 1), (2, 2), (2, 3), (2, 1)) else m.cap, T(x, y, DZ + 0.032), bevel=0.002)
    # his coin by the keyboard
    K.ring('coin', 0.0075, 0.021, 0.0, 0.003, m.gold, T(-0.47, 0.10, DZ + 0.0035), c=0.0006, seg=48)
    for k in range(4):
        box(f'coin-sq{k}', (0.016, 0.0022, 0.0035), m.gold, T(-0.47, 0.10, DZ + 0.0035) @ Rz(90 * k) @ T(0, 0.0075, 0.0015), bevel=0)
    # the monitor: bezel, screen, the glass in front with his print on it
    box('mon-bezel', (SW + 0.020, 0.024, SH + 0.020), m.dark, MON @ T(0, 0.012, 0), bevel=0.004)
    D.quad('mon-screen', SW, SH, m.screen, MON @ T(0, -0.0015, 0))
    D.quad('mon-glass', SW + 0.004, SH + 0.004, m.glass, MON @ T(0, -0.0045, 0))
    pr = K.lathe('print', [(0, -0.002), (0.42, -0.002), (0.42, 0.002), (0, 0.002)], m.print, MON @ T(*PRINT_L) @ Rx(90) @ Rz(-18) @ Matrix.Scale(0.031, 4), 96, sharp=30)
    box('mon-back', (SW * 0.5, 0.05, SH * 0.5), m.dark, MON @ T(0, 0.045, 0), bevel=0.01)
    cyl('mon-neck', V(MC.x, MC.y + 0.09, DZ), V(MC.x, MC.y + 0.09, MC.z - 0.05), 0.018, m.dark, seg=16)
    box('mon-foot', (0.26, 0.18, 0.010), m.dark, T(MC.x, MC.y + 0.08, DZ + 0.005), bevel=0.003)
    box('bias', (1.30, 0.01, 0.015), m.bias, T(MC.x, 0.96, 0.98), bevel=0)
    # a desk lamp, warm
    L0 = T(-0.98, 0.72, DZ)
    K.lathe('lamp-base', [(0, 0), (0.07, 0), (0.07, 0.015), (0, 0.02)], m.dark, L0, 32, sharp=30)
    cyl('lamp-arm1', L0 @ V(0, 0, 0.01), L0 @ V(0.08, -0.06, 0.34), 0.008, m.gold, seg=12)
    cyl('lamp-arm2', L0 @ V(0.08, -0.06, 0.34), L0 @ V(0.26, -0.20, 0.40), 0.008, m.gold, seg=12)
    K.lathe('lamp-head', [(0, 0.0), (0.05, -0.01), (0.06, -0.06), (0, -0.06)], m.dark, L0 @ T(0.28, -0.22, 0.40) @ Rx(-20), 32, sharp=30)
    box('lamp-bulb', (0.08, 0.08, 0.004), m.lamp, L0 @ T(0.28, -0.22, 0.345), bevel=0)

def build_pc(m):
    P = PC; w, d, h = 0.24, 0.48, 0.50
    # the case: four walls and a top, the side facing the room is glass
    box('pc-right', (0.01, d, h), m.dark, T(P.x + w / 2, P.y, DZ + h / 2), bevel=0.003)
    box('pc-top', (w, d, 0.01), m.dark, T(P.x, P.y, DZ + h), bevel=0.003)
    box('pc-bottom', (w, d, 0.02), m.dark, T(P.x, P.y, DZ + 0.01), bevel=0.003)
    box('pc-back', (w, 0.01, h), m.dark, T(P.x, P.y + d / 2, DZ + h / 2), bevel=0.003)
    box('pc-front', (w, 0.012, h), m.dark, T(P.x, P.y - d / 2, DZ + h / 2), bevel=0.003)
    box('pc-glass', (0.004, d - 0.01, h - 0.02), m.case_glass, T(P.x - w / 2, P.y, DZ + h / 2), bevel=0)
    for z in (DZ + 0.12, DZ + 0.26, DZ + 0.40):
        M = T(P.x, P.y - d / 2 + 0.02, z) @ Rx(90)
        torus(f'fan{z:.2f}', 0.058, 0.005, m.fan, M, seg=48, rseg=6)
        for b in range(7): box(f'fan{z:.2f}-blade{b}', (0.04, 0.016, 0.002), m.vmetal, M @ Rz(360 * b / 7) @ T(0.032, 0, 0) @ Rx(25), bevel=0)
    # the motherboard on the far wall, the CPU in the middle of it
    bx = P.x + w / 2 - 0.012
    box('mobo', (0.004, d - 0.06, h - 0.08), m.board, T(bx, P.y, DZ + h / 2 + 0.01), bevel=0.001)
    Mc = T(*CHIP) @ Ry(-90)                   # local Z faces -X, toward the glass
    box('cpu-socket', (0.075, 0.075, 0.010), m.dark, Mc @ T(0, 0, -0.005), bevel=0.002)
    box('cpu-lid', (0.050, 0.050, 0.006), m.gold, Mc @ T(0, 0, 0.003), bevel=0.002)
    box('cpu-die', (0.022, 0.022, 0.003), m.die, Mc @ T(0, 0, 0.0075), bevel=0.0005)
    for k in range(10):
        for s in (-1, 1):
            box(f'cpu-pin{k}{s}', (0.004, 0.010, 0.002), m.gold, Mc @ T(-0.0225 + 0.005 * k, s * 0.044, -0.0005), bevel=0)
            box(f'cpu-pinv{k}{s}', (0.010, 0.004, 0.002), m.gold, Mc @ T(s * 0.044, -0.0225 + 0.005 * k, -0.0005), bevel=0)
    # traces from the chip: down and forward to the port the cable leaves from
    rs = random.Random(8)
    for k in range(7):
        yy = -0.03 + 0.01 * k
        pts = [V(bx - 0.003, CHIP.y + yy, CHIP.z - 0.04), V(bx - 0.003, CHIP.y + yy, CHIP.z - 0.12 - 0.01 * k),
               V(bx - 0.003, P.y - d / 2 + 0.05 + 0.006 * k, CHIP.z - 0.12 - 0.01 * k), V(bx - 0.003, P.y - d / 2 + 0.05 + 0.006 * k, DZ + 0.06)]
        U.tube(f'trace{k}', pts, [0.0012] * len(pts), m.trace, res=2)
    for k in range(4):
        box(f'ram{k}', (0.006, 0.010, 0.13), m.vmetal, T(bx - 0.006, CHIP.y + 0.08 + 0.016 * k, CHIP.z), bevel=0.001)
        box(f'ram{k}-led', (0.0065, 0.006, 0.12), m.fan, T(bx - 0.007, CHIP.y + 0.08 + 0.016 * k, CHIP.z + 0.003), bevel=0)
    box('gpu', (0.12, 0.30, 0.05), m.vmetal, T(bx - 0.065, P.y - 0.02, DZ + 0.15), bevel=0.004)
    box('gpu-strip', (0.004, 0.26, 0.006), m.trace, T(bx - 0.125, P.y - 0.02, DZ + 0.17), bevel=0)
    DESK['port'] = V(P.x - 0.06, P.y - d / 2 - 0.006, DZ + 0.06)
    box('port', (0.03, 0.012, 0.016), m.gold, T(*DESK['port']), bevel=0.002)

CABLE = {}
def build_cable(m):
    p0 = DESK['port'] + V(0, -0.01, 0); p3 = AB + V(0.03, 0.05, 0.012)
    pts = bezier(p0, p0 + V(0, -0.10, -0.04), p3 + V(0.12, 0.08, 0.0), p3, 60)
    pts = [V(p.x, p.y, max(p.z, DZ + 0.006)) for p in pts]
    U.tube('cable', pts, [0.0055] * len(pts), m.dark, res=4)
    CABLE['pts'] = pts
    CABLE['pulse'] = ball('pulse', pts[0], 0.009, m.pulse, seg=16)

# the arm: a base, a turret, two links and a print head; built once, posed every frame
ARM = {}
ARM_OFF = {}
L1, L2, SH0 = 0.21, 0.19, 0.11
def put(o, M): o.matrix_world = M @ ARM_OFF[o.name]
def build_arm(m):
    ARM['base'] = K.lathe('arm-base', [(0, 0), (0.065, 0), (0.065, 0.025), (0.055, 0.04), (0, 0.04)], m.dark, I4, 64, sharp=30)
    ARM['base-ring'] = torus('arm-base-ring', 0.060, 0.004, m.armlit, I4, seg=64, rseg=6)
    ARM['turret'] = K.lathe('arm-turret', [(0, 0), (0.045, 0), (0.048, 0.05), (0.03, 0.075), (0, 0.075)], m.obs, I4, 48, sharp=30)
    ARM['hub1'] = cyl('arm-hub1', V(-0.035, 0, 0), V(0.035, 0, 0), 0.032, m.gold, seg=32, round_=0.006)
    ARM['link1'] = cyl('arm-link1', V(0, 0, 0), V(0, 0, L1), 0.020, m.obs, seg=24, round_=0.01)
    ARM['plate1'] = box('arm-plate1', (0.052, 0.012, L1 * 0.7), m.dark, T(0, -0.024, L1 * 0.5), bevel=0.004)
    ARM['line1'] = box('arm-line1', (0.004, 0.013, L1 * 0.6), m.armvio, T(0, -0.025, L1 * 0.5), bevel=0)
    ARM['hub2'] = cyl('arm-hub2', V(-0.028, 0, 0), V(0.028, 0, 0), 0.025, m.gold, seg=32, round_=0.005)
    ARM['link2'] = cyl('arm-link2', V(0, 0, 0), V(0, 0, L2), 0.016, m.obs, seg=24, round_=0.008)
    # the second link's cover is not made yet: only drawn
    ARM['ghost2'] = [cyl(f'arm-ghost2-{s}', V(s * 0.024, -0.018, 0.03), V(s * 0.024, -0.018, L2 - 0.03), 0.0018, m.ghost, seg=6) for s in (-1, 1)]
    ARM['ghost2'] += [cyl(f'arm-ghost2-r{k}', V(-0.024, -0.018, z), V(0.024, -0.018, z), 0.0018, m.ghost, seg=6) for k, z in enumerate((0.03, L2 - 0.03))]
    ARM['hub3'] = ball('arm-hub3', V(0, 0, 0), 0.020, m.gold, seg=24)
    ARM['head'] = K.lathe('arm-head', [(0, 0.0), (0.028, 0.0), (0.03, -0.03), (0.012, -0.06), (0.004, -0.075), (0, -0.075)], m.dark, I4, 48, sharp=30)
    ARM['nozzle'] = ball('arm-nozzle', V(0, 0, -0.077), 0.006, m.nozzle, seg=12)
    ARM['eye'] = torus('arm-eye', 0.016, 0.003, m.armlit, I4, seg=32, rseg=6)
    # each part keeps the offset it was built with, relative to the joint frame it hangs on
    for k, v in ARM.items():
        for o in (v if isinstance(v, list) else [v]): ARM_OFF[o.name] = o.matrix_world.copy()

def arm_pose(yaw, a1, a2, hold=None):
    """yaw about Z; a1 the first link's angle from upright, a2 the elbow's bend; the head always points down."""
    Ry_ = Rz(math.degrees(yaw))
    put(ARM['base'], T(*AB)); put(ARM['base-ring'], T(*(AB + V(0, 0, 0.026))))
    put(ARM['turret'], T(*(AB + V(0, 0, 0.035))) @ Ry_)
    S0 = AB + V(0, 0, SH0)
    fw = Ry_.to_3x3() @ V(0, -1, 0)
    d1 = (V(0, 0, 1) * math.cos(a1) + fw * math.sin(a1)); E = S0 + d1 * L1
    d2 = (V(0, 0, 1) * math.cos(a1 + a2) + fw * math.sin(a1 + a2)); W = E + d2 * L2
    def along(p, d): return T(*p) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    side = Ry_
    put(ARM['hub1'], T(*S0) @ side)
    M1 = T(*S0) @ side @ Rx(math.degrees(a1))
    for k in ('link1', 'plate1', 'line1'): put(ARM[k], M1)
    put(ARM['hub2'], T(*E) @ side)
    M2 = T(*E) @ side @ Rx(math.degrees(a1 + a2))
    put(ARM['link2'], M2)
    for o in ARM['ghost2']: put(o, M2)
    put(ARM['hub3'], T(*W))
    put(ARM['head'], T(*W) @ side)
    put(ARM['nozzle'], T(*W) @ side)
    put(ARM['eye'], T(*(W + fw * 0.029 + V(0, 0, -0.02))) @ side @ Rx(90))
    return W + V(0, 0, -0.083)

def arm_reach(target):
    """Point the head's tip at target: solve the two links in the vertical plane through the base."""
    S0 = AB + V(0, 0, SH0); W = target + V(0, 0, 0.083)
    dv = W - S0; yaw = math.atan2(-dv.x, dv.y) + math.pi           # fw = Rz(yaw)(0,-1,0) points from base to target
    h = math.hypot(dv.x, dv.y); z = dv.z; r = min(math.hypot(h, z), L1 + L2 - 1e-4)
    c2 = (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2); a2 = math.acos(clamp(c2, -1, 1))      # elbow up
    phi = math.atan2(h, z); a1 = phi - math.atan2(L2 * math.sin(a2), L1 + L2 * math.cos(a2))
    return yaw, a1, a2

# the turntable and the four tiles it carries
TILES = {}
PROJ = [('jontai', 'src/assets/projects/jontai-type.webp'), ('lumo', 'tools/lab/mock/img/lumo.webp'), ('locked', None), ('cookies', 'src/assets/projects/cookies-playing.webp')]
def build_turntable(m):
    TILES['platter'] = link(bpy.data.objects.new('platter', None))
    K.lathe('tt-base', [(0, 0), (0.15, 0), (0.15, 0.012), (0.14, 0.016), (0, 0.016)], m.dark, T(*TT), 96, sharp=30)
    objs = [K.lathe('tt-platter', [(0, 0.016), (0.135, 0.016), (0.135, 0.028), (0, 0.028)], m.obs, I4, 96, sharp=30),
            K.ring('tt-code', 0.112, 0.130, 0.0275, 0.0295, m.ring_g, I4, c=0.0005, seg=128),
            torus('tt-rim', 0.136, 0.003, m.gold, T(0, 0, 0.024), seg=96, rseg=6)]
    for o in objs: o.parent = TILES['platter']
    TILES['tiles'] = []
    for k, (key, path) in enumerate(PROJ):
        holder = link(bpy.data.objects.new(f'tile-{key}', None)); holder.parent = TILES['platter']
        a = math.radians(-90 + 90 * k)
        holder.matrix_basis = T(SLOT_R * math.cos(a), SLOT_R * math.sin(a), 0.028) @ Rz(math.degrees(a) + 90)
        g = link(bpy.data.objects.new(f'tile-{key}-grow', None)); g.parent = holder
        w, h = 0.085, 0.11
        parts = [box(f'tile-{key}-body', (w, 0.008, h), m.obs, T(0, 0, h / 2), bevel=0.004),
                 box(f'tile-{key}-edge', (w + 0.001, 0.0085, 0.004), m.gold, T(0, 0, h - 0.002), bevel=0.0005)]
        if path:
            mat = D.picture(f'tile-{key}-pic', os.path.join(REPO, path), 1.1)
            parts.append(D.quad(f'tile-{key}-pic', w - 0.012, h - 0.024, mat, T(0, -0.0045, h / 2 + 0.002)))
        else:
            parts.append(box(f'tile-{key}-face', (w - 0.012, 0.001, h - 0.024), m.vmetal, T(0, -0.0045, h / 2 + 0.002), bevel=0))
            tx = K.text(f'tile-{key}-word', 'Locked', 0.016, m.ivory, T(0, -0.0052, h / 2 + 0.004) @ Rx(90), m.font) if hasattr(m, 'font') else None
            if tx: parts.append(tx)
        for o in parts: o.parent = g
        TILES['tiles'].append((holder, g, parts))

def turntable(angle, grown):
    TILES['platter'].matrix_world = T(*TT) @ Rz(math.degrees(angle))
    for (holder, g, parts), k in zip(TILES['tiles'], grown):
        g.matrix_basis = Matrix.Diagonal((1, 1, max(0.001, k), 1))
        for o in parts: o.hide_render = k <= 0.001

def front_slot_top(height):
    return TT + V(0, -SLOT_R, 0.028 + height)

# ---------------------------------------------------------------- the world inside the screen (its own place, far off)
DG = V(600, 0, 0)
DW = {}
REST_B = {}
LEV = {}
def build_digital(m):
    rs = random.Random(21)
    # a faint grid floor
    for k in range(-12, 13):
        cyl(f'grid-x{k}', DG + V(-12, k, 0), DG + V(12, k, 0), 0.006, m.grid, seg=4)
        cyl(f'grid-y{k}', DG + V(k, -12, 0), DG + V(k, 12, 0), 0.006, m.grid, seg=4)
    # the cursor and eight lines of code, typed token by token on a plane facing the camera
    DW['cursor'] = box('cursor', (0.05, 0.02, 0.18), m.cursor, T(*(DG + V(-1.62, 0, 2.05))), bevel=0)
    lines = []
    for r in range(8):
        x = -1.62 + 0.22 * (rs.choice((0, 0, 1, 1, 2)) if r else 0); toks = []
        for t in range(rs.randint(3, 6)):
            w = rs.choice((0.18, 0.26, 0.34, 0.12, 0.42))
            o = box(f'tok{r}-{t}', (w, 0.03, 0.09), m.tok[rs.randrange(4)], T(*(DG + V(x + w / 2, 0, 2.05 - 0.2 * r))), bevel=0.01)
            toks.append((o, o.matrix_world.copy())); x += w + 0.08
        lines.append(toks)
    DW['lines'] = lines
    # the structure the code becomes: three tiers of blocks, joined where their interfaces meet
    grp = link(bpy.data.objects.new('structure', None)); DW['grp'] = grp; grp.location = DG + V(0, 1.0, 0)
    blocks = []
    layout = [(0, 0, 2.15)] + [(x, 0, 1.35) for x in (-0.85, 0.85)] + [(x, 0, 0.55) for x in (-1.7, 0.0, 1.7)] + [(x, -0.9, 0.55) for x in (-0.85, 0.85)]
    for k, (x, y, z) in enumerate(layout):
        c = V(x, y, z); s = 0.62
        parts = [box(f'blk{k}', (s, s, s), m.blockglass, T(*c), bevel=0.03)]
        parts.append(D.quad(f'blk{k}-code', s * 0.82, s * 0.82, m.code if k % 2 else m.code2, T(*(c + V(0, -s / 2 - 0.004, 0)))))
        for e in range(4):
            a = math.radians(90 * e)
            parts.append(box(f'blk{k}-edge{e}', (s + 0.01, 0.012, 0.012), m.edge, T(*(c + V(0, 0, s / 2))) @ Rz(90 * e) @ T(0, s / 2, 0), bevel=0))
        top = box(f'blk{k}-top', (s * 0.96, s * 0.96, 0.02), m.plat, T(*(c + V(0, 0, s / 2 + 0.012))), bevel=0.004)
        parts.append(top)
        for o in parts: o.parent = grp; o.matrix_parent_inverse = grp.matrix_world.inverted() if False else Matrix.Identity(4)
        blocks.append(dict(c=c, parts=parts, top=top, k=k))
    DW['blocks'] = blocks
    for b in blocks:
        for o in b['parts']: REST_B[o.name] = o.matrix_basis.copy()
    # interfaces between tiers
    links_ = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 4), (2, 5), (4, 6), (4, 7)]
    DW['links'] = []
    for a, b in links_:
        pa, pb = blocks[a]['c'], blocks[b]['c']
        o = cyl(f'iface{a}{b}', pa + (pb - pa).normalized() * 0.36, pb - (pb - pa).normalized() * 0.36, 0.018, m.path, seg=10)
        o.parent = grp; DW['links'].append(o)
    # game: a coin over a gap, a flag on top, a player that hops; apps opening out of two blocks
    DW['coin'] = K.lathe('coin3d', [(0, -0.02), (0.11, -0.02), (0.11, 0.02), (0, 0.02)], m.coin, T(-0.85, 0, 2.05) @ Rx(90), 40, sharp=30); DW['coin'].parent = grp
    DW['flagpole'] = cyl('flagpole', V(0.15, 0, 2.48), V(0.15, 0, 3.05), 0.012, m.gold, seg=8); DW['flagpole'].parent = grp
    DW['flag'] = box('flag', (0.24, 0.01, 0.14), m.coin, T(0.27, 0, 2.97), bevel=0); DW['flag'].parent = grp
    DW['player'] = ball('player', V(0, 0, 0), 0.085, m.player, seg=24); DW['player'].parent = grp
    DW['apps'] = []
    for k, bi in enumerate((3, 5)):
        c = blocks[bi]['c']; side = -1 if bi == 3 else 1
        g = link(bpy.data.objects.new(f'app{k}', None)); g.parent = grp
        g.matrix_basis = T(*(c + V(side * 0.75, -0.2, 0.25)))
        parts = [box(f'app{k}-frame', (0.48, 0.03, 0.82), m.dark, I4, bevel=0.05)]
        for i in range(3):
            for j in range(4):
                parts.append(box(f'app{k}-tile{i}{j}', (0.11, 0.035, 0.11), m.app if (i + j) % 3 else m.coin, T(-0.13 + 0.13 * i, -0.012, -0.27 + 0.16 * j), bevel=0.03))
        for o in parts: o.parent = g
        DW['apps'].append(g)
    # cybersecurity: panels lying round the structure fold up into walls; a lock ring comes down; shards fly in
    DW['walls'] = []
    for k in range(12):
        a = TAU * k / 12; r = 3.0
        hinge = V(r * math.cos(a), r * math.sin(a) + 0.0, 0.0)
        g = link(bpy.data.objects.new(f'wall{k}', None)); g.parent = grp
        parts = [box(f'wall{k}-panel', (1.5, 0.06, 1.9), m.dark, T(0, 0, 0.95), bevel=0.02),
                 K.ring(f'wall{k}-mark', 0.22, 0.30, -0.035, 0.035, m.ring_g, T(0, -0.04, 1.2) @ Rx(90), c=0.004, seg=48),
                 box(f'wall{k}-edge', (1.5, 0.065, 0.02), m.edge, T(0, 0, 1.9), bevel=0)]
        for o in parts: o.parent = g
        DW['walls'].append((g, hinge, a))
    lk = link(bpy.data.objects.new('lock', None)); lk.parent = grp; DW['lock'] = lk
    parts = [torus('lock-ring', 1.25, 0.06, m.gold, I4, seg=128, rseg=12), K.ring('lock-code', 1.05, 1.18, -0.04, 0.04, m.ring_g, I4, c=0.006, seg=160)]
    for k in range(6):
        a = TAU * k / 6
        parts.append(box(f'lock-bolt{k}', (0.24, 0.08, 0.08), m.gold, T(1.32 * math.cos(a), 1.32 * math.sin(a), 0) @ Rz(math.degrees(a)), bevel=0.01))
    for o in parts: o.parent = lk
    DW['shards'] = []
    for k in range(16):
        a = rs.uniform(0, TAU); z = rs.uniform(0.4, 3.0)
        far = V(9 * math.cos(a), 9 * math.sin(a), z); near = V(3.1 * math.cos(a), 3.1 * math.sin(a), z * 0.7)
        o = K.lathe(f'shard{k}', [(0, -0.25), (0.06, 0.0), (0, 0.25)], m.shard, I4, 3, sharp=1); o.parent = grp
        DW['shards'].append((o, far, near, rs.uniform(0, 360)))
    # the chip it compiles into: the same die as in the PC
    DW['die'] = box('die', (1.0, 1.0, 0.12), m.die, I4, bevel=0.01)
    DW['pkg'] = box('pkg', (2.2, 2.2, 0.08), m.gold, I4, bevel=0.02)
    DW['pins'] = []
    for k in range(10):
        for s in (-1, 1):
            DW['pins'].append(box(f'dpin{k}{s}', (0.16, 0.40, 0.06), m.gold, I4, bevel=0))
            DW['pins'].append(box(f'dpinv{k}{s}', (0.40, 0.16, 0.06), m.gold, I4, bevel=0))
    DW['sock'] = box('dsock', (3.3, 3.3, 0.3), m.dark, I4, bevel=0.02)

def digital(Pp, g=0):
    """Pp: 0 cursor, 1 software built, 2 game lit, 3 locked, 4 compiled to a chip."""
    # typing
    typed = win(Pp, 0.05, 0.55); total = sum(len(l) for l in DW['lines']); n = typed * total; i = 0
    lift = sm(win(Pp, 0.55, 0.95))
    for r, toks in enumerate(DW['lines']):
        for o, M in toks:
            vis = i < n and lift < 0.999; i += 1
            o.hide_render = not vis
            if vis:
                tgt = DW['blocks'][(r + i) % len(DW['blocks'])]['c'] + DW['grp'].location
                p = M.translation.lerp(tgt, lift); s = 1 - 0.85 * lift
                o.matrix_world = T(*p) @ Matrix.Scale(s, 4)
    cur_on = True if Pp < 0.05 else (typed < 1)
    DW['cursor'].hide_render = not cur_on or Pp > 0.6
    if typed > 0:
        row = min(7, int(typed * 8)); DW['cursor'].matrix_world = T(*(DG + V(-1.62 + 0.0, 0, 2.05 - 0.2 * row + 0.0)))
    # blocks grow as the code arrives
    for b in DW['blocks']:
        k = b['k']; grow = sm(win(Pp, 0.60 + 0.03 * k, 0.85 + 0.03 * k))
        S_ = Matrix.Scale(max(0.001, grow), 4)
        for o in b['parts']:
            o.hide_render = grow <= 0.001
            o.matrix_basis = T(*b['c']) @ S_ @ T(*(-b['c'])) @ REST_B[o.name]
        if Pp < 1.05: b['top'].hide_render = True
    for o in DW['links']: o.hide_render = Pp < 0.92
    # game
    gm = sm(win(Pp, 1.05, 1.6))
    LEV.update({'game': gm, 'edges': 0.4 + 0.6 * sm(win(Pp, 0.9, 1.4)), 'code': 1.0 - 0.6 * sm(win(Pp, 3.2, 3.8)), 'grid': 1.0 - sm(win(Pp, 3.0, 3.9))})
    for o in (DW['coin'], DW['flagpole'], DW['flag'], DW['player']): o.hide_render = gm < 0.02
    DW['coin'].matrix_basis = T(-0.85, 0, 2.05) @ Rz(12 * g) @ Rx(90)
    # the player hops along the tops: bottom left, up the tiers, to the flag
    path = [V(-1.7, 0, 0.97), V(-0.85, 0, 1.77), V(-0.85, 0, 2.15), V(0.0, 0, 2.57), V(0.0, 0, 2.57)]
    h = win(Pp, 1.2, 1.95) * (len(path) - 1); i0 = min(int(h), len(path) - 2); f = h - i0
    p = path[i0].lerp(path[i0 + 1], f) + V(0, 0, 0.35 * math.sin(math.pi * f))
    DW['player'].matrix_basis = T(*(p + V(0, 0, 0.09)))
    for k, a in enumerate(DW['apps']):
        o = sm(win(Pp, 1.35 + 0.1 * k, 1.8 + 0.1 * k))
        for c in a.children: c.hide_render = o < 0.02
        side = -1 if k == 0 else 1
        c = DW['blocks'][3 if k == 0 else 5]['c']
        a.matrix_basis = T(*(c + V(side * (0.35 + 0.45 * o), -0.2, 0.25))) @ Matrix.Diagonal((o, 1, o, 1))
    # cybersecurity
    fold = sm(win(Pp, 2.15, 2.75))
    for gw, hinge, a in DW['walls']:
        on = Pp > 2.05
        for c in gw.children: c.hide_render = not on
        gw.matrix_basis = T(*hinge) @ Rz(math.degrees(a) + 90) @ Rx(-90 * (1 - fold) - 0)
    for o, far, near, rot in DW['shards']:
        t = win(Pp, 2.05, 2.55); hit = win(Pp, 2.55, 2.75)
        o.hide_render = t <= 0 or hit >= 1
        p = far.lerp(near, sm(t)); o.matrix_basis = T(*p) @ Rz(rot + 200 * t) @ Ry(70) @ Matrix.Scale(1 - hit, 4)
    lk = sm(win(Pp, 2.6, 2.95))
    for c in DW['lock'].children: c.hide_render = Pp < 2.55
    DW['lock'].matrix_basis = T(0, 0, 4.4 - 1.3 * lk) @ Rz(30 * (1 - lk))
    # compile: everything shrinks into the chip
    cp = sm(win(Pp, 3.05, 3.85))
    s_ = max(0.002, 1 - cp)
    DW['grp'].matrix_basis = T(*(DG + V(0, 1.0, 1.35) * 1.0)) @ Matrix.Scale(s_, 4) @ T(0, 0, -1.35)
    die_on = sm(win(Pp, 3.35, 3.95))
    C0 = DG + V(0, 1.0, 1.35)
    Mchip = T(*C0) @ Rx(90)                              # the chip faces the camera (-Y)
    DW['die'].hide_render = die_on <= 0.001
    DW['die'].matrix_world = Mchip @ T(0, 0, 0.10) @ Matrix.Scale(max(0.001, die_on) * 0.18, 4)
    pk = sm(win(Pp, 3.6, 4.0))
    for o in [DW['pkg'], DW['sock']] + DW['pins']: o.hide_render = pk <= 0.001
    sc = 0.18 * max(0.001, pk)
    DW['pkg'].matrix_world = Mchip @ Matrix.Scale(sc, 4) @ T(0, 0, 0.0)
    DW['sock'].matrix_world = Mchip @ Matrix.Scale(sc, 4) @ T(0, 0, -0.2)
    i = 0
    for k in range(10):
        for s in (-1, 1):
            DW['pins'][i].matrix_world = Mchip @ Matrix.Scale(sc, 4) @ T(-1.0 + 0.22 * k, s * 1.62, -0.06); i += 1
            DW['pins'][i].matrix_world = Mchip @ Matrix.Scale(sc, 4) @ T(s * 1.62, -1.0 + 0.22 * k, -0.06); i += 1

# ---------------------------------------------------------------- the desk's state after the chip
CHIPWARM = []
def desk_state(Q, g=0):
    """Q: 0 chip lit, 1 board, 2 cable carried the signal, 3 arm awake, 4 four tiles built, 5 the whole desk."""
    LEV.update({'die': lerp(1.0, 0.45, sm(win(Q, 0.6, 1.6))), 'signal': 0.3 + 0.9 * sm(win(Q, 0.5, 1.4)), 'arm': sm(win(Q, 2.4, 3.0)),
                'ghost': 1.0, 'nozzle': 0.0, 'pulse': 1.0})
    # the pulse runs the length of the cable
    t = win(Q, 1.45, 2.55); pts = CABLE['pts']
    CABLE['pulse'].hide_render = not (0 < t < 1)
    if 0 < t < 1:
        x = t * (len(pts) - 1); i = min(int(x), len(pts) - 2); CABLE['pulse'].matrix_world = T(*pts[i].lerp(pts[i + 1], x - i))
    # the arm: folded and dark, wakes, then prints each tile at the front of the turntable while the turntable steps on
    grown = [0.0] * 4; angle = 0.0; nozzle = 0.0
    folded = (math.radians(200), -0.35, 2.55)
    if Q < 3.0:
        wake = sm(win(Q, 2.55, 3.0))
        above = arm_reach(front_slot_top(0.17))
        yaw, a1, a2 = [lerp(x, y, wake) for x, y in zip(folded, above)]
    else:
        k = min(3, int((Q - 3.0) / 0.25)); f = (Q - 3.0) / 0.25 - k
        for j in range(4): grown[j] = 1.0 if j < k or Q >= 4.0 else 0.0
        build = sm(win(f, 0.05, 0.62)); turn = sm(win(f, 0.68, 1.0))
        if Q < 4.0:
            grown[k] = build
            angle = -math.radians(90 * (k + turn))
            hgt = 0.11 * build
            tip = front_slot_top(hgt + 0.004) + V(0.012 * math.sin(f * 40), 0, 0.03 * turn)
            nozzle = 1.0 if 0.05 < f < 0.62 else 0.2
        else:
            angle = -math.radians(360); tip = front_slot_top(0.20) + V(0.05, -0.04, 0.0)
        yaw, a1, a2 = arm_reach(tip)
    LEV['nozzle'] = nozzle
    if CHIPWARM: CHIPWARM[0].data.energy = 0.35 * (1 - sm(win(Q, 0.4, 1.2)))      # the die's own gold on the lid, as in the screen
    arm_pose(yaw, a1, a2)
    turntable(angle, grown)

# ---------------------------------------------------------------- lights
def build_lights(m):
    L = {}
    L['bias'] = K.area('bias-l', MC + V(0, 0.34, -0.1), MC + V(0, 0.8, 0.1), 1.3, 26, LIGHT_VIO, size_y=0.3)
    L['top'] = K.area('room-top', V(0.1, -0.5, 2.6), V(0.1, 0.4, DZ), 1.4, 46, (0.80, 0.70, 1.0), size_y=1.0)
    L['lamp'] = spot('lamp-light', V(-0.70, 0.50, 1.12), V(-0.45, 0.30, DZ), 26, GOLD_LIGHT, size=75, blend=0.8, radius=0.05, scatter=False)
    L['screen'] = K.area('screen-glow', MC + V(0, -0.05, 0), MC + V(0, -1.0, -0.2), 0.7, 14, (0.70, 0.60, 1.0), size_y=0.4)
    L['pc'] = glow('pc-inside', PC + V(0.0, 0.0, 0.28), LIGHT_VIO, 1.6, size=0.05)
    L['arm'] = glow('arm-glow', TT + V(0.05, -0.15, 0.30), (0.85, 0.78, 1.0), 2.2, size=0.08)
    L['rim'] = K.area('rim', V(1.4, 0.9, 1.6), V(0.4, 0.2, DZ), 0.6, 30, LIGHT_VIO, size_y=0.6)
    # inside the screen
    L['d-key'] = K.area('d-key', DG + V(-6, -8, 7), DG + V(0, 1, 1.5), 4.0, 900, (0.86, 0.80, 1.0), size_y=3.0)
    L['d-rim'] = K.area('d-rim', DG + V(7, 8, 4), DG + V(0, 1, 1.5), 3.0, 1600, LIGHT_VIO, size_y=6.0)
    L['d-under'] = K.area('d-under', DG + V(0, -5, -4), DG + V(0, 1, 1.5), 4.0, 300, (0.6, 0.4, 1.0), size_y=4.0)
    for o in L.values(): o.visible_volume_scatter = False
    L['screen'].visible_glossy = False
    L['chipwarm'] = glow('chip-warm', CHIP + V(-0.05, 0, 0.01), GOLD_LIGHT, 0.0, size=0.01)
    return L

def scene():
    s = K.fresh()
    s.cycles.volume_bounces = 0; s.cycles.transmission_bounces = 8; s.cycles.max_bounces = 10; s.cycles.transparent_max_bounces = 32
    m = Mats(); m.font = bpy.data.fonts.load('C:/Windows/Fonts/bahnschrift.ttf', check_existing=True)
    S.HAZE = ENV('R75_HAZE', 0.0)
    w = s.world.node_tree; w.nodes['Background'].inputs['Color'].default_value = (*mul(DPUR, 0.10), 1)
    build_room(m); build_pc(m); build_cable(m); build_arm(m); build_turntable(m); build_digital(m)
    L = build_lights(m); CHIPWARM.append(L['chipwarm'])
    cam = S.cam('cam', loc=(0, -1, 1), target=(0, 0, 1), lens=35)
    cam.data.clip_start = 0.002; cam.data.clip_end = 300; s.camera = cam
    return s, m, L, cam

# ---------------------------------------------------------------- the journey
def mon_pt(p): return MON @ Vector(p)
def stops():
    n = (MON.to_3x3() @ V(0, -1, 0)).normalized()
    Pp = mon_pt(PRINT_L + V(0, -0.0045, 0)); Cu = mon_pt(CUR_L)
    st = [
        dict(name='print', seg='desk', Q=0.0, pos=Pp + n * 0.14 + V(0.035, 0, 0.02), tgt=Pp, lens=60, fstop=2.8, focus=0.146),
        dict(name='cursor', seg='desk', Q=0.0, pos=Pp + n * 0.30 + V(-0.10, 0, 0.06), tgt=Cu + V(0.12, 0, -0.03), lens=55, fstop=2.8, focus=0.36),
        dict(name='screen', seg='desk', Q=0.0, pos=MC + n * (SW * 50 / 36), tgt=MC, lens=50),
        dict(name='d-cursor', seg='dig', P=0.0, pos=DG + V(0, -6.0, 1.10), tgt=DG + V(0, 0, 1.10), lens=50),
        dict(name='software', seg='dig', P=1.0, pos=DG + V(-3.4, -8.4, 3.3), tgt=DG + V(0.9, 1.0, 1.4), lens=35),
        dict(name='game', seg='dig', P=2.0, pos=DG + V(-4.6, -5.6, 2.1), tgt=DG + V(0.4, 1.0, 1.8), lens=32),
        dict(name='cyber', seg='dig', P=3.0, pos=DG + V(-6.8, -9.5, 7.2), tgt=DG + V(1.2, 1.0, 1.3), lens=30),
        dict(name='compile', seg='dig', P=4.0, pos=DG + V(0, 1.0, 1.35) + V(0, -2.2, 0), tgt=DG + V(0, 1.0, 1.35), lens=50),
        dict(name='chip', seg='desk', Q=0.0, pos=CHIP + V(-0.268, 0, 0), tgt=CHIP, lens=50),
        dict(name='board', seg='desk', Q=1.0, pos=CHIP + V(-0.20, -0.10, 0.04), tgt=CHIP + V(0, -0.09, -0.10), lens=30),
        dict(name='cable', seg='desk', Q=2.0, pos=V(0.47, -0.17, DZ + 0.17), tgt=V(0.72, 0.27, DZ + 0.05), lens=26),
        dict(name='arm', seg='desk', Q=3.0, pos=V(0.26, -0.26, DZ + 0.20), tgt=V(0.50, 0.22, DZ + 0.12), lens=32),
        dict(name='works', seg='desk', Q=4.0, pos=V(0.12, -0.30, DZ + 0.20), tgt=V(0.40, 0.26, DZ + 0.09), lens=40),
        dict(name='desk', seg='desk', Q=5.0, pos=V(0.10, -1.25, 1.36), tgt=V(0.10, 0.46, 0.98), lens=30),
    ]
    return st

VIAS = {
    'print': [], 'cursor': [],
    'screen': [],                        # match cut into the screen
    'd-cursor': [(DG + V(-1.0, -7.5, 1.6), DG + V(0.4, 0.6, 1.3))],
    'software': [], 'game': [(DG + V(-6.0, -8.0, 4.6), DG + V(0.8, 1.0, 1.6))],
    'cyber': [(DG + V(-1.4, -4.0, 2.4), DG + V(0, 1.0, 1.35))],
    'compile': [],                       # match cut into the PC
    'chip': [], 'board': [(CHIP + V(-0.26, -0.20, -0.10), V(0.80, 0.30, DZ + 0.06)), (V(0.62, -0.06, DZ + 0.14), V(0.70, 0.30, DZ + 0.05))],
    'cable': [], 'arm': [], 'works': [(V(0.12, -0.70, 1.05), V(0.20, 0.40, 0.92))],
}
MOVES = {'print': 14, 'cursor': 16, 'screen': 1, 'd-cursor': 24, 'software': 20, 'game': 20, 'cyber': 22, 'compile': 1,
         'chip': 14, 'board': 22, 'cable': 16, 'arm': 30, 'works': 24}

def main():
    os.makedirs(OUT, exist_ok=True)
    s, m, L, cam = scene()
    def shoot(path):
        s.render.filepath = path; bpy.ops.render.render(write_still=True); print('wrote', path, flush=True)
    st = stops(); by = {k['name']: k for k in st}
    def state_for(a, b, t, g):
        e = ease(t)
        if a['seg'] == 'dig' or (b['seg'] == 'dig' and t >= 1):
            Pp = lerp(a.get('P', 4.0 if a['seg'] == 'dig' else 0.0), b.get('P', 4.0), e) if b['seg'] == 'dig' else 4.0
            digital(Pp, g)
        else:
            digital(0.0, g)
        Q = lerp(a.get('Q', 0.0), b.get('Q', 0.0), e) if (a['seg'] == 'desk' and b['seg'] == 'desk') else a.get('Q', 0.0)
        if a['name'] in ('print', 'cursor', 'screen'): Q = 0.0
        desk_state(Q, g)
        U.energy(LEV)
    def dof(a, b, e):
        fa, fb = a.get('fstop'), b.get('fstop')
        if fa or fb:
            cam.data.dof.use_dof = True
            cam.data.dof.aperture_fstop = lerp(fa or 16.0, fb or 16.0, e)
            cam.data.dof.focus_distance = lerp(a.get('focus', (a['tgt'] - a['pos']).length), b.get('focus', (b['tgt'] - b['pos']).length), e)
        else:
            cam.data.dof.use_dof = False
    def frame(a, b, t, g, path):
        state_for(a, b, t, g)
        D.pose(cam, a, b, t, VIAS.get(a['name'], []))
        dof(a, b, ease(t))
        shoot(path)
    job, _, arg = JOB.partition(':')
    only = arg.split(',') if arg else None
    screen_img = os.path.join(OUT, 'screen.jpg')
    def set_screen():
        if os.path.exists(screen_img):
            m.screen.node_tree.nodes['pic'].image = bpy.data.images.load(screen_img, check_existing=True)
    if job == 'screen':        # the first frame inside: it is also what the monitor shows
        k = by['d-cursor']; digital(0.0, 0); desk_state(0.0); U.energy(LEV); D.pose(cam, k, k, 0.0, []); cam.data.dof.use_dof = False
        shoot(screen_img); return
    set_screen()
    if job in ('look', 'keys'):
        for i, k in enumerate(st):
            if only and k['name'] not in only: continue
            frame(k, k, 0.0, 0, os.path.join(OUT, f'{job}-{k["name"]}.jpg'))
        return
    if job == 'mids':
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            if only and a['name'] not in only: continue
            if MOVES[a['name']] <= 1: continue
            for t in (0.33, 0.66): frame(a, b, t, 0, os.path.join(OUT, f'mid-{a["name"]}-{int(t * 100)}.jpg'))
        return
    if job == 'spin':          # the finished turntable, all the way round, for dragging
        os.makedirs(os.path.join(OUT, 'spin'), exist_ok=True)
        k = by['works']; N = 36
        for i in range(N):
            desk_state(4.0 + 1e-6); digital(0.0, 0); U.energy(LEV)
            turntable(math.radians(360 + 360 * i / N), [1, 1, 1, 1])
            D.pose(cam, k, k, 0.0, []); cam.data.dof.use_dof = False
            shoot(os.path.join(OUT, 'spin', f's{i:02d}.jpg'))
        with open(os.path.join(OUT, 'spin', 'spin.json'), 'w') as fh: json.dump({'count': N}, fh)
        return
    if job == 'seq':
        os.makedirs(os.path.join(OUT, 'seq'), exist_ok=True)
        fr = [(st[0], st[0], 0.0)]; at = [0]
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]
            n = MOVES[a['name']]
            for j in range(1, n + 1): fr.append((a, b, j / n))
            at.append(len(fr) - 1)
        with open(os.path.join(OUT, 'seq', 'frames.json'), 'w') as fh:
            json.dump({'count': len(fr), 'stops': {k['name']: a for k, a in zip(st, at)}}, fh)
        lo, _, hi = arg.partition('-'); lo = int(lo) if lo else 0; hi = int(hi) if hi else 10 ** 6
        for f, (a, b, t) in enumerate(fr):
            if not (lo <= f <= hi): continue
            path = os.path.join(OUT, 'seq', f'f{f:03d}.jpg')
            if os.path.exists(path) and os.environ.get('R75_SKIP', '1') == '1': continue
            frame(a, b, t, f, path)
        print('frames', len(fr), at, flush=True)

if __name__ == '__main__':
    main()
