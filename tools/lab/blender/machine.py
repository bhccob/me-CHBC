# LAB ONLY (throwaway). Round 50: the robot as a coin machine, so a coin makes sense going in. One cabinet, in world
# units (the page uses it at scale 1), solid painted metal and brass, no glass look:
#   the head: a squared housing with the flat visor (the mesh 'visor', 15.5 x 12.4, the screen that showed the works
#     and then its eyes), a brass bezel, round speaker-ears, an antenna with a bulb;
#   the coin shelf under the screen: one slot in its top (empty 'slot'), an 'INSERT COIN' plate on its front;
#   the body: a window cut into its front (empty 'window', 17 x 15.5) where the page builds the mechanism the coins
#     roll through (rails, four bays, the CPU socket holding the brain); a base below.
# Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/machine.py -- <out.glb> [preview.png]
# Blender is Z up with the front looking along -Y; in the page that is Y up, the front looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'machine.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0, coat=0.0):
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

BODY = material('body', (0.09, 0.055, 0.16), 0.3, 0.42, coat=0.6)
TRIM = material('trim', (0.78, 0.55, 0.24), 1.0, 0.3)
DARK = material('dark', (0.02, 0.016, 0.03), 0.4, 0.5)
SCREEN = material('visor', (0, 0, 0), 0, 0.1)
LAMP = material('lamp', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.72, 0.3), strength=5)
HIDE = material('hide', (0, 0, 0))
root = bpy.data.objects.new('machine', None)
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
    target.modifiers.move(len(target.modifiers) - 1, 0)

def empty(name, at, **props):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.location = at; e.parent = root
    for k, v in props.items(): e[k] = v
    return e

# In the page: x right, y up (here z), z toward you (here -y). Helper: page coords -> Blender.
P = lambda x, y, z: (x, -z, y)

# ---- the head: housing, bezel, visor, ears, antenna
head = box('head', (22.0, 14.0, 17.5), P(0, 0.4, -7.0), BODY, bevel=2.2, segs=8)
cut(head, 'visor_hole', (16.3, 10.0, 13.2), P(0, 0, 0))   # deep: a chamber behind the screen, where its brain is
bpy.ops.mesh.primitive_grid_add(x_subdivisions=8, y_subdivisions=8, size=1)
vis = bpy.context.active_object; vis.name = 'visor'
for v in vis.data.vertices:
    x, z = v.co.x * 15.5, v.co.y * 12.4
    v.co.x, v.co.y, v.co.z = x, 0.4, z          # sits back a little in its bezel (page z = -0.4)
own(vis, SCREEN)
empty('visor_c', P(0, 0, -0.4), width=15.5, height=12.4)
# brass bezel round the screen: four bars with round corners
for nm, size, at in (('bezel_t', (16.9, 0.7, 0.55), P(0, 6.75, 0.05)), ('bezel_b', (16.9, 0.7, 0.55), P(0, -6.75, 0.05)),
                     ('bezel_l', (0.55, 0.7, 13.9), P(-8.2, 0, 0.05)), ('bezel_r', (0.55, 0.7, 13.9), P(8.2, 0, 0.05))):
    box(nm, size, at, TRIM, bevel=0.18)
for sx in (-1, 1):
    cyl(f'ear_{sx}', 2.6, 1.4, P(sx * 11.4, 1.2, -6.0), (0, math.pi / 2, 0), DARK, bevel=0.2)
    cyl(f'ear_ring_{sx}', 2.75, 0.5, P(sx * 12.1, 1.2, -6.0), (0, math.pi / 2, 0), TRIM, bevel=0.12)
    cyl(f'ear_grill_{sx}', 1.6, 0.3, P(sx * 12.3, 1.2, -6.0), (0, math.pi / 2, 0), DARK)
    for k in range(5):
        box(f'ear_slit_{sx}_{k}', (0.12, 2.6, 0.18), P(sx * 12.45, 1.2 - 1.0 + k * 0.5, -6.0), TRIM)
cyl('antenna', 0.16, 3.6, P(2.5, 10.6, -7.0), (0, 0, 0), TRIM)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, segments=32, ring_count=16, location=P(2.5, 12.6, -7.0))
own(bpy.context.active_object, LAMP).name = 'bulb'
box('cheek_l', (1.6, 0.3, 0.5), P(-5.6, -7.6, 0.25), LAMP, bevel=0.1)
box('cheek_r', (1.6, 0.3, 0.5), P(5.6, -7.6, 0.25), LAMP, bevel=0.1)

# ---- the coin shelf: one slot in its top; INSERT COIN on its front
SH_TOP = -8.1
shelf = box('shelf', (12.0, 3.8, 1.8), P(0, SH_TOP - 0.9, 1.3), BODY, bevel=0.45)
cut(shelf, 'slot_cut', (3.4, 0.5, 4.0), P(0, SH_TOP, 1.6))
box('slot_rim_f', (3.8, 0.12, 0.14), P(0, SH_TOP + 0.04, 1.93), TRIM)
box('slot_rim_b', (3.8, 0.12, 0.14), P(0, SH_TOP + 0.04, 1.27), TRIM)
box('slot_rim_l', (0.14, 0.78, 0.14), P(-1.83, SH_TOP + 0.04, 1.6), TRIM)
box('slot_rim_r', (0.14, 0.78, 0.14), P(1.83, SH_TOP + 0.04, 1.6), TRIM)
empty('slot', P(0, SH_TOP, 1.6), length=3.4, width=0.5)
box('coin_plate', (5.6, 0.12, 1.0), P(0, SH_TOP - 0.95, 3.22), DARK, bevel=0.08)   # the page writes INSERT COIN on it
empty('coin_label', P(0, SH_TOP - 0.95, 3.3), width=5.4, height=0.9)

# ---- the body: a window cut into it, a base
body = box('body', (21.0, 12.0, 22.5), P(0, -21.0, -6.0), BODY, bevel=1.8, segs=6)
cut(body, 'window_cut', (17.0, 4.0, 15.5), P(0, -17.4, 0.0))
empty('window', P(0, -17.4, -1.0), width=17.0, height=15.5)
for nm, size, at in (('frame_t', (17.6, 0.6, 0.5), P(0, -9.4, 0.1)), ('frame_b', (17.6, 0.6, 0.5), P(0, -25.4, 0.1)),
                     ('frame_l', (0.5, 0.6, 16.5), P(-8.75, -17.4, 0.1)), ('frame_r', (0.5, 0.6, 16.5), P(8.75, -17.4, 0.1))):
    box(nm, size, at, TRIM, bevel=0.15)
box('base', (23.0, 13.0, 3.0), P(0, -33.4, -6.0), DARK, bevel=0.8)
for k in range(3):
    box(f'vent_{k}', (9.0, 0.15, 0.25), P(0, -27.6 - k * 0.7, 0.05), DARK, bevel=0.05)

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = P(22, -10, 70); cam.rotation_euler = (math.radians(90), 0, math.radians(18)); scene.camera = cam; cam.data.lens = 50
    for nm, loc, power, col in (('key', P(-30, 25, 40), 160000, (1, 0.95, 0.9)), ('rim', P(35, 15, -20), 120000, (0.6, 0.45, 1.0)), ('fill', P(0, -20, 40), 40000, (1, 0.8, 0.6))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 900, 1100
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('cam', 'key', 'rim', 'fill'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
