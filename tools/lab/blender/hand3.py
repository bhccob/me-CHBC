# LAB ONLY (throwaway). Round 45: the colossus's hand, an armoured gauntlet in the spirit of a modern armoured suit
# (an original design in the robot's own black, gold and violet): an anatomical palm, layered plates over the back, a
# knuckle guard, fingers in overlapping shells over a silver under-layer, a thumb with its own pad, a glowing palm, and a
# finished wrist with a violet ring (the hands float; there is no arm). Every finger segment is its own node with its
# pivot at the joint. Run headless:
#   blender --background --factory-startup --python tools/lab/blender/hand3.py -- <out.glb> [preview.png]
# Blender is Z up; glTF comes out Y up. Fingers point along +Z here (+Y in the page); the palm faces -Y here (+Z there).
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'hand3.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal, rough, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

ARMOR = material('armor', (0.035, 0.032, 0.045), 0.9, 0.2, coat=1.0)
PLATE = material('plate', (0.1, 0.09, 0.12), 1.0, 0.17, coat=1.0)
UNDER = material('under', (0.32, 0.31, 0.36), 1.0, 0.34)
GOLD = material('gold', (0.78, 0.52, 0.22), 1.0, 0.24)
GLOW = material('glow', (0.05, 0.03, 0.01), 0.0, 0.5, emit=(1.0, 0.7, 0.3), strength=6.0)
SEAM = material('seam', (0.02, 0.01, 0.03), 0.0, 0.5, emit=(0.62, 0.42, 1.0), strength=5.0)

def mods(o, bevel=0.0, segs=3, subsurf=0, taper=0.0, bend=0.0, bend_axis='Z'):
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    if taper:
        m = o.modifiers.new('taper', 'SIMPLE_DEFORM'); m.deform_method = 'TAPER'; m.factor = taper; m.deform_axis = 'Z'
    if bend:
        m = o.modifiers.new('bend', 'SIMPLE_DEFORM'); m.deform_method = 'BEND'; m.angle = bend; m.deform_axis = bend_axis
    if subsurf:
        m = o.modifiers.new('smooth', 'SUBSURF'); m.levels = subsurf; m.render_levels = subsurf
    for p in o.data.polygons: p.use_smooth = True

def empty(name, at=(0, 0, 0), parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = at
    o.rotation_euler = rot
    if parent is not None: o.parent = parent
    return o

def shaped(name, fn, cuts, mat, parent, at=(0, 0, 0), subsurf=2):
    """A subdivided cube whose every vertex (in -0.5..0.5) is moved by fn(x, y, z) -> (x, y, z)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=cuts); bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        v.co.x, v.co.y, v.co.z = fn(v.co.x, v.co.y, v.co.z)
    o.location = at
    o.data.materials.append(mat)
    o.parent = parent
    mods(o, subsurf=subsurf)
    return o

def box(name, size, at=(0, 0, 0), rot=(0, 0, 0), mat=ARMOR, parent=None, base=False, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if base: v.co.z += size[2] / 2
    o.location = at
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent is not None: o.parent = parent
    mods(o, **kw)
    return o

def cyl(name, r, depth, at=(0, 0, 0), rot=(0, 0, 0), mat=UNDER, parent=None, verts=40, r2=None, **kw):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.location = at
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent is not None: o.parent = parent
    mods(o, **kw)
    return o

def torus(name, R, r, at, rot=(0, 0, 0), mat=GOLD, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=96, minor_segments=10, location=at, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    return o

def ss(a, b, t):
    t = max(0.0, min(1.0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)

hand = empty('hand')

# ---- the palm: wider at the knuckles than the wrist, a domed back, the heel and thumb pad on the palm side
def palm_fn(x, y, z):
    t = z + 0.5                                   # 0 at the wrist, 1 at the knuckles
    x, y = x * math.sqrt(max(0.0, 1 - 0.55 * (2 * y) ** 2 / 2)), y * math.sqrt(max(0.0, 1 - 0.55 * (2 * x) ** 2 / 2))
    w = 0.78 + 0.2 * ss(0.0, 0.75, t)
    X = x * w
    Y = y * 0.3
    if y > 0: Y += 0.07 * (1 - (2 * x) ** 2)       # the back domes
    else:
        Y -= 0.05 * math.exp(-((x + 0.28) ** 2) / 0.02 - ((t - 0.3) ** 2) / 0.05)   # thumb pad
        Y -= 0.03 * math.exp(-((x - 0.25) ** 2) / 0.03 - ((t - 0.15) ** 2) / 0.03)  # heel
    Z = t * 1.02 + 0.06 * (1 - (2 * x + 0.15) ** 2) * ss(0.7, 1.0, t)   # the knuckle line arches
    return X, Y, Z
palm = shaped('palm', palm_fn, 5, ARMOR, hand)

# ---- plates over the back: a metacarpal plate in two layers, a knuckle guard, a lit seam between
def back_plate(name, z0, z1, w0, w1, lift, mat, trim=True):
    def fn(x, y, z):
        t = z + 0.5
        w = w0 + (w1 - w0) * t
        X = x * w
        Z = z0 + t * (z1 - z0)
        Y = 0.16 + lift + 0.07 * (1 - (2 * x) ** 2) + 0.035 * math.exp(-(x * x) / 0.01) + (y + 0.5) * 0.045
        return X, Y, Z
    p = shaped(name, fn, 3, mat, hand, subsurf=2)
    m = p.modifiers.new('bevel', 'BEVEL'); m.width = 0.01; m.segments = 2
    p.modifiers.move(len(p.modifiers) - 1, 0)
    if trim:
        box(f'{name}_trim', (w0 * 0.92, 0.014, 0.016), at=(0, 0.16 + lift + 0.1, z0 + 0.01), mat=GOLD, parent=hand, bend=0.9, bend_axis='Z')
    return p
back_plate('plate_back', 0.12, 0.84, 0.7, 0.9, 0.0, PLATE)
for sx in (-1, 1):
    box(f'back_line_{sx}', (0.01, 0.01, 0.5), at=(sx * 0.2, 0.255, 0.28), rot=(0, sx * -0.12, 0), mat=SEAM, parent=hand, base=True)

# ---- fingers: anatomical lengths, the knuckle line arched; each segment a shell over the silver under-layer
FINGERS = [  # x at the knuckle, z of the knuckle, width, (proximal, middle, distal), fan
    (-0.34, 1.0, 0.205, (0.43, 0.26, 0.21), -0.05),
    (-0.115, 1.05, 0.215, (0.47, 0.29, 0.22), -0.015),
    (0.115, 1.03, 0.205, (0.45, 0.28, 0.215), 0.02),
    (0.33, 0.95, 0.18, (0.36, 0.22, 0.19), 0.06),
]

def segment(name, w, ln, parent, z, last=False):
    seg = empty(name, at=(0, 0, z), parent=parent)
    d = w * 0.86
    # the under-layer core: a slim silver tube with a joint barrel at its root
    cyl(f'{name}_core', w * 0.36, ln * 0.96, at=(0, 0, ln * 0.48), mat=UNDER, parent=seg, verts=24)
    cyl(f'{name}_joint', w * 0.42, w * 0.96, at=(0, 0, 0), rot=(0, math.pi / 2, 0), mat=UNDER, parent=seg, verts=28, bevel=0.012)
    # the shell: a tapered tube, back flatter, overlapping toward the next joint
    L = ln * (0.86 if not last else 0.78)
    sh = cyl(f'{name}_shell', w * 0.5, L, at=(0, 0.006, ln * 0.12 + L / 2), mat=ARMOR, parent=seg, verts=28, r2=w * 0.44, bevel=w * 0.12, segs=3, subsurf=1)
    sh.scale = (1, 0.86, 1)
    # the top plate: a curved lighter plate on the back of the segment, with a gold edge
    box(f'{name}_plate', (w * 0.8, 0.035, ln * 0.62), at=(0, d * 0.5 + 0.005, ln * 0.2), mat=PLATE, parent=seg, base=True, bevel=0.012, segs=2, bend=1.9, bend_axis='Z', subsurf=1)
    box(f'{name}_edge', (w * 0.62, 0.012, 0.012), at=(0, d * 0.5 + 0.03, ln * 0.83), mat=GOLD, parent=seg, bend=1.2, bend_axis='Z')
    if last:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=w * 0.5, segments=32, ring_count=16, location=(0, 0, ln * 0.86))
        tip = bpy.context.active_object; tip.name = f'{name}_tip'; tip.scale = (0.88, 0.78, 0.62); tip.data.materials.append(ARMOR); tip.parent = seg
        for p in tip.data.polygons: p.use_smooth = True
    return seg

for f, (x, zk, w, ls, fan) in enumerate(FINGERS):
    base = empty(f'f{f}_base', at=(x, 0.02, zk), parent=hand, rot=(0, fan, 0))
    # the knuckle cap: a rounded plate over the joint
    bpy.ops.mesh.primitive_uv_sphere_add(radius=w * 0.56, segments=32, ring_count=16, location=(x, 0.16, zk - 0.03))
    k = bpy.context.active_object; k.name = f'knuckle_{f}'; k.scale = (1.0, 0.42, 0.78); k.data.materials.append(GOLD); k.parent = hand
    for p in k.data.polygons: p.use_smooth = True
    parent, z = base, 0.0
    for s, ln in enumerate(ls):
        seg = segment(f'f{f}_s{s}', w * (1 - s * 0.08), ln, parent, z, last=(s == 2))
        parent, z = seg, ln

# ---- the thumb: out of the palm's side, its pad turned toward the fingers
tb = empty('thumb_base', at=(-0.42, -0.06, 0.32), parent=hand, rot=(0.55, -0.35, 0.72))
parent, z = tb, 0.0
for s, ln in enumerate((0.36, 0.28, 0.23)):
    seg = segment(f'thumb_s{s}', 0.235 * (1 - s * 0.07), ln, parent, z, last=(s == 2))
    parent, z = seg, ln

# ---- the palm: a warm light in a gold ring
cyl('palm_light', 0.15, 0.06, at=(0, -0.215, 0.6), rot=(math.pi / 2, 0, 0), mat=GLOW, parent=hand, verts=48)
torus('palm_ring', 0.19, 0.022, at=(0, -0.235, 0.6), rot=(math.pi / 2, 0, 0), parent=hand)

# ---- the wrist: a short flared cuff, finished, a violet ring round a dark cap (no arm beyond it)
cuff = cyl('cuff', 0.39, 0.2, at=(0, 0.0, -0.02), mat=ARMOR, parent=hand, verts=64, r2=0.4, bevel=0.03, segs=3, subsurf=1)
cuff.scale = (1, 0.62, 1)
trim = torus('cuff_trim', 0.4, 0.014, at=(0, 0.0, 0.07), parent=hand); trim.scale = (1, 0.62, 1)
cap = cyl('wrist_cap', 0.35, 0.02, at=(0, 0.0, -0.12), mat=UNDER, parent=hand, verts=64); cap.scale = (1, 0.62, 1)
ring = torus('wrist_ring', 0.31, 0.024, at=(0, 0.0, -0.13), mat=SEAM, parent=hand); ring.scale = (1, 0.62, 1)
core = cyl('wrist_core', 0.15, 0.02, at=(0, 0.0, -0.135), mat=SEAM, parent=hand, verts=48); core.scale = (1, 0.62, 1)

if PREVIEW:
    import os
    root, ext = os.path.splitext(PREVIEW)
    for f in range(4):
        for s in range(3):
            bpy.data.objects[f'f{f}_s{s}'].rotation_euler.x = -(0.18 + 0.1 * s)
    for s in range(3): bpy.data.objects[f'thumb_s{s}'].rotation_euler.x = -0.15
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    for nm, loc, power, col in (('key', (3, -4, 5), 900, (1, 0.95, 0.9)), ('rim', (-3, 4, 3), 1400, (0.6, 0.45, 1.0)), ('fill', (-4, -3, 0), 250, (1, 0.8, 0.6)), ('back', (2, 5, 3), 700, (0.9, 0.9, 1.0))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 800, 800
    for tag, loc, rot in (('back', (1.8, 3.6, 1.6), (78, 0, 152)), ('palm', (2.0, -3.6, 1.4), (80, 0, 30))):
        cam.location = loc; cam.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.render.filepath = f'{root}-{tag}{ext}'
        bpy.ops.render.render(write_still=True)
    for f in range(4):
        for s in range(3): bpy.data.objects[f'f{f}_s{s}'].rotation_euler.x = 0
    for s in range(3): bpy.data.objects[f'thumb_s{s}'].rotation_euler.x = 0
    for nm in ('cam', 'key', 'rim', 'fill', 'back'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
print('EXPORTED', OUT)
