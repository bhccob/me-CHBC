# LAB ONLY (throwaway). Round 59: the printer, simpler, and it prints from below. One soft purple block; the sheet
# comes out of a slot in its underside and hangs (the page makes the sheet; empty 'paper_slot' is where it comes out);
# a dark face band with LED eyes on its front ('face'); a coin slit in its front ('coin_slot'); one brass line.
# Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/printer2.py -- <out.glb> [preview.png]
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
YS = 4.86            # its underside, where the paper comes out
W_, D_, H_ = 20.0, 10.0, 8.0
body = box('body', (W_, D_, H_), P(0, YS + H_ / 2, 0), BODY, bevel=2.6, segs=10)
cut(body, 'paper_cut', (15.8, 0.7, 3.0), P(0, YS, 0))
cut(body, 'coin_cut', (0.5, 3.0, 3.0), P(7.4, YS + H_ / 2, D_ / 2))
# a brass lip either side of the paper's way out, and a brass rim round the coin slit
for z in (-0.5, 0.5):
    box(f'lip_{z}', (16.2, 0.14, 0.14), P(0, YS - 0.03, z), TRIM, bevel=0.04)
box('coin_rim_t', (0.9, 0.14, 0.14), P(7.4, YS + H_ / 2 + 1.75, D_ / 2 + 0.03), TRIM)
box('coin_rim_b', (0.9, 0.14, 0.14), P(7.4, YS + H_ / 2 - 1.75, D_ / 2 + 0.03), TRIM)
box('coin_rim_l', (0.14, 0.14, 3.64), P(7.02, YS + H_ / 2, D_ / 2 + 0.03), TRIM)
box('coin_rim_r', (0.14, 0.14, 3.64), P(7.78, YS + H_ / 2, D_ / 2 + 0.03), TRIM)
empty('paper_slot', P(0, YS, 0), width=15.8)
empty('coin_slot', P(7.4, YS + H_ / 2, D_ / 2), length=3.4, width=0.5)
# its face: a dark band, the page draws the eyes on 'face'
box('face_panel', (11.4, 0.3, 2.9), P(-1.2, YS + H_ / 2, D_ / 2 + 0.02), GLASS, bevel=0.5, segs=6)
empty('face', P(-1.2, YS + H_ / 2, D_ / 2 + 0.2), width=10.8, height=2.4)

if PREVIEW:
    # a sheet so the preview reads as a printer
    bpy.ops.mesh.primitive_plane_add(size=1, location=P(0, YS - 5.0, 0), rotation=(math.pi / 2, 0, 0))
    sh = bpy.context.active_object; sh.scale = (14.5, 10.0, 1)
    sh.data.materials.append(material('paper', (0.92, 0.89, 0.83), 0, 0.8))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = P(18, 10, 44); scene.camera = cam; cam.data.lens = 35
    from mathutils import Vector
    cam.rotation_euler = (Vector(P(0, 4, 0)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
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
