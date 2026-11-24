"""
Mecha-Aero Sculpting, BVH Ambient Occlusion & GLTF Rigging Library (Blender 4.2.16+).
Exports Y-up GLBs ready for Three.js WebGL2 without pivot drift.

Why it's structured like this:
  1. Real lofted curves & airfoil wings with beveled ceramic armor over recessed inner frames.
  2. Clean anodized/ceramic shading + BVHTree vertex AO & edge wear baked to COLOR_0
     (friends don't let friends ship lazy brick normal maps on spaceships).
  3. Exact Blender Z-up to glTF Y-up mapping so Three.js doesn't mount wings sideways.
"""

from __future__ import annotations

import math
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "models"


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 48
    return scene


# Subtle Brushed-Metal Micro Grain (zero generic grid slop)
def _get_brushed_metal_bump() -> bpy.types.Image:
    name = "MicroBrushedMetal_512"
    if name in bpy.data.images:
        return bpy.data.images[name]

    size = 512
    rng = np.random.default_rng(1337)
    streak = rng.normal(0.5, 0.08, (size, size // 16)).astype(np.float32)
    streak = np.repeat(streak, 16, axis=1)
    fine = rng.normal(0.0, 0.025, (size, size)).astype(np.float32)
    height = np.clip(streak + fine, 0.0, 1.0)

    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, 0] = height
    rgba[:, :, 1] = height
    rgba[:, :, 2] = height

    img = bpy.data.images.new(name, width=size, height=size, alpha=False)
    img.file_format = "PNG"
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


# PBR Material Factory (Ceramic, Metal, Chitin, Smoked Glass, Glow Cores)
def make_material(
    name: str,
    base_color: tuple[float, float, float],
    metallic: float = 0.25,
    roughness: float = 0.24,
    emission_color: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    brushed: bool = False,
    bump_distance: float = 0.008,
    use_ao_vc: bool = True,
) -> bpy.types.Material:
    if name in bpy.data.materials:
        return bpy.data.materials[name]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")

    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if emission_color is not None and emission_strength > 0.0:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        em_col = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if em_col:
            em_col.default_value = (*emission_color, 1.0)
        em_str = bsdf.inputs.get("Emission Strength")
        if em_str:
            em_str.default_value = emission_strength
        mat["is_emissive_part"] = True
        return mat

    mat["is_emissive_part"] = False

    if use_ao_vc:
        vc_node = nodes.new("ShaderNodeVertexColor")
        vc_node.layer_name = "Col"

        mix_node = nodes.new("ShaderNodeMix")
        mix_node.data_type = "RGBA"
        mix_node.blend_type = "MULTIPLY"
        mix_node.clamp_result = True
        mix_node.inputs["Factor"].default_value = 1.0
        mix_node.inputs["A"].default_value = (*base_color, 1.0)
        links.new(vc_node.outputs["Color"], mix_node.inputs["B"])
        links.new(mix_node.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)

    if brushed and False:
        # Reserved for ultra-subtle high-res micro-roughness if ever needed;
        # clean ceramic & satin-anodized PBR shading reads far crisper at gameplay camera distances.
        pass

    return mat


def make_faction_palette() -> dict[str, bpy.types.Material]:
    """Faction color palettes tuned to stay punchy without turning muddy under bloom."""
    return {
        # Player Vanguard ("Neo-Ikaruga" Ceramic White / Deep Navy / Aero Orange)
        "p_white": make_material("VanguardCeramicWhite", (0.88, 0.92, 0.97), metallic=0.16, roughness=0.20),
        "p_navy": make_material("VanguardTacticalNavy", (0.09, 0.14, 0.22), metallic=0.38, roughness=0.32, brushed=True),
        "p_frame": make_material("DarkGunmetalFrame", (0.14, 0.17, 0.22), metallic=0.86, roughness=0.34, brushed=True),
        "p_orange": make_material("VanguardAeroOrange", (0.98, 0.42, 0.05), metallic=0.22, roughness=0.22),
        "p_canopy": make_material("ObsidianCanopyGlass", (0.03, 0.09, 0.14), metallic=0.15, roughness=0.04),
        "p_glow": make_material(
            "VanguardCyanGlow", (0.35, 0.96, 1.0), metallic=0.0, roughness=0.1,
            emission_color=(0.15, 0.92, 1.0), emission_strength=3.8, use_ao_vc=False,
        ),

        # Crimson Syndicate (Small, Normal, Boss Destroyer)
        "c_red": make_material("CrimsonSatinLacquer", (0.68, 0.07, 0.13), metallic=0.30, roughness=0.22),
        "c_dark": make_material("CrimsonObsidianHull", (0.08, 0.09, 0.13), metallic=0.52, roughness=0.32, brushed=True),
        "c_gold": make_material("CrimsonHazardAmber", (0.92, 0.60, 0.08), metallic=0.72, roughness=0.24, brushed=True),
        "c_steel": make_material("CrimsonBrushedSteel", (0.34, 0.37, 0.44), metallic=0.88, roughness=0.28, brushed=True),
        "c_glow": make_material(
            "CrimsonMoltenGlow", (1.0, 0.36, 0.08), metallic=0.0, roughness=0.12,
            emission_color=(1.0, 0.28, 0.04), emission_strength=4.2, use_ao_vc=False,
        ),

        # Abyssal Void Brood (Large Ram-Cruiser, Minion, Boss Summoner)
        "v_chitin": make_material("VoidIridescentChitin", (0.14, 0.07, 0.24), metallic=0.45, roughness=0.20),
        "v_dark": make_material("VoidCarapaceDark", (0.06, 0.05, 0.10), metallic=0.60, roughness=0.30, brushed=True),
        "v_bone": make_material("VoidBoneSilver", (0.58, 0.56, 0.72), metallic=0.68, roughness=0.26, brushed=True),
        "v_glow": make_material(
            "VoidAmethystGlow", (0.90, 0.22, 1.0), metallic=0.0, roughness=0.1,
            emission_color=(0.82, 0.18, 1.0), emission_strength=4.2, use_ao_vc=False,
        ),
        "v_magenta": make_material(
            "VoidMagentaGlow", (1.0, 0.25, 0.72), metallic=0.0, roughness=0.1,
            emission_color=(1.0, 0.20, 0.68), emission_strength=4.0, use_ao_vc=False,
        ),

        # Aurelian Seraphim (Elite Chrono-Sniper, Boss Overlord)
        "s_ivory": make_material("SeraphIvoryPearl", (0.92, 0.89, 0.82), metallic=0.16, roughness=0.18),
        "s_gold": make_material("SeraphChampagneGold", (0.86, 0.66, 0.22), metallic=0.92, roughness=0.18, brushed=True),
        "s_dark": make_material("SeraphObsidianFrame", (0.09, 0.10, 0.14), metallic=0.72, roughness=0.28, brushed=True),
        "s_solar": make_material(
            "SeraphSolarGlow", (1.0, 0.94, 0.58), metallic=0.0, roughness=0.1,
            emission_color=(1.0, 0.88, 0.42), emission_strength=4.4, use_ao_vc=False,
        ),
        "s_cyan": make_material(
            "SeraphChronoCyan", (0.30, 0.94, 1.0), metallic=0.0, roughness=0.1,
            emission_color=(0.20, 0.90, 1.0), emission_strength=4.0, use_ao_vc=False,
        ),

        # Props
        "k_emerald": make_material(
            "MedkitEmeraldGlow", (0.20, 1.0, 0.55), metallic=0.0, roughness=0.1,
            emission_color=(0.15, 0.98, 0.48), emission_strength=4.0, use_ao_vc=False,
        ),
        "k_crystal": make_material(
            "PowerupEnergyCrystal", (0.25, 0.92, 1.0), metallic=0.1, roughness=0.1,
            emission_color=(0.20, 0.88, 1.0), emission_strength=3.6, use_ao_vc=False,
        ),
    }


def make_modular_ship_palette() -> dict[str, bpy.types.Material]:
    """Shared material palette across modular Player Vanguard & Weapon GLBs for unified faction livery tinting."""
    return {
        "primary": make_material("ShipHull_Primary", (0.88, 0.92, 0.97), metallic=0.22, roughness=0.22, use_ao_vc=True),
        "secondary": make_material("ShipHull_Secondary", (0.11, 0.16, 0.25), metallic=0.45, roughness=0.30, brushed=True, use_ao_vc=True),
        "accent": make_material("ShipHull_Accent", (0.98, 0.44, 0.06), metallic=0.28, roughness=0.22, use_ao_vc=True),
        "frame": make_material("ShipHull_Frame", (0.16, 0.19, 0.25), metallic=0.86, roughness=0.32, brushed=True, use_ao_vc=True),
        "scrap_metal": make_material("ShipHull_ScrapMetal", (0.20, 0.23, 0.27), metallic=0.84, roughness=0.48, brushed=True, use_ao_vc=True),
        "scrap_rust": make_material("ShipHull_ScrapRust", (0.36, 0.20, 0.13), metallic=0.54, roughness=0.64, brushed=True, use_ao_vc=True),
        "scrap_weld": make_material("ShipHull_ScrapWeld", (0.28, 0.24, 0.20), metallic=0.72, roughness=0.55, use_ao_vc=True),
        "scrap_bulb": make_material(
            "ShipHull_ScrapBulb", (1.0, 0.68, 0.28), metallic=0.0, roughness=0.18,
            emission_color=(1.0, 0.56, 0.18), emission_strength=1.45, use_ao_vc=False,
        ),
        "canopy": make_material("ShipHull_Canopy", (0.03, 0.09, 0.14), metallic=0.15, roughness=0.04, use_ao_vc=True),
        "glow": make_material(
            "ShipHull_Glow", (0.35, 0.96, 1.0), metallic=0.0, roughness=0.10,
            emission_color=(0.15, 0.92, 1.0), emission_strength=3.8, use_ao_vc=False,
        ),
        "wpn_cyan": make_material(
            "WeaponSigCyan", (0.25, 0.94, 1.0), metallic=0.0, roughness=0.10,
            emission_color=(0.15, 0.90, 1.0), emission_strength=4.2, use_ao_vc=False,
        ),
        "wpn_amber": make_material(
            "WeaponSigAmber", (1.0, 0.58, 0.14), metallic=0.0, roughness=0.10,
            emission_color=(1.0, 0.48, 0.08), emission_strength=4.2, use_ao_vc=False,
        ),
        "wpn_ice": make_material(
            "WeaponSigIce", (0.60, 0.96, 1.0), metallic=0.0, roughness=0.10,
            emission_color=(0.50, 0.94, 1.0), emission_strength=4.2, use_ao_vc=False,
        ),
        "wpn_violet": make_material(
            "WeaponSigViolet", (0.74, 0.42, 1.0), metallic=0.0, roughness=0.10,
            emission_color=(0.64, 0.28, 1.0), emission_strength=4.2, use_ao_vc=False,
        ),
        "wpn_emerald": make_material(
            "WeaponSigEmerald", (0.20, 0.98, 0.62), metallic=0.0, roughness=0.10,
            emission_color=(0.14, 0.95, 0.54), emission_strength=4.2, use_ao_vc=False,
        ),
    }


# Geometry Cleanup, UVs & Modifier Baking Helpers
def _apply_box_uv(obj: bpy.types.Object, uv_scale: float = 0.6) -> None:
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


def finalize_sculpted_mesh(
    obj: bpy.types.Object,
    mat: bpy.types.Material,
    subsurf_levels: int = 0,
    bevel_width: float = 0.0,
    bevel_segments: int = 2,
    auto_smooth_deg: float = 38.0,
    uv_scale: float = 0.6,
    apply_modifiers: bool = True,
) -> bpy.types.Object:
    """
    Applies materials, modifiers, smooth/crisp shading split, and clean box UVs.
    Always leaves clean evaluated geometry ready for BVHTree Vertex AO baking.
    """
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    if bevel_width > 0.0:
        bev = obj.modifiers.new(name="Bevel", type="BEVEL")
        bev.width = bevel_width
        bev.segments = bevel_segments
        bev.limit_method = "ANGLE"
        bev.angle_limit = math.radians(30.0)
        bev.harden_normals = False

    if subsurf_levels > 0:
        sub = obj.modifiers.new(name="Subsurf", type="SUBSURF")
        sub.levels = subsurf_levels
        sub.render_levels = subsurf_levels

    if apply_modifiers and len(obj.modifiers) > 0:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception:
                pass

    if obj.data and hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = True

    if auto_smooth_deg > 0.0 and auto_smooth_deg < 89.0:
        es = obj.modifiers.new(name="EdgeSplit", type="EDGE_SPLIT")
        es.split_angle = math.radians(auto_smooth_deg)
        es.use_edge_angle = True
        es.use_edge_sharp = True
        if apply_modifiers:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=es.name)

    _apply_box_uv(obj, uv_scale=uv_scale)
    return obj


# Sculpting Primitives: Lofted Hulls, Airfoils, Curved Blades & Armor Plates
def build_lofted_hull(
    name: str,
    stations: list[tuple[float, list[tuple[float, float]]]],
    mat: bpy.types.Material,
    crease_indices: set[int] | None = None,
    subsurf: int = 1,
    bevel: float = 0.0,
    bevel_segments: int = 2,
    auto_smooth_deg: float = 42.0,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """
    Creates a smooth or crisp-chined aerodynamic hull by lofting cross-section rings
    along X. `crease_indices` holds vertex indices along the profile whose longitudinal
    spine edges stay razor-sharp under Catmull-Clark Subdivision.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    crease_layer = bm.edges.layers.float.new("crease_edge")
    rings: list[list[bmesh.types.BMVert]] = []

    for x, profile in stations:
        ring = [bm.verts.new((x, y, z)) for y, z in profile]
        rings.append(ring)

    ring_len = len(rings[0])
    c_set = crease_indices or set()

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for j in range(ring_len):
            jn = (j + 1) % ring_len
            try:
                f = bm.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
                if j in c_set:
                    for e in f.edges:
                        if r0[j] in e.verts and r1[j] in e.verts:
                            e[crease_layer] = 0.85
            except ValueError:
                pass

    # Clean end caps
    for cap_ring, rev in [(rings[0], False), (rings[-1], True)]:
        pts = list(reversed(cap_ring)) if rev else list(cap_ring)
        try:
            f = bm.faces.new(pts)
            for e in f.edges:
                e[crease_layer] = 0.85
        except ValueError:
            pass

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.location = location
    obj.rotation_euler = tuple(math.radians(a) for a in rotation_deg)
    return finalize_sculpted_mesh(
        obj,
        mat,
        subsurf_levels=subsurf,
        bevel_width=bevel,
        bevel_segments=bevel_segments,
        auto_smooth_deg=auto_smooth_deg,
    )


def jet_profile(
    half_w: float,
    top_h: float,
    bot_h: float,
    deck_w: float = 0.42,
    chine_z: float = 0.02,
    shoulder_w: float = 0.86,
) -> list[tuple[float, float]]:
    """
    10-point sleek stealth-fighter cross-section with distinct top spine, chamfered
    shoulders, lateral chines (for crisp AO shadows), and flat belly.
    Indices 1, 2, 7, 8 sit on sharp chine lines when subsurfed.
    """
    return [
        (half_w * deck_w, top_h * 0.92),        # 0 top-right deck
        (half_w * shoulder_w, top_h * 0.48),    # 1 upper-right shoulder
        (half_w, chine_z),                      # 2 right razor chine
        (half_w * 0.78, bot_h * 0.52),          # 3 lower-right bevel
        (half_w * 0.36, bot_h),                 # 4 bottom-right keel
        (-half_w * 0.36, bot_h),                # 5 bottom-left keel
        (-half_w * 0.78, bot_h * 0.52),         # 6 lower-left bevel
        (-half_w, chine_z),                     # 7 left razor chine
        (-half_w * shoulder_w, top_h * 0.48),   # 8 upper-left shoulder
        (-half_w * deck_w, top_h * 0.92),       # 9 top-left deck
    ]


def build_airfoil_wing(
    name: str,
    stations: list[tuple[float, float, float, float, float]],
    mat: bpy.types.Material,
    camber: float = 0.08,
    subsurf: int = 0,
    bevel: float = 0.012,
    bevel_segments: int = 2,
    auto_smooth_deg: float = 36.0,
) -> bpy.types.Object:
    """
    Sculpts a realistic 3D tapered, swept airfoil wing along arbitrary Y/Z stations.
    Each station tuple is: (y_pos, x_front, x_back, z_center, thickness).
    Constructs a 10-point cambered airfoil profile at each spanwise station.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []

    for y, xf, xb, zc, th in stations:
        chord = xf - xb
        h = th * 0.5
        # Cambered supersonic diamond/airfoil profile (rounded leading edge, sharp trailing edge)
        pts = [
            (xf, zc),
            (xb + chord * 0.86, zc + h * (0.68 + camber * 0.5)),
            (xb + chord * 0.62, zc + h * (1.05 + camber)),
            (xb + chord * 0.34, zc + h * (0.92 + camber * 0.6)),
            (xb + chord * 0.12, zc + h * 0.48),
            (xb, zc),
            (xb + chord * 0.12, zc - h * 0.36),
            (xb + chord * 0.38, zc - h * (0.68 - camber * 0.2)),
            (xb + chord * 0.68, zc - h * (0.78 - camber * 0.2)),
            (xb + chord * 0.88, zc - h * 0.52),
        ]
        # Ensure consistent winding whether spanning +Y (left) or -Y (right)
        ring = [bm.verts.new((px, y, pz)) for px, pz in pts]
        rings.append(ring)

    # Check winding relative to span sign
    flip_winding = len(stations) >= 2 and stations[-1][0] < stations[0][0]
    ring_len = len(rings[0])

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for j in range(ring_len):
            jn = (j + 1) % ring_len
            verts = (r0[j], r1[j], r1[jn], r0[jn]) if not flip_winding else (r0[jn], r1[jn], r1[j], r0[j])
            try:
                bm.faces.new(verts)
            except ValueError:
                pass

    r_start = list(reversed(rings[0])) if flip_winding else list(rings[0])
    r_end = list(rings[-1]) if flip_winding else list(reversed(rings[-1]))
    try:
        bm.faces.new(r_start)
    except ValueError:
        pass
    try:
        bm.faces.new(r_end)
    except ValueError:
        pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    return finalize_sculpted_mesh(
        obj,
        mat,
        subsurf_levels=subsurf,
        bevel_width=bevel,
        bevel_segments=bevel_segments,
        auto_smooth_deg=auto_smooth_deg,
    )


def _eval_catmull_rom(pts: list[Vector], samples_per_seg: int = 3) -> list[Vector]:
    if len(pts) < 2:
        return pts
    if len(pts) == 2:
        out = []
        steps = max(2, samples_per_seg)
        for i in range(steps + 1):
            t = i / steps
            out.append(pts[0].lerp(pts[1], t))
        return out

    ext = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
    out: list[Vector] = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        n_steps = samples_per_seg
        for s in range(n_steps):
            t = s / n_steps
            t2 = t * t
            t3 = t2 * t
            pos = 0.5 * (
                (2.0 * p1)
                + (-p0 + p2) * t
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
            )
            out.append(pos)
    out.append(pts[-1].copy())
    return out


def build_curved_blade(
    name: str,
    control_points: list[tuple[float, float, float]],
    widths: list[float],
    thicknesses: list[float],
    mat: bpy.types.Material,
    twist_deg: list[float] | None = None,
    up_hint: tuple[float, float, float] = (0.0, 0.0, 1.0),
    samples_per_seg: int = 3,
    auto_smooth_deg: float = 42.0,
) -> bpy.types.Object:
    """
    Sculpts an aerodynamic tapered curved blade, seraphim feather, hydraulic mandible,
    or bio-mechanical tentacle along a 3D Catmull-Rom spline with diamond/hexagonal cross-section.
    """
    vecs = [Vector(p) for p in control_points]
    sampled = _eval_catmull_rom(vecs, samples_per_seg=samples_per_seg)
    n_pts = len(sampled)

    # Resample scalar curves along normalized arc parameter
    def sample_curve(vals: list[float], t: float) -> float:
        if len(vals) == 1:
            return vals[0]
        ft = max(0.0, min(len(vals) - 1.0, t * (len(vals) - 1)))
        idx = int(ft)
        nxt = min(len(vals) - 1, idx + 1)
        return vals[idx] + (vals[nxt] - vals[idx]) * (ft - idx)

    up_vec = Vector(up_hint).normalized()
    twists = twist_deg if twist_deg else [0.0] * len(control_points)

    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []

    for i, pos in enumerate(sampled):
        t = i / max(1, n_pts - 1)
        if i == 0:
            tan = (sampled[1] - sampled[0]).normalized()
        elif i == n_pts - 1:
            tan = (sampled[-1] - sampled[-2]).normalized()
        else:
            tan = (sampled[i + 1] - sampled[i - 1]).normalized()

        # Robust perpendicular basis
        ref = up_vec if abs(tan.dot(up_vec)) < 0.94 else Vector((1.0, 0.0, 0.0))
        side = tan.cross(ref).normalized()
        ortho_up = side.cross(tan).normalized()

        ang = math.radians(sample_curve(twists, t))
        if abs(ang) > 1e-4:
            ca, sa = math.cos(ang), math.sin(ang)
            s_rot = side * ca + ortho_up * sa
            u_rot = ortho_up * ca - side * sa
            side, ortho_up = s_rot, u_rot

        hw = max(0.004, sample_curve(widths, t) * 0.5)
        ht = max(0.003, sample_curve(thicknesses, t) * 0.5)

        # 6-point hexagonal beveled blade profile (sharp edges, rigid spine)
        profile_local = [
            (hw, 0.0),
            (hw * 0.42, ht),
            (-hw * 0.42, ht),
            (-hw, 0.0),
            (-hw * 0.42, -ht * 0.85),
            (hw * 0.42, -ht * 0.85),
        ]
        ring = [bm.verts.new(pos + side * lx + ortho_up * lz) for lx, lz in profile_local]
        rings.append(ring)

    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(6):
            jn = (j + 1) % 6
            try:
                bm.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
            except ValueError:
                pass

    try:
        bm.faces.new(list(reversed(rings[0])))
    except ValueError:
        pass
    try:
        bm.faces.new(rings[-1])
    except ValueError:
        pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    return finalize_sculpted_mesh(
        obj, mat, subsurf_levels=0, bevel_width=0.0, auto_smooth_deg=auto_smooth_deg
    )


def build_beveled_armor_plate(
    name: str,
    poly_xy: list[tuple[float, float]],
    z_bottom: float,
    z_top: float,
    mat: bpy.types.Material,
    top_inset: float = 0.86,
    tilt_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.0,
    bevel_segments: int = 2,
) -> bpy.types.Object:
    """
    Creates an angled, floating chamfered armor plate (mech shoulder pad, dorsal fairing,
    livery panel) with real 45-degree beveled rim for physical panel-line crevices.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    cx = sum(p[0] for p in poly_xy) / len(poly_xy)
    cy = sum(p[1] for p in poly_xy) / len(poly_xy)

    bm = bmesh.new()
    bot_verts = [bm.verts.new((px, py, z_bottom)) for px, py in poly_xy]
    top_verts = [
        bm.verts.new((cx + (px - cx) * top_inset, cy + (py - cy) * top_inset, z_top))
        for px, py in poly_xy
    ]

    n = len(poly_xy)
    for i in range(n):
        inext = (i + 1) % n
        try:
            bm.faces.new((bot_verts[i], bot_verts[inext], top_verts[inext], top_verts[i]))
        except ValueError:
            pass
    try:
        bm.faces.new(list(reversed(bot_verts)))
    except ValueError:
        pass
    try:
        bm.faces.new(top_verts)
    except ValueError:
        pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.rotation_euler = tuple(math.radians(a) for a in tilt_deg)
    return finalize_sculpted_mesh(
        obj, mat, subsurf_levels=0, bevel_width=bevel, bevel_segments=bevel_segments, auto_smooth_deg=34.0
    )


def create_geo(
    name: str,
    kind: str,
    mat: bpy.types.Material,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    bevel: float = 0.015,
    bevel_segments: int = 2,
    subsurf: int = 0,
    auto_smooth_deg: float = 36.0,
    **kwargs,
) -> bpy.types.Object:
    rot_rad = tuple(math.radians(a) for a in rotation_deg)
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rot_rad)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=kwargs.get("vertices", 16),
            radius=kwargs.get("radius", 0.5),
            depth=kwargs.get("depth", 1.0),
            location=location,
            rotation=rot_rad,
        )
    elif kind == "cone":
        bpy.ops.mesh.primitive_cone_add(
            vertices=kwargs.get("vertices", 12),
            radius1=kwargs.get("radius1", 0.5),
            radius2=kwargs.get("radius2", 0.0),
            depth=kwargs.get("depth", 1.0),
            location=location,
            rotation=rot_rad,
        )
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=kwargs.get("segments", 20),
            ring_count=kwargs.get("rings", 14),
            radius=kwargs.get("radius", 0.5),
            location=location,
            rotation=rot_rad,
        )
    elif kind == "ico":
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=kwargs.get("subdivisions", 2),
            radius=kwargs.get("radius", 0.5),
            location=location,
            rotation=rot_rad,
        )
    else:
        raise ValueError(f"Unknown primitive: {kind}")

    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finalize_sculpted_mesh(
        obj,
        mat,
        subsurf_levels=subsurf,
        bevel_width=bevel,
        bevel_segments=bevel_segments,
        auto_smooth_deg=auto_smooth_deg,
    )


# High-Craft Sub-Assemblies (Thrusters, Railguns, Canopies, Radiators)
def build_vector_nozzle(
    prefix: str,
    location: tuple[float, float, float],
    radius: float,
    length: float,
    shroud_mat: bpy.types.Material,
    frame_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
    petals: int = 8,
) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    """
    High-detail vectored-thrust jet nozzle. Returns (fixed_shroud_parts, moving_petal_parts)
    so the engine petals can contract/expand dynamically on Dash/Charge!
    """
    x, y, z = location
    fixed: list[bpy.types.Object] = [
        create_geo(
            f"{prefix}_OuterShroud",
            "cylinder",
            shroud_mat,
            location=(x + length * 0.25, y, z),
            rotation_deg=(0, 90, 0),
            vertices=14,
            radius=radius * 1.06,
            depth=length * 0.65,
            bevel=radius * 0.06,
        ),
        create_geo(
            f"{prefix}_InnerCowl",
            "cone",
            frame_mat,
            location=(x - length * 0.12, y, z),
            rotation_deg=(0, -90, 0),
            vertices=14,
            radius1=radius * 0.96,
            radius2=radius * 0.72,
            depth=length * 0.36,
            bevel=radius * 0.04,
        ),
        create_geo(
            f"{prefix}_AfterburnerCore",
            "cylinder",
            glow_mat,
            location=(x - length * 0.26, y, z),
            rotation_deg=(0, 90, 0),
            vertices=12,
            radius=radius * 0.56,
            depth=length * 0.16,
            bevel=0.0,
        ),
    ]
    petal_objs: list[bpy.types.Object] = []
    for i in range(petals):
        ang = (i / petals) * math.tau
        py = y + math.cos(ang) * radius * 0.80
        pz = z + math.sin(ang) * radius * 0.80
        # Tapered trapezoidal petal plate
        p = build_beveled_armor_plate(
            f"{prefix}_Petal_{i}",
            [
                (-length * 0.22, -radius * 0.12),
                (length * 0.18, -radius * 0.16),
                (length * 0.18, radius * 0.16),
                (-length * 0.22, radius * 0.12),
            ],
            z_bottom=-radius * 0.04,
            z_top=radius * 0.05,
            mat=frame_mat,
            top_inset=0.80,
        )
        p.location = (x - length * 0.36, py, pz)
        p.rotation_euler = (ang + math.pi * 0.5, math.radians(-12), 0.0)
        petal_objs.append(p)
    return fixed, petal_objs


def build_mechanical_turret(
    prefix: str,
    location: tuple[float, float, float],
    scale_f: float,
    armor_mat: bpy.types.Material,
    frame_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
    barrels: int = 2,
) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    """
    Beveled angular mecha artillery turret with sloped cheek armor, dual heatsinked
    barrels, and optical targeting slit. Returns (turret_head_parts, barrel_parts).
    """
    x, y, z = location
    s = scale_f
    head: list[bpy.types.Object] = [
        create_geo(
            f"{prefix}_BaseRing",
            "cylinder",
            frame_mat,
            location=(x, y, z),
            vertices=10,
            radius=0.38 * s,
            depth=0.14 * s,
            bevel=0.015 * s,
        ),
        build_beveled_armor_plate(
            f"{prefix}_ShieldHood",
            [
                (x - 0.34 * s, y - 0.22 * s),
                (x + 0.28 * s, y - 0.28 * s),
                (x + 0.36 * s, y),
                (x + 0.28 * s, y + 0.28 * s),
                (x - 0.34 * s, y + 0.22 * s),
            ],
            z_bottom=z + 0.05 * s,
            z_top=z + 0.32 * s,
            mat=armor_mat,
            top_inset=0.72,
            bevel=0.015 * s,
        ),
        create_geo(
            f"{prefix}_OpticVisor",
            "cube",
            glow_mat,
            location=(x + 0.25 * s, y, z + 0.20 * s),
            scale=(0.12 * s, 0.28 * s, 0.06 * s),
            bevel=0.0,
        ),
    ]

    barrel_objs: list[bpy.types.Object] = []
    offsets = [-0.12 * s, 0.12 * s] if barrels == 2 else [0.0]
    for idx, oy in enumerate(offsets):
        barrel_objs.append(
            build_beveled_armor_plate(
                f"{prefix}_Barrel_{idx}",
                [
                    (x + 0.14 * s, y + oy - 0.05 * s),
                    (x + 0.96 * s, y + oy - 0.035 * s),
                    (x + 0.96 * s, y + oy + 0.035 * s),
                    (x + 0.14 * s, y + oy + 0.05 * s),
                ],
                z_bottom=z + 0.12 * s,
                z_top=z + 0.21 * s,
                mat=frame_mat,
                top_inset=0.82,
            )
        )
        barrel_objs.append(
            create_geo(
                f"{prefix}_MuzzleGlow_{idx}",
                "cube",
                glow_mat,
                location=(x + 0.97 * s, y + oy, z + 0.165 * s),
                scale=(0.06 * s, 0.05 * s, 0.05 * s),
                bevel=0.0,
            )
        )
    return head, barrel_objs


def build_railgun_assembly(
    prefix: str,
    location: tuple[float, float, float],
    scale_f: float,
    shroud_mat: bpy.types.Material,
    frame_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Precision split-rail electromagnetic accelerator cannon with recessed plasma groove."""
    x, y, z = location
    s = scale_f
    shroud = build_beveled_armor_plate(
        f"{prefix}_Housing",
        [
            (x - 0.45 * s, y - 0.14 * s),
            (x + 0.45 * s, y - 0.10 * s),
            (x + 0.55 * s, y),
            (x + 0.45 * s, y + 0.10 * s),
            (x - 0.45 * s, y + 0.14 * s),
        ],
        z_bottom=z - 0.11 * s,
        z_top=z + 0.11 * s,
        mat=shroud_mat,
        top_inset=0.84,
        bevel=0.01 * s,
    )
    upper_rail = build_beveled_armor_plate(
        f"{prefix}_UpperRail",
        [
            (x + 0.10 * s, y - 0.055 * s),
            (x + 1.25 * s, y - 0.032 * s),
            (x + 1.25 * s, y + 0.032 * s),
            (x + 0.10 * s, y + 0.055 * s),
        ],
        z_bottom=z + 0.028 * s,
        z_top=z + 0.095 * s,
        mat=frame_mat,
        top_inset=0.85,
    )
    lower_rail = build_beveled_armor_plate(
        f"{prefix}_LowerRail",
        [
            (x + 0.10 * s, y - 0.055 * s),
            (x + 1.25 * s, y - 0.032 * s),
            (x + 1.25 * s, y + 0.032 * s),
            (x + 0.10 * s, y + 0.055 * s),
        ],
        z_bottom=z - 0.095 * s,
        z_top=z - 0.028 * s,
        mat=frame_mat,
        top_inset=0.85,
    )
    core_strip = create_geo(
        f"{prefix}_AcceleratorCore",
        "cube",
        glow_mat,
        location=(x + 0.72 * s, y, z),
        scale=(1.05 * s, 0.038 * s, 0.038 * s),
        bevel=0.0,
    )
    return [shroud, upper_rail, lower_rail, core_strip]


def build_heavy_turret(
    prefix: str,
    location: tuple[float, float, float],
    scale_f: float,
    armor_mat: bpy.types.Material,
    frame_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
    barrels: int = 3,
) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    """
    Capital-grade multi-tiered battleship turret: serrated barbette ring, sloped twin-tier
    cheeks, dorsal optical rangefinder mast, heatsink jackets, and slotted muzzle brakes.
    Returns (turret_head_parts, recoil_barrel_parts).
    """
    x, y, z = location
    s = scale_f
    barbette = create_geo(
        f"{prefix}_Barbette", "cylinder", frame_mat,
        location=(x, y, z + 0.05 * s), vertices=12, radius=0.46 * s, depth=0.12 * s, bevel=0.0,
    )
    lower_hull = build_beveled_armor_plate(
        f"{prefix}_LowerHull",
        [
            (x - 0.42 * s, y - 0.28 * s),
            (x + 0.30 * s, y - 0.34 * s),
            (x + 0.44 * s, y),
            (x + 0.30 * s, y + 0.34 * s),
            (x - 0.42 * s, y + 0.28 * s),
        ],
        z_bottom=z + 0.09 * s, z_top=z + 0.32 * s, mat=armor_mat, top_inset=0.80,
    )
    upper_cap = build_beveled_armor_plate(
        f"{prefix}_UpperCrown",
        [
            (x - 0.34 * s, y - 0.20 * s),
            (x + 0.14 * s, y - 0.22 * s),
            (x + 0.24 * s, y),
            (x + 0.14 * s, y + 0.22 * s),
            (x - 0.34 * s, y + 0.20 * s),
        ],
        z_bottom=z + 0.31 * s, z_top=z + 0.44 * s, mat=frame_mat, top_inset=0.72,
    )
    visor = create_geo(
        f"{prefix}_RangefinderVisor", "cube", glow_mat,
        location=(x + 0.22 * s, y, z + 0.36 * s), scale=(0.08 * s, 0.26 * s, 0.055 * s), bevel=0.0,
    )
    head = [barbette, lower_hull, upper_cap, visor]

    offsets = [-0.17 * s, 0.0, 0.17 * s] if barrels >= 3 else [-0.13 * s, 0.13 * s]
    barrel_objs: list[bpy.types.Object] = []
    for idx, oy in enumerate(offsets):
        b_len = 1.08 * s if (barrels >= 3 and idx == 1) else 0.98 * s
        # Thermal barrel jacket
        barrel_objs.append(
            build_beveled_armor_plate(
                f"{prefix}_Jacket_{idx}",
                [
                    (x + 0.18 * s, y + oy - 0.052 * s),
                    (x + 0.58 * s, y + oy - 0.044 * s),
                    (x + 0.58 * s, y + oy + 0.044 * s),
                    (x + 0.18 * s, y + oy + 0.052 * s),
                ],
                z_bottom=z + 0.13 * s, z_top=z + 0.25 * s, mat=armor_mat, top_inset=0.84,
            )
        )
        # Main rifled gun barrel
        barrel_objs.append(
            build_beveled_armor_plate(
                f"{prefix}_Tube_{idx}",
                [
                    (x + 0.48 * s, y + oy - 0.032 * s),
                    (x + b_len,    y + oy - 0.024 * s),
                    (x + b_len,    y + oy + 0.024 * s),
                    (x + 0.48 * s, y + oy + 0.032 * s),
                ],
                z_bottom=z + 0.15 * s, z_top=z + 0.23 * s, mat=frame_mat, top_inset=0.86,
            )
        )
        # Glowing accelerator muzzle brake
        barrel_objs.append(
            create_geo(
                f"{prefix}_Muzzle_{idx}", "cube", glow_mat,
                location=(x + b_len + 0.02 * s, y + oy, z + 0.19 * s),
                scale=(0.06 * s, 0.045 * s, 0.045 * s), bevel=0.0,
            )
        )
    return head, barrel_objs


def build_louver_array(
    prefix: str,
    start_pos: tuple[float, float, float],
    end_pos: tuple[float, float, float],
    count: int,
    fin_w: float,
    fin_thick: float,
    fin_h: float,
    frame_mat: bpy.types.Material,
    glow_mat: bpy.types.Material | None = None,
    yaw_deg: float = 0.0,
) -> list[bpy.types.Object]:
    """Builds a crisp row of angled hull cooling louvers with an optional under-glow strip."""
    sx, sy, sz = start_pos
    ex, ey, ez = end_pos
    objs: list[bpy.types.Object] = []
    for i in range(count):
        t = i / max(1, count - 1)
        px = sx + (ex - sx) * t
        py = sy + (ey - sy) * t
        pz = sz + (ez - sz) * t
        objs.append(
            create_geo(
                f"{prefix}_Louver_{i}", "cube", frame_mat,
                location=(px, py, pz), rotation_deg=(0.0, -28.0, yaw_deg),
                scale=(fin_thick, fin_w, fin_h), bevel=0.0,
            )
        )
    if glow_mat is not None:
        mx, my, mz = (sx + ex) * 0.5, (sy + ey) * 0.5, (sz + ez) * 0.5 - fin_h * 0.18
        span_len = math.hypot(ex - sx, ey - sy)
        objs.append(
            create_geo(
                f"{prefix}_UnderGlow", "cube", glow_mat,
                location=(mx, my, mz), rotation_deg=(0.0, 0.0, yaw_deg),
                scale=(span_len * 0.92, fin_w * 0.62, fin_h * 0.45), bevel=0.0,
            )
        )
    return objs


def build_vls_missile_pod(
    prefix: str,
    location: tuple[float, float, float],
    rows: int,
    cols: int,
    cell_size: float,
    frame_mat: bpy.types.Material,
    cap_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Capital warship Vertical Launch System (VLS) missile silo deck with armored hatch grid."""
    x, y, z = location
    w_x = rows * cell_size * 1.25 + cell_size * 0.35
    w_y = cols * cell_size * 1.25 + cell_size * 0.35
    housing = build_beveled_armor_plate(
        f"{prefix}_Frame",
        [
            (x - w_x * 0.5, y - w_y * 0.5),
            (x + w_x * 0.5, y - w_y * 0.5),
            (x + w_x * 0.5, y + w_y * 0.5),
            (x - w_x * 0.5, y + w_y * 0.5),
        ],
        z_bottom=z - cell_size * 0.4, z_top=z + cell_size * 0.25, mat=frame_mat, top_inset=0.88,
    )
    objs = [housing]
    for r in range(rows):
        for c in range(cols):
            cx = x + (r - (rows - 1) * 0.5) * cell_size * 1.22
            cy = y + (c - (cols - 1) * 0.5) * cell_size * 1.22
            objs.append(
                create_geo(
                    f"{prefix}_Cell_{r}_{c}", "cube", cap_mat,
                    location=(cx, cy, z + cell_size * 0.32),
                    scale=(cell_size * 0.88, cell_size * 0.88, cell_size * 0.22), bevel=0.0,
                )
            )
    objs.append(
        create_geo(
            f"{prefix}_StatusBar", "cube", glow_mat,
            location=(x + w_x * 0.42, y, z + cell_size * 0.28),
            scale=(cell_size * 0.18, w_y * 0.72, cell_size * 0.14), bevel=0.0,
        )
    )
    return objs


def build_detail_rib_band(
    prefix: str,
    points_3d: list[tuple[float, float, float]],
    count: int,
    rib_w: float,
    rib_h: float,
    mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Places evenly spaced curved armor braces along a 3D hull spine curve."""
    vecs = [Vector(p) for p in points_3d]
    sampled = _eval_catmull_rom(vecs, samples_per_seg=max(2, count))
    objs: list[bpy.types.Object] = []
    for i in range(count):
        t = i / max(1, count - 1)
        idx = min(len(sampled) - 1, int(t * (len(sampled) - 1)))
        pos = sampled[idx]
        objs.append(
            create_geo(
                f"{prefix}_Rib_{i}", "cube", mat,
                location=(pos.x, pos.y, pos.z),
                scale=(rib_w * 0.45, rib_w, rib_h), bevel=0.0,
            )
        )
    return objs


def build_precision_ring_assembly(
    prefix: str,
    center: tuple[float, float, float],
    major_r: float,
    minor_r: float,
    segments: int,
    mat_frame: bpy.types.Material,
    mat_accent: bpy.types.Material,
    mat_glow: bpy.types.Material,
    clamp_count: int = 6,
    rot_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> list[bpy.types.Object]:
    """Engineered gimbal/accelerator halo with armored outer torus, inner plasma core, and stator clamps."""
    cx, cy, cz = center
    rot_eul = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    rot_mat = rot_eul.to_matrix()
    center_vec = Vector(center)
    maj_seg = max(20, min(32, segments))

    objs: list[bpy.types.Object] = []
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r,
        minor_radius=minor_r,
        major_segments=maj_seg,
        minor_segments=8,
        location=center,
        rotation=rot_eul,
    )
    outer_ring = bpy.context.active_object
    outer_ring.name = f"{prefix}_OuterFrame"
    objs.append(finalize_sculpted_mesh(outer_ring, mat_frame, subsurf_levels=0, bevel_width=0.0, auto_smooth_deg=38.0))

    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r * 0.93,
        minor_radius=minor_r * 0.50,
        major_segments=maj_seg,
        minor_segments=6,
        location=center,
        rotation=rot_eul,
    )
    inner_ring = bpy.context.active_object
    inner_ring.name = f"{prefix}_PlasmaTrack"
    objs.append(finalize_sculpted_mesh(inner_ring, mat_glow, subsurf_levels=0, bevel_width=0.0, auto_smooth_deg=48.0))

    for i in range(max(0, clamp_count)):
        ang = (i / clamp_count) * math.tau
        local_p = Vector((math.cos(ang) * major_r, math.sin(ang) * major_r, 0.0))
        wp = center_vec + rot_mat @ local_p
        clamp_rot = (rot_eul.to_matrix() @ Euler((0.0, 0.0, ang), "XYZ").to_matrix()).to_euler("XYZ")
        clamp_deg = tuple(math.degrees(v) for v in clamp_rot)
        objs.append(
            create_geo(
                f"{prefix}_Clamp_{i}",
                "cube",
                mat_accent,
                location=(wp.x, wp.y, wp.z),
                rotation_deg=clamp_deg,
                scale=(minor_r * 2.55, minor_r * 2.35, minor_r * 2.65),
                bevel=minor_r * 0.14,
                bevel_segments=1,
            )
        )
        pip_local = Vector((math.cos(ang) * (major_r + minor_r * 1.1), math.sin(ang) * (major_r + minor_r * 1.1), 0.0))
        pip_wp = center_vec + rot_mat @ pip_local
        objs.append(
            create_geo(
                f"{prefix}_ClampPip_{i}",
                "cube",
                mat_glow,
                location=(pip_wp.x, pip_wp.y, pip_wp.z),
                rotation_deg=clamp_deg,
                scale=(minor_r * 0.85, minor_r * 0.85, minor_r * 0.85),
                bevel=0.0,
            )
        )
    return objs


def build_hydraulic_strut(
    prefix: str,
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    radius: float,
    sleeve_mat: bpy.types.Material,
    piston_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Structural hydraulic actuator linking two 3D points so hinges and pods stay physically anchored."""
    v0 = Vector(p0)
    v1 = Vector(p1)
    delta = v1 - v0
    dist = delta.length
    if dist < 1e-4:
        return []
    direction = delta / dist
    rot_deg = tuple(math.degrees(v) for v in direction.to_track_quat("Z", "Y").to_euler("XYZ"))
    mid = (v0 + v1) * 0.5
    sleeve_pos = v0 + direction * (dist * 0.28)
    kn0 = v0 + direction * min(dist * 0.16, radius * 0.9)
    kn1 = v1 - direction * min(dist * 0.16, radius * 0.9)

    return [
        create_geo(
            f"{prefix}_Piston",
            "cylinder",
            piston_mat,
            location=(mid.x, mid.y, mid.z),
            rotation_deg=rot_deg,
            vertices=10,
            radius=radius * 0.85,
            depth=dist,
            bevel=0.0,
        ),
        create_geo(
            f"{prefix}_Sleeve",
            "cylinder",
            sleeve_mat,
            location=(sleeve_pos.x, sleeve_pos.y, sleeve_pos.z),
            rotation_deg=rot_deg,
            vertices=10,
            radius=radius * 1.42,
            depth=dist * 0.56,
            bevel=0.0,
        ),
        create_geo(
            f"{prefix}_KnuckleA",
            "cylinder",
            sleeve_mat,
            location=(kn0.x, kn0.y, kn0.z),
            rotation_deg=rot_deg,
            vertices=8,
            radius=radius * 1.72,
            depth=radius * 1.4,
            bevel=0.0,
        ),
        create_geo(
            f"{prefix}_KnuckleB",
            "cylinder",
            sleeve_mat,
            location=(kn1.x, kn1.y, kn1.z),
            rotation_deg=rot_deg,
            vertices=8,
            radius=radius * 1.72,
            depth=radius * 1.4,
            bevel=0.0,
        ),
    ]


def build_sensor_mast_array(
    prefix: str,
    base_pos: tuple[float, float, float],
    scale_f: float,
    frame_mat: bpy.types.Material,
    accent_mat: bpy.types.Material,
    glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Detailed warship telemetry radar mast with beveled plinth, twin sensor bar, dish & optic strip."""
    x, y, z = base_pos
    s = scale_f
    return [
        create_geo(
            f"{prefix}_Plinth", "cube", frame_mat,
            location=(x, y, z + 0.04 * s), scale=(0.24 * s, 0.20 * s, 0.08 * s), bevel=0.008 * s, bevel_segments=1,
        ),
        create_geo(
            f"{prefix}_Mast", "cube", accent_mat,
            location=(x - 0.02 * s, y, z + 0.22 * s), scale=(0.14 * s, 0.07 * s, 0.30 * s), bevel=0.005 * s, bevel_segments=1,
        ),
        create_geo(
            f"{prefix}_RadarBar", "cube", frame_mat,
            location=(x - 0.02 * s, y, z + 0.38 * s), scale=(0.06 * s, 0.44 * s, 0.055 * s), bevel=0.004 * s, bevel_segments=1,
        ),
        create_geo(
            f"{prefix}_Dish", "cylinder", accent_mat,
            location=(x + 0.06 * s, y, z + 0.31 * s), rotation_deg=(0.0, 68.0, 0.0),
            vertices=10, radius=0.11 * s, depth=0.04 * s, bevel=0.0,
        ),
        create_geo(
            f"{prefix}_Optic", "cube", glow_mat,
            location=(x + 0.07 * s, y, z + 0.24 * s), scale=(0.04 * s, 0.14 * s, 0.045 * s), bevel=0.0,
        ),
    ]


def build_precision_cockpit_canopy(
    prefix: str,
    stations: list[tuple[float, list[tuple[float, float]]]],
    glass_mat: bpy.types.Material,
    frame_mat: bpy.types.Material,
    hud_glow_mat: bpy.types.Material,
) -> list[bpy.types.Object]:
    """Sculpted fighter/cruiser canopy with dark smoked glass, roll-cage arch braces & interior HUD glow."""
    glass = build_lofted_hull(
        f"{prefix}_Glass", stations, glass_mat, crease_indices={2, 7}, subsurf=1,
    )
    # Build perimeter brow directly around first & last station bounds
    xs = [st[0] for st in stations]
    mid_idx = max(0, min(len(stations) - 1, len(stations) // 2))
    mid_x, mid_prof = stations[mid_idx]
    max_y = max(abs(p[0]) for p in mid_prof)
    max_z = max(p[1] for p in mid_prof)
    min_z = min(p[1] for p in mid_prof)
    brow = build_beveled_armor_plate(
        f"{prefix}_BrowFrame",
        [
            (xs[0] - 0.04, -max_y * 0.96),
            (xs[-1] * 0.85, -max_y * 0.68),
            (xs[-1] + 0.05, 0.0),
            (xs[-1] * 0.85, max_y * 0.68),
            (xs[0] - 0.04, max_y * 0.96),
        ],
        z_bottom=min_z - 0.02,
        z_top=min_z + (max_z - min_z) * 0.34,
        mat=frame_mat,
        top_inset=0.84,
        bevel=0.008,
        bevel_segments=1,
    )
    arch_a = build_curved_blade(
        f"{prefix}_ArchA",
        [(mid_x - 0.06, -max_y * 0.82, min_z + 0.02), (mid_x, 0.0, max_z + 0.025), (mid_x - 0.06, max_y * 0.82, min_z + 0.02)],
        widths=[0.055, 0.065, 0.055],
        thicknesses=[0.032, 0.038, 0.032],
        mat=frame_mat,
        up_hint=(1.0, 0.0, 0.0),
        samples_per_seg=2,
    )
    arch_b = build_curved_blade(
        f"{prefix}_ArchB",
        [(xs[-1] * 0.62, -max_y * 0.56, min_z + 0.02), (xs[-1] * 0.66, 0.0, max_z * 0.86 + min_z * 0.14), (xs[-1] * 0.62, max_y * 0.56, min_z + 0.02)],
        widths=[0.045, 0.052, 0.045],
        thicknesses=[0.028, 0.032, 0.028],
        mat=frame_mat,
        up_hint=(1.0, 0.0, 0.0),
        samples_per_seg=2,
    )
    hud = create_geo(
        f"{prefix}_HUDGlow", "cube", hud_glow_mat,
        location=((mid_x + xs[-1]) * 0.52, 0.0, min_z + (max_z - min_z) * 0.36),
        scale=((xs[-1] - xs[0]) * 0.24, max_y * 0.72, (max_z - min_z) * 0.16),
        bevel=0.0,
    )
    return [glass, brow, arch_a, arch_b, hud]


def build_armor_greeble_strip(
    prefix: str,
    start_pos: tuple[float, float, float],
    end_pos: tuple[float, float, float],
    count: int,
    tile_size: tuple[float, float, float],
    mat: bpy.types.Material,
    accent_mat: bpy.types.Material | None = None,
    rot_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> list[bpy.types.Object]:
    """Distributes chamfered armor tiles & panel stiffener ribs across wings and hulls."""
    sx, sy, sz = start_pos
    ex, ey, ez = end_pos
    tx, ty, tz = tile_size
    bev = min(tx, ty, tz) * 0.12
    objs: list[bpy.types.Object] = []
    for i in range(count):
        t = i / max(1, count - 1)
        px = sx + (ex - sx) * t
        py = sy + (ey - sy) * t
        pz = sz + (ez - sz) * t
        use_mat = accent_mat if (accent_mat is not None and i % 2 == 1) else mat
        objs.append(
            create_geo(
                f"{prefix}_Tile_{i}",
                "cube",
                use_mat,
                location=(px, py, pz),
                rotation_deg=rot_deg,
                scale=(tx, ty, tz),
                bevel=bev,
                bevel_segments=1,
            )
        )
    return objs


# BVH Ambient Occlusion & Edge-Wear Vertex Color Baker (exports to COLOR_0)
def _fibonacci_hemisphere_dirs(samples: int) -> list[Vector]:
    dirs: list[Vector] = []
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(samples):
        y = 1.0 - (i + 0.5) / samples
        r = math.sqrt(max(0.0, 1.0 - y * y))
        theta = golden_angle * i
        # Hemisphere z >= 0.08 in local tangent frame
        dirs.append(Vector((math.cos(theta) * r, math.sin(theta) * r, max(0.08, y))).normalized())
    return dirs


def _bake_ao_subset(
    occluders: list[bpy.types.Object],
    targets: list[bpy.types.Object],
    ao_samples: int = 12,
    ao_radius: float = 1.0,
    min_ao: float = 0.34,
    base_ao: float = 0.88,
    edge_boost: float = 0.12,
) -> None:
    if not targets:
        return
    occluder_verts: list[Vector] = []
    occluder_polys: list[tuple[int, ...]] = []
    v_offset = 0

    for obj in occluders:
        if obj.type != "MESH" or not obj.data:
            continue
        mw = obj.matrix_world
        mesh = obj.data
        mesh.calc_loop_triangles()
        for v in mesh.vertices:
            occluder_verts.append(mw @ v.co)
        for tri in mesh.loop_triangles:
            occluder_polys.append(
                (v_offset + tri.vertices[0], v_offset + tri.vertices[1], v_offset + tri.vertices[2])
            )
        v_offset += len(mesh.vertices)

    if not occluder_verts or not occluder_polys:
        return

    bvh = BVHTree.FromPolygons(occluder_verts, occluder_polys, all_triangles=True)
    hemi = _fibonacci_hemisphere_dirs(ao_samples)
    self_eps = max(0.015, ao_radius * 0.016)

    for obj in targets:
        if obj.type != "MESH" or not obj.data:
            continue
        mesh = obj.data
        is_emissive = bool(mesh.materials and mesh.materials[0].get("is_emissive_part", False))

        while mesh.color_attributes:
            mesh.color_attributes.remove(mesh.color_attributes[0])
        col_attr = mesh.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")

        if is_emissive:
            n_loops = len(mesh.loops)
            col_attr.data.foreach_set("color", [1.0, 1.0, 1.0, 1.0] * n_loops)
            continue

        mw = obj.matrix_world
        rot_m = mw.to_3x3().normalized()

        adj_normals: list[list[Vector]] = [[] for _ in range(len(mesh.vertices))]
        for e in mesh.edges:
            v0, v1 = e.vertices[0], e.vertices[1]
            adj_normals[v0].append(mesh.vertices[v1].normal)
            adj_normals[v1].append(mesh.vertices[v0].normal)

        vert_factors = [1.0] * len(mesh.vertices)
        for vi, v in enumerate(mesh.vertices):
            wp = mw @ v.co
            wn = (rot_m @ v.normal).normalized()
            if wn.length < 1e-4:
                wn = Vector((0.0, 0.0, 1.0))

            ref = Vector((0.0, 0.0, 1.0)) if abs(wn.z) < 0.92 else Vector((1.0, 0.0, 0.0))
            tx = wn.cross(ref).normalized()
            ty = wn.cross(tx).normalized()

            occ = 0.0
            origin = wp + wn * self_eps
            for d in hemi:
                wdir = tx * d.x + ty * d.y + wn * d.z
                hit_loc, _hit_n, _hit_idx, hit_dist = bvh.ray_cast(origin, wdir, ao_radius)
                if hit_loc is not None and hit_dist is not None and hit_dist > self_eps * 0.5:
                    falloff = 1.0 - min(1.0, hit_dist / ao_radius)
                    occ += falloff

            ao_weight = base_ao - (occ / ao_samples) * (base_ao - min_ao) * 1.55

            neigh = adj_normals[vi]
            if neigh:
                avg_dot = sum(max(-1.0, min(1.0, v.normal.dot(nn))) for nn in neigh) / len(neigh)
                if avg_dot < 0.88:
                    ao_weight += min(edge_boost, (0.88 - avg_dot) * edge_boost * 1.8)

            vert_factors[vi] = max(min_ao, min(1.0, ao_weight))

        loop_colors = []
        for loop in mesh.loops:
            f = vert_factors[loop.vertex_index]
            loop_colors.extend((f, f, f, 1.0))
        col_attr.data.foreach_set("color", loop_colors)


def bake_model_vertex_ao(
    mesh_objs: list[bpy.types.Object],
    ao_samples: int = 16,
    ao_radius: float = 1.25,
    min_ao: float = 0.34,
    base_ao: float = 0.88,
    edge_boost: float = 0.12,
) -> None:
    """
    Computes fast raytraced Ambient Occlusion + Convex Edge Wear across all armor/frame
    parts of a model in Rest Pose using mathutils.bvhtree.BVHTree, writing linear RGB
    occlusion weights into mesh color attribute 'Col' (CORNER domain) for glTF COLOR_0.
    """
    bpy.context.view_layer.update()
    _bake_ao_subset(
        mesh_objs, mesh_objs,
        ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
    )


def bake_staged_vertex_ao(
    all_meshes: list[bpy.types.Object],
    ao_samples: int = 12,
    ao_radius: float = 1.0,
    min_ao: float = 0.34,
    base_ao: float = 0.88,
    edge_boost: float = 0.12,
) -> None:
    """
    Stage-isolated BVH Ambient Occlusion baker so hidden Form1Only/Form2Only/Form3 shells
    never cast black ghost shadows onto parts visible in other transformation stages.
    """
    bpy.context.view_layer.update()
    f1_only: list[bpy.types.Object] = []
    f12: list[bpy.types.Object] = []
    f2_only: list[bpy.types.Object] = []
    f2: list[bpy.types.Object] = []
    f3: list[bpy.types.Object] = []
    base: list[bpy.types.Object] = []

    for o in all_meshes:
        if o.type != "MESH" or not o.data:
            continue
        name = o.name
        if "Form1Only_" in name:
            f1_only.append(o)
        elif "Form12_" in name:
            f12.append(o)
        elif "Form2Only_" in name:
            f2_only.append(o)
        elif "Form2_" in name:
            f2.append(o)
        elif "Form3_" in name:
            f3.append(o)
        else:
            base.append(o)

    # Pass 1: Stage 1 (base + Form1Only_ + Form12_)
    s1 = base + f1_only + f12
    _bake_ao_subset(s1, s1, ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost)

    # Pass 2: Stage 2 hardware (occluded by base + Form12_ + Form2Only_ + Form2_)
    t2 = f2_only + f2
    if t2:
        _bake_ao_subset(
            base + f12 + t2, t2,
            ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
        )

    # Pass 3: Stage 3 Apex hardware (occluded by base + Form2_ + Form3_)
    if f3:
        _bake_ao_subset(
            base + f2 + f3, f3,
            ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
        )


def bake_modular_vertex_ao(
    all_meshes: list[bpy.types.Object],
    isolated_groups: list[list[bpy.types.Object]],
    base_meshes: list[bpy.types.Object] | None = None,
    ao_samples: int = 10,
    ao_radius: float = 0.80,
    min_ao: float = 0.34,
    base_ao: float = 0.88,
    edge_boost: float = 0.12,
) -> None:
    """
    Isolated BVH Vertex AO baker for mutually exclusive modular ship & weapon sections
    so hidden Stock/Core/Slot variants never cast black ghost shadows onto adjacent parts.
    """
    bpy.context.view_layer.update()
    iso_set = {o for grp in isolated_groups for o in grp if o.type == "MESH" and o.data}
    if base_meshes is None:
        base = [o for o in all_meshes if o.type == "MESH" and o.data and o not in iso_set]
    else:
        base = [o for o in base_meshes if o.type == "MESH" and o.data]

    if base:
        _bake_ao_subset(
            base, base,
            ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
        )
    baked = set(base)
    for grp in isolated_groups:
        targets = [o for o in grp if o.type == "MESH" and o.data]
        if not targets:
            continue
        _bake_ao_subset(
            base + targets, targets,
            ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
        )
        baked.update(targets)

    leftovers = [o for o in all_meshes if o.type == "MESH" and o.data and o not in baked]
    if leftovers:
        _bake_ao_subset(
            base + leftovers, leftovers,
            ao_samples=ao_samples, ao_radius=ao_radius, min_ao=min_ao, base_ao=base_ao, edge_boost=edge_boost,
        )


# World-Aligned Rigging, Parenting & GLTF 2.0 Export
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
        export_vertex_color="MATERIAL",
        export_draco_mesh_compression_enable=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips_merged_animation_name="Idle",
        export_force_sampling=True,
        export_image_format="AUTO",
    )
    print(f"[EXPORTED v4] {out_path.name} ({out_path.stat().st_size:,} bytes)")
    return out_path
