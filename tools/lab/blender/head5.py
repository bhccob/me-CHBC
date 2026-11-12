# LAB ONLY (throwaway). The robot of light, round 49: a squared head, in world units (the page uses it at scale 1).
# A boxy dome with rounded corners and a flat face; a big flat squared visor (the mesh 'visor', 15.5 x 12.4, clean UVs:
# the page shows the works on it, then its eyes); a gold rim round the visor; a jaw ledge below with ONE slot in its top
# (empty 'slot' at the opening; coins fall in edge first); four pips on the ledge; squared ear pods with ring lights; a
# crest over the top; a halo behind. Drawn as light in the page. Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/head5.py -- <out.glb> [preview.png]
# Blender is Z up with the face looking along -Y; in the page that is Y up, the face looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'head5.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

SHELL = material('shell', (0.05, 0.04, 0.08), 0.6, 0.2)
VISOR = material('visor', (0, 0, 0), 0, 0.1)
SEAM = material('seam', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.72, 0.3), strength=4)
POD = material('pod', (0.08, 0.07, 0.1), 0.8, 0.3)
PIP = material('pip', (0.02, 0.02, 0.02), 0, 0.5, emit=(1.0, 0.7, 0.25), strength=1)
HIDE = material('hide', (0, 0, 0))
head = bpy.data.objects.new('head', None)
scene.collection.objects.link(head)
cutters = []

def link(o, mat):
    o.data.materials.append(mat); o.parent = head
    for p in o.data.polygons: p.use_smooth = True
    return o

def rounded_box(name, sx, sy, sz, P, at, mat, segs=96, rings=48):
    """A superellipsoid: a box with round corners (P large = boxier)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices:
        n = v.co.normalized()
        k = (abs(n.x) ** P + abs(n.y) ** P + abs(n.z) ** P) ** (-1 / P)
        v.co.x, v.co.y, v.co.z = n.x * k * sx, n.y * k * sy, n.z * k * sz
    o.location = at
    return link(o, mat)

def tube(name, pts, r, mat=SEAM, closed=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu); scene.collection.objects.link(o); o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object; o.parent = head
    for p in o.data.polygons: p.use_smooth = True
    return o

def rrect(cx, cz, w, h, r, y, n=24):
    """Points round a rounded rectangle in the XZ plane at depth y."""
    pts = []
    for (qx, qz, a0) in ((w / 2 - r, h / 2 - r, 0), (-(w / 2 - r), h / 2 - r, 90), (-(w / 2 - r), -(h / 2 - r), 180), (w / 2 - r, -(h / 2 - r), 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + qx + math.cos(a) * r, y, cz + qz + math.sin(a) * r))
    return pts

# ---- the head: a boxy dome, its face flat
shell = rounded_box('shell', 10.5, 9.0, 10.5, 4.2, (0, 0, 0), SHELL)
for v in shell.data.vertices:
    if v.co.y < -8.55: v.co.y = -8.55 + (v.co.y + 8.55) * 0.3

# ---- the visor: flat, squared, the face itself
VW, VH, VY, VZ = 15.5, 12.4, -9.0, 0.8
bpy.ops.mesh.primitive_grid_add(x_subdivisions=8, y_subdivisions=8, size=1)
vis = bpy.context.active_object; vis.name = 'visor'
for v in vis.data.vertices:
    x, z = v.co.x * VW, v.co.y * VH
    v.co.x, v.co.y, v.co.z = x, VY, VZ + z          # the grid's y becomes z: it faces -Y, toward the viewer
link(vis, VISOR)
e = bpy.data.objects.new('visor_c', None); scene.collection.objects.link(e); e.location = (0, VY, VZ); e.parent = head
e['width'] = VW; e['height'] = VH
tube('seam_visor', rrect(0, VZ, VW + 0.5, VH + 0.5, 1.7, VY - 0.05), 0.12, closed=True)
tube('seam_visor_2', rrect(0, VZ, VW + 1.3, VH + 1.3, 2.1, VY + 0.25), 0.05, closed=True)

# ---- the jaw ledge, one slot in its top, pips on its front
LZ = VZ - VH / 2 - 2.0
ledge = rounded_box('ledge', 4.8, 1.9, 1.1, 4.0, (0, -9.6, LZ), SHELL, segs=64, rings=32)
SLOT_L, SLOT_W, SLOT_Y = 4.6, 0.6, -10.2
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, SLOT_Y, LZ + 1.1))
cut = bpy.context.active_object; cut.name = 'slot_cut'
for v in cut.data.vertices: v.co.x *= SLOT_L; v.co.y *= SLOT_W; v.co.z *= 3.0
cut.hide_render = True; cutters.append(cut)
m = ledge.modifiers.new('slot', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cut; m.solver = 'EXACT'
top = LZ + 1.1
tube('seam_slot', rrect(0, 0, SLOT_L + 0.3, SLOT_W + 0.3, 0.12, 0, 8), 0.07, closed=True)
o = bpy.data.objects['seam_slot']
for v in o.data.vertices: v.co.y, v.co.z = SLOT_Y + v.co.z, top + 0.02 + v.co.y * 0
s = bpy.data.objects.new('slot', None); scene.collection.objects.link(s); s.location = (0, SLOT_Y, top); s.parent = head
s['length'] = SLOT_L; s['width'] = SLOT_W
for i in range(4):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, segments=16, ring_count=8, location=(-1.2 + i * 0.8, -11.45, LZ - 0.2))
    link(bpy.context.active_object, PIP).name = f'pip_{i}'
tube('seam_ledge', [(x, -11.5, LZ + 0.55) for x in [-4.0 + 8.0 * t / 30 for t in range(31)]], 0.05)

# ---- squared ear pods, a crest, a halo
for sx in (-1, 1):
    pod = rounded_box(f'pod_{sx}', 0.9, 3.2, 3.4, 4.0, (sx * 10.9, 0.6, 1.0), POD, segs=48, rings=24)
    tube(f'pod_ring_{sx}', rrect(0, 1.0, 4.4, 4.6, 1.2, 0), 0.08, closed=True)
    r = bpy.data.objects[f'pod_ring_{sx}']
    for v in r.data.vertices: v.co.x, v.co.y = sx * 11.85, 0.6 + v.co.x
bpy.ops.mesh.primitive_torus_add(major_radius=15.5, minor_radius=0.14, major_segments=220, minor_segments=10, location=(0, 6.0, 1.0), rotation=(math.pi / 2, 0, 0))
h = bpy.context.active_object; h.name = 'halo'; link(h, SEAM)

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (18, -48, 2); cam.rotation_euler = (math.radians(88), 0, math.radians(20)); scene.camera = cam; cam.data.lens = 40
    for nm, loc, power, col in (('key', (-20, -30, 25), 40000, (0.9, 0.9, 1)), ('rim', (25, 15, 15), 60000, (0.6, 0.45, 1.0)), ('under', (0, -25, -15), 9000, (1, 0.8, 0.5))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1000
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('cam', 'key', 'rim', 'under'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
