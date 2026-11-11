# LAB ONLY (throwaway). The robot of light, round 48: a better-shaped head. One smooth egg-shaped dome (broad crown,
# narrowing to the chin, the face a little flatter), a wide visor that wraps round the front following the dome (the
# page draws LED eyes on the mesh 'visor', UVs left to right and bottom to top), a mouth slot cut right through under
# it (empty 'slot' at the opening; the coins tip flat and slide in), gold seams that give it its lines (a rim round
# the visor, a crest over the dome, rings round the ear pods, lips on the slot), four pips under the mouth, a halo
# behind. Drawn as light in the page. Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/head4.py -- <out.glb> [preview.png]
# Blender is Z up with the face looking along -Y; in the page that is Y up, the face looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'head4.glb'
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

def surface(theta, phi, out=0.0):
    """A point on the dome: theta round from the front (+ to the right), phi up from the middle."""
    n = (math.cos(phi) * math.sin(theta), -math.cos(phi) * math.cos(theta), math.sin(phi))
    zf = n[2]
    A = 3.5 * (1 - 0.24 * max(0.0, -zf) ** 1.3)
    B = 3.8 * (1 - 0.14 * max(0.0, -zf))
    Hz = 4.3 if zf > 0 else 3.5
    x, y, z = n[0] * A, n[1] * B, zf * Hz
    if y < -2.95: y = -2.95 + (y + 2.95) * 0.45          # a flatter face
    k = 1 + out / 3.6
    return (x * k, y * k, z * k)

def mesh_from(name, verts, faces, mat, uvs=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if uvs is not None:
        layer = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                layer.data[li].uv = uvs[vi]
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    o.parent = head
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def grid(name, nu, nv, fn, mat, uv=True):
    verts, uvs, faces = [], [], []
    for j in range(nv + 1):
        for i in range(nu + 1):
            u, v = i / nu, j / nv
            verts.append(fn(u, v)); uvs.append((u, v))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    return mesh_from(name, verts, faces, mat, uvs if uv else None)

# ---- the dome: a closed egg (theta all the way round, phi pole to pole)
NT, NP = 160, 90
verts, faces = [], []
for j in range(1, NP):
    phi = -math.pi / 2 + math.pi * j / NP
    for i in range(NT):
        verts.append(surface(2 * math.pi * i / NT - math.pi, phi))
bot = len(verts); verts.append(surface(0, -math.pi / 2))
top = len(verts); verts.append(surface(0, math.pi / 2))
for j in range(NP - 2):
    for i in range(NT):
        a, b = j * NT + i, j * NT + (i + 1) % NT
        faces.append((a, b, b + NT, a + NT))
for i in range(NT):
    faces.append((bot, (i + 1) % NT, i))
    faces.append((top, (NP - 2) * NT + i, (NP - 2) * NT + (i + 1) % NT))
dome = mesh_from('dome', verts, faces, SHELL, smooth=True)
# The normals out (from_pydata winding): recalculate.
bpy.context.view_layer.objects.active = dome
dome.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
dome.select_set(False)

# ---- the visor: wraps round the front, taller in the middle, tapering to the sides
TH, PC, PS = 1.18, 0.16, 0.58
def visor_at(u, v, out=0.05):
    th = (u - 0.5) * 2 * TH
    span = PS * (1 - 0.5 * abs(2 * u - 1) ** 2.4)
    return surface(th, PC + (v - 0.5) * span, out)
grid('visor', 80, 30, lambda u, v: visor_at(u, v), VISOR)
bpy.data.objects.new('face', None)
face = bpy.data.objects.new('face_c', None); scene.collection.objects.link(face); face.location = visor_at(0.5, 0.5); face.parent = head

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

# Seams: the rim round the visor; a crest from the visor over the dome; a brow line; rings round the ear pods.
rim = [visor_at(i / 120, 0, 0.09) for i in range(121)] + [visor_at(1, j / 30, 0.09) for j in range(31)] + [visor_at(1 - i / 120, 1, 0.09) for i in range(121)] + [visor_at(0, 1 - j / 30, 0.09) for j in range(31)]
tube('seam_rim', rim, 0.035, closed=True)
crest0 = PC + PS / 2 + 0.1
tube('seam_crest', [surface(0, crest0 + 0.12 + (math.pi * 0.95 - crest0 - 0.12) * t / 60, 0.04) for t in range(61)], 0.03)
for sx in (-1, 1):
    tube(f'seam_cheek_{sx}', [surface(sx * (TH + 0.08 + 0.05 * t / 30), PC - 0.05 - 0.75 * t / 30, 0.04) for t in range(31)], 0.022)
    c = surface(sx * math.pi / 2, 0.12, 0.0)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.1, depth=0.45, vertices=64, location=(c[0] + sx * 0.12, c[1], c[2]), rotation=(0, math.pi / 2, 0))
    pod = bpy.context.active_object; pod.name = f'pod_{sx}'; pod.data.materials.append(POD); pod.parent = head
    for p in pod.data.polygons: p.use_smooth = True
    for i, rr in enumerate((1.12, 0.75)):
        tube(f'pod_ring_{sx}_{i}', [(c[0] + sx * 0.36, c[1] + math.cos(a) * rr, c[2] + math.sin(a) * rr) for a in [k / 64 * 2 * math.pi for k in range(65)]], 0.03)

# ---- the mouth: a slot right through, under the visor, with gold lips; four pips below it
PM = -0.4
mc = surface(0, PM)
SW, SHt = 1.7, 0.22
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, mc[1] + 0.6, mc[2]))
cut = bpy.context.active_object; cut.name = 'mouth_cut'
for v in cut.data.vertices: v.co.x *= SW; v.co.y *= 3.0; v.co.z *= SHt
cut.hide_render = True; cutters.append(cut)
m = dome.modifiers.new('mouth', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cut; m.solver = 'EXACT'
for nm, dz in (('lip_top', SHt / 2 + 0.03), ('lip_bot', -SHt / 2 - 0.03)):
    tube(nm, [(x, surface(math.asin(max(-1, min(1, x / 3.3))), PM)[1] - 0.04, mc[2] + dz) for x in [-SW / 2 - 0.08 + (SW + 0.16) * t / 40 for t in range(41)]], 0.035)
s = bpy.data.objects.new('slot', None); scene.collection.objects.link(s); s.location = (0, mc[1] - 0.04, mc[2]); s.parent = head
s['width'] = SW; s['height'] = SHt
for i in range(4):
    p = surface((i - 1.5) * 0.11, PM - 0.12, 0.03)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, segments=16, ring_count=8, location=p)
    o = bpy.context.active_object; o.name = f'pip_{i}'; o.data.materials.append(PIP); o.parent = head

# ---- a halo behind
bpy.ops.mesh.primitive_torus_add(major_radius=5.6, minor_radius=0.05, major_segments=200, minor_segments=10, location=(0, 2.6, 0.9), rotation=(math.pi / 2, 0, 0))
h = bpy.context.active_object; h.name = 'halo'; h.data.materials.append(SEAM); h.parent = head

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (7, -18, 1.5); cam.rotation_euler = (math.radians(87), 0, math.radians(21)); scene.camera = cam; cam.data.lens = 42
    for nm, loc, power, col in (('key', (-7, -11, 9), 3500, (0.9, 0.9, 1)), ('rim', (9, 6, 6), 6000, (0.6, 0.45, 1.0)), ('under', (0, -9, -5), 900, (1, 0.8, 0.5))):
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
