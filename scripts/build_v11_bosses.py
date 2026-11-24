"""
Heavy Capital Bosses Builder (Leviathan, Gemini, Bastion).
Sculpts, bakes staged BVH AO, rigs 9 NLA clips, and exports GLB 2.0 assets:
  1. boss_leviathan.glb - Boss 3: Leviathan Hydra (Viper -> Cobra -> Elder Wyrm)
  2. boss_gemini.glb    - Boss 4: Gemini Twin Cores (Delta Jet -> X-Valkyrie -> Star Astrolabe)
  3. boss_bastion.glb   - Boss 5: Bastion Colossus (Bunker -> Citadel -> Supernova)

Run headless in Blender 4.2+:
  blender --background --python scripts/build_v11_bosses.py
"""

from __future__ import annotations

import json
import math
import struct
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_sculpt_lib as lib  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

PREVIEW_DIR = Path(__file__).resolve().parent.parent / "previews"


def _mirror_y_points(
    pts: list[tuple[float, float, float]], sign: int
) -> list[tuple[float, float, float]]:
    return [(x, y * sign, z) for x, y, z in pts]


def _mirror_y_poly(poly: list[tuple[float, float]], sign: int) -> list[tuple[float, float]]:
    res = [(px, py * sign) for px, py in poly]
    return list(reversed(res)) if sign < 0 else res


def _mirror_y_wing_stations(
    stations: list[tuple[float, float, float, float, float]], sign: int
) -> list[tuple[float, float, float, float, float]]:
    return [(y * sign, xf, xb, zc, th) for y, xf, xb, zc, th in stations]


def inspect_glb(glb_path: Path) -> None:
    data = glb_path.read_bytes()
    magic, version, _total_len = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2, f"Invalid GLB header in {glb_path}"
    chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
    assert chunk_type == 0x4E4F534A
    gltf_json = json.loads(data[20 : 20 + chunk_len].decode("utf-8"))
    anims = [a.get("name", "<unnamed>") for a in gltf_json.get("animations", [])]
    nodes = [n.get("name", "") for n in gltf_json.get("nodes", [])]
    meshes = gltf_json.get("meshes", [])
    has_color0 = any(
        "COLOR_0" in prim.get("attributes", {})
        for m in meshes
        for prim in m.get("primitives", [])
    )
    has_core = any("ReactorCore" in n for n in nodes)
    assert glb_path.stat().st_size < 1_500_000, f"{glb_path.name} exceeds 1.5MB!"
    print(
        f"[GLB v13 OK] {glb_path.name} ({glb_path.stat().st_size:,} B): "
        f"{len(meshes)} meshes, AO={has_color0}, Core={has_core}, anims={anims}"
    )


# Boss 3: Leviathan Hydra (Viper -> Cobra Hydra -> Elder Abyssal Wyrm)
def build_boss_leviathan() -> Path:
    lib.reset_scene()
    jade = lib.make_material("LeviathanEmeraldArmor", (0.04, 0.34, 0.28), metallic=0.46, roughness=0.20)
    obsidian = lib.make_material("LeviathanObsidianScale", (0.05, 0.08, 0.09), metallic=0.66, roughness=0.28, brushed=True)
    titanium = lib.make_material("LeviathanBioTitanium", (0.50, 0.64, 0.62), metallic=0.84, roughness=0.24, brushed=True)
    venom = lib.make_material(
        "LeviathanVenomGlow", (0.12, 1.0, 0.68), metallic=0.0, roughness=0.10,
        emission_color=(0.06, 0.96, 0.62), emission_strength=4.4, use_ao_vc=False,
    )
    amber = lib.make_material(
        "LeviathanFangAmber", (1.0, 0.72, 0.14), metallic=0.0, roughness=0.12,
        emission_color=(1.0, 0.56, 0.06), emission_strength=3.8, use_ao_vc=False,
    )

    # --- SHARED CORE ARCHITECTURE ---
    cranium = lib.build_lofted_hull(
        "Leviathan_CraniumHull",
        [
            (-1.26, lib.jet_profile(0.44, 0.24, -0.20, deck_w=0.40)),
            (-0.56, lib.jet_profile(0.62, 0.32, -0.24, deck_w=0.46)),
            (0.28,  lib.jet_profile(0.50, 0.28, -0.22, deck_w=0.44)),
            (0.98,  lib.jet_profile(0.28, 0.17, -0.14, deck_w=0.38)),
            (1.38,  lib.jet_profile(0.08, 0.06, -0.05, deck_w=0.28)),
        ],
        obsidian, crease_indices={2, 7}, subsurf=1,
    )
    crest_plate = lib.build_beveled_armor_plate(
        "Leviathan_DorsalCrest",
        [(-0.96, -0.26), (0.30, -0.28), (0.98, 0.0), (0.30, 0.28), (-0.96, 0.26)],
        z_bottom=0.24, z_top=0.38, mat=jade, top_inset=0.78, bevel=0.012, bevel_segments=1,
    )
    crown_ridge = lib.build_beveled_armor_plate(
        "Leviathan_CrownRidge",
        [(-0.78, -0.12), (0.48, -0.10), (0.90, 0.0), (0.48, 0.10), (-0.78, 0.12)],
        z_bottom=0.37, z_top=0.48, mat=titanium, top_inset=0.72,
    )
    belly_keel = lib.build_beveled_armor_plate(
        "Leviathan_BellyKeel",
        [(-1.02, -0.24), (0.72, -0.16), (1.06, 0.0), (0.72, 0.16), (-1.02, 0.24)],
        z_bottom=-0.28, z_top=-0.16, mat=titanium, top_inset=0.80,
    )
    reactor_core = lib.create_geo(
        "Leviathan_ReactorCore", "sphere", venom,
        location=(0.56, 0.0, 0.10), scale=(0.36, 0.34, 0.32), segments=18, rings=12, bevel=0.0,
    )
    body = [cranium, crest_plate, crown_ridge, belly_keel, reactor_core]
    body.extend(lib.build_sensor_mast_array("Leviathan_DorsalSensor", (-0.64, 0.0, 0.46), 0.72, obsidian, titanium, venom))
    body.extend(lib.build_louver_array("Leviathan_DorsalVentL", (-0.72, 0.18, 0.36), (-0.05, 0.18, 0.34), 6, 0.11, 0.04, 0.07, obsidian, venom, yaw_deg=12.0))
    body.extend(lib.build_louver_array("Leviathan_DorsalVentR", (-0.72, -0.18, 0.36), (-0.05, -0.18, 0.34), 6, 0.11, 0.04, 0.07, obsidian, venom, yaw_deg=-12.0))

    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        for ei, (ex, ey, ez) in enumerate(((0.86, 0.22, 0.24), (0.64, 0.28, 0.27), (0.42, 0.32, 0.29))):
            body.append(
                lib.create_geo(
                    f"Leviathan_Optic_{side}_{ei}", "cube", amber,
                    location=(ex, ey * sign, ez), rotation_deg=(0, 8, -22 * sign),
                    scale=(0.14, 0.055, 0.055), bevel=0.0,
                )
            )
        shroud, petals = lib.build_vector_nozzle(
            f"Leviathan_Thruster_{side}", (-1.24, 0.26 * sign, 0.0),
            radius=0.15, length=0.38, shroud_mat=obsidian, frame_mat=titanium, glow_mat=venom, petals=6,
        )
        body.extend([*shroud, *petals])

    # Articulated inner venom fangs (always present; Form 3 adds hyper-extended blades onto same bones!)
    fang_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, fkey in ((1, "Fang_L"), (-1, "Fang_R")):
        fang_blade = lib.build_curved_blade(
            f"Leviathan_{fkey}_Mandible",
            _mirror_y_points([(0.54, 0.30, 0.02), (1.04, 0.42, 0.0), (1.52, 0.18, -0.02)], sign),
            widths=[0.18, 0.13, 0.02], thicknesses=[0.10, 0.07, 0.015], mat=titanium,
        )
        fang_glow = lib.build_curved_blade(
            f"Leviathan_{fkey}_VenomEdge",
            _mirror_y_points([(0.62, 0.25, 0.03), (1.06, 0.35, 0.01), (1.46, 0.16, -0.01)], sign),
            widths=[0.065, 0.05, 0.012], thicknesses=[0.04, 0.03, 0.01], mat=venom,
        )
        jaw_piston = lib.build_hydraulic_strut(
            f"Leviathan_{fkey}_Piston", (0.28, 0.28 * sign, -0.04), (0.72, 0.36 * sign, 0.0), 0.032, obsidian, titanium
        )
        apex_shear = lib.build_curved_blade(
            f"Form3_Leviathan_{fkey}_ApexShear",
            _mirror_y_points([(0.95, 0.42, 0.04), (1.62, 0.62, 0.06), (2.28, 0.18, 0.0)], sign),
            widths=[0.22, 0.16, 0.02], thicknesses=[0.09, 0.06, 0.015], mat=amber, samples_per_seg=2,
        )
        fang_parts[fkey] = [fang_blade, fang_glow, *jaw_piston, apex_shear]

    # --- FORM I ONLY: SEALED TORPEDO VIPER SHELL (width ~1.18) ---
    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        body.append(
            lib.build_beveled_armor_plate(
                f"Form1Only_Leviathan_ViperShroud_{side}",
                _mirror_y_poly([(-0.98, 0.34), (0.56, 0.28), (0.86, 0.44), (0.22, 0.58), (-1.04, 0.54)], sign),
                z_bottom=-0.10, z_top=0.22, mat=jade, top_inset=0.80, bevel=0.012, bevel_segments=1,
            )
        )
        body.append(
            lib.build_airfoil_wing(
                f"Form1Only_Leviathan_FoldedFin_{side}",
                _mirror_y_wing_stations([(0.52, 0.12, -0.96, 0.0, 0.08), (0.84, -0.28, -1.16, 0.04, 0.035)], sign),
                mat=obsidian, bevel=0.008, bevel_segments=1,
            )
        )
        body.append(
            lib.build_beveled_armor_plate(
                f"Form12_Leviathan_CheekCarapace_{side}",
                _mirror_y_poly([(-0.68, 0.40), (0.28, 0.38), (0.44, 0.66), (-0.72, 0.62)], sign),
                z_bottom=0.08, z_top=0.24, mat=jade, top_inset=0.82,
            )
        )
    body.append(
        lib.build_beveled_armor_plate(
            "Form1Only_Leviathan_SnoutShield",
            [(0.18, -0.24), (1.16, -0.14), (1.36, 0.0), (1.16, 0.14), (0.18, 0.24)],
            z_bottom=0.28, z_top=0.52, mat=obsidian, top_inset=0.76, bevel=0.012, bevel_segments=1,
        )
    )

    # --- FORM II: HUGE COBRA HOOD FRILLS + FLANKING HYDRA SUB-HEAD PODS (width ~2.55) ---
    hood_parts: dict[str, list[bpy.types.Object]] = {}
    form2_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, hkey, pkey in ((1, "Hood_L", "Form2_HydraPod_L"), (-1, "Hood_R", "Form2_HydraPod_R")):
        side = "L" if sign > 0 else "R"
        cobra_frill = lib.build_beveled_armor_plate(
            f"Form2Only_Leviathan_{hkey}_CobraFrill",
            _mirror_y_poly([(-0.98, 0.42), (0.48, 0.44), (0.68, 1.32), (-0.34, 1.56), (-1.22, 1.08)], sign),
            z_bottom=0.02, z_top=0.24, mat=jade, top_inset=0.80, bevel=0.015, bevel_segments=1,
        )
        cobra_rim = lib.build_curved_blade(
            f"Form2Only_Leviathan_{hkey}_RimBlade",
            _mirror_y_points([(0.44, 0.72, 0.18), (-0.08, 1.56, 0.24), (-1.18, 1.24, 0.10)], sign),
            widths=[0.18, 0.24, 0.04], thicknesses=[0.08, 0.06, 0.02], mat=venom, samples_per_seg=2,
        )
        cobra_chevrons = lib.build_armor_greeble_strip(
            f"Form2Only_Leviathan_{hkey}_Ribs",
            (0.18, 0.68 * sign, 0.26), (-0.72, 1.18 * sign, 0.22),
            count=4, tile_size=(0.14, 0.34, 0.05), mat=obsidian, accent_mat=amber, rot_deg=(0, 0, -24 * sign),
        )
        hood_strut = lib.build_hydraulic_strut(
            f"Form2Only_Leviathan_{hkey}_Strut", (-0.18, 0.46 * sign, 0.06), (-0.18, 1.04 * sign, 0.08), 0.045, obsidian, titanium
        )
        hood_parts[hkey] = [cobra_frill, cobra_rim, *cobra_chevrons, *hood_strut]

        # Twin flanking autonomous Hydra Sub-Head Pods
        pod_hull = lib.build_lofted_hull(
            f"Form2_Leviathan_{pkey}_Head",
            [
                (-0.18, lib.jet_profile(0.24, 0.14, -0.12, deck_w=0.42)),
                (0.42,  lib.jet_profile(0.30, 0.17, -0.14, deck_w=0.44)),
                (1.06,  lib.jet_profile(0.19, 0.11, -0.09, deck_w=0.38)),
                (1.42,  lib.jet_profile(0.06, 0.05, -0.04, deck_w=0.28)),
            ],
            jade, crease_indices={2, 7}, subsurf=1, location=(0.12, 1.38 * sign, 0.14),
        )
        pod_jaw = lib.build_beveled_armor_plate(
            f"Form2_Leviathan_{pkey}_Crest",
            _mirror_y_poly([(0.06, 1.18), (0.98, 1.24), (1.34, 1.38), (0.98, 1.54), (0.06, 1.56)], sign),
            z_bottom=0.24, z_top=0.34, mat=obsidian, top_inset=0.76,
        )
        pod_eyes = lib.create_geo(
            f"Form2_Leviathan_{pkey}_Optic", "cube", amber,
            location=(0.94, 1.38 * sign, 0.30), scale=(0.24, 0.14, 0.05), bevel=0.0,
        )
        pod_canon = lib.build_railgun_assembly(
            f"Form2_Leviathan_{pkey}_Cannon", (0.56, 1.38 * sign, 0.06), 0.62, obsidian, titanium, venom
        )
        pylon_strut = lib.build_hydraulic_strut(
            f"Form2_Leviathan_{pkey}_Boom", (0.14, 0.56 * sign, 0.10), (0.42, 1.24 * sign, 0.14), 0.055, obsidian, titanium
        )
        form2_parts[pkey] = [pod_hull, pod_jaw, pod_eyes, *pod_canon, *pylon_strut]

    # --- FORM III: ELDER ABYSSAL DRAGON WINGS + ANTLER CROWN (span ±2.58!) ---
    form3_parts: dict[str, list[bpy.types.Object]] = {}
    crown_objs: list[bpy.types.Object] = []
    for ci, (cx, cy_off, cz, tx, ty) in enumerate((
        (0.28, 0.0, 0.48, -0.45, 0.0),
        (0.14, 0.24, 0.44, -0.35, 0.52),
        (0.14, -0.24, 0.44, -0.35, -0.52),
        (-0.18, 0.34, 0.40, -0.68, 0.88),
        (-0.18, -0.34, 0.40, -0.68, -0.88),
    )):
        horn = lib.build_curved_blade(
            f"Form3_Leviathan_CrownHorn_{ci}",
            [(cx, cy_off, cz), (cx + tx * 0.55, ty * 0.55, cz + 0.36), (cx + tx, ty, cz + 0.62)],
            widths=[0.16, 0.11, 0.018], thicknesses=[0.08, 0.05, 0.012],
            mat=titanium if ci % 2 == 1 else amber, samples_per_seg=2,
        )
        crown_objs.append(horn)
    # Exposed glowing rib-heart dorsal reactor stack in Form III
    for ri, rx in enumerate((-0.46, -0.18, 0.10)):
        crown_objs.append(
            lib.create_geo(
                f"Form3_Leviathan_HeartVent_{ri}", "cube", amber,
                location=(rx, 0.0, 0.48), scale=(0.14, 0.34, 0.09), bevel=0.0,
            )
        )
    form3_parts["Form3_DragonCrown"] = crown_objs

    for sign, wkey in ((1, "Form3_DragonWing_L"), (-1, "Form3_DragonWing_R")):
        wing_mem = lib.build_airfoil_wing(
            f"Form3_Leviathan_{wkey}_Membrane",
            _mirror_y_wing_stations([
                (0.56, 0.55, -0.95, 0.16, 0.12),
                (1.48, 0.32, -1.35, 0.36, 0.08),
                (2.58, -0.22, -1.78, 0.56, 0.04),
            ], sign),
            mat=jade, camber=0.10, bevel=0.012, bevel_segments=1,
        )
        wing_lead = lib.build_curved_blade(
            f"Form3_Leviathan_{wkey}_BoneSpar",
            _mirror_y_points([(0.34, 0.54, 0.18), (0.64, 1.48, 0.42), (-0.18, 2.66, 0.62)], sign),
            widths=[0.22, 0.17, 0.03], thicknesses=[0.14, 0.10, 0.025], mat=titanium, samples_per_seg=2,
        )
        wing_ribs = lib.build_armor_greeble_strip(
            f"Form3_Leviathan_{wkey}_PanelRibs",
            (0.08, 0.92 * sign, 0.28), (-0.48, 2.15 * sign, 0.48),
            count=4, tile_size=(0.16, 0.36, 0.06), mat=obsidian, accent_mat=venom, rot_deg=(0, 0, -28 * sign),
        )
        finger_1 = lib.build_curved_blade(
            f"Form3_Leviathan_{wkey}_FingerA",
            _mirror_y_points([(0.32, 1.32, 0.36), (-0.38, 1.98, 0.40), (-1.42, 2.38, 0.24)], sign),
            widths=[0.14, 0.10, 0.02], thicknesses=[0.06, 0.04, 0.012], mat=venom, samples_per_seg=2,
        )
        finger_2 = lib.build_curved_blade(
            f"Form3_Leviathan_{wkey}_FingerB",
            _mirror_y_points([(0.05, 1.05, 0.28), (-0.68, 1.48, 0.26), (-1.52, 1.72, 0.14)], sign),
            widths=[0.12, 0.09, 0.02], thicknesses=[0.05, 0.04, 0.012], mat=amber, samples_per_seg=2,
        )
        wing_piston = lib.build_hydraulic_strut(
            f"Form3_Leviathan_{wkey}_Piston", (-0.12, 0.48 * sign, 0.22), (0.18, 1.24 * sign, 0.34), 0.05, obsidian, titanium
        )
        form3_parts[wkey] = [wing_mem, wing_lead, *wing_ribs, finger_1, finger_2, *wing_piston]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "LeviathanRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "Hood_L": ((-0.15, 0.46, 0.14), (-0.15, 0.96, 0.14), "Root"),
            "Hood_R": ((-0.15, -0.46, 0.14), (-0.15, 0.04, 0.14), "Root"),
            "Fang_L": ((0.64, 0.32, 0.02), (0.64, 0.82, 0.02), "Root"),
            "Fang_R": ((0.64, -0.32, 0.02), (0.64, 0.18, 0.02), "Root"),
            "Form2_HydraPod_L": ((0.35, 1.32, 0.14), (0.35, 1.82, 0.14), "Root"),
            "Form2_HydraPod_R": ((0.35, -1.32, 0.14), (0.35, -0.82, 0.14), "Root"),
            "Form3_DragonCrown": ((0.0, 0.0, 0.48), (0.0, 0.50, 0.48), "Root"),
            "Form3_DragonWing_L": ((0.22, 0.58, 0.22), (0.22, 1.08, 0.22), "Root"),
            "Form3_DragonWing_R": ((0.22, -0.58, 0.22), (0.22, -0.08, 0.22), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    for mp in (hood_parts, fang_parts, form2_parts, form3_parts):
        for k, objs in mp.items():
            lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, sway, fang in [(1, 0.0, 0.0), (24, 5.0, 7.0), (48, 0.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.03 if f == 24 else 0.0))
        lib.key_bone(rig, "Hood_L", f, rot_deg=(0, 0, -sway))
        lib.key_bone(rig, "Hood_R", f, rot_deg=(0, 0, sway))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, fang))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -fang))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, flare, fang in [(1, 0.0, 0.0), (14, 22.0, 24.0), (28, 28.0, 30.0)]:
        lib.key_bone(rig, "Hood_L", f, rot_deg=(0, 0, flare))
        lib.key_bone(rig, "Hood_R", f, rot_deg=(0, 0, -flare))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, fang))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -fang))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, fang, lunge in [(1, 22.0, 0.0), (10, -10.0, 0.16), (20, 22.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(lunge, 0, 0))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, fang))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -fang))
        lib.key_bone(rig, "Form2_HydraPod_L", f, loc=(lunge * 1.4, 0, 0))
        lib.key_bone(rig, "Form2_HydraPod_R", f, loc=(lunge * 1.4, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, spread, z_up in [(1, 0.0, 0.0), (14, 32.0, 0.24), (28, 20.0, 0.06)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Hood_L", f, rot_deg=(12.0, 0, spread))
        lib.key_bone(rig, "Hood_R", f, rot_deg=(-12.0, 0, -spread))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, spread * 0.7))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -spread * 0.7))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, z_dn in [(1, -0.14), (24, -0.18), (48, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, 26))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -26))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, z_up, hd, s2, px in [
        (1, 0.0, 0.0, 0.01, -0.45),
        (14, 0.24, 24.0, 0.65, 0.08),
        (28, 0.14, 18.0, 1.18, 0.16),
        (42, 0.04, 14.0, 1.00, 0.04),
    ]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Hood_L", f, rot_deg=(10.0, 0, hd), scale=(s2, s2, s2))
        lib.key_bone(rig, "Hood_R", f, rot_deg=(-10.0, 0, -hd), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_HydraPod_L", f, loc=(px, 0.08, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_HydraPod_R", f, loc=(px, -0.08, 0), scale=(s2, s2, s2))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, hd, yaw in [(1, 12.0, -4.0), (24, 20.0, 6.0), (48, 12.0, -4.0)]:
        lib.key_bone(rig, "Hood_L", f, rot_deg=(10.0, 0, hd))
        lib.key_bone(rig, "Hood_R", f, rot_deg=(-10.0, 0, -hd))
        lib.key_bone(rig, "Form2_HydraPod_L", f, rot_deg=(0, 0, yaw))
        lib.key_bone(rig, "Form2_HydraPod_R", f, rot_deg=(0, 0, -yaw))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, 16.0))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -16.0))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, fwd, z_up, s3, flap in [
        (1, -0.06, 0.04, 0.01, -24.0),
        (16, 0.18, 0.30, 0.65, 22.0),
        (32, 0.08, 0.18, 1.22, 6.0),
        (48, 0.00, 0.06, 1.00, 0.0),
    ]:
        lib.key_bone(rig, "Root", f, loc=(fwd, 0, z_up))
        lib.key_bone(rig, "Form2_HydraPod_L", f, loc=(0.12, 0.14, -0.04), rot_deg=(0, 0, 8.0))
        lib.key_bone(rig, "Form2_HydraPod_R", f, loc=(0.12, -0.14, -0.04), rot_deg=(0, 0, -8.0))
        lib.key_bone(rig, "Form3_DragonCrown", f, scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_DragonWing_L", f, rot_deg=(flap, 0, 0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_DragonWing_R", f, rot_deg=(-flap, 0, 0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, 26.0))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -26.0))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, flap, jw in [(1, -8.0, 20.0), (16, 14.0, 28.0), (32, -8.0, 20.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.08 if f == 16 else 0.02))
        lib.key_bone(rig, "Form2_HydraPod_L", f, loc=(0.12, 0.14, -0.04), rot_deg=(0, 0, 8.0))
        lib.key_bone(rig, "Form2_HydraPod_R", f, loc=(0.12, -0.14, -0.04), rot_deg=(0, 0, -8.0))
        lib.key_bone(rig, "Form3_DragonWing_L", f, rot_deg=(flap, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_DragonWing_R", f, rot_deg=(-flap, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Fang_L", f, rot_deg=(0, 0, jw))
        lib.key_bone(rig, "Fang_R", f, rot_deg=(0, 0, -jw))
    lib.finalize_action_to_nla(rig, "Form3")

    out = lib.export_glb("boss_leviathan.glb")
    inspect_glb(out)
    return out


# Boss 4: Gemini Twin Cores (Stealth Delta -> X-Valkyrie -> Star Astrolabe)
def build_boss_gemini() -> Path:
    lib.reset_scene()
    cobalt = lib.make_material("GeminiCobaltCeramic", (0.10, 0.22, 0.42), metallic=0.34, roughness=0.18)
    pearl = lib.make_material("GeminiSilverHull", (0.76, 0.84, 0.94), metallic=0.58, roughness=0.22, brushed=True)
    dark = lib.make_material("GeminiCarbonFrame", (0.07, 0.09, 0.15), metallic=0.74, roughness=0.30, brushed=True)
    cyan = lib.make_material(
        "GeminiPolarityCyan", (0.22, 0.94, 1.0), metallic=0.0, roughness=0.10,
        emission_color=(0.14, 0.90, 1.0), emission_strength=4.5, use_ao_vc=False,
    )
    magenta = lib.make_material(
        "GeminiPolarityMagenta", (1.0, 0.22, 0.56), metallic=0.0, roughness=0.10,
        emission_color=(1.0, 0.16, 0.52), emission_strength=4.2, use_ao_vc=False,
    )

    # --- SHARED SLEEK NEEDLE CORE ---
    fuselage = lib.build_lofted_hull(
        "Gemini_SpearFuselage",
        [
            (-1.22, lib.jet_profile(0.32, 0.18, -0.15, deck_w=0.38)),
            (-0.44, lib.jet_profile(0.46, 0.25, -0.19, deck_w=0.42)),
            (0.42,  lib.jet_profile(0.34, 0.19, -0.15, deck_w=0.38)),
            (1.18,  lib.jet_profile(0.15, 0.09, -0.07, deck_w=0.32)),
            (1.56,  lib.jet_profile(0.03, 0.03, -0.025, deck_w=0.24)),
        ],
        pearl, crease_indices={2, 7}, subsurf=1,
    )
    canopy = lib.build_precision_cockpit_canopy(
        "Gemini_BridgeCanopy",
        [
            (0.18, lib.jet_profile(0.14, 0.24, 0.13, deck_w=0.36)),
            (0.54, lib.jet_profile(0.18, 0.34, 0.15, deck_w=0.34)),
            (0.92, lib.jet_profile(0.11, 0.24, 0.10, deck_w=0.30)),
        ],
        dark, pearl, cyan,
    )
    reactor_core = lib.create_geo(
        "Gemini_ReactorCore", "sphere", cyan,
        location=(0.0, 0.0, 0.24), scale=(0.42, 0.42, 0.38), segments=18, rings=12, bevel=0.0,
    )
    body: list[bpy.types.Object] = [fuselage, *canopy, reactor_core]
    body.extend(lib.build_louver_array("Gemini_DorsalVents", (-0.82, 0.0, 0.28), (-0.28, 0.0, 0.30), 6, 0.24, 0.04, 0.07, dark, cyan))
    body.extend(lib.build_sensor_mast_array("Gemini_AftSensor", (-0.98, 0.0, 0.24), 0.68, dark, pearl, magenta))

    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        shroud, petals = lib.build_vector_nozzle(
            f"Gemini_Engine_{side}", (-1.20, 0.22 * sign, 0.0),
            radius=0.14, length=0.36, shroud_mat=dark, frame_mat=pearl, glow_mat=cyan, petals=6,
        )
        body.extend([*shroud, *petals])

    waist_gimbal = lib.build_precision_ring_assembly(
        "Gemini_WaistGimbal", (-0.22, 0.0, 0.26), 0.56, 0.045, 24, dark, pearl, magenta, clamp_count=4, rot_deg=(0, 14, 0)
    )

    # --- FORM I ONLY: STEALTH SUPERSONIC DELTA ARROW (width ~1.28) ---
    blades: dict[str, list[bpy.types.Object]] = {}
    for sign, key in ((1, "BladeF_L"), (-1, "BladeF_R")):
        delta_wing = lib.build_airfoil_wing(
            f"Form1Only_Gemini_{key}_DeltaWing",
            _mirror_y_wing_stations([
                (0.32, 0.72, -0.96, 0.02, 0.11),
                (0.84, 0.08, -1.06, 0.03, 0.07),
                (1.26, -0.58, -1.16, 0.14, 0.035),
            ], sign),
            mat=cobalt, camber=0.05, bevel=0.008, bevel_segments=1,
        )
        delta_trim = lib.build_beveled_armor_plate(
            f"Form1Only_Gemini_{key}_DeltaTrim",
            _mirror_y_poly([(-0.82, 0.38), (0.34, 0.36), (0.04, 0.88), (-0.92, 0.84)], sign),
            z_bottom=0.05, z_top=0.12, mat=pearl, top_inset=0.84,
        )
        delta_edge = lib.create_geo(
            f"Form1Only_Gemini_{key}_DeltaGlow", "cube", magenta,
            location=(-0.38, 1.18 * sign, 0.12), rotation_deg=(0, 0, -24 * sign),
            scale=(0.48, 0.04, 0.04), bevel=0.0,
        )
        # Compact mid-hull side strake kept through Form 2, shed in Form 3
        strake = lib.build_beveled_armor_plate(
            f"Form12_Gemini_{key}_SideStrake",
            _mirror_y_poly([(-0.78, 0.28), (0.58, 0.26), (0.68, 0.44), (-0.72, 0.48)], sign),
            z_bottom=-0.08, z_top=0.14, mat=cobalt, top_inset=0.80,
        )
        blades[key] = [delta_wing, delta_trim, delta_edge, strake]

    # --- FORM II: HUGE X-WING SCISSOR VALKYRIE + INNER GYRO HALO (width ~2.12!) ---
    for sign, fkey, akey in ((1, "BladeF_L", "BladeA_L"), (-1, "BladeF_R", "BladeA_R")):
        xf_wing = lib.build_airfoil_wing(
            f"Form2Only_Gemini_{fkey}_ScissorFwd",
            _mirror_y_wing_stations([
                (0.32, 0.64, -0.22, 0.06, 0.10),
                (1.18, 1.32, 0.48, 0.16, 0.06),
                (1.98, 1.72, 1.12, 0.24, 0.03),
            ], sign),
            mat=cobalt, camber=0.04, bevel=0.01, bevel_segments=1,
        )
        xf_edge = lib.build_curved_blade(
            f"Form2Only_Gemini_{fkey}_RailEdge",
            _mirror_y_points([(0.44, 0.36, 0.12), (1.18, 1.24, 0.19), (1.76, 1.98, 0.26)], sign),
            widths=[0.12, 0.10, 0.02], thicknesses=[0.06, 0.045, 0.012], mat=cyan, samples_per_seg=2,
        )
        xf_greeb = lib.build_armor_greeble_strip(
            f"Form2Only_Gemini_{fkey}_Panel",
            (0.64, 0.68 * sign, 0.15), (1.32, 1.48 * sign, 0.22),
            count=3, tile_size=(0.24, 0.16, 0.05), mat=pearl, accent_mat=dark, rot_deg=(0, 0, 32 * sign),
        )
        xf_strut = lib.build_hydraulic_strut(
            f"Form2Only_Gemini_{fkey}_Strut", (0.28, 0.34 * sign, 0.04), (0.64, 0.72 * sign, 0.12), 0.038, dark, pearl
        )
        blades[fkey].extend([xf_wing, xf_edge, *xf_greeb, *xf_strut])

        xa_wing = lib.build_airfoil_wing(
            f"Form2Only_Gemini_{akey}_ScissorAft",
            _mirror_y_wing_stations([
                (0.34, -0.14, -0.92, 0.02, 0.09),
                (1.14, -0.64, -1.32, -0.04, 0.055),
                (1.88, -1.16, -1.66, -0.10, 0.028),
            ], sign),
            mat=pearl, camber=-0.02, bevel=0.01, bevel_segments=1,
        )
        xa_edge = lib.build_curved_blade(
            f"Form2Only_Gemini_{akey}_PlasmaEdge",
            _mirror_y_points([(-0.36, 0.38, 0.04), (-0.88, 1.18, -0.02), (-1.42, 1.88, -0.10)], sign),
            widths=[0.11, 0.09, 0.02], thicknesses=[0.055, 0.04, 0.012], mat=magenta, samples_per_seg=2,
        )
        blades[akey] = [xa_wing, xa_edge]

    # Form 2+ Gyro Polarity Halo + Form 3 Colossal Astrolabe Rings + 4 Orbital Prism Sabers
    gyro_inner_objs: list[bpy.types.Object] = []
    gyro_outer_objs: list[bpy.types.Object] = []
    orbital_objs: list[bpy.types.Object] = []

    f2_ring = lib.build_precision_ring_assembly(
        "Form2_Gemini_GyroHalo", (0.0, 0.0, 0.34), 0.92, 0.05, 24, dark, pearl, cyan, clamp_count=6, rot_deg=(0, 18, 0)
    )
    gyro_inner_objs.extend(f2_ring)

    # Form 3 Concentric Precision Astrolabes (span ±1.92!)
    f3_ring_a = lib.build_precision_ring_assembly(
        "Form3_Gemini_AstrolabeInner", (0.0, 0.0, 0.38), 1.32, 0.058, 28, pearl, cobalt, cyan, clamp_count=6, rot_deg=(18, -12, 0)
    )
    gyro_inner_objs.extend(f3_ring_a)

    f3_ring_b = lib.build_precision_ring_assembly(
        "Form3_Gemini_AstrolabeOuter", (0.0, 0.0, 0.38), 1.88, 0.068, 32, cobalt, pearl, magenta, clamp_count=8, rot_deg=(-16, 14, 0)
    )
    gyro_outer_objs.extend(f3_ring_b)

    # 4 Colossal Floating Orbital Wing-Prisms (Form III iconic angelic silhouette!)
    for oi in range(4):
        ang = math.radians(45 + oi * 90)
        ca, sa = math.cos(ang), math.sin(ang)
        m_edge = cyan if oi % 2 == 0 else magenta
        blade_frame = lib.build_curved_blade(
            f"Form3_Gemini_OrbitalSaber_{oi}",
            [(ca * 1.48, sa * 1.48, 0.22), (ca * 1.98 - sa * 0.24, sa * 1.98 + ca * 0.24, 0.38), (ca * 2.42, sa * 2.42, 0.14)],
            widths=[0.26, 0.34, 0.03], thicknesses=[0.11, 0.09, 0.02], mat=pearl if oi % 2 == 0 else cobalt, samples_per_seg=2,
        )
        blade_core = lib.build_curved_blade(
            f"Form3_Gemini_OrbitalGlow_{oi}",
            [(ca * 1.54, sa * 1.54, 0.25), (ca * 2.00 - sa * 0.18, sa * 2.00 + ca * 0.18, 0.41), (ca * 2.38, sa * 2.38, 0.18)],
            widths=[0.10, 0.12, 0.02], thicknesses=[0.05, 0.04, 0.012], mat=m_edge, samples_per_seg=2,
        )
        orbital_objs.extend([blade_frame, blade_core])

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "GeminiRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "WaistGimbal": ((-0.22, 0.0, 0.26), (-0.22, 0.50, 0.26), "Root"),
            "BladeF_L": ((0.24, 0.36, 0.05), (0.24, 0.86, 0.05), "Root"),
            "BladeF_R": ((0.24, -0.36, 0.05), (0.24, 0.14, 0.05), "Root"),
            "BladeA_L": ((-0.38, 0.36, 0.02), (-0.38, 0.86, 0.02), "Root"),
            "BladeA_R": ((-0.38, -0.36, 0.02), (-0.38, 0.14, 0.02), "Root"),
            "GyroInner": ((0.0, 0.0, 0.36), (0.0, 0.50, 0.36), "Root"),
            "GyroOuter": ((0.0, 0.0, 0.38), (0.0, 0.50, 0.38), "Root"),
            "OrbitalRing": ((0.0, 0.0, 0.28), (0.0, 0.50, 0.28), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(waist_gimbal, rig, "WaistGimbal")
    for k, objs in blades.items():
        lib.parent_to_bone(objs, rig, k)
    lib.parent_to_bone(gyro_inner_objs, rig, "GyroInner")
    lib.parent_to_bone(gyro_outer_objs, rig, "GyroOuter")
    lib.parent_to_bone(orbital_objs, rig, "OrbitalRing")

    lib.start_action(rig, "Idle")
    for f, spin, sw in [(1, 0.0, 0.0), (24, 180.0, 5.0), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.03 if f == 24 else 0.0))
        lib.key_bone(rig, "WaistGimbal", f, rot_deg=(0, 0, spin))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(0, 0, sw))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(0, 0, -sw))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, spin, sw in [(1, 0.0, 0.0), (14, 180.0, -20.0), (28, 360.0, -26.0)]:
        lib.key_bone(rig, "WaistGimbal", f, rot_deg=(0, 0, spin))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(10, 0, sw))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(-10, 0, -sw))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, -spin))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, spin, sw in [(1, 0.0, -16.0), (10, 180.0, 14.0), (20, 360.0, -16.0)]:
        lib.key_bone(rig, "WaistGimbal", f, rot_deg=(0, 0, spin))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(0, 0, sw))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(0, 0, -sw))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, spin))
        lib.key_bone(rig, "GyroOuter", f, rot_deg=(0, 0, -spin))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, spread, z_up in [(1, 0.0, 0.0), (14, 28.0, 0.24), (28, 16.0, 0.06)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(14, 0, spread))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(-14, 0, -spread))
        lib.key_bone(rig, "BladeA_L", f, rot_deg=(-14, 0, -spread))
        lib.key_bone(rig, "BladeA_R", f, rot_deg=(14, 0, spread))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, z_dn in [(1, -0.14), (24, -0.18), (48, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(-16, 0, 12))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(16, 0, -12))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, ang, s2, gz in [(1, 0.0, 0.01, 0.0), (14, 18.0, 0.65, 120.0), (28, 12.0, 1.18, 240.0), (42, 8.0, 1.00, 360.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.22 if f == 14 else 0.04))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(12, 0, -ang))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(-12, 0, ang))
        lib.key_bone(rig, "BladeA_L", f, rot_deg=(-10, 0, ang))
        lib.key_bone(rig, "BladeA_R", f, rot_deg=(10, 0, -ang))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, gz), scale=(s2, s2, s2))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, spin, ang in [(1, 0.0, 6.0), (24, 180.0, 12.0), (48, 360.0, 6.0)]:
        lib.key_bone(rig, "WaistGimbal", f, rot_deg=(0, 0, -spin))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, spin), scale=(1, 1, 1))
        lib.key_bone(rig, "BladeF_L", f, rot_deg=(10, 0, -ang))
        lib.key_bone(rig, "BladeF_R", f, rot_deg=(-10, 0, ang))
        lib.key_bone(rig, "BladeA_L", f, rot_deg=(-10, 0, ang))
        lib.key_bone(rig, "BladeA_R", f, rot_deg=(10, 0, -ang))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, z_up, spin, s3 in [(1, 0.04, 0.0, 0.01), (16, 0.28, 120.0, 0.65), (32, 0.18, 240.0, 1.22), (48, 0.06, 360.0, 1.00)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, spin), scale=(1, 1, 1))
        lib.key_bone(rig, "GyroOuter", f, rot_deg=(0, 0, -spin), scale=(s3, s3, s3))
        lib.key_bone(rig, "OrbitalRing", f, rot_deg=(0, 0, spin * 0.5), scale=(s3, s3, s3))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, spin in [(1, 0.0), (16, 180.0), (32, 360.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.06 if f == 16 else 0.02))
        lib.key_bone(rig, "WaistGimbal", f, rot_deg=(0, 0, spin))
        lib.key_bone(rig, "GyroInner", f, rot_deg=(0, 0, -spin), scale=(1, 1, 1))
        lib.key_bone(rig, "GyroOuter", f, rot_deg=(0, 0, spin), scale=(1, 1, 1))
        lib.key_bone(rig, "OrbitalRing", f, rot_deg=(0, 0, -spin * 0.5), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form3")

    out = lib.export_glb("boss_gemini.glb")
    inspect_glb(out)
    return out


# Boss 5: Bastion Colossus (Sealed Bunker -> Siege Citadel -> Supernova)
def build_boss_bastion() -> Path:
    lib.reset_scene()
    tungsten = lib.make_material("BastionTungstenWhite", (0.86, 0.87, 0.89), metallic=0.28, roughness=0.22)
    gunmetal = lib.make_material("BastionGunmetalCore", (0.14, 0.16, 0.20), metallic=0.84, roughness=0.30, brushed=True)
    hazard = lib.make_material("BastionAmberArmor", (0.95, 0.54, 0.08), metallic=0.45, roughness=0.24)
    furnace = lib.make_material(
        "BastionMoltenGlow", (1.0, 0.56, 0.10), metallic=0.0, roughness=0.10,
        emission_color=(1.0, 0.44, 0.04), emission_strength=4.6, use_ao_vc=False,
    )

    # --- SHARED OCTAGONAL CHASSIS & REACTOR ---
    core_chassis = lib.create_geo(
        "Bastion_CoreChassis", "cylinder", gunmetal,
        location=(0.0, 0.0, 0.0), radius=0.84, depth=0.60, vertices=8, bevel=0.02, bevel_segments=1,
    )
    upper_deck = lib.create_geo(
        "Bastion_UpperDeck", "cylinder", tungsten,
        location=(0.0, 0.0, 0.32), radius=0.68, depth=0.20, vertices=8, bevel=0.015, bevel_segments=1,
    )
    reactor_core = lib.create_geo(
        "Bastion_ReactorCore", "sphere", furnace,
        location=(0.0, 0.0, 0.36), scale=(0.64, 0.64, 0.56), segments=18, rings=12, bevel=0.0,
    )
    body: list[bpy.types.Object] = [core_chassis, upper_deck, reactor_core]
    core_ring = lib.build_precision_ring_assembly(
        "Bastion_CoreRing", (0.0, 0.0, 0.48), 0.58, 0.062, 24, gunmetal, hazard, furnace, clamp_count=6
    )
    body.extend(lib.build_sensor_mast_array("Bastion_BridgeSensor", (-0.42, 0.0, 0.42), 0.70, gunmetal, tungsten, furnace))
    body.extend(lib.build_louver_array("Bastion_HullVents_L", (-0.42, 0.66, 0.22), (0.42, 0.66, 0.22), 5, 0.14, 0.045, 0.12, gunmetal, furnace, yaw_deg=0.0))
    body.extend(lib.build_louver_array("Bastion_HullVents_R", (-0.42, -0.66, 0.22), (0.42, -0.66, 0.22), 5, 0.14, 0.045, 0.12, gunmetal, furnace, yaw_deg=0.0))

    # --- 4 DIAGONAL HEAVY SIEGE CANNONS + FORM I HOODS + FORM II TELESCOPED BOOMS ---
    cannons: dict[str, list[bpy.types.Object]] = {}
    for ci in range(4):
        ang = math.radians(45 + ci * 90)
        ca, sa = math.cos(ang), math.sin(ang)
        deg_z = math.degrees(ang)
        head_parts, barrel_parts = lib.build_heavy_turret(
            f"Bastion_Cannon_{ci}", (0.0, 0.0, 0.16), 0.56, tungsten, gunmetal, furnace, barrels=2
        )
        bpy.context.view_layer.update()
        xf = Matrix.Translation((ca * 0.64, sa * 0.64, 0.0)) @ Matrix.Rotation(ang, 4, "Z")
        for obj in [*head_parts, *barrel_parts]:
            obj.matrix_world = xf @ obj.matrix_world
        # Form 1 Only armored bunker shutter over each cannon
        hood_cap = lib.create_geo(
            f"Form1Only_Bastion_CannonCap_{ci}", "cube", tungsten,
            location=(ca * 0.72, sa * 0.72, 0.28), rotation_deg=(0, 0, deg_z),
            scale=(0.56, 0.34, 0.24), bevel=0.02, bevel_segments=1,
        )
        # Form 2 Only long telescoped siege cannon extensions (reaching r = 2.05!)
        boom_arm = lib.create_geo(
            f"Form2Only_Bastion_SiegeBoom_{ci}_Housing", "cube", hazard,
            location=(ca * 1.42, sa * 1.42, 0.18), rotation_deg=(0, 0, deg_z),
            scale=(0.86, 0.24, 0.16), bevel=0.015, bevel_segments=1,
        )
        boom_rail = lib.create_geo(
            f"Form2Only_Bastion_SiegeBoom_{ci}_Rail", "cylinder", tungsten,
            location=(ca * 1.82, sa * 1.82, 0.18), rotation_deg=(0, 90, deg_z),
            radius=0.055, depth=0.68, vertices=8, bevel=0.0,
        )
        boom_glow = lib.create_geo(
            f"Form2Only_Bastion_SiegeBoom_{ci}_Glow", "cube", furnace,
            location=(ca * 1.62, sa * 1.62, 0.24), rotation_deg=(0, 0, deg_z),
            scale=(0.82, 0.06, 0.05), bevel=0.0,
        )
        cannons[f"Cannon_{ci}"] = [*head_parts, *barrel_parts, hood_cap, boom_arm, boom_rail, boom_glow]

    # --- 4 DESTRUCTIBLE OUTER SHIELD BULWARKS (Plate_0..3 ONLY — NO Form* PREFIX!) ---
    plates: dict[str, list[bpy.types.Object]] = {}
    plate_angles = [0.0, 180.0, 90.0, 270.0]
    for pi, deg in enumerate(plate_angles):
        rad = math.radians(deg)
        ca, sa = math.cos(rad), math.sin(rad)
        px, py = ca * 1.06, sa * 1.06
        plate_main = lib.create_geo(
            f"Bastion_Plate_{pi}_Armor", "cube", tungsten,
            location=(px, py, 0.08), rotation_deg=(0, 0, deg),
            scale=(0.30, 1.02, 0.56), bevel=0.025, bevel_segments=1,
        )
        plate_trim = lib.create_geo(
            f"Bastion_Plate_{pi}_Hazard", "cube", hazard,
            location=(px + ca * 0.14, py + sa * 0.14, 0.12),
            rotation_deg=(0, 0, deg), scale=(0.09, 0.82, 0.32), bevel=0.01, bevel_segments=1,
        )
        plate_vent = lib.create_geo(
            f"Bastion_Plate_{pi}_Vent", "cube", furnace,
            location=(px + ca * 0.17, py + sa * 0.17, 0.28),
            rotation_deg=(0, 0, deg), scale=(0.05, 0.54, 0.07), bevel=0.0,
        )
        strut = lib.build_hydraulic_strut(
            f"Bastion_Plate_{pi}_Piston", (ca * 0.62, sa * 0.62, 0.08), (px - ca * 0.10, py - sa * 0.10, 0.08), 0.045, gunmetal, tungsten
        )
        plates[f"Plate_{pi}"] = [plate_main, plate_trim, plate_vent, *strut]

    # --- FORM I ONLY: HEAVY BUNKER ROOF DOME + FORM 1&2 CORNER SKIRTS ---
    body.append(
        lib.create_geo(
            "Form1Only_Bastion_BunkerRoof", "cylinder", tungsten,
            location=(0.0, 0.0, 0.56), radius=0.72, depth=0.28, vertices=8, bevel=0.025, bevel_segments=1,
        )
    )
    body.append(
        lib.create_geo(
            "Form1Only_Bastion_RoofHatch", "cylinder", gunmetal,
            location=(0.0, 0.0, 0.72), radius=0.44, depth=0.10, vertices=8, bevel=0.015, bevel_segments=1,
        )
    )
    for si in range(4):
        ang = math.radians(45 + si * 90)
        ca, sa = math.cos(ang), math.sin(ang)
        body.append(
            lib.create_geo(
                f"Form12_Bastion_CornerSkirt_{si}", "cube", gunmetal,
                location=(ca * 0.96, sa * 0.96, -0.06), rotation_deg=(0, 0, math.degrees(ang)),
                scale=(0.34, 0.52, 0.28), bevel=0.02, bevel_segments=1,
            )
        )

    # --- FORM II: ELEVATED VLS MORTAR RING ---
    mortar_objs: list[bpy.types.Object] = []
    mortar_objs.extend(
        lib.build_precision_ring_assembly(
            "Form2_Bastion_MortarRing", (0.0, 0.0, 0.58), 0.78, 0.055, 24, gunmetal, hazard, furnace, clamp_count=4
        )
    )
    for mi in range(4):
        ang = math.radians(mi * 90)
        mx, my = math.cos(ang) * 0.62, math.sin(ang) * 0.62
        vls_objs = lib.build_vls_missile_pod(
            f"Form2_Bastion_MortarVLS_{mi}", (mx, my, 0.60), rows=2, cols=2, cell_size=0.085,
            frame_mat=gunmetal, cap_mat=hazard, glow_mat=furnace,
        )
        mortar_objs.extend(vls_objs)

    # --- FORM III: SUPERNOVA 8-PETAL RADIATOR BURST + TWIN 4.2m APOCALYPSE SUPER-RAILS ---
    form3_cage_objs: list[bpy.types.Object] = []
    for fi in range(8):
        ang = math.radians(fi * 45)
        ca, sa = math.cos(ang), math.sin(ang)
        deg_z = math.degrees(ang)
        petal = lib.build_curved_blade(
            f"Form3_Bastion_MeltdownPetal_{fi}",
            [(ca * 0.68, sa * 0.68, 0.36), (ca * 1.42, sa * 1.42, 0.44), (ca * 2.08, sa * 2.08, 0.18)],
            widths=[0.26, 0.32, 0.06], thicknesses=[0.09, 0.08, 0.02],
            mat=hazard if fi % 2 == 0 else tungsten, samples_per_seg=2,
        )
        petal_core = lib.build_curved_blade(
            f"Form3_Bastion_MeltdownVein_{fi}",
            [(ca * 0.72, sa * 0.72, 0.40), (ca * 1.38, sa * 1.38, 0.47), (ca * 1.98, sa * 1.98, 0.22)],
            widths=[0.11, 0.13, 0.03], thicknesses=[0.05, 0.045, 0.015], mat=furnace, samples_per_seg=2,
        )
        form3_cage_objs.extend([petal, petal_core])

    form3_rail_l: list[bpy.types.Object] = []
    form3_rail_r: list[bpy.types.Object] = []
    for sign, target_list, label in ((1, form3_rail_l, "L"), (-1, form3_rail_r, "R")):
        # Heavy transverse wing-sponson super rail cannons reaching y = ±2.35!
        target_list.extend(
            lib.build_railgun_assembly(
                f"Form3_Bastion_SuperRail_{label}", (0.18, 1.32 * sign, 0.22), 1.35, gunmetal, tungsten, furnace
            )
        )
        for o in target_list:
            # Rotate into outward side axis? Keep forward-aimed twin broadside apocalypse beams!
            pass
        jet_shroud, jet_petals = lib.build_vector_nozzle(
            f"Form3_Bastion_OverdriveNoz_{label}", (-0.58, 1.32 * sign, 0.22),
            radius=0.22, length=0.65, shroud_mat=gunmetal, frame_mat=tungsten, glow_mat=furnace, petals=6,
        )
        target_list.extend([*jet_shroud, *jet_petals])
        target_list.extend(
            lib.build_hydraulic_strut(
                f"Form3_Bastion_RailBoom_{label}", (0.0, 0.62 * sign, 0.16), (0.0, 1.24 * sign, 0.22), 0.07, gunmetal, tungsten
            )
        )

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    bone_defs: dict[str, tuple[tuple[float, float, float], tuple[float, float, float], str | None]] = {
        "Root": ((0, 0, 0), (0, 0.5, 0), None),
        "CoreRing": ((0, 0, 0.48), (0, 0.5, 0.48), "Root"),
        "Form2_MortarDeck": ((0, 0, 0.58), (0, 0.5, 0.58), "Root"),
        "Form3_FurnaceCage": ((0, 0, 0.40), (0, 0.5, 0.40), "Root"),
        "Form3_OverdriveJet_L": ((0.0, 1.32, 0.22), (0.0, 1.82, 0.22), "Root"),
        "Form3_OverdriveJet_R": ((0.0, -1.32, 0.22), (0.0, -0.82, 0.22), "Root"),
    }
    for ci in range(4):
        ang = math.radians(45 + ci * 90)
        bx, by = math.cos(ang) * 0.64, math.sin(ang) * 0.64
        bone_defs[f"Cannon_{ci}"] = ((bx, by, 0.16), (bx, by + 0.4, 0.16), "Root")
    for pi, deg in enumerate(plate_angles):
        rad = math.radians(deg)
        bx, by = math.cos(rad) * 1.02, math.sin(rad) * 1.02
        bone_defs[f"Plate_{pi}"] = ((bx, by, 0.08), (bx, by + 0.4, 0.08), "Root")

    rig = lib.create_rig("BastionRig", bone_defs)
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(core_ring, rig, "CoreRing")
    lib.parent_to_bone(mortar_objs, rig, "Form2_MortarDeck")
    lib.parent_to_bone(form3_cage_objs, rig, "Form3_FurnaceCage")
    lib.parent_to_bone(form3_rail_l, rig, "Form3_OverdriveJet_L")
    lib.parent_to_bone(form3_rail_r, rig, "Form3_OverdriveJet_R")
    for k, objs in [*cannons.items(), *plates.items()]:
        lib.parent_to_bone(objs, rig, k)

    def _plate_push(pi: int, dist: float) -> tuple[float, float, float]:
        rad = math.radians(plate_angles[pi])
        return (math.cos(rad) * dist, math.sin(rad) * dist, 0.0)

    def _cannon_push(ci: int, dist: float) -> tuple[float, float, float]:
        ang = math.radians(45 + ci * 90)
        return (math.cos(ang) * dist, math.sin(ang) * dist, 0.0)

    lib.start_action(rig, "Idle")
    for f, p_d, crz in [(1, 0.0, 0.0), (24, 0.05, 180.0), (48, 0.0, 360.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.02 if f == 24 else 0.0))
        lib.key_bone(rig, "CoreRing", f, rot_deg=(0, 0, crz))
        for pi in range(4):
            lib.key_bone(rig, f"Plate_{pi}", f, loc=_plate_push(pi, p_d))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, pd, cd, crz in [(1, 0.0, 0.0, 0.0), (14, 0.22, 0.24, 180.0), (28, 0.28, 0.30, 360.0)]:
        lib.key_bone(rig, "CoreRing", f, rot_deg=(0, 0, crz))
        for pi in range(4):
            lib.key_bone(rig, f"Plate_{pi}", f, loc=_plate_push(pi, pd))
        for ci in range(4):
            lib.key_bone(rig, f"Cannon_{ci}", f, loc=_cannon_push(ci, cd))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, a_d, b_d, crz in [(1, 0.26, 0.08, 0.0), (10, 0.08, 0.26, 180.0), (20, 0.26, 0.08, 360.0)]:
        lib.key_bone(rig, "CoreRing", f, rot_deg=(0, 0, crz))
        for ci in range(4):
            lib.key_bone(rig, f"Cannon_{ci}", f, loc=_cannon_push(ci, a_d if ci % 2 == 0 else b_d))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, pd, z_up in [(1, 0.0, 0.0), (14, 0.34, 0.22), (28, 0.22, 0.06)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        for pi in range(4):
            lib.key_bone(rig, f"Plate_{pi}", f, loc=_plate_push(pi, pd))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, z_dn in [(1, -0.14), (24, -0.18), (48, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        for pi in range(4):
            lib.key_bone(rig, f"Plate_{pi}", f, loc=_plate_push(pi, 0.26))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, z_up, cd, s2, mr in [(1, 0.0, 0.0, 0.01, 0.0), (14, 0.24, 0.24, 0.65, 90.0), (28, 0.14, 0.30, 1.18, 180.0), (42, 0.04, 0.24, 1.00, 270.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        for ci in range(4):
            lib.key_bone(rig, f"Cannon_{ci}", f, loc=_cannon_push(ci, cd))
        lib.key_bone(rig, "Form2_MortarDeck", f, rot_deg=(0, 0, mr), scale=(s2, s2, s2))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, cd, mz in [(1, 0.24, 0.0), (24, 0.30, 180.0), (48, 0.24, 360.0)]:
        lib.key_bone(rig, "CoreRing", f, rot_deg=(0, 0, -mz))
        for ci in range(4):
            lib.key_bone(rig, f"Cannon_{ci}", f, loc=_cannon_push(ci, cd))
        lib.key_bone(rig, "Form2_MortarDeck", f, rot_deg=(0, 0, mz), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, z_up, cz, s3 in [(1, 0.04, 0.0, 0.01), (16, 0.28, 120.0, 0.65), (32, 0.18, 240.0, 1.22), (48, 0.06, 360.0, 1.00)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Form3_FurnaceCage", f, rot_deg=(0, 0, cz), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_OverdriveJet_L", f, scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_OverdriveJet_R", f, scale=(s3, s3, s3))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, spin, rx in [(1, 0.0, 0.0), (16, 180.0, -0.22), (32, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.08 if f == 16 else 0.02))
        lib.key_bone(rig, "CoreRing", f, rot_deg=(0, 0, -spin))
        lib.key_bone(rig, "Form2_MortarDeck", f, rot_deg=(0, 0, spin * 0.5))
        lib.key_bone(rig, "Form3_FurnaceCage", f, rot_deg=(0, 0, spin), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_OverdriveJet_L", f, loc=(rx, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_OverdriveJet_R", f, loc=(rx, 0, 0), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form3")

    out = lib.export_glb("boss_bastion.glb")
    inspect_glb(out)
    return out


# Studio 6x3 Boss Evolution Showcase Renderer (5-bucket stage visibility)
def _render_forms_sheet(
    sheet_filename: str,
    boss_rows: list[tuple[str, float]],
) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            continue

    scene.render.resolution_x = 2160
    scene.render.resolution_y = 1620
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = (
        "AgX"
        if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
        else "Filmic"
    )
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("FormsShowroomWorld")
    scene.world = world
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (0.015, 0.022, 0.040, 1.0)
        bg.inputs[1].default_value = 1.65

    for name, loc, rot, energy, color in [
        ("KeyLight", (6, -8, 10), (0.85, 0.1, 0.55), 5.0, (1.0, 0.96, 0.92)),
        ("FillLight", (-7, -5, 6), (0.95, 0.0, -0.8), 2.5, (0.65, 0.85, 1.0)),
        ("RimLight", (0, 10, 6), (-0.75, 0.0, 3.14), 3.6, (0.85, 0.92, 1.0)),
    ]:
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = energy
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = rot
        scene.collection.objects.link(lo)

    col_xs = [-8.6, 0.0, 8.6]
    row_ys = [6.3, 0.0, -6.3]

    for r_idx, (glb_name, base_scale) in enumerate(boss_rows):
        glb = lib.OUT_DIR / glb_name
        ry = row_ys[r_idx]
        fit_scale = base_scale * 0.78
        for stage_idx, cx in enumerate(col_xs):
            stage = stage_idx + 1
            before_objs = set(bpy.data.objects)
            before_acts = set(bpy.data.actions)
            bpy.ops.import_scene.gltf(filepath=str(glb))
            added_objs = [o for o in bpy.data.objects if o not in before_objs]
            added_acts = [a for a in bpy.data.actions if a not in before_acts]

            arm = next((o for o in added_objs if o.type == "ARMATURE"), None)
            if arm and arm.animation_data:
                pose_clip = "Idle" if stage == 1 else "Form2" if stage == 2 else "Form3"
                target_act = next(
                    (a for a in added_acts if a.name == pose_clip or a.name.startswith(pose_clip)),
                    None,
                )
                if target_act:
                    arm.animation_data.action = target_act
                    scene.frame_set(16)

            for obj in added_objs:
                if obj.type != "MESH":
                    continue
                nm = obj.name
                if "Form1Only_" in nm:
                    show_mesh = stage == 1
                elif "Form12_" in nm:
                    show_mesh = stage <= 2
                elif "Form2Only_" in nm:
                    show_mesh = stage == 2
                elif "Form2_" in nm:
                    show_mesh = stage >= 2
                elif "Form3_" in nm:
                    show_mesh = stage >= 3
                else:
                    show_mesh = True

                if "bastion" in glb_name and "Plate_" in nm:
                    if stage == 2 and ("Plate_0" in nm or "Plate_1" in nm):
                        show_mesh = False
                    elif stage == 3:
                        show_mesh = False

                obj.hide_render = not show_mesh
                obj.hide_viewport = not show_mesh

            roots = [o for o in added_objs if o.parent is None]
            for r in roots:
                r.rotation_mode = "XYZ"
                r.location = (cx, ry, 0.0)
                r.scale = (fit_scale, fit_scale, fit_scale)
                r.rotation_euler = (math.radians(32), math.radians(-10), math.radians(-28))

    cam_data = bpy.data.cameras.new("FormsShowcaseCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 26.8
    cam_obj = bpy.data.objects.new("FormsShowcaseCam", cam_data)
    cam_obj.location = (0.0, 0.0, 16.0)
    cam_obj.rotation_euler = (0.0, 0.0, 0.0)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    out_img = PREVIEW_DIR / sheet_filename
    scene.render.filepath = str(out_img)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print(f"[SHOWCASE RENDERED] {out_img}")


def main() -> None:
    t0 = time.perf_counter()
    build_boss_leviathan()
    build_boss_gemini()
    build_boss_bastion()
    render_sheets = "--no-render" not in sys.argv
    if render_sheets:
        _render_forms_sheet(
            "showcase_v13_boss_forms_a.png",
            [
                ("boss_destroyer.glb", 0.86),
                ("boss_summoner.glb", 0.82),
                ("boss_overlord.glb", 0.80),
            ],
        )
        _render_forms_sheet(
            "showcase_v13_boss_forms_b.png",
            [
                ("boss_leviathan.glb", 0.84),
                ("boss_gemini.glb", 0.84),
                ("boss_bastion.glb", 0.84),
            ],
        )
    print(f"[ALL V13 BOSSES BUILT] in {time.perf_counter() - t0:.2f}s")


if __name__ == "__main__":
    main()
