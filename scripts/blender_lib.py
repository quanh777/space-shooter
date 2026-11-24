"""
Legacy Hard-Surface Spacecraft Kitbashing & Procedural Texture Helper (Blender 4.2+).
Handy toolkit for panel normal maps, lofted hulls, swept wings, thruster bells,
twin rail pods, canopies, turrets, louvers, and NLA animation glue.
"""

from __future__ import annotations

import math
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "models"


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 48
    return scene


# Procedural PBR Textures (NumPy -> packed Blender images -> GLB)
def _get_or_create_scifi_maps() -> tuple[bpy.types.Image, bpy.types.Image]:
    """
    Synthesizes a crisp 512x512 Sci-Fi Armor Panel Normal Map and Brushed Metal
    Roughness Map using NumPy so every hull plate catches real micro-specular highlights.
    """
    norm_name = "SciFi_Hull_Normal_512"
    rough_name = "SciFi_Hull_Rough_512"
    if norm_name in bpy.data.images and rough_name in bpy.data.images:
        return bpy.data.images[norm_name], bpy.data.images[rough_name]

    size = 512
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)

    # Heightfield representing interlocking sci-fi armor plates, seams, rivets, and vents
    height = np.ones((size, size), dtype=np.float32) * 0.72

    # Major plate seam grid (128px and 64px asymmetric military panels)
    seam_w = 3.0
    major_x = np.minimum(xx % 128.0, 128.0 - (xx % 128.0)) < seam_w
    major_y = np.minimum(yy % 128.0, 128.0 - (yy % 128.0)) < seam_w
    sub_x = (np.minimum((xx + 64.0) % 128.0, 128.0 - ((xx + 64.0) % 128.0)) < 1.8) & ((yy // 128) % 2 == 0)
    sub_y = (np.minimum((yy + 64.0) % 128.0, 128.0 - ((yy + 64.0) % 128.0)) < 1.8) & ((xx // 128) % 2 == 1)

    # Recessed armor hatches & louver strips
    hatch = (xx % 128.0 > 18) & (xx % 128.0 < 54) & (yy % 128.0 > 18) & (yy % 128.0 < 48)
    louver = (
        (xx % 128.0 > 74) & (xx % 128.0 < 112)
        & (yy % 128.0 > 72) & (yy % 128.0 < 114)
        & ((yy % 8.0) < 3.5)
    )

    # Micro-rivets along panel corners
    rx = ((xx - 10.0) % 64.0) - 3.0
    ry = ((yy - 10.0) % 64.0) - 3.0
    rivets = (rx * rx + ry * ry) < 5.5

    # Raised beveled plate variation per tile
    tile_id = (np.floor(xx / 128.0) * 7.0 + np.floor(yy / 128.0) * 13.0) % 5.0
    height += (tile_id - 2.0) * 0.035

    height[hatch] -= 0.14
    height[louver] -= 0.24
    height[major_x | major_y] -= 0.42
    height[sub_x | sub_y] -= 0.28
    height[rivets] += 0.16

    # Brushed anisotropic metallic micro-grain (deterministic RNG)
    rng = np.random.default_rng(42)
    streak = rng.normal(0.0, 0.022, (size, size // 8)).astype(np.float32)
    streak = np.repeat(streak, 8, axis=1)
    fine = rng.normal(0.0, 0.012, (size, size)).astype(np.float32)
    height = np.clip(height + streak + fine, 0.0, 1.0)

    # Sobel-like gradient -> Tangent-Space Normal Map
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 3.8
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 3.8
    nx = -dx
    ny = -dy
    nz = np.ones_like(height)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    nx = nx * inv_len * 0.5 + 0.5
    ny = ny * inv_len * 0.5 + 0.5
    nz = nz * inv_len * 0.5 + 0.5

    norm_rgba = np.ones((size, size, 4), dtype=np.float32)
    norm_rgba[:, :, 0] = nx
    norm_rgba[:, :, 1] = ny
    norm_rgba[:, :, 2] = nz

    norm_img = bpy.data.images.new(norm_name, width=size, height=size, alpha=False)
    norm_img.file_format = "PNG"
    norm_img.colorspace_settings.name = "Non-Color"
    norm_img.pixels.foreach_set(norm_rgba.ravel())
    norm_img.pack()

    # Roughness map: smoother on raised clean armor, rougher inside seams/grooves & edge scratches
    rough = np.full((size, size), 0.30, dtype=np.float32)
    rough += (tile_id - 2.0) * 0.03
    rough += np.abs(streak) * 2.2
    rough[hatch] += 0.12
    rough[louver] += 0.25
    rough[major_x | major_y | sub_x | sub_y] = 0.72
    rough[rivets] = 0.16
    rough = np.clip(rough, 0.08, 0.88)

    rough_rgba = np.ones((size, size, 4), dtype=np.float32)
    rough_rgba[:, :, 0] = rough
    rough_rgba[:, :, 1] = rough
    rough_rgba[:, :, 2] = rough

    rough_img = bpy.data.images.new(rough_name, width=size, height=size, alpha=False)
    rough_img.file_format = "PNG"
    rough_img.colorspace_settings.name = "Non-Color"
    rough_img.pixels.foreach_set(rough_rgba.ravel())
    rough_img.pack()

    return norm_img, rough_img


def make_pbr_material(
    name: str,
    base_color: tuple[float, float, float],
    metallic: float = 0.82,
    roughness: float = 0.26,
    emission_color: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    use_panel_maps: bool = True,
    normal_strength: float = 0.65,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if emission_color and emission_strength > 0.0:
        em_col = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if em_col:
            em_col.default_value = (*emission_color, 1.0)
        em_str = bsdf.inputs.get("Emission Strength")
        if em_str:
            em_str.default_value = emission_strength
        return mat

    if use_panel_maps:
        norm_img, rough_img = _get_or_create_scifi_maps()

        tex_norm = nodes.new("ShaderNodeTexImage")
        tex_norm.image = norm_img
        norm_node = nodes.new("ShaderNodeNormalMap")
        norm_node.inputs["Strength"].default_value = normal_strength
        links.new(tex_norm.outputs["Color"], norm_node.inputs["Color"])
        links.new(norm_node.outputs["Normal"], bsdf.inputs["Normal"])

        tex_rough = nodes.new("ShaderNodeTexImage")
        tex_rough.image = rough_img
        math_mul = nodes.new("ShaderNodeMath")
        math_mul.operation = "MULTIPLY"
        math_mul.inputs[1].default_value = max(0.35, roughness / 0.30)
        math_mul.use_clamp = True
        links.new(tex_rough.outputs["Color"], math_mul.inputs[0])
        links.new(math_mul.outputs["Value"], bsdf.inputs["Roughness"])

    return mat


def apply_box_uv(obj: bpy.types.Object, uv_scale: float = 0.55) -> None:
    """Fast, distortion-free triplanar box UV projection directly in BMesh (no viewport context needed)."""
    mesh = obj.data
    if not mesh or not hasattr(mesh, "polygons"):
        return
    bm = bmesh.new()
    bm.from_mesh(mesh)
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x * uv_scale, co.y * uv_scale
            elif ax >= ay and ax >= az:
                u, v = co.y * uv_scale, co.z * uv_scale
            else:
                u, v = co.x * uv_scale, co.z * uv_scale
            loop[uv_layer].uv = (u, v)
    bm.to_mesh(mesh)
    bm.free()


def finalize_mesh(
    obj: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float = 0.022,
    bevel_segments: int = 2,
    uv_scale: float = 0.55,
    smooth: bool = True,
) -> bpy.types.Object:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    apply_box_uv(obj, uv_scale=uv_scale)
    if smooth and obj.data and hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel > 0.0:
        mod = obj.modifiers.new(name="Bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = bevel_segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(32.0)
        mod.harden_normals = False
    return obj


# Hard-Surface BMesh Lofting & Airfoil Generators
def create_lofted_hull(
    name: str,
    stations: list[tuple[float, list[tuple[float, float]]]],
    mat: bpy.types.Material,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.02,
    uv_scale: float = 0.55,
) -> bpy.types.Object:
    """
    Lofts a closed 3D aerodynamic hard-surface hull along the X axis from cross-section stations.
    Each station is: (x_pos, [(y0, z0), (y1, z1), ...]) with identical vertex count per ring.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for x, profile in stations:
        ring = [bm.verts.new((x, y, z)) for y, z in profile]
        rings.append(ring)

    ring_len = len(rings[0])
    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for j in range(ring_len):
            jn = (j + 1) % ring_len
            try:
                bm.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
            except ValueError:
                pass

    # Cap front and back
    try:
        bm.faces.new(rings[0])
    except ValueError:
        pass
    try:
        bm.faces.new(list(reversed(rings[-1])))
    except ValueError:
        pass

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.location = location
    obj.rotation_euler = tuple(math.radians(a) for a in rotation_deg)
    return finalize_mesh(obj, mat, bevel=bevel, uv_scale=uv_scale)


def octagon_profile(
    half_y: float,
    top_z: float,
    bot_z: float,
    chamfer_y: float = 0.62,
    mid_z: float = 0.0,
) -> list[tuple[float, float]]:
    """8-point military stealth chine cross-section (symmetric across Y=0)."""
    cy = half_y * chamfer_y
    return [
        (cy, top_z),
        (half_y, mid_z + (top_z - mid_z) * 0.25),
        (half_y, mid_z + (bot_z - mid_z) * 0.25),
        (cy, bot_z),
        (-cy, bot_z),
        (-half_y, mid_z + (bot_z - mid_z) * 0.25),
        (-half_y, mid_z + (top_z - mid_z) * 0.25),
        (-cy, top_z),
    ]


def create_tapered_wing(
    name: str,
    root_x_front: float,
    root_x_back: float,
    tip_x_front: float,
    tip_x_back: float,
    y_start: float,
    y_end: float,
    root_thick: float,
    tip_thick: float,
    dihedral_z: float,
    mat: bpy.types.Material,
    z_offset: float = 0.0,
    bevel: float = 0.015,
) -> bpy.types.Object:
    """
    Creates a genuine 3D hexagonal-airfoil swept wing tapering cleanly in both chord and thickness
    from wing root (y_start) to wingtip (y_end), with dihedral angle.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()

    def airfoil_ring(y: float, xf: float, xb: float, th: float, zc: float):
        xm_f = xb + (xf - xb) * 0.72
        xm_b = xb + (xf - xb) * 0.22
        h = th * 0.5
        return [
            bm.verts.new((xf, y, zc)),
            bm.verts.new((xm_f, y, zc + h)),
            bm.verts.new((xm_b, y, zc + h * 0.85)),
            bm.verts.new((xb, y, zc)),
            bm.verts.new((xm_b, y, zc - h * 0.75)),
            bm.verts.new((xm_f, y, zc - h * 0.85)),
        ]

    # 3 spanwise stations for crisp mid-wing kink/taper
    y_mid = y_start + (y_end - y_start) * 0.45
    r0 = airfoil_ring(y_start, root_x_front, root_x_back, root_thick, z_offset)
    r1 = airfoil_ring(
        y_mid,
        root_x_front * 0.55 + tip_x_front * 0.45,
        root_x_back * 0.62 + tip_x_back * 0.38,
        root_thick * 0.62 + tip_thick * 0.38,
        z_offset + dihedral_z * 0.4,
    )
    r2 = airfoil_ring(y_end, tip_x_front, tip_x_back, tip_thick, z_offset + dihedral_z)

    for a, b in [(r0, r1), (r1, r2)]:
        for i in range(6):
            jn = (i + 1) % 6
            bm.faces.new((a[i], b[i], b[jn], a[jn]))
    bm.faces.new(r0)
    bm.faces.new(list(reversed(r2)))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    return finalize_mesh(obj, mat, bevel=bevel, uv_scale=0.65)


def create_part(
    name: str,
    primitive: str,
    mat: bpy.types.Material,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    bevel: float = 0.02,
    uv_scale: float = 0.6,
    **kwargs,
) -> bpy.types.Object:
    rot_rad = tuple(math.radians(a) for a in rotation_deg)
    if primitive == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rot_rad)
    elif primitive == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=kwargs.get("vertices", 16),
            radius=kwargs.get("radius", 0.5),
            depth=kwargs.get("depth", 1.0),
            location=location,
            rotation=rot_rad,
        )
    elif primitive == "cone":
        bpy.ops.mesh.primitive_cone_add(
            vertices=kwargs.get("vertices", 12),
            radius1=kwargs.get("radius1", 0.5),
            radius2=kwargs.get("radius2", 0.0),
            depth=kwargs.get("depth", 1.0),
            location=location,
            rotation=rot_rad,
        )
    elif primitive == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=kwargs.get("segments", 20),
            ring_count=kwargs.get("rings", 14),
            radius=kwargs.get("radius", 0.5),
            location=location,
            rotation=rot_rad,
        )
    elif primitive == "ico":
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=kwargs.get("subdivisions", 2),
            radius=kwargs.get("radius", 0.5),
            location=location,
            rotation=rot_rad,
        )
    elif primitive == "torus":
        bpy.ops.mesh.primitive_torus_add(
            major_radius=kwargs.get("major_radius", 1.0),
            minor_radius=kwargs.get("minor_radius", 0.10),
            major_segments=kwargs.get("major_segments", 28),
            minor_segments=kwargs.get("minor_segments", 10),
            location=location,
            rotation=rot_rad,
        )
    else:
        raise ValueError(f"Unknown primitive: {primitive}")

    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finalize_mesh(obj, mat, bevel=bevel, uv_scale=uv_scale)


# Reusable Bolt-On Hardware (Engines, Railguns, Turrets, Louvers)
def create_engine_pod(
    prefix: str,
    location: tuple[float, float, float],
    radius: float,
    length: float,
    housing_mat: bpy.types.Material,
    dark_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Multi-piece vectored-thrust jet engine nacelle with outer shroud, cooling collar, petals & plasma core."""
    x, y, z = location
    parts = [
        # Outer armored nacelle housing
        create_part(
            f"{prefix}_Housing", "cylinder", housing_mat,
            location=(x + length * 0.25, y, z), rotation_deg=(0, 90, 0),
            vertices=12, radius=radius * 1.05, depth=length * 0.72, bevel=radius * 0.06,
        ),
        # Heat-shield intake collar
        create_part(
            f"{prefix}_Collar", "torus", dark_mat,
            location=(x - length * 0.08, y, z), rotation_deg=(0, 90, 0),
            major_radius=radius * 1.02, minor_radius=radius * 0.14,
            major_segments=16, minor_segments=8, bevel=0.0,
        ),
        # Tapered exhaust nozzle bell
        create_part(
            f"{prefix}_Bell", "cone", dark_mat,
            location=(x - length * 0.30, y, z), rotation_deg=(0, -90, 0),
            vertices=12, radius1=radius * 0.96, radius2=radius * 0.72, depth=length * 0.42, bevel=radius * 0.04,
        ),
        # Inner glowing plasma afterburner core
        create_part(
            f"{prefix}_GlowCore", "cylinder", glow_mat,
            location=(x - length * 0.42, y, z), rotation_deg=(0, 90, 0),
            vertices=12, radius=radius * 0.60, depth=length * 0.16, bevel=0.0,
        ),
    ]
    # 6 vectored exhaust petals around the nozzle rim
    for i in range(6):
        ang = (i / 6.0) * math.tau
        py = y + math.cos(ang) * radius * 0.84
        pz = z + math.sin(ang) * radius * 0.84
        parts.append(
            create_part(
                f"{prefix}_Petal_{i}", "cube", dark_mat,
                location=(x - length * 0.45, py, pz),
                rotation_deg=(math.degrees(ang), 10, 0),
                scale=(length * 0.26, radius * 0.12, radius * 0.24),
                bevel=0.008,
            )
        )
    return parts


def create_railgun_pod(
    prefix: str,
    location: tuple[float, float, float],
    scale_f: float,
    hull_mat: bpy.types.Material,
    dark_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Twin-rail electromagnetic plasma cannon with breech housing, accelerator rails, and glowing core channel."""
    x, y, z = location
    s = scale_f
    return [
        # Breech block & mounting pylon
        create_part(
            f"{prefix}_Breech", "cube", hull_mat,
            location=(x - 0.18 * s, y, z), scale=(0.95 * s, 0.24 * s, 0.24 * s), bevel=0.015 * s,
        ),
        # Upper & lower magnetic rails
        create_part(
            f"{prefix}_UpperRail", "cube", dark_mat,
            location=(x + 0.58 * s, y, z + 0.075 * s), scale=(1.15 * s, 0.11 * s, 0.065 * s), bevel=0.008 * s,
        ),
        create_part(
            f"{prefix}_LowerRail", "cube", dark_mat,
            location=(x + 0.58 * s, y, z - 0.075 * s), scale=(1.15 * s, 0.11 * s, 0.065 * s), bevel=0.008 * s,
        ),
        # Central glowing plasma accelerator core between the rails
        create_part(
            f"{prefix}_PlasmaChannel", "cube", glow_mat,
            location=(x + 0.56 * s, y, z), scale=(1.08 * s, 0.06 * s, 0.06 * s), bevel=0.0,
        ),
        # Perforated muzzle brake collar
        create_part(
            f"{prefix}_MuzzleRing", "cylinder", dark_mat,
            location=(x + 1.12 * s, y, z), rotation_deg=(0, 90, 0),
            vertices=10, radius=0.115 * s, depth=0.18 * s, bevel=0.008 * s,
        ),
        create_part(
            f"{prefix}_MuzzleGlow", "cylinder", glow_mat,
            location=(x + 1.22 * s, y, z), rotation_deg=(0, 90, 0),
            vertices=10, radius=0.08 * s, depth=0.06 * s, bevel=0.0,
        ),
    ]


def create_dorsal_turret(
    prefix: str,
    location: tuple[float, float, float],
    scale_f: float,
    hull_mat: bpy.types.Material,
    dark_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Armored twin-barrel naval/space dorsal artillery turret."""
    x, y, z = location
    s = scale_f
    return [
        create_part(
            f"{prefix}_RingBase", "cylinder", dark_mat,
            location=(x, y, z), vertices=12, radius=0.42 * s, depth=0.16 * s, bevel=0.015 * s,
        ),
        create_part(
            f"{prefix}_Housing", "cube", hull_mat,
            location=(x - 0.04 * s, y, z + 0.18 * s), scale=(0.66 * s, 0.54 * s, 0.28 * s), bevel=0.025 * s,
        ),
        create_part(
            f"{prefix}_OpticBar", "cube", glow_mat,
            location=(x + 0.29 * s, y, z + 0.22 * s), scale=(0.08 * s, 0.32 * s, 0.07 * s), bevel=0.0,
        ),
        create_part(
            f"{prefix}_Barrel_L", "cylinder", dark_mat,
            location=(x + 0.58 * s, y + 0.14 * s, z + 0.17 * s), rotation_deg=(0, 90, 0),
            vertices=10, radius=0.055 * s, depth=0.85 * s, bevel=0.006 * s,
        ),
        create_part(
            f"{prefix}_Barrel_R", "cylinder", dark_mat,
            location=(x + 0.58 * s, y - 0.14 * s, z + 0.17 * s), rotation_deg=(0, 90, 0),
            vertices=10, radius=0.055 * s, depth=0.85 * s, bevel=0.006 * s,
        ),
    ]


def create_radiator_fins(
    prefix: str,
    location: tuple[float, float, float],
    count: int,
    spacing_x: float,
    fin_size: tuple[float, float, float],
    mat: bpy.types.Material,
    tilt_deg: float = -22.0,
) -> list[bpy.types.Object]:
    """Row of crisp military heat-radiator cooling louvers."""
    x, y, z = location
    objs = []
    start_x = x - (count - 1) * spacing_x * 0.5
    for i in range(count):
        objs.append(
            create_part(
                f"{prefix}_Fin_{i}", "cube", mat,
                location=(start_x + i * spacing_x, y, z),
                rotation_deg=(0, tilt_deg, 0),
                scale=fin_size,
                bevel=0.005,
            )
        )
    return objs


# Bone Rigging & NLA Animation Wiring
def create_rig(
    name: str,
    bone_defs: dict[str, tuple[tuple[float, float, float], tuple[float, float, float], str | None]],
) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new(name + "_ArmData")
    rig = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = arm_data.edit_bones
    created = {}
    for bname, (head, tail, _parent) in bone_defs.items():
        b = edit_bones.new(bname)
        b.head = Vector(head)
        b.tail = Vector(tail)
        b.roll = 0.0
        b.use_deform = True
        created[bname] = b

    for bname, (_head, _tail, parent_name) in bone_defs.items():
        if parent_name and parent_name in created:
            created[bname].parent = created[parent_name]

    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    return rig


def parent_to_bone(objs: list[bpy.types.Object], rig: bpy.types.Object, bone_name: str) -> None:
    bpy.context.view_layer.update()
    bone = rig.data.bones[bone_name]
    parent_mat = rig.matrix_world @ bone.matrix_local @ Matrix.Translation((0.0, bone.length, 0.0))
    inv_parent = parent_mat.inverted()

    for obj in objs:
        orig_world = obj.matrix_world.copy()
        obj.parent = rig
        obj.parent_type = "BONE"
        obj.parent_bone = bone_name
        obj.matrix_parent_inverse = inv_parent @ orig_world
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)


def reset_pose(rig: bpy.types.Object) -> None:
    for pb in rig.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def key_bone(
    rig: bpy.types.Object,
    bone_name: str,
    frame: int,
    loc: tuple[float, float, float] | None = None,
    rot_deg: tuple[float, float, float] | None = None,
    scale: tuple[float, float, float] | None = None,
) -> None:
    pb = rig.pose.bones[bone_name]
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert(data_path="location", frame=frame)
    if rot_deg is not None:
        pb.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert(data_path="scale", frame=frame)


def start_action(rig: bpy.types.Object, action_name: str) -> bpy.types.Action:
    if not rig.animation_data:
        rig.animation_data_create()
    reset_pose(rig)
    act = bpy.data.actions.new(name=action_name)
    rig.animation_data.action = act
    return act


def finalize_action_to_nla(rig: bpy.types.Object, action_name: str) -> None:
    if not rig.animation_data or not rig.animation_data.action:
        return
    act = rig.animation_data.action
    act.name = action_name
    act.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, 1, act)
    strip.name = action_name
    rig.animation_data.action = None
    reset_pose(rig)


def export_glb(filename: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / filename
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips_merged_animation_name="Idle",
        export_force_sampling=True,
        export_image_format="AUTO",
    )
    print(f"[EXPORTED] {out_path.name} ({out_path.stat().st_size:,} bytes)")
    return out_path
