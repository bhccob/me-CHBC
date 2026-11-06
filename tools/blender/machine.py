# The machine that gets built as you scroll: its parts, its pose at each frame and its camera path, from the approved mock-up.
#   blender -b --factory-startup --python tools/blender/machine.py -- <out.glb> <pose.json> <anchors.json>
# Writes the GLB (tools/blender/pack.mjs then shrinks it), and what `pose` gives at the review frames, which
# tests/unit/journey/choreography.test.ts holds the TypeScript port to.
import bmesh
import bpy
import json
import math
import os
from bpy_extras.object_utils import world_to_camera_view
import sys
from mathutils import Matrix, Vector

OUT_GLB, OUT_POSE, OUT_ANCHORS = sys.argv[sys.argv.index('--') + 1:]
REVIEW_FRAMES = [0, 36, 112, 190, 262, 304, 345, 360]
ANCHOR_FRAMES = list(range(276, 327, 2))

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
scene = bpy.context.scene
coll = scene.collection


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def ramp(f, a, b):
    return clamp((f - a) / (b - a))


def ez(x):
    return x * x * (3 - 2 * x)


def ease(f, a, b):
    return ez(ramp(f, a, b))


def mix(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ materials
def material(name, col, metal=0.0, rough=0.5, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.12
    return m


def set_emit(m, s):
    m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = s


GRAPHITE = material('graphite', (0.016, 0.016, 0.021), 1.0, 0.34)
DARK = material('dark', (0.006, 0.006, 0.008), 0.9, 0.42)
STEEL = material('steel', (0.09, 0.09, 0.105), 1.0, 0.24)
GOLD = material('gold', (0.86, 0.56, 0.17), 1.0, 0.2)
MASK = material('mask', (0.055, 0.02, 0.17), 0.0, 0.3, coat=0.5)
CHIP = material('chip', (0.007, 0.007, 0.009), 0.0, 0.38)
SILK = material('silk', (0.75, 0.72, 0.8), 0.0, 0.5)
RUBBER = material('rubber', (0.008, 0.008, 0.009), 0.0, 0.55)
FLOOR = material('floor', (0.005, 0.005, 0.008), 0.0, 0.52)
FLOOR.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.16
WALL = material('wall', (0.012, 0.012, 0.016), 0.7, 0.45)
LED = material('led', (0, 0, 0), 0, 0.4, (1.0, 0.68, 0.24), 0.0)
LED_COOL = material('ledcool', (0, 0, 0), 0, 0.4, (0.72, 0.68, 1.0), 0.0)
PULSE = material('pulse', (0, 0, 0), 0, 0.4, (1.0, 0.78, 0.4), 16.0)
LED_SLEEVE = material('ledsleeve', (0, 0, 0), 0, 0.4, (1.0, 0.72, 0.32), 1.1)
KEY = material('key', (0, 0, 0), 0, 0.4, (1.0, 0.68, 0.24), 0.0)
YEAR = material('year', (0, 0, 0), 0, 0.4, (1.0, 0.72, 0.3), 3.2)
SLOT = material('slot', (0.004, 0.004, 0.006), 0.2, 0.14)
CHIPTXT = material('chiptxt', (0.86, 0.56, 0.17), 1.0, 0.24, (1.0, 0.68, 0.26), 1.6)


# ------------------------------------------------------------------ mesh helpers
def finish(name, bm, mat, parent=None, loc=(0, 0, 0), bevel=None, deg=32):
    bm.normal_update()
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            if e.calc_face_angle(0) > math.radians(deg):
                e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    me.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(deg)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def empty(name, parent=None, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    coll.objects.link(ob)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def bm_box(bm, c, s, rot=None):
    M = Matrix.Translation(c)
    if rot:
        M = M @ rot
    M = M @ Matrix.Diagonal((s[0], s[1], s[2], 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)


def box(name, s, loc, mat, parent=None, bevel=0.005):
    bm = bmesh.new()
    bm_box(bm, (0, 0, 0), s)
    return finish(name, bm, mat, parent, loc, bevel)


def bm_cyl(bm, r, h, c=(0, 0, 0), axis='Z', seg=40, r2=None):
    R = Matrix.Identity(4)
    if axis == 'X':
        R = Matrix.Rotation(math.pi / 2, 4, 'Y')
    if axis == 'Y':
        R = Matrix.Rotation(math.pi / 2, 4, 'X')
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h, matrix=Matrix.Translation(c) @ R)


def cyl(name, r, h, loc, mat, parent=None, axis='Z', seg=40, bevel=0.004, r2=None):
    bm = bmesh.new()
    bm_cyl(bm, r, h, (0, 0, 0), axis, seg, r2)
    return finish(name, bm, mat, parent, loc, bevel)


def revolve(name, prof, mat, parent=None, loc=(0, 0, 0), seg=96, closed=True, deg=32):
    bm = bmesh.new()
    loops = []
    for r, z in prof:
        loops.append([bm.verts.new((r * math.cos(k / seg * math.tau), r * math.sin(k / seg * math.tau), z)) for k in range(seg)])
    n = len(prof)
    for i in range(n if closed else n - 1):
        a, b = loops[i], loops[(i + 1) % n]
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, parent, loc, None, deg)


def gear(name, r_root, r_tip, teeth, h, mat, parent=None, loc=(0, 0, 0), inner=0.0):
    pts = []
    for k in range(teeth):
        a = k / teeth * math.tau
        u = math.tau / teeth
        for t, r in ((0.0, r_root), (0.16, r_root), (0.3, r_tip), (0.62, r_tip), (0.76, r_root)):
            pts.append((a + t * u, r))
    bm = bmesh.new()
    top, bot, itop, ibot = [], [], [], []
    ri = inner if inner else 0.002
    for a, r in pts:
        c, s = math.cos(a), math.sin(a)
        top.append(bm.verts.new((c * r, s * r, h / 2)))
        bot.append(bm.verts.new((c * r, s * r, -h / 2)))
        itop.append(bm.verts.new((c * ri, s * ri, h / 2)))
        ibot.append(bm.verts.new((c * ri, s * ri, -h / 2)))
    m = len(pts)
    for k in range(m):
        j = (k + 1) % m
        bm.faces.new((top[k], top[j], itop[j], itop[k]))
        bm.faces.new((bot[j], bot[k], ibot[k], ibot[j]))
        bm.faces.new((bot[k], bot[j], top[j], top[k]))
        if inner:
            bm.faces.new((itop[k], itop[j], ibot[j], ibot[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, parent, loc, 0.003)


def polygon(name, pts, h, mat, parent=None, loc=(0, 0, 0)):
    bm = bmesh.new()
    t = [bm.verts.new((x, y, h / 2)) for x, y in pts]
    b = [bm.verts.new((x, y, -h / 2)) for x, y in pts]
    bm.faces.new(t)
    bm.faces.new(list(reversed(b)))
    n = len(pts)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((b[k], b[j], t[j], t[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, parent, loc, None)


def strips(name, paths, w, z, mat, parent=None, h=0.002):
    bm = bmesh.new()
    for path in paths:
        for (x0, y0), (x1, y1) in zip(path, path[1:]):
            dx, dy = x1 - x0, y1 - y0
            l = math.hypot(dx, dy)
            if l < 1e-6:
                continue
            nx, ny = -dy / l * w / 2, dx / l * w / 2
            ex, ey = dx / l * w / 2, dy / l * w / 2
            q = [(x0 + nx - ex, y0 + ny - ey), (x1 + nx + ex, y1 + ny + ey), (x1 - nx + ex, y1 - ny + ey), (x0 - nx - ex, y0 - ny - ey)]
            t = [bm.verts.new((a, b, z + h)) for a, b in q]
            bm.faces.new(t)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, parent, (0, 0, 0))


def text(name, body, size, loc, mat, parent=None, extrude=0.0, align='CENTER', font=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    if font and os.path.exists(font):
        cu.font = bpy.data.fonts.load(font)
    ob = bpy.data.objects.new(name, cu)
    coll.objects.link(ob)
    cu.materials.append(mat)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def show(ob, on):
    ob.hide_render = not on
    for c in ob.children:
        show(c, on)


FONT = 'C:/Windows/Fonts/bahnschrift.ttf'
root = empty('machine')

# ------------------------------------------------------------------ 1. the board: software
board = empty('board', root)
box('pcb', (1.3, 1.3, 0.035), (0, 0, 0), MASK, board, 0.004)
paths, vias, signal = [], [], []
Z = 0.0178
for side in range(4):
    ca, sa = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
    rot = lambda x, y: (x * ca - y * sa, x * sa + y * ca)
    for k in range(-5, 6):
        o = k * 0.026
        spread = k * 0.052
        run = 0.2 + abs(k) * 0.012
        p = [(0.17, o), (run, o), (run + abs(spread - o), spread), (0.6 - (abs(k) % 3) * 0.05, spread)]
        pr = [rot(*q) for q in p]
        paths.append(pr)
        vias.append(pr[-1])
        if k % 3 == 0:
            signal.append(pr)
strips('traces', paths, 0.012, Z, GOLD, board)
bm = bmesh.new()
for x, y in vias:
    bmesh.ops.create_circle(bm, cap_ends=True, segments=14, radius=0.013, matrix=Matrix.Translation((x, y, Z + 0.003)))
finish('vias', bm, GOLD, board)
box('mcu', (0.34, 0.34, 0.03), (0, 0, 0.033), CHIP, board, 0.004)
box('mcu-lid', (0.22, 0.22, 0.008), (0, 0, 0.051), STEEL, board, 0.002)
text('mcu-t', 'SYSTEMS' + chr(10) + 'BUILDER', 0.036, (0, 0, 0.0555), CHIPTXT, board, font=FONT)
led_core = cyl('mcu-led', 0.014, 0.004, (0.135, 0.135, 0.05), LED, board, seg=16, bevel=None)
for x, y, sx, sy in ((-0.42, 0.42, 0.12, 0.09), (0.44, 0.34, 0.08, 0.14), (-0.36, -0.44, 0.16, 0.08), (0.4, -0.42, 0.1, 0.1), (0.05, 0.47, 0.13, 0.06), (0.03, -0.52, 0.09, 0.06)):
    box('ic', (sx, sy, 0.018), (x, y, 0.027), CHIP, board, 0.002)
for k in range(16):
    a = k / 16 * math.tau + 0.2
    r = 0.3 + (k % 3) * 0.035
    cyl('cap', 0.01, 0.014, (r * math.cos(a), r * math.sin(a), 0.025), GOLD if k % 4 == 0 else STEEL, board, seg=14, bevel=None)
bm = bmesh.new()
for k in range(26):
    bm_box(bm, (-0.6 + k * 0.048, -0.635, Z), (0.03, 0.05, 0.003))
finish('edge', bm, GOLD, board)
t = text('silk', 'BOB CHUNG', 0.05, (-0.42, 0.585, Z + 0.002), SILK, board, font=FONT)
pulses_board = []
for i, pr in enumerate(signal):
    p = box(f'pulse-{i}', (0.014, 0.014, 0.003), (0, 0, Z + 0.004), PULSE, board, None)
    pulses_board.append((p, pr, i * 0.13))

# ------------------------------------------------------------------ 2. software and games, as parts you can read
def emissive_plane(name, w, h, parent, loc):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Roughness'].default_value = 0.4
    b.inputs['Specular IOR Level'].default_value = 0.2
    b.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    b.inputs['Emission Strength'].default_value = 0.0
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.active_object
    pl.name = name
    pl.scale = (w, h, 1)
    pl.location = loc
    pl.parent = parent
    pl.data.materials.append(m)
    return pl, b


code = empty('code', root)
box('code-plate', (1.26, 1.26, 0.03), (0, 0, 0), GRAPHITE, code)
box('code-bezel', (1.16, 1.16, 0.004), (0, 0, 0.0145), DARK, code, 0.001)
code_screen, code_bsdf = emissive_plane('code-screen', 1.1, 1.1, code, (0, 0, 0.0168))
bm = bmesh.new()
bm_box(bm, (0, 0.5, 0), (1.1, 1.0, 0.001))
code_cover = finish('code-cover', bm, DARK, code, (0, -0.55, 0.0178))
for x, y in ((-0.58, -0.58), (0.58, -0.58), (-0.58, 0.58), (0.58, 0.58)):
    cyl('standoff', 0.022, 0.15, (x, y, -0.09), GOLD, code, seg=6, bevel=0.002)

game = empty('game', root)
box('game-plate', (1.26, 1.26, 0.03), (0, 0, 0), GRAPHITE, game)
for x, y in ((-0.58, -0.58), (0.58, -0.58), (-0.58, 0.58), (0.58, 0.58)):
    cyl('standoff', 0.022, 0.15, (x, y, -0.09), GOLD, game, seg=6, bevel=0.002)
    cyl('screw', 0.022, 0.008, (x, y, 0.018), GOLD, game, seg=6, bevel=None)
PADBODY = material('padbody', (0.035, 0.034, 0.045), 0.65, 0.3)


def smooth_closed(ctrl, per=7):
    out = []
    n = len(ctrl)
    for i in range(n):
        p0, p1, p2, p3 = ctrl[(i - 1) % n], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n]
        for k in range(per):
            t = k / per
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t) for j in range(2)))
    return out


half = [(0.0, 0.2), (0.27, 0.21), (0.44, 0.17), (0.54, 0.03), (0.6, -0.2), (0.53, -0.34), (0.42, -0.3), (0.3, -0.13), (0.13, -0.1)]
outline = half + [(0.0, -0.1)] + [(-x, y) for x, y in reversed(half[1:])]
pad = empty('pad', game, (0, 0.04, 0.075))
body_ob = polygon('pad-body', smooth_closed(outline), 0.1, PADBODY, pad)
bev = body_ob.modifiers.new('bev', 'BEVEL')
bev.width = 0.03
bev.segments = 4
bev.limit_method = 'ANGLE'
bev.angle_limit = math.radians(30)
bm = bmesh.new()
bm_box(bm, (-0.3, 0.06, 0.056), (0.17, 0.058, 0.02))
bm_box(bm, (-0.3, 0.06, 0.056), (0.058, 0.17, 0.02))
finish('dpad', bm, DARK, pad, (0, 0, 0), 0.004)
for x, y, m in ((0.3, 0.13, GOLD), (0.3, -0.01, STEEL), (0.23, 0.06, STEEL), (0.37, 0.06, GOLD)):
    cyl('btn', 0.033, 0.022, (x, y, 0.056), m, pad, seg=28)
for x in (-0.14, 0.14):
    cyl('stick-base', 0.062, 0.016, (x, -0.075, 0.054), DARK, pad, seg=32)
    cyl('stick', 0.024, 0.04, (x, -0.075, 0.074), STEEL, pad, seg=16)
    cyl('stick-top', 0.05, 0.016, (x, -0.075, 0.098), GOLD, pad, seg=32)
for x in (-0.06, 0.06):
    box('menu', (0.06, 0.018, 0.01), (x, 0.09, 0.052), STEEL, pad, 0.002)
box('pad-led', (0.14, 0.012, 0.004), (0, 0.15, 0.052), LED, pad, None)

# ------------------------------------------------------------------ 3. the enclosure: security
walls = []
WALL_H, WALL_Z = 0.74, 0.23
for k in range(4):
    g = empty(f'wall{k}', root)
    g.rotation_euler = (0, 0, k * math.pi / 2)
    box('plate', (1.44, 0.04, WALL_H), (0, 0, 0), GRAPHITE, g, 0.006)
    bm = bmesh.new()
    for i in range(15):
        bm_box(bm, (-0.61 + i * 0.087, -0.03, -0.02), (0.022, 0.03, WALL_H - 0.14))
    finish('fins', bm, STEEL, g, (0, 0, 0), 0.003)
    box('led', (1.3, 0.006, 0.01), (0, -0.024, WALL_H / 2 - 0.035), LED, g, None)
    if k == 0:
        text('plate', 'SYSTEMS BUILDER', 0.05, (0.0, -0.0225, -WALL_H / 2 + 0.035), GOLD, g, font=FONT).rotation_euler = (math.pi / 2, 0, 0)
    walls.append(g)
posts = []
for x, y in ((-0.72, -0.72), (0.72, -0.72), (-0.72, 0.72), (0.72, 0.72)):
    g = empty(f'post-{len(posts)}', root, (x, y, WALL_Z))
    cyl('body', 0.06, WALL_H + 0.05, (0, 0, 0), GRAPHITE, g)
    cyl('band', 0.064, 0.02, (0, 0, WALL_H / 2 - 0.05), GOLD, g)
    cyl('band', 0.064, 0.02, (0, 0, -WALL_H / 2 + 0.05), GOLD, g)
    posts.append(g)
lid = empty('lid', root)
AP = 0.4
N = 128
HW = 0.78
bm = bmesh.new()
rings = []
def square_r(a, hw):
    return min(hw / max(abs(math.cos(a)), 1e-5), hw / max(abs(math.sin(a)), 1e-5))
for r, z, kind in ((AP, -0.03, 'c'), (AP, 0.024, 'c'), (AP + 0.012, 0.03, 'c'), (HW - 0.012, 0.03, 's'), (HW, 0.018, 's'), (HW, -0.03, 's')):
    loop = []
    for k in range(N):
        a = k / N * math.tau + math.pi / N
        rr = r if kind == 'c' else square_r(a, r)
        loop.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
    rings.append(loop)
for i in range(len(rings) - 1):
    for k in range(N):
        j = (k + 1) % N
        bm.faces.new((rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]))
for k in range(N):
    j = (k + 1) % N
    bm.faces.new((rings[-1][k], rings[-1][j], rings[0][j], rings[0][k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
finish('lid-plate', bm, GRAPHITE, lid, (0, 0, 0))
revolve('lid-ap', [(AP + 0.002, 0.0), (AP + 0.002, 0.036), (AP + 0.034, 0.036), (AP + 0.034, 0.03)], GOLD, lid, closed=False, seg=96)
for x, y in ((-0.68, -0.68), (0.68, -0.68), (-0.68, 0.68), (0.68, 0.68)):
    cyl('bolt', 0.024, 0.014, (x, y, 0.036), GOLD, lid, seg=6, bevel=0.002)
blades = []
BN = 9
blade_pts = [(0.0, -0.1), (0.3, -0.13), (0.56, -0.09), (0.66, 0.0), (0.56, 0.16), (0.24, 0.2), (0.0, 0.12)]
for k in range(BN):
    a = k / BN * math.tau
    pivot = empty(f'blade-pivot-{k}', lid, (0.56 * math.cos(a), 0.56 * math.sin(a), -0.014 + k * 0.0012))
    polygon('blade', blade_pts, 0.002, STEEL if k % 2 else GRAPHITE, pivot)
    blades.append((pivot, a))
cap = empty('keycap', lid, (0, 0, 0.012))
cyl('capbase', 0.385, 0.012, (0, 0, -0.008), GRAPHITE, cap, seg=64)
SH = [(-0.25, 0.25), (0.0, 0.3), (0.25, 0.25), (0.25, 0.02), (0.16, -0.18), (0.0, -0.31), (-0.16, -0.18), (-0.25, 0.02)]
polygon('shield-rim', [(x * 1.13, y * 1.11) for x, y in smooth_closed(SH, 5)], 0.02, GOLD, cap, (0, 0, 0.004))
polygon('shield', smooth_closed(SH, 5), 0.03, STEEL, cap, (0, 0, 0.012))
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=24, radius=0.055, matrix=Matrix.Translation((0, 0.05, 0.0285)))
t0 = [bm.verts.new((-0.026, 0.01, 0.0285)), bm.verts.new((0.026, 0.01, 0.0285)), bm.verts.new((0.05, -0.12, 0.0285)), bm.verts.new((-0.05, -0.12, 0.0285))]
bm.faces.new(t0)
finish('keyhole', bm, KEY, cap)

# Sleeve from the aperture down, and the flare into the shaft.
sleeve = empty('sleeve', root)
revolve('sleeve-wall', [(AP - 0.001, 0.6), (AP, -1.1), (0.75, -1.5), (2.72, -2.3)], WALL, sleeve, closed=False, deg=60)
for z in (0.05, -0.3, -0.65, -1.0):
    revolve('sleeve-led', [(AP - 0.006, z + 0.008), (AP - 0.006, z - 0.008)], LED_SLEEVE, sleeve, closed=False, seg=64)

# ------------------------------------------------------------------ 4. the body: mechatronics
turret = empty('turret', root)
ring = gear('ring', 0.62, 0.655, 96, 0.04, STEEL, turret, (0, 0, 0), inner=0.46)
revolve('ring-gold', [(0.46, 0.022), (0.5, 0.022), (0.5, 0.0), (0.46, 0.0)], GOLD, turret, seg=96)
pinions = []
drive = []
for sx, sy in ((-1, 1), (1, -1)):
    d = 0.655 + 0.098
    x, y = sx * d * math.sqrt(0.5), sy * d * math.sqrt(0.5)
    g = empty(f'servo-{len(drive)}', root, (x, y, 0))
    box('servo-body', (0.2, 0.2, 0.13), (0, 0, -0.065), DARK, g, 0.008)
    cyl('servo-collar', 0.075, 0.02, (0, 0, 0.0), STEEL, g)
    p = gear(f'pinion-{len(pinions)}', 0.08, 0.108, 14, 0.04, GOLD, g, (0, 0, 0.02))
    pinions.append(p)
    drive.append(g)

L1, L2, HIP_Z = 0.78, 1.05, 0.05
legs = []
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    hip = empty(f'leg{k}', root)
    hip.rotation_euler = (0, 0, a)
    R0 = 1.02
    base = empty(f'leg{k}-base', hip, (R0, 0, HIP_Z))
    cyl('hip', 0.135, 0.26, (0, 0, 0), DARK, base, axis='Y', seg=48)
    revolve('hipg', [(0.09, 0), (0.142, 0), (0.142, -0.014), (0.09, -0.014)], GOLD, base, loc=(0, 0.13, 0)).rotation_euler = (math.pi / 2, 0, 0)
    revolve('hipg', [(0.09, 0), (0.142, 0), (0.142, -0.014), (0.09, -0.014)], GOLD, base, loc=(0, -0.13, 0)).rotation_euler = (-math.pi / 2, 0, 0)
    upper = empty(f'leg{k}-upper', base)
    box('u-a', (L1, 0.045, 0.18), (L1 / 2, 0.082, 0), GRAPHITE, upper, 0.007)
    box('u-led', (L1 * 0.55, 0.004, 0.012), (L1 / 2, 0.106, 0), LED, upper, None)
    box('u-b', (L1, 0.045, 0.18), (L1 / 2, -0.082, 0), GRAPHITE, upper, 0.007)
    box('u-led', (L1 * 0.55, 0.004, 0.012), (L1 / 2, -0.106, 0), LED, upper, None)
    cyl('piston', 0.022, L1 * 0.62, (L1 * 0.45, 0, 0.125), STEEL, upper, axis='X', seg=20)
    cyl('piston-b', 0.036, L1 * 0.3, (L1 * 0.28, 0, 0.125), GOLD, upper, axis='X', seg=24)
    knee = empty(f'leg{k}-knee', upper, (L1, 0, 0))
    cyl('kneeb', 0.118, 0.26, (0, 0, 0), DARK, knee, axis='Y', seg=48)
    revolve('kneeg', [(0.07, 0), (0.125, 0), (0.125, -0.014), (0.07, -0.014)], GOLD, knee, loc=(0, 0.13, 0)).rotation_euler = (math.pi / 2, 0, 0)
    revolve('kneeg', [(0.07, 0), (0.125, 0), (0.125, -0.014), (0.07, -0.014)], GOLD, knee, loc=(0, -0.13, 0)).rotation_euler = (-math.pi / 2, 0, 0)
    lower = empty(f'leg{k}-lower', knee)
    bm = bmesh.new()
    prof = [(0.0, 0.105), (L2 * 0.75, 0.066), (L2, 0.044)]
    vs = []
    for x, h in prof:
        vs.append([bm.verts.new((x, y, z)) for y, z in ((-0.062, -h), (0.062, -h), (0.062, h), (-0.062, h))])
    for i in range(2):
        for j in range(4):
            bm.faces.new((vs[i][j], vs[i][(j + 1) % 4], vs[i + 1][(j + 1) % 4], vs[i + 1][j]))
    bm.faces.new(vs[0])
    bm.faces.new(list(reversed(vs[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish('l-beam', bm, GRAPHITE, lower, (0, 0, 0), 0.006)
    box('l-led', (L2 * 0.6, 0.128, 0.01), (L2 * 0.38, 0, 0.0), LED, lower, None)
    foot = empty(f'leg{k}-foot', lower, (L2, 0, 0))
    cyl('foot-b', 0.135, 0.06, (0, 0, -0.012), DARK, foot, seg=6)
    cyl('foot-g', 0.142, 0.014, (0, 0, -0.022), GOLD, foot, seg=6)
    for dy in (-0.05, 0.05):
        cu = bpy.data.curves.new('cable', 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = 0.014
        cu.bevel_resolution = 2
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(1)
        pa, pb = sp.bezier_points
        pa.co = (-0.32, dy * 2.4, 0.2)
        pa.handle_left = (-0.42, dy * 2.4, 0.2)
        pa.handle_right = (-0.1, dy * 2.4, 0.42)
        pb.co = (0.06, dy * 1.2, 0.17)
        pb.handle_left = (-0.06, dy * 1.2, 0.36)
        pb.handle_right = (0.2, dy * 1.2, 0.1)
        co = bpy.data.objects.new('cable', cu)
        coll.objects.link(co)
        cu.materials.append(RUBBER)
        co.parent = base
    legs.append((hip, base, upper, knee, lower, foot, a))

# ------------------------------------------------------------------ 5. the floor, with a hole for the sleeve
bm = bmesh.new()
loops = []
for r in (0.45, 40.0):
    loops.append([bm.verts.new((r * math.cos(k / 64 * math.tau), r * math.sin(k / 64 * math.tau), 0)) for k in range(64)])
for k in range(64):
    bm.faces.new((loops[0][k], loops[0][(k + 1) % 64], loops[1][(k + 1) % 64], loops[1][k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
floor = finish('floor', bm, FLOOR, None, (0, 0, -0.14), None, 80)
floor.is_shadow_catcher = True
floor_cover = cyl('floor-cover', 0.6, 0.002, (0, 0, -0.14), FLOOR, floor, seg=64, bevel=None)
floor_cover.location = (0, 0, 0)
floor_cover.is_shadow_catcher = True

# ------------------------------------------------------------------ light, camera, world
def area(name, loc, target, size, energy, col):
    li = bpy.data.lights.new(name, 'AREA')
    li.size = size
    li.energy = energy
    li.color = col
    ob = bpy.data.objects.new(name, li)
    coll.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = False
    return ob


key = area('key', (-2.6, -1.8, 4.4), (0, 0, 0), 3.2, 120, (1.0, 0.96, 0.9))
rim = area('rim', (3.6, 3.2, 0.55), (0, 0, 0.1), 2.0, 110, (0.62, 0.52, 1.0))
strip = area('strip', (3.0, 2.2, 2.3), (0, 0, 0.2), 0.5, 42, (1.0, 0.95, 0.88))
strip.data.shape = 'RECTANGLE'
strip.data.size = 5.0
strip.data.size_y = 0.32
low = area('low', (1.6, -3.4, -0.25), (0, 0, 0.3), 1.8, 18, (1.0, 0.72, 0.34))
top = area('top', (0.2, 0.2, 3.6), (0, 0, 0), 2.4, 40, (1.0, 0.95, 0.88))
bench = area('bench', (-0.5, 0.7, 1.3), (0, 0, 0), 1.0, 9, (1.0, 0.86, 0.68))
lamp = bpy.data.lights.new('headlamp', 'POINT')
lamp.energy = 0
lamp.color = (1.0, 0.93, 0.82)
lamp.shadow_soft_size = 0.4
lamp_ob = bpy.data.objects.new('headlamp', lamp)
coll.objects.link(lamp_ob)
cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
coll.objects.link(cam)
scene.camera = cam
cam_d.sensor_width = 36
cam_d.clip_start = 0.01
cam_d.clip_end = 400
cam_d.dof.use_dof = True

world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.0012, 0.0011, 0.002, 1)
scene.world = world

scene.render.resolution_x, scene.render.resolution_y = 1280, 720


# ------------------------------------------------------------------ the camera's path
LZ = 0.6
# frame, position, target, lens, f-stop, sideways shift (the machine stands to the right of the words)
CAM = [
    (0, (1.3, -2.25, 1.65), (0.0, 0.0, 0.0), 50, 7.0, -0.24),
    (12, (1.2, -2.1, 1.52), (0.0, 0.0, 0.0), 50, 7.0, -0.24),
    (34, (0.36, -0.48, 0.21), (0.02, 0.02, 0.03), 60, 2.6, -0.15),
    (48, (0.56, -0.8, 0.44), (0.0, 0.0, 0.04), 55, 3.2, -0.16),
    (72, (1.22, -1.95, 1.5), (0.0, 0.0, 0.1), 50, 5.0, -0.16),
    (100, (1.02, -2.15, 1.75), (0.0, 0.0, 0.14), 50, 6.0, -0.16),
    (126, (-1.05, -2.25, 1.95), (0.0, 0.0, 0.24), 50, 6.0, -0.16),
    (154, (-1.3, -2.55, 2.05), (0.0, 0.0, 0.24), 50, 7.0, -0.16),
    (180, (-2.0, -3.2, 1.8), (0.0, 0.0, 0.24), 50, 8.0, -0.11),
    (206, (-2.4, -3.35, 1.9), (0.0, 0.0, 0.24), 50, 9.0, -0.11),
    (240, (-3.7, -3.5, 1.65), (0.0, 0.0, 0.05), 45, 9.0, -0.1),
    (262, (-4.7, -2.9, 1.2), (0.0, 0.0, -0.06), 40, 10.0, -0.09),
    (274, (-4.5, -3.3, 1.35), (0.0, 0.0, -0.04), 40, 10.0, -0.09),
    (296, (-3.8, -5.3, 4.5), (0.75, -1.15, 0.85), 38, 14.0, -0.04),
    (312, (-3.8, -5.3, 4.5), (0.75, -1.15, 0.85), 38, 14.0, -0.04),
    (328, (-3.9, -3.0, 1.4), (0.0, 0.0, 0.0), 40, 10.0, -0.04),
    (344, (-1.1, -1.3, 4.0), (0.0, 0.0, 0.5), 40, 12.0, 0.0),
    (356, (0.0, -0.05, 2.0), (0.0, 0.0, 0.3), 42, 14.0, 0.0),
]


def spline(keys, f, idx):
    if f <= keys[0][0]:
        return keys[0][idx]
    for i in range(len(keys) - 1):
        a, b = keys[i], keys[i + 1]
        if f <= b[0]:
            t = (f - a[0]) / (b[0] - a[0])
            p0, p1, p2, p3 = keys[max(i - 1, 0)][idx], a[idx], b[idx], keys[min(i + 2, len(keys) - 1)][idx]
            def cr(q0, q1, q2, q3):
                return 0.5 * ((2 * q1) + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q3) * t * t + (-q0 + 3 * q1 - 3 * q2 + q3) * t * t * t)
            if isinstance(p1, tuple):
                return tuple(cr(p0[n], p1[n], p2[n], p3[n]) for n in range(3))
            return cr(p0, p1, p2, p3)
    return keys[-1][idx]


TUNNEL = [(356, 2.0), (364, 0.4), (370, -1.3), (378, -5.0), (388, -7.7), (400, -8.2), (416, -22.7), (428, -23.2), (444, -33.7), (456, -34.2), (472, -44.7), (484, -45.2), (502, -57.5)]


def tunnel_z(f):
    for (a, za), (b, zb) in zip(TUNNEL, TUNNEL[1:]):
        if f <= b:
            return mix(za, zb, ez(ramp(f, a, b)) if a >= 370 else ramp(f, a, b) ** 1.5)
    return TUNNEL[-1][1]


def place_camera(f):
    if f <= 356:
        pos = Vector(spline(CAM, f, 1))
        tgt = Vector(spline(CAM, f, 2))
        lens = spline(CAM, f, 3)
        fstop = spline(CAM, f, 4)
        shift = spline(CAM, f, 5)
    else:
        z = tunnel_z(f)
        wob = ease(f, 370, 386)
        pos = Vector((math.sin(f * 0.07) * 0.12 * wob, math.cos(f * 0.053) * 0.08 * wob + (-0.05 * (1 - wob)), z))
        tgt = Vector((math.sin(f * 0.07) * 0.04 * wob, 0.0, z - 4.0))
        lens = mix(42, 32, ease(f, 356, 378))
        fstop = 22
        shift = 0.0
    k = ease(f, 328, 356)
    up = Vector((0, 0, 1)).lerp(Vector((0, 1, 0)), k).normalized()
    d = (tgt - pos).normalized()
    if abs(d.dot(up)) > 0.995:
        up = Vector((0, 1, 0))
    right = d.cross(up).normalized()
    up2 = right.cross(d).normalized()
    M = Matrix(((right.x, up2.x, -d.x), (right.y, up2.y, -d.y), (right.z, up2.z, -d.z)))
    cam.matrix_world = Matrix.Translation(pos) @ M.to_4x4()
    if f > 356:
        cam.rotation_mode = 'XYZ'
        cam.rotation_euler.rotate_axis('Z', math.sin(f * 0.04) * 0.03 * ease(f, 370, 386))
    cam_d.lens = lens
    cam_d.shift_x = shift
    cam_d.dof.focus_distance = (pos - tgt).length
    cam_d.dof.aperture_fstop = fstop
    lamp_ob.location = pos + Vector((0, 0.3, -0.5))
    return pos


def polyline_point(pts, t):
    lens_ = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(lens_)
    s_ = (t % 1.0) * total
    for (a, b), l in zip(zip(pts, pts[1:]), lens_):
        if s_ <= l:
            u = s_ / max(l, 1e-6)
            return (mix(a[0], b[0], u), mix(a[1], b[1], u))
        s_ -= l
    return pts[-1]


def back_out(x, o=1.25):
    x -= 1
    return 1 + x * x * ((o + 1) * x + o)


ANCHORS = {}
DRIVE_XY = [(g.location.x, g.location.y) for g in drive]


def pose(f):
    pos = place_camera(f)
    # Exploded view: the four layers lift apart so you can read the stack, then close.
    X = ease(f, 276, 296) * (1 - ease(f, 312, 326))
    closed = 200 <= f and X <= 0.001
    # The board wakes.
    wake = ease(f, 6, 26)
    show(board, not closed and f < 334)
    SX, SY = 0.6 * X, -0.8 * X
    board.location = (SX * 0.8, SY * 0.8, X * 0.8)
    for ob, pr, ph in pulses_board:
        x, y = polyline_point(pr, f * 0.024 + ph)
        ob.location = (x, y, Z + 0.004)
    set_emit(PULSE, 4.0 * wake if f < 334 else 14.0)
    # Software: the code layer lands and types itself.
    d = ease(f, 52, 76)
    show(code, f >= 50 and not closed and f < 334)
    code.location = (SX * 1.6, SY * 1.6, mix(1.5, 0.17, d) + X * 1.3)
    typed = math.floor(ramp(f, 72, 96) * 16) / 16
    code_bsdf.inputs['Emission Strength'].default_value = 2.6 * ease(f, 68, 74)
    code_cover.scale = (1, max(1 - typed, 0.0001) * 1.1, 1)
    code_cover.location = (0, -0.55, 0.0178)
    # Games: the controller lands on its own layer.
    g_ = ease(f, 104, 130)
    show(game, f >= 102 and not closed and f < 334)
    game.location = (SX * 2.4, SY * 2.4, mix(1.8, 0.34, back_out(g_, 0.9) if g_ < 1 else 1) + X * 1.75)
    # Security: armour closes round them, the lid and shield come down.
    for k, g in enumerate(walls):
        show(g, f >= 154 and f < 372)
        dist = mix(2.8, 0.70, ease(f, 156 + k * 3, 174 + k * 3))
        a = k * math.pi / 2
        g.location = (dist * math.sin(a), -dist * math.cos(a), WALL_Z)
    for i, g in enumerate(posts):
        show(g, f >= 164 and f < 372)
        g.location.z = mix(1.9, WALL_Z, ease(f, 164 + i, 178 + i))
    show(lid, f >= 174 and f < 372)
    lid_z = mix(2.4, LZ, ease(f, 176, 196)) + X * 2.0
    lid.location = (SX * 3.2, SY * 3.2, lid_z)
    led = 2.8 * ease(f, 190, 202)
    set_emit(KEY, (6.0 + 1.4 * math.sin(f * 0.25)) * ease(f, 188, 200))
    # Iris and shield.
    openness = ease(f, 338, 356)
    for pivot, a in blades:
        pivot.rotation_euler = (0, 0, a + math.pi + mix(0.2, 1.32, openness))
    cap_gone = ease(f, 332, 342)
    show(cap, cap_gone < 1.0 and f >= 174)
    cap.scale = (max(1 - cap_gone, 0.001), max(1 - cap_gone, 0.001), 1)
    cap.rotation_euler = (0, 0, cap_gone * 2.6)
    show(sleeve, f >= 334 and f < 382)
    # Mechatronics: the gear ring, the drives, then the legs, and it stands.
    show(turret, f >= 206 and f < 372)
    turret.location = (SX * 3.2, SY * 3.2, mix(2.2, LZ + 0.05, ease(f, 208, 222)) + X * 2.0)
    spin = max(f - 218, 0) * 0.016
    turret.rotation_euler = (0, 0, spin)
    for i, (g, p) in enumerate(zip(drive, pinions)):
        show(g, f >= 208 and f < 372)
        bx, by = DRIVE_XY[i]
        g.location = (bx + SX * 3.2, by + SY * 3.2, mix(1.8, LZ + 0.03, ease(f, 210 + i * 2, 224 + i * 2)) + X * 2.0)
        p.rotation_euler = (0, 0, -spin * 0.655 / 0.108 + 0.11)
    u = ease(f, 240, 262)
    A = math.radians(mix(84, 22, u))
    B = math.radians(mix(-102, -68, u))
    for i, (hip, base, upper, knee, lower, foot, a) in enumerate(legs):
        show(hip, f >= 212 and f < 372)
        base.location.x = mix(5.5, 1.02, ease(f, 212 + i * 4, 236 + i * 2))
        upper.rotation_euler = (0, -A, 0)
        knee_rel = B - A
        lower.rotation_euler = (0, -knee_rel, 0)
        foot.rotation_euler = (0, knee_rel + A, 0)
    fz = HIP_Z + L1 * math.sin(A) + L2 * math.sin(B) - 0.04
    base_z = mix(-0.019, -0.145, ease(f, 150, 172))
    floor.location.z = min(fz, base_z) if f >= 212 else base_z
    show(floor, f < 368)
    show(floor_cover, f < 334)
    # Lights: studio outside, headlamp in the shaft.
    outside = 1 - ease(f, 362, 370)
    key.data.energy = 150 * outside * mix(0.55, 1.0, ease(f, 8, 40))
    rim.data.energy = 78 * outside * mix(0.5, 1.0, ease(f, 20, 60))
    strip.data.energy = 42 * outside * mix(0.6, 1.0, ease(f, 8, 40))
    low.data.energy = 18 * outside
    bench.data.energy = 9 * (1 - ease(f, 150, 180)) * mix(0.5, 1.0, ease(f, 2, 24))
    top.data.energy = 40 * outside * ease(f, 40, 90)
    lamp.energy = 60 * ease(f, 356, 374)
    set_emit(LED, led if f < 356 else mix(led, 1.5, ease(f, 356, 374)))
    # Where the page's labels point during the exploded view.
    bpy.context.view_layer.update()
    pts = {'armour': Vector((lid.location.x + 0.78, lid.location.y - 0.78, lid_z + 0.03)), 'controls': Vector((game.location.x + 0.63, game.location.y - 0.63, game.location.z)), 'brain': Vector((code.location.x + 0.63, code.location.y - 0.63, code.location.z)), 'body': Vector((0.72, -0.72, 0.3)), 'ap': Vector((0, 0, lid_z)), 'ap2': Vector((AP * 1.3, 0, lid_z))}
    ANCHORS[f] = {n: {'point': [round(c, 5) for c in v], 'uv': [round(c, 5) for c in world_to_camera_view(scene, cam, v)[:2]]} for n, v in pts.items() if n in ('armour', 'controls', 'brain', 'body')}


DRIVEN = (
    ['board'] + [f'pulse-{i}' for i in range(12)] + ['code', 'code-cover', 'game'] + [f'wall{k}' for k in range(4)] + [f'post-{k}' for k in range(4)]
    + ['lid'] + [f'blade-pivot-{k}' for k in range(BN)] + ['keycap', 'sleeve', 'turret'] + [f'servo-{k}' for k in range(2)] + [f'pinion-{k}' for k in range(2)]
    + [n for k in range(4) for n in (f'leg{k}', f'leg{k}-base', f'leg{k}-upper', f'leg{k}-lower', f'leg{k}-foot')] + ['floor', 'floor-cover']
)


def part_state(name):
    ob = bpy.data.objects[name]
    return {
        'p': [round(c, 6) for c in ob.location],
        'r': [round(c, 6) for c in ob.rotation_euler],
        's': [round(c, 6) for c in ob.scale],
        'on': not ob.hide_render,
    }


def emission(m):
    return round(m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value, 6)


scene.frame_set(0)
poses = {}
for f in REVIEW_FRAMES:
    pos = pose(f)
    bpy.context.view_layer.update()
    poses[str(f)] = {
        'parts': {name: part_state(name) for name in DRIVEN},
        'camera': {'position': [round(c, 6) for c in cam.matrix_world.translation], 'matrix': [round(c, 6) for row in cam.matrix_world for c in row], 'lens': round(cam_d.lens, 6), 'fstop': round(cam_d.dof.aperture_fstop, 6), 'focus': round(cam_d.dof.focus_distance, 6), 'shift': round(cam_d.shift_x, 6)},
        'emit': {'pulse': emission(PULSE), 'led': emission(LED), 'key': emission(KEY), 'code': round(code_bsdf.inputs['Emission Strength'].default_value, 6)},
        'lights': {'key': round(key.data.energy, 6), 'rim': round(rim.data.energy, 6), 'strip': round(strip.data.energy, 6), 'low': round(low.data.energy, 6), 'top': round(top.data.energy, 6), 'bench': round(bench.data.energy, 6), 'lamp': round(lamp.energy, 6)},
    }
with open(OUT_POSE, 'w') as fh:
    json.dump(poses, fh, indent=1)
ANCHORS.clear()
for f in ANCHOR_FRAMES:
    pose(f)
with open(OUT_ANCHORS, 'w') as fh:
    json.dump(ANCHORS, fh, indent=1)

# The model as a whole, everything showing, the lights and the camera left out: the page has its own.
pose(0)
for ob in bpy.data.objects:
    ob.hide_render = False
for m in (PULSE, LED, KEY, LED_COOL):
    set_emit(m, 1.0)
code_bsdf.inputs['Emission Strength'].default_value = 1.0
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_yup=False, use_selection=False, export_animations=False, export_cameras=False, export_lights=False)
print('EXPORTED', OUT_GLB, flush=True)
