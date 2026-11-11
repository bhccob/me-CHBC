# LAB ONLY (throwaway). Builds the armoured hand for the robot beat and exports it as glTF, every finger segment its own
# node with its pivot at the joint, so the page can bend the fingers. Run headless:
#   blender --background --factory-startup --python tools/lab/blender/hand.py -- <out.glb> [preview.png]
# Blender is Z up; glTF comes out Y up. Fingers point along +Z here (+Y in the page); the palm faces -Y here (+Z there).
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'hand.glb'
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

ARMOR = material('armor', (0.05, 0.045, 0.06), 1.0, 0.32, coat=1.0)
SHELL = material('shell', (0.16, 0.15, 0.18), 1.0, 0.18, coat=1.0)
JOINT = material('joint', (0.012, 0.01, 0.016), 0.8, 0.45)
GOLD = material('gold', (0.78, 0.52, 0.22), 1.0, 0.25)
GLOW = material('glow', (0.05, 0.03, 0.01), 0.0, 0.5, emit=(1.0, 0.68, 0.24), strength=6.0)

def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj

def mods(obj, bevel=0.0, segs=3, subsurf=0, taper=0.0, bend=0.0, bend_axis='Z'):
    if bevel > 0:
        m = obj.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    if taper:
        m = obj.modifiers.new('taper', 'SIMPLE_DEFORM'); m.deform_method = 'TAPER'; m.factor = taper; m.deform_axis = 'Z'
    if bend:
        m = obj.modifiers.new('bend', 'SIMPLE_DEFORM'); m.deform_method = 'BEND'; m.angle = bend; m.deform_axis = bend_axis
    if subsurf:
        m = obj.modifiers.new('smooth', 'SUBSURF'); m.levels = subsurf; m.render_levels = subsurf
    for p in obj.data.polygons: p.use_smooth = True

def capsule(name, w, d, length, at=(0, 0, 0), mat=ARMOR, parent=None, **kw):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1, vertices=20)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        v.co.x *= w; v.co.y *= d; v.co.z = (v.co.z + 0.5) * length
    o.location = at
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    mods(o, **kw)
    return o

def box(name, size, at=(0, 0, 0), mat=ARMOR, parent=None, base=False, **kw):
    """A box of `size` (x, y, z); with base=True its origin sits at the middle of its bottom face."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    bpy.context.scene.collection.objects.unlink(o) if o.name in bpy.context.scene.collection.objects and False else None
    o.name = name
    for v in o.data.vertices:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if base: v.co.z += size[2] / 2
    o.location = at
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    mods(o, **kw)
    return o

def cyl(name, r, depth, at=(0, 0, 0), rot=(0, 0, 0), mat=JOINT, parent=None, verts=40, **kw):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.location = at
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    mods(o, **kw)
    return o

def sphere(name, r, at=(0, 0, 0), scale=(1, 1, 1), mat=JOINT, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=16)
    o = bpy.context.active_object
    o.name = name
    o.location = at
    o.scale = scale
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    return o

def empty(name, at=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = at
    if parent is not None:
        o.parent = parent
    return o

hand = empty('hand')

# ---- the cuff and wrist: smooth, ringed, cut by whatever the hand comes through
cyl('cuff', 0.44, 2.4, at=(0, 0, -1.4), mat=ARMOR, parent=hand, verts=64, bevel=0.03, subsurf=1)
for i, z in enumerate((-0.35, -0.95, -1.55)):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.452, minor_radius=0.014, major_segments=96, minor_segments=8, location=(0, 0, z))
    t = bpy.context.active_object; t.name = f'cuff_ring{i}'; t.data.materials.append(GOLD if i == 0 else JOINT); t.parent = hand
cyl('wrist', 0.33, 0.32, at=(0, 0, 0.0), mat=JOINT, parent=hand, verts=48, bevel=0.03)

# ---- palm and the layered plates over the back of the hand
palm = box('palm', (1.0, 0.36, 1.08), at=(0, 0, 0.1), mat=ARMOR, parent=hand, base=True, bevel=0.1, segs=4, subsurf=2)
box('back_plate_a', (1.06, 0.08, 0.6), at=(0, 0.2, 0.3), mat=SHELL, parent=hand, base=True, bevel=0.025, bend=0.5, bend_axis='Z', subsurf=1)
box('back_plate_b', (1.1, 0.08, 0.54), at=(0, 0.22, 0.78), mat=SHELL, parent=hand, base=True, bevel=0.025, bend=0.5, bend_axis='Z', subsurf=1)
box('back_glow', (0.72, 0.016, 0.018), at=(0, 0.27, 0.79), mat=GLOW, parent=hand)
for x in (-0.3, 0.3):
    box(f'back_glow_v{x}', (0.016, 0.016, 0.42), at=(x, 0.26, 0.42), mat=GLOW, parent=hand, base=True)
# The light in the palm, ringed in gold.
cyl('palm_light', 0.19, 0.04, at=(0, -0.185, 0.66), rot=(math.pi / 2, 0, 0), mat=GLOW, parent=hand, verts=48)
bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.022, major_segments=64, minor_segments=10, location=(0, -0.19, 0.66), rotation=(math.pi / 2, 0, 0))
t = bpy.context.active_object; t.name = 'palm_ring'; t.data.materials.append(GOLD); t.parent = hand

# ---- fingers: three segments each, pivots at the joints; plated shells on the back, a lit seam, a rounded tip
LENGTHS = [(0.5, 0.37, 0.28), (0.57, 0.41, 0.3), (0.55, 0.39, 0.29), (0.45, 0.33, 0.25)]
WIDTH = [0.19, 0.2, 0.19, 0.17]
for f, ls in enumerate(LENGTHS):
    x = -0.36 + f * 0.24
    base = empty(f'f{f}_base', at=(x, 0, 1.2), parent=hand)
    box(f'f{f}_guard', (0.22, 0.08, 0.16), at=(x, 0.17, 1.18), mat=SHELL, parent=hand, bevel=0.02, bend=0.6, bend_axis='Z', subsurf=1)
    parent, z = base, 0.0
    for s, ln in enumerate(ls):
        w = WIDTH[f] * (1 - s * 0.09)
        seg = capsule(f'f{f}_s{s}', w, w * 0.9, ln * 0.97, at=(0, 0, z), mat=ARMOR, parent=parent, bevel=w * 0.22, segs=4, taper=-0.16, subsurf=2)
        cyl(f'f{f}_s{s}_joint', w * 0.44, w * 1.06, at=(0, 0, 0), rot=(0, math.pi / 2, 0), mat=JOINT, parent=seg, verts=32, bevel=0.01)
        bpy.ops.mesh.primitive_torus_add(major_radius=w * 0.45, minor_radius=0.008, major_segments=48, minor_segments=6, location=(w * 0.54, 0, 0), rotation=(0, math.pi / 2, 0))
        tr = bpy.context.active_object; tr.name = f'f{f}_s{s}_ring'; tr.data.materials.append(GOLD); tr.parent = seg
        box(f'f{f}_s{s}_shell', (w * 0.86, 0.045, ln * 0.7), at=(0, w * 0.44, ln * 0.14), mat=SHELL, parent=seg, base=True, bevel=0.02, segs=3, bend=1.5, bend_axis='Z', subsurf=2)
        if s == 1:
            box(f'f{f}_s{s}_seam', (0.012, 0.012, ln * 0.42), at=(0, w * 0.44 + 0.03, ln * 0.26), mat=GLOW, parent=seg, base=True)
        if s == 2:
            sphere(f'f{f}_tip', w * 0.42, at=(0, -0.01, ln * 0.98), scale=(1, 0.86, 0.9), mat=SHELL, parent=seg)
        parent, z = seg, ln
# The thumb, from the side of the palm, turned in.
tb = empty('thumb_base', at=(-0.52, -0.05, 0.42), parent=hand)
tb.rotation_euler = (0.3, 0, 0.62)
parent, z = tb, 0.0
for s, ln in enumerate((0.4, 0.31, 0.25)):
    w = 0.22 * (1 - s * 0.08)
    seg = capsule(f'thumb_s{s}', w, w * 0.92, ln * 0.97, at=(0, 0, z), mat=ARMOR, parent=parent, bevel=w * 0.22, segs=4, taper=-0.14, subsurf=2)
    cyl(f'thumb_s{s}_joint', w * 0.45, w * 1.06, at=(0, 0, 0), rot=(0, math.pi / 2, 0), mat=JOINT, parent=seg, verts=32, bevel=0.01)
    box(f'thumb_s{s}_shell', (w * 0.86, 0.045, ln * 0.7), at=(0, w * 0.44, ln * 0.14), mat=SHELL, parent=seg, base=True, bevel=0.02, segs=3, bend=1.5, bend_axis='Z', subsurf=2)
    if s == 2:
        sphere('thumb_tip', w * 0.42, at=(0, -0.01, ln * 0.98), scale=(1, 0.86, 0.9), mat=SHELL, parent=seg)
    parent, z = seg, ln

# A preview: curl the fingers a little, light it, render.
if PREVIEW:
    for f in range(4):
        for s in range(3):
            bpy.data.objects[f'f{f}_s{s}'].rotation_euler.x = -(0.25 + 0.1 * s)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.location = (2.6, -4.2, 1.6)
    cam.rotation_euler = (math.radians(78), 0, math.radians(32))
    scene.camera = cam
    for nm, loc, power, col in (('key', (3, -4, 5), 900, (1, 0.95, 0.9)), ('rim', (-3, 4, 3), 1400, (0.6, 0.45, 1.0)), ('fill', (-4, -3, 0), 200, (1, 0.8, 0.6))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    if scene.render.engine == 'CYCLES': scene.cycles.samples = 32
    scene.render.resolution_x, scene.render.resolution_y = 900, 900
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for f in range(4):
        for s in range(3):
            bpy.data.objects[f'f{f}_s{s}'].rotation_euler.x = 0
    for nm in ('cam', 'key', 'rim', 'fill'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
print('EXPORTED', OUT)
