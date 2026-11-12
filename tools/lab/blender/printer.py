# LAB ONLY (throwaway). Round 58: a simple printer robot. The sheet rises out of the slot in its top (the page makes
# the sheet; empty 'paper_slot' is where it comes out); a small dark face with LED eyes on its front ('face'); a coin
# slot in its top in front of the paper ('coin_slot'); a feed button; round platen knobs for ears; two feet.
# Soft rounded purple body, brass rollers and trim. Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/printer.py -- <out.glb> [preview.png]
# Blender is Z up with the front looking along -Y; in the page that is Y up, the front looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'printer.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

BODY = material('body', (0.09, 0.055, 0.16), 0.3, 0.42, coat=0.6)
TRIM = material('trim', (0.78, 0.55, 0.24), 1.0, 0.3)
DARK = material('dark', (0.02, 0.016, 0.03), 0.4, 0.5)
GLASS = material('glass', (0.012, 0.01, 0.02), 0.0, 0.08, coat=1.0)
LAMP = material('lamp', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.72, 0.3), strength=5)
root = bpy.data.objects.new('printer', None)
scene.collection.objects.link(root)
cutters = []

def own(o, mat, smooth=True):
    if mat is not None: o.data.materials.append(mat)
    o.parent = root
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def box(name, size, at, mat, bevel=0.0, segs=4, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    return own(o, mat)

def cyl(name, r, depth, at, rot, mat, verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 3; m.limit_method = 'ANGLE'
    return own(o, mat)

def cut(target, name, size, at):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    c = bpy.context.active_object; c.name = name
    for v in c.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    c.hide_render = True; cutters.append(c)
    m = target.modifiers.new(name, 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'

def empty(name, at, **props):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.location = at; e.parent = root
    for k, v in props.items(): e[k] = v
    return e

P = lambda x, y, z: (x, -z, y)
TOP = -5.0

# ---- the body: one wide, low, soft block; the paper slot and the coin slot cut into its top (after the rounding)
H_ = 7.6
body = box('body', (23.0, 13.0, H_), P(0, TOP - H_ / 2, 0), BODY, bevel=1.9, segs=8)
cut(body, 'paper_cut', (15.8, 0.8, 3.0), P(0, TOP, 0))
cut(body, 'coin_cut', (3.4, 0.5, 3.0), P(0, TOP, 3.2))
# brass rollers either side of the paper's way out; sprocket wheels at its ends; a brass rim round the coin slot
for z in (-0.62, 0.62):
    cyl(f'roller_{z}', 0.34, 16.0, P(0, TOP + 0.08, z), (0, math.pi / 2, 0), TRIM, verts=32)
for sx in (-1, 1):
    cyl(f'sprocket_{sx}', 1.05, 0.5, P(sx * 8.35, TOP + 0.15, 0), (0, math.pi / 2, 0), TRIM, verts=12, bevel=0.05)
    cyl(f'sprocket_hub_{sx}', 0.5, 0.7, P(sx * 8.35, TOP + 0.15, 0), (0, math.pi / 2, 0), DARK, verts=24)
box('coin_rim_f', (3.9, 0.12, 0.14), P(0, TOP + 0.04, 3.53), TRIM)
box('coin_rim_b', (3.9, 0.12, 0.14), P(0, TOP + 0.04, 2.87), TRIM)
box('coin_rim_l', (0.14, 0.78, 0.14), P(-1.88, TOP + 0.04, 3.2), TRIM)
box('coin_rim_r', (0.14, 0.78, 0.14), P(1.88, TOP + 0.04, 3.2), TRIM)
empty('paper_slot', P(0, TOP + 0.25, 0), width=15.8)
empty('coin_slot', P(0, TOP, 3.2), length=3.4, width=0.5)
# the feed button and two status lamps, top right
cyl('button_ring', 1.05, 0.22, P(7.4, TOP + 0.06, 3.4), (0, 0, 0), TRIM, bevel=0.06)
cyl('button', 0.8, 0.4, P(7.4, TOP + 0.2, 3.4), (0, 0, 0), LAMP, bevel=0.1)
for k in range(2):
    cyl(f'status_{k}', 0.28, 0.2, P(-7.0 - k * 1.0, TOP + 0.06, 3.4), (0, 0, 0), LAMP)
# its face: a small dark glass panel on the front, the page draws the eyes on 'face'
box('face_rim', (10.4, 0.3, 4.1), P(0, TOP - 3.7, 6.48), TRIM, bevel=0.6, segs=6)
box('face_panel', (9.8, 0.4, 3.5), P(0, TOP - 3.7, 6.6), GLASS, bevel=0.5, segs=6)
empty('face', P(0, TOP - 3.7, 6.82), width=9.2, height=3.0)
# the output lip along the bottom of its front
box('lip', (17.0, 1.6, 0.35), P(0, TOP - H_ + 0.9, 6.9), TRIM, bevel=0.15)
# side vents
for sx in (-1, 1):
    for k in range(4):
        box(f'vent_{sx}_{k}', (0.1, 6.0, 0.22), P(sx * 11.52, TOP - 2.6 - k * 0.7, -2.0), DARK)
# ears: the platen knobs, one each side
for sx in (-1, 1):
    cyl(f'knob_{sx}', 1.7, 0.7, P(sx * 11.75, TOP - 3.4, 3.2), (0, math.pi / 2, 0), TRIM, bevel=0.12)
    cyl(f'knob_cap_{sx}', 1.1, 0.5, P(sx * 12.2, TOP - 3.4, 3.2), (0, math.pi / 2, 0), DARK, bevel=0.08)
# feet
for sx in (-1, 1):
    box(f'foot_{sx}', (5.0, 8.0, 1.1), P(sx * 7.0, TOP - H_ - 0.45, 0.4), DARK, bevel=0.5, segs=4)

if PREVIEW:
    # a sheet so the preview reads as a printer
    bpy.ops.mesh.primitive_plane_add(size=1, location=P(0, TOP + 5.0, 0), rotation=(math.pi / 2, 0, 0))
    sh = bpy.context.active_object; sh.scale = (14.5, 10.0, 1)
    sh.data.materials.append(material('paper', (0.92, 0.89, 0.83), 0, 0.8))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = P(20, 4, 46); scene.camera = cam; cam.data.lens = 35
    from mathutils import Vector
    cam.rotation_euler = (Vector(P(0, -4, 0)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    for nm, loc, power, col in (('key', P(-30, 25, 40), 160000, (1, 0.95, 0.9)), ('rim', P(35, 15, -20), 120000, (0.6, 0.45, 1.0)), ('fill', P(0, -20, 40), 40000, (1, 0.8, 0.6))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(sh)
    for nm in ('cam', 'key', 'rim', 'fill'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
