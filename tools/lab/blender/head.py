# LAB ONLY (throwaway). The colossus's head for the robot beat: a smooth, modern helm with a curved face mask, a dark
# glass visor band with slit eyes behind it, lit seams, a crest, and an emblem on the brow with four coin sockets
# (empties socket_0..socket_3 mark where each study coin docks; socket_3 is the centre). Exports glTF. Run headless:
#   blender --background --factory-startup --python tools/lab/blender/head.py -- <out.glb> [preview.png]
# Blender is Z up and the face looks along -Y; in the page that becomes Y up and the face looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'head.glb'
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

SHELL = material('shell', (0.07, 0.065, 0.085), 1.0, 0.28, coat=1.0)
PLATE = material('plate', (0.24, 0.22, 0.27), 1.0, 0.2, coat=1.0)
GLASS = material('glass', (0.01, 0.008, 0.016), 0.4, 0.05, coat=1.0)
EYE = material('eye', (0.05, 0.03, 0.01), 0.0, 0.5, emit=(1.0, 0.82, 0.55), strength=8.0)
SEAM = material('seam', (0.02, 0.01, 0.03), 0.0, 0.5, emit=(0.62, 0.42, 1.0), strength=4.0)
GOLD = material('gold', (0.78, 0.52, 0.22), 1.0, 0.24)
RECESS = material('recess', (0.008, 0.006, 0.01), 0.6, 0.55)

def mods(o, bevel=0.0, segs=3, subsurf=0, taper=0.0, bend=0.0, bend_axis='Z', taper_axis='Z'):
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    if taper:
        m = o.modifiers.new('taper', 'SIMPLE_DEFORM'); m.deform_method = 'TAPER'; m.factor = taper; m.deform_axis = taper_axis
    if bend:
        m = o.modifiers.new('bend', 'SIMPLE_DEFORM'); m.deform_method = 'BEND'; m.angle = bend; m.deform_axis = bend_axis
    if subsurf:
        m = o.modifiers.new('smooth', 'SUBSURF'); m.levels = subsurf; m.render_levels = subsurf
    for p in o.data.polygons: p.use_smooth = True

def box(name, size, at=(0, 0, 0), rot=(0, 0, 0), mat=PLATE, parent=None, cuts=0, top=False, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    if cuts:
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=cuts); bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        if top: v.co.z -= size[2] / 2
    o.location = (at[0], at[1], at[2] + (size[2] / 2 if top else 0))
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent: o.parent = parent
    mods(o, **kw)
    return o

def sphere(name, scale, at=(0, 0, 0), mat=SHELL, parent=None, sub=2):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=64, ring_count=32)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.location = at
    o.data.materials.append(mat)
    if parent: o.parent = parent
    mods(o, subsurf=sub)
    return o

def torus(name, R, r, at, rot=(math.pi / 2, 0, 0), mat=GOLD, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=128, minor_segments=12, location=at, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if parent: o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    return o

def cyl(name, r, depth, at, rot=(math.pi / 2, 0, 0), mat=RECESS, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=64, location=at, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if parent: o.parent = parent
    mods(o, bevel=0.02, segs=2)
    return o

head = bpy.data.objects.new('head', None)
scene.collection.objects.link(head)

# The cranium: a long smooth dome, wider than deep.
sphere('cranium', (3.7, 3.5, 4.6), at=(0, 0.6, 1.2), mat=SHELL, parent=head)
# The face: one curved mask, narrowing to the chin.
box('mask', (6.2, 1.4, 7.6), at=(0, -2.55, -0.2), mat=SHELL, parent=head, cuts=6, bevel=0.35, segs=4, taper=0.42, bend=0.9, bend_axis='Z', subsurf=2, top=True)
for sx in (-1, 1):
    box(f'cheek_{sx}', (2.3, 0.5, 3.4), at=(sx * 1.45, -3.1, -1.05), rot=(0.1, sx * 0.3, sx * -0.18), mat=PLATE, parent=head, cuts=3, bevel=0.16, segs=3, taper=0.3, subsurf=2, top=True)
    box(f'temple_{sx}', (1.4, 0.5, 1.6), at=(sx * 2.75, -2.35, 1.5), rot=(0, sx * 0.62, 0), mat=PLATE, parent=head, cuts=2, bevel=0.14, segs=3, subsurf=2)
box('ridge', (0.42, 0.5, 3.1), at=(0, -3.28, -0.95), mat=PLATE, parent=head, cuts=2, bevel=0.12, segs=3, taper=0.4, subsurf=2, top=True)
box('chin', (1.5, 0.6, 0.9), at=(0, -2.95, -3.4), rot=(0.25, 0, 0), mat=PLATE, parent=head, cuts=2, bevel=0.2, segs=3, taper=0.3, subsurf=2)
# The brow: a sleek band across the top of the mask.
box('brow', (6.4, 1.0, 0.7), at=(0, -2.95, 1.55), mat=PLATE, parent=head, cuts=6, bevel=0.22, segs=4, bend=0.95, bend_axis='Z', subsurf=2)
# The visor: dark glass across the eyes, and two slit eyes behind it.
box('visor', (5.6, 0.5, 0.78), at=(0, -3.3, 0.72), mat=GLASS, parent=head, cuts=8, bevel=0.2, segs=4, bend=1.0, bend_axis='Z', subsurf=2)
for sx in (-1, 1):
    box(f'eye_{"l" if sx < 0 else "r"}', (1.55, 0.06, 0.13), at=(sx * 1.25, -3.58, 0.72), rot=(0, sx * -0.12, sx * 0.22), mat=EYE, parent=head, bevel=0.05, segs=3)
# The crest: a fin from the brow over the top of the head.
box('crest', (0.5, 4.2, 1.4), at=(0, -0.6, 5.0), rot=(0.25, 0, 0), mat=PLATE, parent=head, cuts=4, bevel=0.18, segs=3, taper=-0.4, taper_axis='Y', subsurf=2)
box('crest_seam', (0.06, 4.0, 0.06), at=(0, -0.55, 5.72), rot=(0.25, 0, 0), mat=SEAM, parent=head)
# Seams of light down the cheeks and across the jaw.
for sx in (-1, 1):
    box(f'cheek_seam_{sx}', (0.05, 0.08, 2.4), at=(sx * 0.42, -3.36, -0.95), rot=(0, sx * 0.1, 0), mat=SEAM, parent=head)
    box(f'temple_seam_{sx}', (0.05, 0.08, 1.4), at=(sx * 2.85, -2.2, 0.9), rot=(0, sx * -0.2, sx * 0.55), mat=SEAM, parent=head)
box('jaw_seam', (1.6, 0.08, 0.05), at=(0, -3.1, -2.75), mat=SEAM, parent=head)

# Sides: discs where ears would be.
for sx in (-1, 1):
    cyl(f'ear_{sx}', 0.95, 0.5, at=(sx * 3.55, 0.4, 0.6), rot=(0, math.pi / 2, 0), mat=PLATE, parent=head)
    torus(f'ear_ring_{sx}', 0.75, 0.04, at=(sx * 3.82, 0.4, 0.6), rot=(0, math.pi / 2, 0), mat=SEAM, parent=head)
# The emblem on the brow: a gold ring, three sockets in a triangle round a centre one.
E = (0, -3.42, 2.95)
emblem = bpy.data.objects.new('emblem', None); scene.collection.objects.link(emblem); emblem.location = E; emblem.parent = head
torus('emblem_ring', 1.2, 0.07, at=(0, 0, 0), mat=GOLD, parent=emblem)
torus('emblem_ring_inner', 1.02, 0.025, at=(0, -0.02, 0), mat=SEAM, parent=emblem)
for i, (x, z, r) in enumerate(((0, 0.72, 0.25), (-0.62, -0.36, 0.25), (0.62, -0.36, 0.25), (0, 0, 0.31))):
    cyl(f'socket_{i}_recess', r, 0.14, at=(x, 0.02, z), parent=emblem)
    torus(f'socket_{i}_rim', r + 0.035, 0.024, at=(x, -0.06, z), mat=GOLD, parent=emblem)
    torus(f'socket_{i}_light', r + 0.085, 0.012, at=(x, -0.06, z), mat=SEAM, parent=emblem)
    s = bpy.data.objects.new(f'socket_{i}', None); scene.collection.objects.link(s); s.location = (x, -0.1, z); s.parent = emblem
    s['radius'] = r

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (5.5, -16, 1.8); cam.rotation_euler = (math.radians(88), 0, math.radians(19)); scene.camera = cam
    cam.data.lens = 40
    for nm, loc, power, col in (('key', (-6, -10, 9), 3000, (0.9, 0.9, 1)), ('rim', (8, 6, 6), 5000, (0.6, 0.45, 1.0)), ('under', (0, -8, -6), 800, (1, 0.8, 0.5))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1000
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('cam', 'key', 'rim', 'under'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
