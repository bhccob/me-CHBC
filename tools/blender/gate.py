# The machine's gate for the flight: one octagon frame with gears, clamps and an LED band; twelve iris blades; every digit as
# gold type, so that any year can be built; the gear of the questions. Exports one GLB the page clones along the path.
#   blender -b --factory-startup --python tools/blender/gate.py -- <out.glb>      (npm run build:models does this)
import bmesh
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
scene = bpy.context.scene
coll = scene.collection
FONT = 'C:/Windows/Fonts/arialbd.ttf'
for candidate in ('C:/Windows/Fonts/bahnschrift.ttf', 'C:/Windows/Fonts/segoeuib.ttf'):
    if os.path.exists(candidate):
        FONT = candidate
        break


def material(name, col, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


GRAPHITE = material('graphite', (0.05, 0.05, 0.06), 1.0, 0.36)
STEEL = material('steel', (0.26, 0.26, 0.29), 1.0, 0.26)
GOLD = material('gold', (0.86, 0.56, 0.17), 1.0, 0.24)
LED = material('led', (0, 0, 0), 0, 0.4, (1.0, 0.68, 0.24), 3.0)
BLADE = material('blade', (0.1, 0.1, 0.115), 1.0, 0.3)
YEAR = material('year', (0.86, 0.56, 0.17), 1.0, 0.22, (1.0, 0.66, 0.22), 0.5)

SIDES = 8
RI, RO = 3.25, 4.05


def oct_pt(k, r, z):
    a = (k + 0.5) / SIDES * math.tau
    return (r * math.cos(a), r * math.sin(a), z)


def finish(name, bm, mat, parent=None, loc=(0, 0, 0), smooth=None):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = loc
    if parent:
        ob.parent = parent
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = False
    return ob


def empty(name, parent=None, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    coll.objects.link(ob)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def ring(name, prof, mat, parent):
    bm = bmesh.new()
    lp = [[bm.verts.new(oct_pt(k, r, z)) for k in range(SIDES)] for r, z in prof]
    for i in range(len(prof)):
        for k in range(SIDES):
            j = (k + 1) % SIDES
            n = (i + 1) % len(prof)
            bm.faces.new((lp[i][k], lp[i][j], lp[n][j], lp[n][k]))
    return finish(name, bm, mat, parent, smooth=False)


def box(bm, c, s, rot=0.0):
    M = Matrix.Translation(c) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((s[0], s[1], s[2], 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)


def cyl(bm, c, r, h, seg=12):
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h, matrix=Matrix.Translation(c))


# The frame: a chamfered octagon, like the lid's iris housing.
frame = empty('frame')
ring('frame-body', [(RI, 0.3), (RI + 0.12, 0.42), (RO - 0.14, 0.42), (RO, 0.28), (RO, -0.28), (RO - 0.14, -0.42), (RI + 0.12, -0.42), (RI, -0.3)], GRAPHITE, frame)
ring('frame-inner', [(RI - 0.035, 0.1), (RI + 0.01, 0.1), (RI + 0.01, -0.1), (RI - 0.035, -0.1)], STEEL, frame)
ring('frame-led', [(RI - 0.05, 0.03), (RI - 0.03, 0.03), (RI - 0.03, -0.03), (RI - 0.05, -0.03)], LED, frame)
ring('frame-led2', [(RO - 0.5, 0.43), (RO - 0.48, 0.43), (RO - 0.48, 0.41), (RO - 0.5, 0.41)], LED, frame)

# Clamps and bolts on each corner, gold rails between them.
bm = bmesh.new()
for k in range(SIDES):
    a = k / SIDES * math.tau
    for sign in (1, -1):
        c = Vector(((RI + 0.38) * math.cos(a), (RI + 0.38) * math.sin(a), sign * 0.44))
        box(bm, c, (0.5, 0.32, 0.07), a)
finish('clamps', bm, STEEL, frame, smooth=False)
bm = bmesh.new()
for k in range(SIDES):
    a = k / SIDES * math.tau
    for off in (-0.1, 0.1):
        px = (RI + 0.38) * math.cos(a) - off * math.sin(a)
        py = (RI + 0.38) * math.sin(a) + off * math.cos(a)
        cyl(bm, (px, py, 0.49), 0.03, 0.03, 6)
    px, py, _ = oct_pt(k, RO - 0.3, 0)
    cyl(bm, (px, py, 0.44), 0.05, 0.03, 8)
finish('bolts', bm, GOLD, frame, smooth=False)


# Four gears on the face, the page turns them as you pass.
def gear(name, cx, cy, rad, teeth, mat, parent):
    bm = bmesh.new()
    pts = []
    rt, rr = rad * 1.14, rad * 0.92
    for k in range(teeth):
        s = k / teeth * math.tau
        u = math.tau / teeth
        for t, q in ((0, rr), (0.2, rr), (0.3, rt), (0.62, rt), (0.74, rr)):
            pts.append((q * math.cos(s + t * u), q * math.sin(s + t * u)))
    top = [bm.verts.new((x, y, 0.05)) for x, y in pts]
    bot = [bm.verts.new((x, y, -0.05)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((top[i], bot[i], bot[j], top[j]))
    ob = finish(name, bm, mat, parent, (cx, cy, 0.49), smooth=False)
    bm = bmesh.new()
    cyl(bm, (0, 0, 0.07), rad * 0.3, 0.05, 14)
    finish(name + '-hub', bm, GRAPHITE, ob, smooth=False)
    bm = bmesh.new()
    for k in range(5):
        a = k / 5 * math.tau
        cyl(bm, (rad * 0.62 * math.cos(a), rad * 0.62 * math.sin(a), 0.052), rad * 0.13, 0.006, 8)
    finish(name + '-holes', bm, GRAPHITE, ob, smooth=False)
    return ob


for k in range(4):
    a = (k + 0.5) / 4 * math.tau + math.tau / 16
    r = (RI + RO) / 2 + 0.02
    gear(f'gear-{k}', r * math.cos(a), r * math.sin(a), 0.26, 14, GOLD if k % 2 else STEEL, frame)


# The Q&A's gear: open spokes, so the void shows through it. Radius about 1.
def lathe(name, prof, mat, parent, seg=96):
    bm = bmesh.new()
    rows = [[bm.verts.new((r * math.cos(k / seg * math.tau), r * math.sin(k / seg * math.tau), z)) for k in range(seg)] for r, z in prof]
    for i in range(len(prof) - 1):
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new((rows[i][k], rows[i][j], rows[i + 1][j], rows[i + 1][k]))
    ob = finish(name, bm, mat, parent)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


qg = empty('qgear')
TEETH, RR, RT, RIN = 30, 0.9, 0.99, 0.72
pts, inner = [], []
for k in range(TEETH):
    s, u = k / TEETH * math.tau, math.tau / TEETH
    for t, q in ((0, RR), (0.2, RR), (0.3, RT), (0.62, RT), (0.74, RR)):
        pts.append((q * math.cos(s + t * u), q * math.sin(s + t * u)))
        inner.append((RIN * math.cos(s + t * u), RIN * math.sin(s + t * u)))
bm = bmesh.new()
n = len(pts)
ot = [bm.verts.new((x, y, 0.06)) for x, y in pts]
ob_ = [bm.verts.new((x, y, -0.06)) for x, y in pts]
it = [bm.verts.new((x, y, 0.06)) for x, y in inner]
ib = [bm.verts.new((x, y, -0.06)) for x, y in inner]
for i in range(n):
    j = (i + 1) % n
    bm.faces.new((ot[i], ot[j], it[j], it[i]))
    bm.faces.new((ob_[j], ob_[i], ib[i], ib[j]))
    bm.faces.new((ot[j], ot[i], ob_[i], ob_[j]))
    bm.faces.new((it[i], it[j], ib[j], ib[i]))
finish('qgear-teeth', bm, GOLD, qg, smooth=False)
lathe('qgear-face', [(RIN + 0.03, 0.062), (0.87, 0.062)], GRAPHITE, qg)
lathe('qgear-led', [(0.8, 0.066), (0.812, 0.066)], LED, qg)
lathe('qgear-inner', [(RIN - 0.012, 0.075), (RIN + 0.012, 0.075), (RIN + 0.012, -0.075), (RIN - 0.012, -0.075)], STEEL, qg)
bm = bmesh.new()
for k in range(6):
    a_ = k / 6 * math.tau
    M = Matrix.Rotation(a_, 4, 'Z') @ Matrix.Translation(((0.2 + RIN) / 2, 0, 0)) @ Matrix.Diagonal((RIN - 0.2, 0.075, 0.07, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=M)
finish('qgear-spokes', bm, STEEL, qg, smooth=False)
lathe('qgear-hub', [(0.0, 0.1), (0.2, 0.1), (0.23, 0.07), (0.23, -0.08)], GRAPHITE, qg)
lathe('qgear-cap', [(0.0, 0.112), (0.11, 0.112), (0.12, 0.1)], GOLD, qg)
bm = bmesh.new()
for k in range(6):
    a_ = (k + 0.5) / 6 * math.tau
    cyl(bm, (0.165 * math.cos(a_), 0.165 * math.sin(a_), 0.106), 0.017, 0.014, 8)
finish('qgear-bolts', bm, GOLD, qg, smooth=False)


# Twelve blades, the same shutter as the machine's lid. Each pivots round its own corner.
blades = empty('blades')
BLADES = 12
for k in range(BLADES):
    a = k / BLADES * math.tau
    R_P = 4.0
    piv = empty(f'blade-{k}', blades, (R_P * math.cos(a), R_P * math.sin(a), k * 0.012 - 0.07))
    pts = [(0.0, -0.74), (2.45, -1.1), (4.9, -0.74), (5.8, 0.0), (4.8, 1.35), (1.85, 1.6), (0.0, 0.86)]
    bm = bmesh.new()
    t = [bm.verts.new((x, y, 0.008)) for x, y in pts]
    b = [bm.verts.new((x, y, -0.008)) for x, y in pts]
    bm.faces.new(t)
    bm.faces.new(list(reversed(b)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((t[i], b[i], b[j], t[j]))
    finish(f'blade-mesh-{k}', bm, BLADE, piv, smooth=False)
    piv.rotation_euler = (0, 0, a + math.pi + 0.2)


# The digits in gold, each with its origin in the middle of its own width. How wide each is goes with it, for the page to set them.
def text_mesh(body):
    cu = bpy.data.curves.new('y' + body, 'FONT')
    cu.body = body
    cu.size = 1.25
    cu.align_x = 'LEFT'
    cu.align_y = 'CENTER'
    cu.extrude = 0.09
    cu.bevel_depth = 0.012
    cu.bevel_resolution = 1
    cu.resolution_u = 4
    cu.font = bpy.data.fonts.load(FONT)
    cu.materials.append(YEAR)
    ob = bpy.data.objects.new('t' + body, cu)
    coll.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.select_set(False)
    return ob


def ink_width(ob):
    xs = [v.co.x for v in ob.data.vertices]
    return max(xs) - min(xs)


for d in range(10):
    one = text_mesh(str(d))
    two = text_mesh(str(d) * 2)
    advance = ink_width(two) - ink_width(one)
    bpy.data.objects.remove(two)
    for v in one.data.vertices:
        v.co.x -= advance / 2
    one.name = f'digit-{d}'
    one['advance'] = advance
    print('DIGIT', d, round(advance, 3), flush=True)

for o in bpy.data.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=False, use_selection=False, export_animations=False, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT, os.path.getsize(OUT), flush=True)
