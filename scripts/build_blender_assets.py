"""
Core 3D Fleet & Props Asset Builder.
Sculpts, bakes BVH AO, rigs, animates, and exports combat .glb models into
public/assets/models/ for Three.js WebGL2.

Run headless in Blender 4.2+:
  blender --background --python scripts/build_blender_assets.py
"""

from __future__ import annotations

import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_sculpt_lib as lib  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402


def _build_truss_bar(
    name: str,
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    vertices: int = 8,
) -> bpy.types.Object:
    v0 = Vector(p0)
    v1 = Vector(p1)
    delta = v1 - v0
    length = max(0.02, delta.length)
    mid = (v0 + v1) * 0.5
    rot = Vector((0.0, 0.0, 1.0)).rotation_difference(delta.normalized()).to_euler()
    rot_deg = (math.degrees(rot.x), math.degrees(rot.y), math.degrees(rot.z))
    return lib.create_geo(
        name, "cylinder", mat,
        location=(mid.x, mid.y, mid.z),
        rotation_deg=rot_deg,
        vertices=vertices,
        radius=radius,
        depth=length,
        bevel=0.0,
    )


# Symmetric Left (+Y) / Right (-Y) Mirror Helper
def _mirror_y_points(pts: list[tuple[float, float, float]], sign: int) -> list[tuple[float, float, float]]:
    return [(x, y * sign, z) for x, y, z in pts]


def _mirror_y_poly(poly: list[tuple[float, float]], sign: int) -> list[tuple[float, float]]:
    res = [(px, py * sign) for px, py in poly]
    return list(reversed(res)) if sign < 0 else res


def _mirror_y_wing_stations(
    stations: list[tuple[float, float, float, float, float]], sign: int
) -> list[tuple[float, float, float, float, float]]:
    return [(y * sign, xf, xb, zc, th) for y, xf, xb, zc, th in stations]


# 1. Player Vanguard (from humble scrap tug up to fully armored warship)
def build_player_vanguard() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame = pal["primary"], pal["secondary"], pal["frame"]
    scrap, rust, weld, bulb = pal["scrap_metal"], pal["scrap_rust"], pal["scrap_weld"], pal["scrap_bulb"]
    orange, glass, glow = pal["accent"], pal["canopy"], pal["glow"]
    ice_glow, bio_glow = pal["wpn_ice"], pal["wpn_emerald"]

    # --- PERMANENT SKELETAL CORE CHASSIS (raw iron frame X = -1.46 .. +0.90, |Y| <= 0.52) ---
    hull_stations = [
        (-1.46, lib.jet_profile(0.31, 0.19, -0.14, deck_w=0.40)),
        (-0.92, lib.jet_profile(0.37, 0.22, -0.17, deck_w=0.38)),
        (-0.28, lib.jet_profile(0.38, 0.23, -0.18, deck_w=0.36)),
        (0.32,  lib.jet_profile(0.31, 0.20, -0.15, deck_w=0.34)),
        (0.88,  lib.jet_profile(0.20, 0.14, -0.11, deck_w=0.30)),
    ]
    core_hull = lib.build_lofted_hull(
        "Vanguard_CoreFuselage", hull_stations, scrap, crease_indices={2, 7}, subsurf=1, bevel_segments=1
    )
    belly_keel = lib.build_beveled_armor_plate(
        "Vanguard_CoreBellyKeel",
        [(-1.40, -0.22), (0.80, -0.16), (0.80, 0.16), (-1.40, 0.22)],
        z_bottom=-0.24, z_top=-0.12, mat=frame, top_inset=0.80, bevel_segments=1,
    )
    chin_cam = lib.create_geo(
        "Vanguard_ChinOpticPod", "cube", scrap,
        location=(0.56, 0.0, -0.16), scale=(0.20, 0.12, 0.08), bevel=0.006, bevel_segments=1,
    )
    chin_lens = lib.create_geo(
        "Vanguard_ChinOpticLens", "cube", glow,
        location=(0.66, 0.0, -0.16), scale=(0.03, 0.07, 0.045), bevel=0.0,
    )
    canopy_parts = lib.build_precision_cockpit_canopy(
        "Vanguard_Canopy",
        [
            (-0.22, lib.jet_profile(0.16, 0.24, 0.11, deck_w=0.34)),
            (0.14,  lib.jet_profile(0.21, 0.36, 0.15, deck_w=0.32)),
            (0.52,  lib.jet_profile(0.16, 0.31, 0.11, deck_w=0.32)),
            (0.82,  lib.jet_profile(0.07, 0.18, 0.06, deck_w=0.30)),
        ],
        glass, scrap, bulb,
    )

    body_parts: list[bpy.types.Object] = [
        core_hull, belly_keel, chin_cam, chin_lens, *canopy_parts
    ]
    # Exposed bare skeletal ribs instead of thick factory cowling
    for rx, r_w in ((-1.16, 0.44), (-0.42, 0.46), (0.18, 0.38)):
        body_parts.append(
            lib.create_geo(
                f"Vanguard_SkeletonRib_{rx:.2f}", "cube", weld,
                location=(rx, 0.0, 0.18), scale=(0.08, r_w, 0.07), bevel=0.005, bevel_segments=1,
            )
        )

    # Bolted Structural Bulkhead Flanges (Nose, Wing L/R, Dorsal Spine Bay)
    body_parts.append(
        lib.create_geo(
            "Vanguard_NoseBulkheadCollar", "cylinder", frame,
            location=(0.88, 0.0, 0.0), rotation_deg=(0, 90, 0), vertices=8, radius=0.22, depth=0.09,
            bevel=0.01, bevel_segments=1,
        )
    )
    for b_ang in range(0, 360, 90):
        rad = math.radians(b_ang)
        body_parts.append(
            lib.create_geo(
                f"Vanguard_NoseBulkheadBolt_{b_ang}", "cube", scrap,
                location=(0.89, math.cos(rad) * 0.19, math.sin(rad) * 0.15),
                scale=(0.06, 0.05, 0.05), bevel=0.005, bevel_segments=1,
            )
        )

    body_parts.extend(
        lib.build_precision_ring_assembly(
            "Vanguard_DorsalBayCollar", (-0.78, 0.0, 0.25), 0.32, 0.028, 16, frame, weld, glow, clamp_count=4
        )
    )
    body_parts.append(
        lib.create_geo(
            "Vanguard_DorsalSocketGlow", "cylinder", glow,
            location=(-0.78, 0.0, 0.255), vertices=16, radius=0.20, depth=0.025, bevel=0.0,
        )
    )

    vent_parts: dict[str, list[bpy.types.Object]] = {}
    airbrake_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, side in ((1, "L"), (-1, "R")):
        # Bare skeletal intake struts + Wing-Root Bulkhead Flange at (-0.18, ±0.52, 0.0)
        body_parts.append(
            _build_truss_bar(
                f"Vanguard_IntakeRail_{side}",
                (-1.20, 0.42 * sign, -0.02), (0.36, 0.36 * sign, 0.0),
                radius=0.055, mat=scrap, vertices=8,
            )
        )
        body_parts.append(
            lib.create_geo(
                f"Vanguard_IntakeGlow_{side}", "cube", bulb,
                location=(0.24, 0.35 * sign, 0.0), scale=(0.14, 0.08, 0.07), bevel=0.0,
            )
        )
        body_parts.append(
            lib.create_geo(
                f"Vanguard_WingBulkhead_{side}", "cube", frame,
                location=(-0.18, 0.52 * sign, 0.0), scale=(0.82, 0.08, 0.18), bevel=0.008, bevel_segments=1,
            )
        )
        for bx in (-0.50, 0.14):
            body_parts.append(
                lib.create_geo(
                    f"Vanguard_WingClampLug_{side}_{bx:.2f}", "cube", scrap,
                    location=(bx, 0.51 * sign, 0.08), scale=(0.10, 0.06, 0.045), bevel=0.004, bevel_segments=1,
                )
            )

        # Articulated Dorsal Vents & Airbrakes in raw gunmetal (still articulate on Overheat)
        v_key, ab_key = f"Vent_{side}", f"Airbrake_{side}"
        v_plate = lib.build_beveled_armor_plate(
            f"Vanguard_{v_key}",
            _mirror_y_poly([(-1.22, 0.07), (-0.76, 0.07), (-0.72, 0.24), (-1.24, 0.22)], sign),
            z_bottom=0.22, z_top=0.28, mat=scrap, top_inset=0.80, bevel_segments=1,
        )
        v_core = lib.create_geo(
            f"Vanguard_{v_key}_Core", "cube", bulb,
            location=(-0.98, 0.16 * sign, 0.21), scale=(0.36, 0.08, 0.03), bevel=0.0,
        )
        body_parts.append(v_core)
        vent_parts[v_key] = [v_plate]

        ab_plate = lib.build_beveled_armor_plate(
            f"Vanguard_{ab_key}_Flap",
            _mirror_y_poly([(-0.84, 0.29), (-0.44, 0.29), (-0.46, 0.44), (-0.86, 0.43)], sign),
            z_bottom=0.12, z_top=0.17, mat=weld, top_inset=0.82, bevel_segments=1,
        )
        airbrake_parts[ab_key] = [ab_plate]

    # --- TIER 0 ONLY SCRAP HULL CLADDING (StockHullShell_, hidden when Core Armor T1+ installed) ---
    stock_hull_shell: list[bpy.types.Object] = []
    # Asymmetrical bolted scrap patches + exposed conduit + dorsal cage rails
    stock_hull_shell.append(
        lib.build_beveled_armor_plate(
            "StockHullShell_Patch_L",
            [(-0.72, 0.22), (0.18, 0.24), (0.12, 0.44), (-0.64, 0.45)],
            z_bottom=0.10, z_top=0.175, mat=rust, top_inset=0.84, bevel_segments=1,
        )
    )
    stock_hull_shell.append(
        lib.build_beveled_armor_plate(
            "StockHullShell_Patch_R",
            _mirror_y_poly([(-1.12, 0.22), (-0.28, 0.25), (-0.34, 0.44), (-1.04, 0.42)], -1),
            z_bottom=0.09, z_top=0.165, mat=weld, top_inset=0.84, bevel_segments=1,
        )
    )
    stock_hull_shell.append(
        lib.create_geo(
            "StockHullShell_ExposedTank_L", "cylinder", rust,
            location=(-0.74, 0.34, 0.21), rotation_deg=(0, 90, 0), vertices=8, radius=0.062, depth=0.68, bevel=0.0,
        )
    )
    stock_hull_shell.append(
        _build_truss_bar(
            "StockHullShell_Conduit_R", (-1.18, -0.34, 0.19), (-0.12, -0.28, 0.17), 0.032, rust
        )
    )
    stock_hull_shell.append(
        lib.create_geo(
            "StockHullShell_RivetBar", "cube", scrap,
            location=(0.14, -0.32, 0.14), rotation_deg=(0, 0, -14), scale=(0.48, 0.10, 0.05), bevel=0.004, bevel_segments=1,
        )
    )

    # --- SWAPPABLE STOCK SCRAP AIRFRAME SECTIONS (Replaced immediately when equipping slots!) ---
    # 1. Blunt Industrial Utility Nose Bumper (ends early at X=1.46 instead of fighter spearhead 2.32)
    stock_nose: list[bpy.types.Object] = []
    stock_nose.append(
        lib.build_lofted_hull(
            "StockNose_StubBody",
            [
                (0.84, lib.jet_profile(0.20, 0.14, -0.11, deck_w=0.34)),
                (1.18, lib.jet_profile(0.17, 0.11, -0.09, deck_w=0.40)),
                (1.42, lib.jet_profile(0.12, 0.08, -0.065, deck_w=0.44)),
            ],
            scrap, crease_indices={2, 7}, subsurf=1, bevel_segments=1,
        )
    )
    stock_nose.append(
        lib.create_geo(
            "StockNose_BumperBlock", "cube", rust,
            location=(1.44, 0.0, 0.01), scale=(0.16, 0.22, 0.12), bevel=0.008, bevel_segments=1,
        )
    )
    stock_nose.append(
        lib.create_geo(
            "StockNose_Headlamp", "cube", bulb,
            location=(1.52, 0.0, 0.02), scale=(0.03, 0.11, 0.045), bevel=0.0,
        )
    )
    stock_nose.append(
        lib.create_geo(
            "StockNose_RadioMast", "cylinder", weld,
            location=(1.32, 0.09, 0.11), rotation_deg=(0, 72, 0), vertices=6, radius=0.014, depth=0.34, bevel=0.0,
        )
    )
    canard_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, key in ((1, "Canard_L"), (-1, "Canard_R")):
        tab = lib.create_geo(
            f"StockNose_{key}_TrimTab", "cube", scrap,
            location=(1.10, 0.27 * sign, 0.02), rotation_deg=(0, 0, 12 * sign),
            scale=(0.24, 0.15, 0.026), bevel=0.003, bevel_segments=1,
        )
        canard_parts[key] = [tab]
        stock_nose.append(tab)

    # 2. Open-Frame Tubular Wing Trusses (see-through skeleton bridging root ±0.52 to wingtip ±1.56!)
    stock_wing_in_l: list[bpy.types.Object] = []
    stock_wing_in_r: list[bpy.types.Object] = []
    stock_wing_out_l: list[bpy.types.Object] = []
    stock_wing_out_r: list[bpy.types.Object] = []
    wingtip_parts: dict[str, list[bpy.types.Object]] = {}

    for sign, side in ((1, "L"), (-1, "R")):
        wi_list = stock_wing_in_l if sign > 0 else stock_wing_in_r
        wo_list = stock_wing_out_l if sign > 0 else stock_wing_out_r

        wi_root = lib.create_geo(
            f"StockWingIn_{side}_RootCollar", "cube", frame,
            location=(-0.18, 0.51 * sign, 0.0), scale=(0.74, 0.10, 0.15), bevel=0.006, bevel_segments=1,
        )
        wi_spar_f = _build_truss_bar(
            f"StockWingIn_{side}_ForeSpar", (-0.02, 0.52 * sign, 0.01), (-0.26, 1.56 * sign, 0.02), 0.042, scrap
        )
        wi_spar_a = _build_truss_bar(
            f"StockWingIn_{side}_AftSpar", (-0.42, 0.52 * sign, -0.01), (-0.56, 1.56 * sign, 0.01), 0.036, scrap
        )
        wi_diag1 = _build_truss_bar(
            f"StockWingIn_{side}_BraceA", (-0.38, 0.58 * sign, 0.0), (-0.14, 1.06 * sign, 0.01), 0.026, weld
        )
        wi_diag2 = _build_truss_bar(
            f"StockWingIn_{side}_BraceB", (-0.14, 1.06 * sign, 0.01), (-0.52, 1.50 * sign, 0.01), 0.026, weld
        )
        wi_patch = lib.build_beveled_armor_plate(
            f"StockWingIn_{side}_ScrapPatch",
            _mirror_y_poly([(-0.46, 0.88), (-0.18, 0.88), (-0.26, 1.24), (-0.48, 1.24)], sign),
            z_bottom=-0.02, z_top=0.04, mat=rust if sign > 0 else weld, top_inset=0.88, bevel_segments=1,
        )
        wi_flange = lib.create_geo(
            f"StockWingIn_{side}_OuterFlange", "cube", frame,
            location=(-0.42, 1.56 * sign, 0.02), scale=(0.56, 0.075, 0.13), bevel=0.006, bevel_segments=1,
        )
        wi_list.extend([wi_root, wi_spar_f, wi_spar_a, wi_diag1, wi_diag2, wi_patch, wi_flange])

        # Stubby industrial endplate WingTips (no long swept winglets!)
        wo_cap = lib.create_geo(
            f"StockWingOut_{side}_EndBracket", "cube", scrap,
            location=(-0.44, 1.70 * sign, 0.03), scale=(0.44, 0.24, 0.055), bevel=0.005, bevel_segments=1,
        )
        wo_plate = lib.create_geo(
            f"StockWingOut_{side}_RustPlate", "cube", rust,
            location=(-0.46, 1.83 * sign, 0.06), scale=(0.36, 0.045, 0.16), bevel=0.004, bevel_segments=1,
        )
        wo_bulb = lib.create_geo(
            f"StockWingOut_{side}_NavBulb", "cube", bulb,
            location=(-0.40, 1.85 * sign, 0.13), scale=(0.10, 0.055, 0.055), bevel=0.0,
        )
        wo_objs = [wo_cap, wo_plate, wo_bulb]
        wo_list.extend(wo_objs)
        wingtip_parts[f"WingTip_{side}"] = wo_objs

    # 3. Flat Bare Utility Rack Spine & Tiny Stub Stabilizers (StockSpine_)
    stock_spine: list[bpy.types.Object] = []
    for sign, side in ((1, "L"), (-1, "R")):
        stock_spine.append(
            _build_truss_bar(
                f"StockSpine_RackRail_{side}",
                (-1.28, 0.20 * sign, 0.25), (-0.34, 0.20 * sign, 0.25),
                radius=0.024, mat=scrap, vertices=6,
            )
        )
        stock_spine.append(
            lib.create_geo(
                f"StockSpine_StubFin_{side}", "cube", rust if sign > 0 else scrap,
                location=(-1.16, 0.34 * sign, 0.32), rotation_deg=(16 * sign, 0, 0),
                scale=(0.44, 0.04, 0.28), bevel=0.005, bevel_segments=1,
            )
        )

    # 4. Undersized Old Iron Muffler Nozzles (StockEngine_)
    stock_engine: list[bpy.types.Object] = []
    nozzle_petals: dict[int, list[bpy.types.Object]] = {}
    for side_idx, sign in enumerate((1, -1)):
        side = "L" if sign > 0 else "R"
        shroud, petals = lib.build_vector_nozzle(
            f"StockEngine_Noz_{side}", (-1.46, 0.24 * sign, -0.02), radius=0.145, length=0.38,
            shroud_mat=rust, frame_mat=scrap, glow_mat=bulb, petals=6,
        )
        stock_engine.extend(shroud)
        nozzle_petals[side_idx] = petals

    # --- PROGRESSIVE CORE SHOP UPGRADE HARDWARE ---
    core_armor_t1: list[bpy.types.Object] = []
    core_armor_t2: list[bpy.types.Object] = []
    core_shield: list[bpy.types.Object] = []
    core_engine_t1: list[bpy.types.Object] = []
    core_engine_t2: list[bpy.types.Object] = []
    core_cryo: list[bpy.types.Object] = []
    core_sensor: list[bpy.types.Object] = []

    # Full Armor T1 Nose & Rear Deck Cladding that covers raw iron skeleton cleanly without overlapping Canopy/Spine
    core_armor_t1.append(
        lib.build_beveled_armor_plate(
            "CoreArmor_T1_AftFairing",
            [(-1.44, -0.34), (-1.12, -0.34), (-1.12, 0.34), (-1.44, 0.34)],
            z_bottom=0.16, z_top=0.25, mat=white, top_inset=0.80, bevel_segments=1,
        )
    )
    core_armor_t1.append(
        lib.build_beveled_armor_plate(
            "CoreArmor_T1_FwdCollar",
            [(0.62, -0.22), (0.90, -0.18), (0.90, 0.18), (0.62, 0.22)],
            z_bottom=0.11, z_top=0.20, mat=orange, top_inset=0.82, bevel_segments=1,
        )
    )

    for sign, side in ((1, "L"), (-1, "R")):
        # Armor T1: Gleaming composite cheek plates, intake cowls, shoulder hull shell & belly skirt
        core_armor_t1.append(
            lib.build_beveled_armor_plate(
                f"CoreArmor_T1_Cheek_{side}",
                _mirror_y_poly([(-0.18, 0.30), (0.72, 0.22), (0.82, 0.48), (-0.16, 0.54)], sign),
                z_bottom=-0.12, z_top=0.19, mat=white, top_inset=0.80, bevel_segments=1,
            )
        )
        core_armor_t1.append(
            lib.build_beveled_armor_plate(
                f"CoreArmor_T1_Shoulder_{side}",
                _mirror_y_poly([(-1.32, 0.26), (0.28, 0.26), (0.36, 0.52), (-1.26, 0.52)], sign),
                z_bottom=0.12, z_top=0.25, mat=navy, top_inset=0.78, bevel_segments=1,
            )
        )
        core_armor_t1.append(
            lib.build_beveled_armor_plate(
                f"CoreArmor_T1_IntakeLip_{side}",
                _mirror_y_poly([(0.34, 0.26), (0.62, 0.30), (0.58, 0.50), (0.30, 0.48)], sign),
                z_bottom=-0.12, z_top=0.14, mat=orange, top_inset=0.84, bevel_segments=1,
            )
        )
        core_armor_t1.append(
            lib.create_geo(
                f"CoreArmor_T1_VentralSkirt_{side}", "cube", frame,
                location=(-0.38, 0.28 * sign, -0.24), scale=(1.14, 0.17, 0.095), bevel=0.01, bevel_segments=1,
            )
        )

        # Armor T2: Segmented dreadnought carapace ribs & glowing nano-regen veins
        core_armor_t2.extend(
            lib.build_armor_greeble_strip(
                f"CoreArmor_T2_Carapace_{side}",
                (-1.08, 0.42 * sign, 0.25), (0.36, 0.42 * sign, 0.22), 5, (0.20, 0.24, 0.055), white, orange,
            )
        )
        core_armor_t2.append(
            lib.create_geo(
                f"CoreArmor_T2_RegenVein_{side}", "cube", bio_glow,
                location=(-0.32, 0.53 * sign, 0.16), scale=(1.18, 0.035, 0.04), bevel=0.0,
            )
        )

        # Shield Matrix: Twin Aegis emitter pylons & halo rings on intake shoulders
        core_shield.extend(
            lib.build_precision_ring_assembly(
                f"CoreShield_EmitterRing_{side}", (0.16, 0.44 * sign, 0.26), 0.18, 0.026, 16,
                frame, orange, glow, clamp_count=3,
            )
        )
        core_shield.append(
            lib.create_geo(
                f"CoreShield_Pylon_{side}", "cube", navy,
                location=(0.16, 0.44 * sign, 0.18), scale=(0.24, 0.10, 0.14), bevel=0.01, bevel_segments=1,
            )
        )

        # Engine T1: Stacked quad-nozzle afterburner pods + dorsal engine cowling
        for z_idx, z_off in enumerate((-0.09, 0.11)):
            sh_t1, pt_t1 = lib.build_vector_nozzle(
                f"CoreEngine_T1_QuadNoz_{side}_{z_idx}", (-1.46, 0.28 * sign, z_off),
                radius=0.14, length=0.60, shroud_mat=navy, frame_mat=frame, glow_mat=glow, petals=6,
            )
            core_engine_t1.extend([*sh_t1, *pt_t1])
        core_engine_t1.append(
            lib.build_beveled_armor_plate(
                f"CoreEngine_T1_Cowl_{side}",
                _mirror_y_poly([(-1.72, 0.12), (-1.12, 0.14), (-1.12, 0.44), (-1.72, 0.40)], sign),
                z_bottom=-0.04, z_top=0.22, mat=white, top_inset=0.80, bevel_segments=1,
            )
        )

        # Engine T2: Wide twin hexagonal phase-drive ion cannons + accelerator rings + lower fins
        sh_t2, pt_t2 = lib.build_vector_nozzle(
            f"CoreEngine_T2_PhaseNoz_{side}", (-1.46, 0.34 * sign, 0.02),
            radius=0.25, length=0.72, shroud_mat=navy, frame_mat=frame, glow_mat=glow, petals=8,
        )
        core_engine_t2.extend([*sh_t2, *pt_t2])
        core_engine_t2.extend(
            lib.build_precision_ring_assembly(
                f"CoreEngine_T2_AccelRing_{side}", (-1.84, 0.34 * sign, 0.02), 0.29, 0.028, 16,
                frame, orange, glow, clamp_count=4, rot_deg=(0, 90, 0),
            )
        )
        core_engine_t2.append(
            lib.build_curved_blade(
                f"CoreEngine_T2_VentralFin_{side}",
                _mirror_y_points([(-1.18, 0.28, -0.06), (-1.56, 0.48, -0.34), (-1.88, 0.60, -0.44)], sign),
                widths=[0.46, 0.28, 0.10], thicknesses=[0.06, 0.045, 0.02],
                mat=navy, up_hint=(0.0, -sign * 0.4, -0.9),
            )
        )

        # Cryo Cooler: Frosted twin cryo coolant pipes + louvered gill banks flanking rear deck
        core_cryo.append(
            lib.create_geo(
                f"CoreCryo_ManifoldPipe_{side}", "cylinder", ice_glow,
                location=(-0.78, 0.36 * sign, 0.25), rotation_deg=(0, 90, 0),
                vertices=10, radius=0.036, depth=0.88, bevel=0.0,
            )
        )
        core_cryo.extend(
            lib.build_louver_array(
                f"CoreCryo_GillBank_{side}", (-1.22, 0.36 * sign, 0.29), (-0.42, 0.36 * sign, 0.29),
                count=5, fin_w=0.14, fin_thick=0.028, fin_h=0.06, frame_mat=white, glow_mat=ice_glow,
            )
        )

        # Sensor / Utility: Chin dual grav-collector rings
        core_sensor.extend(
            lib.build_precision_ring_assembly(
                f"CoreSensor_ChinCoil_{side}", (0.48, 0.16 * sign, -0.22), 0.11, 0.018, 12,
                frame, orange, glow, clamp_count=2,
            )
        )

    # Dorsal Telemetry Mast slightly ahead of Spine Bay so it never clips skill_1
    core_sensor.extend(
        lib.build_sensor_mast_array("CoreSensor_Mast", (-0.12, 0.0, 0.28), 0.36, frame, orange, glow)
    )

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [
            stock_hull_shell,
            stock_nose,
            stock_wing_in_l,
            stock_wing_in_r,
            stock_wing_out_l,
            stock_wing_out_r,
            stock_spine,
            [*stock_engine, *nozzle_petals[0], *nozzle_petals[1]],
            core_armor_t1,
            core_armor_t2,
            core_shield,
            core_engine_t1,
            core_engine_t2,
            core_cryo,
            core_sensor,
        ],
        base_meshes=body_parts,
        ao_samples=10,
        ao_radius=0.80,
    )

    # Wing roots stay rigid on Root so outer Wing_L2/R2 modules stay seamlessly locked!
    rig = lib.create_rig(
        "VanguardRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "WingTip_L": ((-0.42, 1.56, 0.02), (-0.42, 2.06, 0.02), "Root"),
            "WingTip_R": ((-0.42, -1.56, 0.02), (-0.42, -1.06, 0.02), "Root"),
            "Canard_L": ((1.10, 0.20, 0.02), (1.10, 0.70, 0.02), "Root"),
            "Canard_R": ((1.10, -0.20, 0.02), (1.10, -0.70, 0.02), "Root"),
            "Vent_L": ((-0.98, 0.07, 0.28), (-0.98, 0.57, 0.28), "Root"),
            "Vent_R": ((-0.98, -0.07, 0.28), (-0.98, -0.57, 0.28), "Root"),
            "Airbrake_L": ((-0.66, 0.31, 0.18), (-0.66, 0.81, 0.18), "Root"),
            "Airbrake_R": ((-0.66, -0.31, 0.18), (-0.66, -0.81, 0.18), "Root"),
            "Nozzle_L": ((-1.55, 0.24, -0.02), (-1.55, 0.74, -0.02), "Root"),
            "Nozzle_R": ((-1.55, -0.24, -0.02), (-1.55, -0.74, -0.02), "Root"),
        },
    )

    static_root = [
        *body_parts,
        *stock_hull_shell,
        *[o for o in stock_nose if o not in canard_parts["Canard_L"] and o not in canard_parts["Canard_R"]],
        *stock_wing_in_l,
        *stock_wing_in_r,
        *stock_spine,
        *stock_engine,
        *core_armor_t1,
        *core_armor_t2,
        *core_shield,
        *core_engine_t1,
        *core_engine_t2,
        *core_cryo,
        *core_sensor,
    ]
    lib.parent_to_bone(static_root, rig, "Root")
    for mp in (canard_parts, wingtip_parts, vent_parts, airbrake_parts):
        for k, pts in mp.items():
            lib.parent_to_bone(pts, rig, k)
    lib.parent_to_bone(nozzle_petals[0], rig, "Nozzle_L")
    lib.parent_to_bone(nozzle_petals[1], rig, "Nozzle_R")

    lib.start_action(rig, "Idle")
    for f, z_h, sweep in [(1, 0.0, 0.0), (24, 0.06, 2.0), (48, 0.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_h))
        lib.key_bone(rig, "WingTip_L", f, rot_deg=(sweep, 0, 0))
        lib.key_bone(rig, "WingTip_R", f, rot_deg=(-sweep, 0, 0))
        lib.key_bone(rig, "Canard_L", f, rot_deg=(sweep * 0.6, 0, 0))
        lib.key_bone(rig, "Canard_R", f, rot_deg=(-sweep * 0.6, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, v_rot, hull_x in [(1, 14.0, 0.0), (12, 26.0, -0.04), (24, 18.0, -0.02), (36, 10.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(hull_x, 0, 0))
        lib.key_bone(rig, "Vent_L", f, rot_deg=(v_rot, 0, 0))
        lib.key_bone(rig, "Vent_R", f, rot_deg=(-v_rot, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "Dash")
    for f, tip_roll, can_sw, nsc in [(1, 14.0, 16.0, 0.80), (16, 18.0, 20.0, 0.72), (32, 14.0, 16.0, 0.80)]:
        lib.key_bone(rig, "WingTip_L", f, rot_deg=(tip_roll, 0, 8.0))
        lib.key_bone(rig, "WingTip_R", f, rot_deg=(-tip_roll, 0, -8.0))
        lib.key_bone(rig, "Canard_L", f, rot_deg=(0, 0, can_sw))
        lib.key_bone(rig, "Canard_R", f, rot_deg=(0, 0, -can_sw))
        lib.key_bone(rig, "Nozzle_L", f, scale=(1.1, nsc, nsc))
        lib.key_bone(rig, "Nozzle_R", f, scale=(1.1, nsc, nsc))
    lib.finalize_action_to_nla(rig, "Dash")

    # Overheat: Dorsal Thermal Vents & Airbrakes pop wide 42 deg with venting shudder!
    lib.start_action(rig, "Overheat")
    for f, vr, ab, sx in [(1, 38.0, 40.0, 0.01), (8, 45.0, 46.0, -0.02), (16, 40.0, 42.0, 0.02), (24, 38.0, 40.0, 0.01)]:
        lib.key_bone(rig, "Root", f, loc=(sx, 0, 0.03))
        lib.key_bone(rig, "Vent_L", f, rot_deg=(vr, 0, 0))
        lib.key_bone(rig, "Vent_R", f, rot_deg=(-vr, 0, 0))
        lib.key_bone(rig, "Airbrake_L", f, rot_deg=(ab, 0, 0))
        lib.key_bone(rig, "Airbrake_R", f, rot_deg=(-ab, 0, 0))
    lib.finalize_action_to_nla(rig, "Overheat")

    lib.export_glb("player_vanguard.glb")


# 2. Enemy Small: "Crimson Scythe" Interceptor (3 evolution forms)
def build_enemy_small() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    red, dark, gold, steel, glow = pal["c_red"], pal["c_dark"], pal["c_gold"], pal["c_steel"], pal["c_glow"]

    hull = lib.build_lofted_hull(
        "Scythe_Hull",
        [
            (-1.25, lib.jet_profile(0.24, 0.16, -0.12, deck_w=0.35)),
            (-0.45, lib.jet_profile(0.38, 0.24, -0.18, deck_w=0.34)),
            (0.40,  lib.jet_profile(0.30, 0.20, -0.14, deck_w=0.32)),
            (1.15,  lib.jet_profile(0.14, 0.10, -0.07, deck_w=0.30)),
            (1.68,  lib.jet_profile(0.02, 0.02, -0.015, deck_w=0.25)),
        ],
        dark, crease_indices={2, 7}, subsurf=1,
    )
    spine = lib.build_beveled_armor_plate(
        "Scythe_CrimsonSpine",
        [(-1.05, -0.16), (0.85, -0.12), (1.32, 0.0), (0.85, 0.12), (-1.05, 0.16)],
        z_bottom=0.14, z_top=0.28, mat=red, top_inset=0.72,
    )
    visor = lib.create_geo(
        "Scythe_OpticSlit", "cube", glow,
        location=(0.95, 0, 0.14), rotation_deg=(0, 12, 0), scale=(0.48, 0.16, 0.06), bevel=0.0,
    )
    shroud, petals = lib.build_vector_nozzle(
        "Scythe_Noz", (-1.32, 0, 0), radius=0.20, length=0.52,
        shroud_mat=dark, frame_mat=steel, glow_mat=glow, petals=6,
    )
    body: list[bpy.types.Object] = [hull, spine, visor, *shroud, *petals]
    body.extend(lib.build_louver_array("Scythe_SpineVents", (-0.82, 0.0, 0.28), (-0.18, 0.0, 0.28), 5, 0.14, 0.035, 0.05, steel, glow))

    # Stage 3 Overdrive Crown on dorsal hull
    crown = [
        lib.build_curved_blade(
            f"Form3_Scythe_CrownBlade_{i}",
            [(-0.35 + i * 0.25, 0.0, 0.28), (-0.52 + i * 0.25, 0.0, 0.56 + i * 0.06)],
            widths=[0.14, 0.02], thicknesses=[0.06, 0.015], mat=glow if i == 1 else gold, up_hint=(0, 1, 0),
        )
        for i in range(3)
    ]
    body.extend(crown)

    wings: dict[str, list[bpy.types.Object]] = {}
    for sign, key in ((1, "Scythe_L"), (-1, "Scythe_R")):
        body.append(
            lib.build_curved_blade(
                f"Scythe_Tail_{key}",
                _mirror_y_points([(-0.85, 0.20, 0.10), (-1.32, 0.44, 0.42)], sign),
                widths=[0.40, 0.12], thicknesses=[0.06, 0.02], mat=red, up_hint=(0.0, -sign * 0.4, 0.9),
            )
        )
        # Compact Root Pulse Barrel
        body.append(
            lib.create_geo(
                f"Scythe_RootGun_{key}", "cylinder", steel,
                location=(0.68, 0.34 * sign, 0.02), rotation_deg=(0, 90, 0), vertices=8, radius=0.04, depth=0.62, bevel=0.0,
            )
        )
        # Form 1 Only: Sleek Narrow Swept-Back Dart Interceptor Wings (span ±0.98)
        f1_dart = lib.build_airfoil_wing(
            f"Form1Only_Scythe_{key}_DartWing",
            _mirror_y_wing_stations([
                (0.28, 0.42, -0.78, 0.0, 0.12),
                (0.76, -0.14, -0.98, 0.04, 0.07),
                (1.02, -0.62, -1.16, 0.08, 0.03),
            ], sign),
            mat=red, bevel=0.008, bevel_segments=1,
        )
        f1_rib = lib.build_beveled_armor_plate(
            f"Form1Only_Scythe_{key}_DartTrim",
            _mirror_y_poly([(-0.66, 0.34), (0.20, 0.32), (0.04, 0.68), (-0.72, 0.72)], sign),
            z_bottom=0.04, z_top=0.12, mat=dark, top_inset=0.80,
        )
        # Form 2 Only: Wide Hooked Crescent Scythe Wings (span ±1.68!)
        f2_blade = lib.build_curved_blade(
            f"Form2Only_Scythe_{key}_CrescentBlade",
            _mirror_y_points([(-0.40, 0.34, 0.0), (-0.08, 1.12, 0.08), (0.66, 1.66, 0.04), (1.48, 1.18, -0.04)], sign),
            widths=[0.74, 0.62, 0.40, 0.04], thicknesses=[0.13, 0.09, 0.06, 0.015], mat=red,
        )
        f2_pod = lib.build_railgun_assembly(
            f"Form2Only_Scythe_{key}_PlasmaPod", (0.28, 0.96 * sign, -0.06), 0.56, dark, gold, glow
        )
        # Form 3: Split Twin-Blade Overdrive Scythes + Molten Outer Lances (span ±2.12!)
        f3_outer = lib.build_curved_blade(
            f"Form3_Scythe_{key}_ApexOuter",
            _mirror_y_points([(-0.36, 0.36, 0.02), (0.14, 1.42, 0.14), (1.12, 2.08, 0.08), (1.86, 1.38, -0.02)], sign),
            widths=[0.64, 0.52, 0.34, 0.035], thicknesses=[0.12, 0.08, 0.05, 0.015], mat=gold, samples_per_seg=2,
        )
        f3_inner = lib.build_curved_blade(
            f"Form3_Scythe_{key}_ApexInner",
            _mirror_y_points([(-0.56, 0.38, 0.14), (-0.28, 1.18, 0.24), (0.48, 1.72, 0.16)], sign),
            widths=[0.38, 0.28, 0.04], thicknesses=[0.08, 0.06, 0.015], mat=red, samples_per_seg=2,
        )
        f3_edge = lib.build_curved_blade(
            f"Form3_Scythe_{key}_GlowEdge",
            _mirror_y_points([(0.12, 1.24, 0.16), (0.98, 1.98, 0.10), (1.76, 1.38, 0.0)], sign),
            widths=[0.12, 0.10, 0.02], thicknesses=[0.05, 0.04, 0.012], mat=glow, samples_per_seg=2,
        )
        wings[key] = [f1_dart, f1_rib, f2_blade, *f2_pod, f3_outer, f3_inner, f3_edge]

    lib.bake_staged_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.8)

    rig = lib.create_rig(
        "ScytheRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "Scythe_L": ((-0.25, 0.34, 0), (-0.25, 0.84, 0), "Root"),
            "Scythe_R": ((-0.25, -0.34, 0), (-0.25, 0.16, 0), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(wings["Scythe_L"], rig, "Scythe_L")
    lib.parent_to_bone(wings["Scythe_R"], rig, "Scythe_R")

    lib.start_action(rig, "Idle")
    for f, bank, flap in [(1, 0.0, -5.0), (14, 7.0, 8.0), (28, 0.0, -5.0)]:
        lib.key_bone(rig, "Root", f, rot_deg=(bank, 0, 0))
        lib.key_bone(rig, "Scythe_L", f, rot_deg=(flap, 0, 0))
        lib.key_bone(rig, "Scythe_R", f, rot_deg=(-flap, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, spread in [(1, 0.0), (14, 18.0), (28, 22.0)]:
        lib.key_bone(rig, "Scythe_L", f, rot_deg=(10.0, 0, spread))
        lib.key_bone(rig, "Scythe_R", f, rot_deg=(-10.0, 0, -spread))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, clench, fwd in [(1, -8.0, 0.0), (10, -24.0, 0.25), (22, -8.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(fwd, 0, 0))
        lib.key_bone(rig, "Scythe_L", f, rot_deg=(0, 0, clench))
        lib.key_bone(rig, "Scythe_R", f, rot_deg=(0, 0, -clench))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("enemy_small.glb")


# 3. Enemy Medium: "Viper Halberd" Twin-Boom Gunship (3 evolution forms)
def build_enemy_medium() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    red, dark, gold, steel, glow = pal["c_red"], pal["c_dark"], pal["c_gold"], pal["c_steel"], pal["c_glow"]

    center_core = lib.create_geo("Viper_ReactorCell", "sphere", glow, location=(-0.15, 0, 0.05), scale=(0.62, 0.52, 0.42), bevel=0.0)
    center_cage = lib.build_beveled_armor_plate(
        "Viper_CoreBridge",
        [(-0.75, -0.78), (0.35, -0.68), (0.55, 0.0), (0.35, 0.68), (-0.75, 0.78)],
        z_bottom=-0.18, z_top=0.14, mat=dark, top_inset=0.88,
    )
    center_shield = lib.build_beveled_armor_plate(
        "Viper_BridgeHood",
        [(-0.68, -0.45), (0.28, -0.35), (0.45, 0.0), (0.28, 0.35), (-0.68, 0.45)],
        z_bottom=0.22, z_top=0.38, mat=red, top_inset=0.72,
    )
    shroud, petals = lib.build_vector_nozzle(
        "Viper_CenterNoz", (-0.90, 0, 0.02), radius=0.24, length=0.55,
        shroud_mat=dark, frame_mat=steel, glow_mat=glow, petals=6,
    )
    body: list[bpy.types.Object] = [center_core, center_cage, center_shield, *shroud, *petals]
    body.extend(lib.build_sensor_mast_array("Viper_Sensor", (-0.42, 0.0, 0.36), 0.62, dark, gold, glow))

    # Stage 3 Dorsal Accelerator Halo + VLS Silo
    f3_halo = lib.build_precision_ring_assembly(
        "Form3_Viper_DorsalHalo", (-0.15, 0.0, 0.48), 0.74, 0.045, 22, dark, gold, glow, clamp_count=4
    )
    body.extend(f3_halo)

    boom_parts: dict[str, list[bpy.types.Object]] = {}
    barrel_parts: dict[str, list[bpy.types.Object]] = {}
    shutter_parts: dict[str, list[bpy.types.Object]] = {}

    for sign, bkey, gkey, skey in ((1, "Boom_L", "Bar_L", "Sht_L"), (-1, "Boom_R", "Bar_R", "Sht_R")):
        by = 0.88 * sign
        boom_hull = lib.build_lofted_hull(
            f"Viper_{bkey}_Hull",
            [
                (-1.25, [(by - 0.16, 0.14), (by + 0.16, 0.14), (by + 0.22, -0.10), (by - 0.22, -0.10)]),
                (-0.40, [(by - 0.26, 0.24), (by + 0.26, 0.24), (by + 0.34, -0.18), (by - 0.34, -0.18)]),
                (0.70,  [(by - 0.24, 0.22), (by + 0.24, 0.22), (by + 0.32, -0.16), (by - 0.32, -0.16)]),
                (1.42,  [(by - 0.12, 0.12), (by + 0.12, 0.12), (by + 0.18, -0.10), (by - 0.18, -0.10)]),
            ],
            dark, crease_indices={0, 1, 2, 3}, subsurf=1,
        )
        armor_cap = lib.build_beveled_armor_plate(
            f"Viper_{bkey}_Cap",
            _mirror_y_poly([(-0.95, 0.62), (1.15, 0.72), (1.35, 1.04), (-0.85, 1.16)], sign),
            z_bottom=0.14, z_top=0.30, mat=red, top_inset=0.80,
        )
        sub_noz, sub_pet = lib.build_vector_nozzle(
            f"Viper_{bkey}_Noz", (-1.32, by, 0.0), radius=0.18, length=0.45,
            shroud_mat=dark, frame_mat=steel, glow_mat=glow, petals=6,
        )
        # Form 1 Only: Compact Stub Winglet
        f1_fin = lib.build_airfoil_wing(
            f"Form1Only_Viper_{bkey}_StubFin",
            _mirror_y_wing_stations([(1.06, 0.25, -0.75, 0.02, 0.12), (1.36, -0.25, -0.95, 0.10, 0.04)], sign),
            mat=red, bevel=0.008, bevel_segments=1,
        )
        # Form 2 Only: Wide Wing Sponsons + Twin Outboard Plasma Rails (span ±1.86!)
        f2_wing = lib.build_airfoil_wing(
            f"Form2Only_Viper_{bkey}_WideWing",
            _mirror_y_wing_stations([(1.04, 0.52, -0.82, 0.02, 0.15), (1.84, 0.12, -1.16, 0.14, 0.05)], sign),
            mat=gold, bevel=0.008, bevel_segments=1,
        )
        f2_rail = lib.build_railgun_assembly(
            f"Form2Only_Viper_{bkey}_OutRail", (0.36, 1.56 * sign, 0.10), 0.78, dark, steel, glow
        )
        # Form 3: Colossal Swept Battlecruiser Wings + Broadside Dual Rail Turret (span ±2.24!)
        f3_wing = lib.build_airfoil_wing(
            f"Form3_Viper_{bkey}_ApexWing",
            _mirror_y_wing_stations([
                (1.04, 0.64, -0.76, 0.04, 0.18),
                (1.68, 0.92, -0.52, 0.16, 0.10),
                (2.24, 0.36, -1.04, 0.28, 0.04),
            ], sign),
            mat=red, camber=0.06, bevel=0.01, bevel_segments=1,
        )
        f3_edge = lib.build_curved_blade(
            f"Form3_Viper_{bkey}_ApexBlade",
            _mirror_y_points([(0.48, 1.06, 0.12), (0.86, 1.78, 0.22), (0.24, 2.26, 0.30)], sign),
            widths=[0.18, 0.14, 0.025], thicknesses=[0.08, 0.05, 0.015], mat=glow, samples_per_seg=2,
        )
        f3_tur, f3_bar = lib.build_heavy_turret(
            f"Form3_Viper_{bkey}_SideTurret", (0.12, 1.48 * sign, 0.18), 0.44, steel, dark, glow, barrels=2
        )
        boom_parts[bkey] = [
            boom_hull, armor_cap, *sub_noz, *sub_pet,
            f1_fin, f2_wing, *f2_rail, f3_wing, f3_edge, *f3_tur, *f3_bar,
        ]
        barrel_parts[gkey] = lib.build_railgun_assembly(
            f"Viper_{gkey}", (0.85, by, 0.02), scale_f=0.95,
            shroud_mat=red, frame_mat=steel, glow_mat=glow,
        )
        shutter_parts[skey] = [
            lib.build_beveled_armor_plate(
                f"Viper_{skey}_Door",
                _mirror_y_poly([(0.15, 0.68), (1.12, 0.72), (1.12, 1.02), (0.15, 1.04)], sign),
                z_bottom=0.24, z_top=0.38, mat=steel, top_inset=0.80,
            )
        ]

    lib.bake_staged_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.85)

    rig = lib.create_rig(
        "ViperRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "Boom_L": ((0, 0.88, 0), (0, 1.38, 0), "Root"),
            "Boom_R": ((0, -0.88, 0), (0, -0.38, 0), "Root"),
            "Bar_L": ((0.85, 0.88, 0.02), (0.85, 1.38, 0.02), "Boom_L"),
            "Bar_R": ((0.85, -0.88, 0.02), (0.85, -0.38, 0.02), "Boom_R"),
            "Sht_L": ((0.60, 0.88, 0.30), (0.60, 1.38, 0.30), "Boom_L"),
            "Sht_R": ((0.60, -0.88, 0.30), (0.60, -0.38, 0.30), "Boom_R"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    for mp in (boom_parts, barrel_parts, shutter_parts):
        for k, objs in mp.items():
            lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, z in [(1, 0.0), (20, 0.06), (40, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, split, fwd, drop in [(1, 0.0, 0.0, 0.0), (14, 0.24, 0.32, 0.22), (28, 0.28, 0.36, 0.26)]:
        lib.key_bone(rig, "Boom_L", f, loc=(0, split, 0))
        lib.key_bone(rig, "Boom_R", f, loc=(0, -split, 0))
        lib.key_bone(rig, "Bar_L", f, loc=(fwd, 0, 0))
        lib.key_bone(rig, "Bar_R", f, loc=(fwd, 0, 0))
        lib.key_bone(rig, "Sht_L", f, loc=(-0.25, drop, 0.10))
        lib.key_bone(rig, "Sht_R", f, loc=(-0.25, -drop, 0.10))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, bl, br in [(1, 0.32, -0.10), (10, -0.34, 0.32), (20, 0.32, -0.34), (32, 0.0, 0.0)]:
        lib.key_bone(rig, "Boom_L", f, loc=(0, 0.18, 0))
        lib.key_bone(rig, "Boom_R", f, loc=(0, -0.18, 0))
        lib.key_bone(rig, "Bar_L", f, loc=(bl, 0, 0))
        lib.key_bone(rig, "Bar_R", f, loc=(br, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("enemy_medium.glb")


# 4. Enemy Large: "Void Ravager" Mandible Ram-Cruiser (3 evolution forms)
def build_enemy_large() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    chitin, dark, bone, glow, mag = pal["v_chitin"], pal["v_dark"], pal["v_bone"], pal["v_glow"], pal["v_magenta"]

    hull = lib.build_lofted_hull(
        "Juggernaut_Hull",
        [
            (-1.55, lib.jet_profile(0.92, 0.36, -0.26, deck_w=0.45)),
            (-0.65, lib.jet_profile(1.18, 0.46, -0.32, deck_w=0.48)),
            (0.45,  lib.jet_profile(1.04, 0.42, -0.28, deck_w=0.44)),
            (1.15,  lib.jet_profile(0.60, 0.24, -0.18, deck_w=0.40)),
        ],
        dark, crease_indices={2, 7}, subsurf=1,
    )
    back_armor = lib.build_beveled_armor_plate(
        "Juggernaut_DorsalShell",
        [(-1.35, -0.68), (0.35, -0.78), (0.78, 0.0), (0.35, 0.78), (-1.35, 0.68)],
        z_bottom=0.28, z_top=0.56, mat=chitin, top_inset=0.78,
    )
    ram_core = lib.create_geo("Juggernaut_RamSingularity", "ico", mag, location=(1.10, 0, 0.08), scale=(0.55, 0.55, 0.45), subdivisions=2, bevel=0.0)
    tur_head, tur_bars = lib.build_heavy_turret(
        "Juggernaut_DorsalTurret", (-0.35, 0, 0.54), scale_f=0.72,
        armor_mat=bone, frame_mat=dark, glow_mat=glow, barrels=2,
    )
    body: list[bpy.types.Object] = [hull, back_armor, ram_core]
    body.extend(lib.build_detail_rib_band("Juggernaut_DorsalRibs", [(-1.10, 0.0, 0.58), (-0.65, 0.0, 0.58), (-0.05, 0.0, 0.56)], 3, 0.62, 0.10, bone))

    mandible_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, mkey in ((1, "Mandible_L"), (-1, "Mandible_R")):
        # Form 1 Only: Sealed heavy armored side guards
        body.append(
            lib.build_beveled_armor_plate(
                f"Form1Only_Juggernaut_SealedPod_{sign}",
                _mirror_y_poly([(-1.25, 0.85), (0.65, 0.80), (0.95, 1.30), (-1.15, 1.40)], sign),
                z_bottom=-0.22, z_top=0.28, mat=chitin, top_inset=0.82,
            )
        )
        # Form 2 Only: Wide Flaring Carapace Shields + Wing-Blades (span ±1.92!)
        body.append(
            lib.build_beveled_armor_plate(
                f"Form2Only_Juggernaut_BroadShield_{sign}",
                _mirror_y_poly([(-1.15, 0.88), (0.78, 0.92), (0.96, 1.88), (-1.28, 1.72)], sign),
                z_bottom=-0.12, z_top=0.34, mat=bone, top_inset=0.82, bevel=0.015, bevel_segments=1,
            )
        )
        body.append(
            lib.create_geo(
                f"Form2Only_Juggernaut_PodGlow_{sign}", "cube", glow,
                location=(0.12, 1.62 * sign, 0.28), rotation_deg=(0, 0, -14 * sign),
                scale=(0.94, 0.09, 0.09), bevel=0.0,
            )
        )
        # Form 3: Colossal Flaring Crystalline Dorsal Spine-Wings (span ±2.24!)
        body.append(
            lib.build_curved_blade(
                f"Form3_Juggernaut_SpineWingA_{sign}",
                _mirror_y_points([(0.34, 0.92, 0.28), (-0.28, 1.78, 0.44), (-1.24, 2.22, 0.26)], sign),
                widths=[0.36, 0.28, 0.04], thicknesses=[0.14, 0.10, 0.025], mat=glow, samples_per_seg=2,
            )
        )
        body.append(
            lib.build_curved_blade(
                f"Form3_Juggernaut_SpineWingB_{sign}",
                _mirror_y_points([(-0.08, 0.92, 0.24), (-0.68, 1.62, 0.36), (-1.48, 1.94, 0.18)], sign),
                widths=[0.28, 0.22, 0.03], thicknesses=[0.12, 0.08, 0.02], mat=mag, samples_per_seg=2,
            )
        )
        for j, oy in enumerate((0.48, 1.02)):
            shroud, petals = lib.build_vector_nozzle(
                f"Juggernaut_Noz_{sign}_{j}", (-1.58, oy * sign, 0.02), radius=0.20, length=0.54,
                shroud_mat=dark, frame_mat=bone, glow_mat=glow, petals=6,
            )
            body.extend([*shroud, *petals])

        claw_outer = lib.build_curved_blade(
            f"Juggernaut_ClawOuter_{mkey}",
            _mirror_y_points([(0.55, 0.80, 0.04), (1.36, 1.04, 0.08), (2.06, 0.82, 0.06), (2.52, 0.22, 0.02)], sign),
            widths=[0.48, 0.42, 0.30, 0.04], thicknesses=[0.28, 0.22, 0.15, 0.035], mat=chitin,
        )
        claw_edge = lib.build_curved_blade(
            f"Juggernaut_ClawEdge_{mkey}",
            _mirror_y_points([(0.85, 0.70, 0.04), (1.50, 0.84, 0.06), (2.12, 0.60, 0.04), (2.58, 0.18, 0.02)], sign),
            widths=[0.20, 0.18, 0.14, 0.03], thicknesses=[0.16, 0.12, 0.09, 0.02], mat=bone,
        )
        claw_piston = lib.build_hydraulic_strut(
            f"Juggernaut_Piston_{mkey}", (0.38, 0.72 * sign, 0.04), (1.06, 0.96 * sign, 0.04), 0.06, dark, bone
        )
        apex_jaw = lib.build_curved_blade(
            f"Form3_Juggernaut_ApexJaw_{mkey}",
            _mirror_y_points([(1.28, 0.92, 0.08), (2.18, 1.12, 0.10), (3.02, 0.24, 0.02)], sign),
            widths=[0.28, 0.22, 0.03], thicknesses=[0.14, 0.10, 0.02], mat=mag, samples_per_seg=2,
        )
        mandible_parts[mkey] = [claw_outer, claw_edge, *claw_piston, apex_jaw]

    lib.bake_staged_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.95)

    rig = lib.create_rig(
        "JuggernautRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "Turret": ((-0.35, 0, 0.54), (-0.35, 0.50, 0.54), "Root"),
            "Mandible_L": ((0.55, 0.80, 0.04), (0.55, 1.30, 0.04), "Root"),
            "Mandible_R": ((0.55, -0.80, 0.04), (0.55, -0.30, 0.04), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone([*tur_head, *tur_bars], rig, "Turret")
    lib.parent_to_bone(mandible_parts["Mandible_L"], rig, "Mandible_L")
    lib.parent_to_bone(mandible_parts["Mandible_R"], rig, "Mandible_R")

    lib.start_action(rig, "Idle")
    for f, yaw, jaw in [(1, 0.0, 4.0), (24, 14.0, 8.0), (48, -14.0, 4.0)]:
        lib.key_bone(rig, "Turret", f, rot_deg=(0, 0, yaw))
        lib.key_bone(rig, "Mandible_L", f, rot_deg=(0, 0, jaw))
        lib.key_bone(rig, "Mandible_R", f, rot_deg=(0, 0, -jaw))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, pull, spread in [(1, 0.0, 12.0), (14, -0.42, 34.0), (28, -0.46, 38.0)]:
        lib.key_bone(rig, "Root", f, loc=(pull, 0, 0))
        lib.key_bone(rig, "Mandible_L", f, rot_deg=(0, 0, spread))
        lib.key_bone(rig, "Mandible_R", f, rot_deg=(0, 0, -spread))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, lunge, clamp in [(1, 0.35, -14.0), (10, 0.45, -18.0), (20, 0.35, -14.0)]:
        lib.key_bone(rig, "Root", f, loc=(lunge, 0, 0), scale=(1.12, 0.92, 0.96))
        lib.key_bone(rig, "Mandible_L", f, rot_deg=(0, 0, clamp))
        lib.key_bone(rig, "Mandible_R", f, rot_deg=(0, 0, -clamp))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("enemy_large.glb")


# 5. Enemy Splitter: "Void Tri-Scythe" Razor Swarm Drone
def build_enemy_splitter() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    chitin, dark, bone, glow, mag = pal["v_chitin"], pal["v_dark"], pal["v_bone"], pal["v_glow"], pal["v_magenta"]

    core = lib.create_geo("TriPetal_Core", "ico", mag, location=(0, 0, 0), scale=(0.48, 0.48, 0.44), subdivisions=2, bevel=0.0)
    upper_dome = lib.create_geo("TriPetal_Dome", "cylinder", dark, location=(0, 0, 0.12), vertices=6, radius=0.58, depth=0.22, bevel=0.02, bevel_segments=1)
    lower_hull = lib.create_geo("TriPetal_Keel", "cylinder", chitin, location=(0, 0, -0.06), vertices=6, radius=0.68, depth=0.18, bevel=0.02, bevel_segments=1)
    body: list[bpy.types.Object] = [core, upper_dome, lower_hull]
    inner_gyro = lib.build_precision_ring_assembly(
        "TriPetal_Gyro", (0.0, 0.0, 0.24), 0.46, 0.042, 20, bone, dark, glow, clamp_count=3
    )

    arm_parts: list[list[bpy.types.Object]] = []
    for i in range(3):
        ang = (i / 3.0) * math.tau
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (ca * 0.52, sa * 0.52, 0.0),
            (ca * 1.04 - sa * 0.32, sa * 1.04 + ca * 0.32, 0.14),
            (ca * 1.62 - sa * 0.04, sa * 1.62 + ca * 0.04, 0.02),
        ]
        petal = lib.build_curved_blade(
            f"TriPetal_Blade_{i}", pts, widths=[0.48, 0.38, 0.04], thicknesses=[0.16, 0.11, 0.025], mat=chitin,
        )
        spine_b = lib.build_curved_blade(
            f"TriPetal_BoneSpine_{i}", pts, widths=[0.24, 0.18, 0.03], thicknesses=[0.18, 0.12, 0.025], mat=bone,
        )
        edge = lib.build_curved_blade(
            f"TriPetal_Edge_{i}", pts[1:], widths=[0.24, 0.03], thicknesses=[0.07, 0.015], mat=glow,
        )
        knuckle = lib.build_hydraulic_strut(
            f"TriPetal_Piston_{i}", (ca * 0.46, sa * 0.46, 0.04), (ca * 0.88 - sa * 0.14, sa * 0.88 + ca * 0.14, 0.08), 0.035, dark, bone
        )
        arm_parts.append([petal, spine_b, edge, *knuckle])

    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.75)

    bones = {
        "Root": ((0, 0, 0), (0, 0.5, 0), None),
        "InnerGyro": ((0, 0, 0.24), (0, 0.5, 0.24), "Root"),
    }
    for i in range(3):
        ang = (i / 3.0) * math.tau
        hx, hy = math.cos(ang) * 0.52, math.sin(ang) * 0.52
        bones[f"Arm_{i}"] = ((hx, hy, 0.0), (hx, hy + 0.5, 0.0), "Root")
    rig = lib.create_rig("TriPetalRig", bones)
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(inner_gyro, rig, "InnerGyro")
    for i in range(3):
        lib.parent_to_bone(arm_parts[i], rig, f"Arm_{i}")

    lib.start_action(rig, "Idle")
    for f, rot_z in [(1, 0.0), (16, 120.0), (32, 240.0), (48, 360.0)]:
        lib.key_bone(rig, "Root", f, rot_deg=(0, 0, rot_z))
        lib.key_bone(rig, "InnerGyro", f, rot_deg=(0, 0, -rot_z * 2.0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, rot_z, sc in [(1, 0.0, 1.0), (14, 180.0, 1.24), (28, 360.0, 1.15)]:
        lib.key_bone(rig, "Root", f, rot_deg=(0, 0, rot_z), scale=(sc, sc, 1.0))
        lib.key_bone(rig, "InnerGyro", f, rot_deg=(0, 0, -rot_z))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, rot_z, sc in [(1, 0.0, 1.0), (12, 180.0, 1.22), (24, 360.0, 1.0)]:
        lib.key_bone(rig, "Root", f, rot_deg=(0, 0, rot_z), scale=(sc, sc, 1.0))
        lib.key_bone(rig, "InnerGyro", f, rot_deg=(0, 0, -rot_z * 2.0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("enemy_splitter.glb")


# 6. Enemy Elite: "Seraphim Chrono-Lance" Rail Sniper (3 evolution forms)
def build_enemy_elite() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    ivory, gold, dark, solar, cyan = pal["s_ivory"], pal["s_gold"], pal["s_dark"], pal["s_solar"], pal["s_cyan"]

    hull = lib.build_lofted_hull(
        "Chrono_Hull",
        [
            (-1.65, lib.jet_profile(0.28, 0.20, -0.15, deck_w=0.35)),
            (-0.75, lib.jet_profile(0.56, 0.34, -0.24, deck_w=0.36)),
            (0.20,  lib.jet_profile(0.42, 0.28, -0.20, deck_w=0.34)),
            (1.10,  lib.jet_profile(0.18, 0.12, -0.09, deck_w=0.30)),
        ],
        ivory, crease_indices={2, 7}, subsurf=1,
    )
    crown = lib.build_beveled_armor_plate(
        "Chrono_GoldCrown",
        [(-0.95, -0.20), (0.35, -0.14), (0.72, 0.0), (0.35, 0.14), (-0.95, 0.20)],
        z_bottom=0.22, z_top=0.38, mat=gold, top_inset=0.72,
    )
    eye = lib.create_geo("Chrono_EyeCore", "sphere", cyan, location=(0.25, 0, 0.32), scale=(0.36, 0.24, 0.16), bevel=0.0)
    beam_core = lib.create_geo("Chrono_AcceleratorBeam", "cube", cyan, location=(1.45, 0, 0.04), scale=(2.35, 0.07, 0.07), bevel=0.0)
    body: list[bpy.types.Object] = [hull, crown, eye, beam_core]
    for sign in (1, -1):
        shroud, petals = lib.build_vector_nozzle(
            f"Chrono_Noz_{sign}", (-1.65, 0.18 * sign, 0.0), radius=0.11, length=0.32,
            shroud_mat=dark, frame_mat=gold, glow_mat=cyan, petals=6,
        )
        body.extend([*shroud, *petals])

    rails: dict[str, list[bpy.types.Object]] = {}
    fins: dict[str, list[bpy.types.Object]] = {}
    for sign, rkey in ((1, "Lance_L"), (-1, "Lance_R")):
        lance = lib.build_curved_blade(
            f"Chrono_{rkey}",
            _mirror_y_points([(0.05, 0.32, 0.04), (1.35, 0.28, 0.04), (2.78, 0.14, 0.04)], sign),
            widths=[0.26, 0.18, 0.04], thicknesses=[0.16, 0.12, 0.04], mat=ivory,
        )
        trim = lib.build_beveled_armor_plate(
            f"Chrono_{rkey}_Trim",
            _mirror_y_poly([(0.15, 0.24), (2.05, 0.18), (2.25, 0.28), (0.15, 0.36)], sign),
            z_bottom=-0.04, z_top=0.14, mat=gold, top_inset=0.84,
        )
        coils = lib.build_armor_greeble_strip(
            f"Form2_Chrono_{rkey}_Coils",
            (0.65, 0.34 * sign, 0.04), (2.15, 0.24 * sign, 0.04), 4, (0.08, 0.14, 0.16), dark, cyan,
        )
        rails[rkey] = [lance, trim, *coils]

        # Form 1 Only: Sleek compact folded winglet shroud (span ±0.88)
        body.append(
            lib.build_airfoil_wing(
                f"Form1Only_Chrono_FoldedFin_{sign}",
                _mirror_y_wing_stations([(0.34, 0.36, -0.78, 0.02, 0.10), (0.88, -0.48, -1.16, 0.08, 0.04)], sign),
                mat=ivory, bevel=0.008, bevel_segments=1,
            )
        )

    # Form 2 Only: Unfolded Wide Crescent Stabilizer Wings (span ±1.82)
    # Form 3: 4 Huge X-Configuration Radiant Seraphim Wings (span ±2.18!)
    for idx, (sy, sz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
        fkey = f"Fin_{idx}"
        fin_f2 = lib.build_curved_blade(
            f"Form2Only_Chrono_{fkey}_Crescent",
            [(-0.45, 0.35 * sy, 0.10 * sz), (-0.98, 1.32 * sy, 0.28 * sz), (-1.42, 1.78 * sy, 0.36 * sz)],
            widths=[0.46, 0.28, 0.05], thicknesses=[0.09, 0.06, 0.02],
            mat=gold if sz > 0 else ivory, up_hint=(0.0, -sy * 0.3, sz * 0.9),
        )
        fin_f3 = lib.build_curved_blade(
            f"Form3_Chrono_{fkey}_SeraphBlade",
            [(-0.45, 0.35 * sy, 0.16 * sz), (-1.18, 1.62 * sy, 0.62 * sz), (-1.92, 2.18 * sy, 0.88 * sz)],
            widths=[0.56, 0.36, 0.06], thicknesses=[0.10, 0.07, 0.02],
            mat=ivory if sz > 0 else dark, up_hint=(0.0, -sy * 0.3, sz * 0.9),
        )
        tip_f3 = lib.create_geo(
            f"Form3_Chrono_{fkey}_Glow", "cube", solar,
            location=(-1.56, 1.88 * sy, 0.74 * sz), scale=(0.52, 0.06, 0.06), bevel=0.0,
        )
        fins[fkey] = [fin_f2, fin_f3, tip_f3]

    # Precision Chrono Rings at stern (Form 2 gold arcs -> Form 3 full Astrolabe Halo!)
    chrono_arcs: list[bpy.types.Object] = []
    chrono_arcs.extend(
        lib.build_precision_ring_assembly(
            "Form2_Chrono_GyroHalo", (-1.28, 0.0, 0.0), 0.88, 0.045, 22, gold, dark, cyan, clamp_count=4, rot_deg=(0, 90, 0)
        )
    )
    chrono_arcs.extend(
        lib.build_precision_ring_assembly(
            "Form3_Chrono_ApexAstrolabe", (-1.34, 0.0, 0.0), 1.32, 0.058, 28, ivory, gold, solar, clamp_count=8, rot_deg=(0, 90, 0)
        )
    )

    lib.bake_staged_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.85)

    bones = {
        "Root": ((0, 0, 0), (0, 0.5, 0), None),
        "Lance_L": ((0.15, 0.28, 0.04), (0.15, 0.78, 0.04), "Root"),
        "Lance_R": ((0.15, -0.28, 0.04), (0.15, 0.22, 0.04), "Root"),
        "ChronoRing": ((-1.30, 0, 0), (-1.30, 0.5, 0), "Root"),
    }
    for idx, (sy, sz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
        bones[f"Fin_{idx}"] = ((-0.45, 0.35 * sy, 0.15 * sz), (-0.45, 0.35 * sy + 0.5, 0.15 * sz), "Root")

    rig = lib.create_rig("ChronoRig", bones)
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(chrono_arcs, rig, "ChronoRing")
    for k, objs in {**rails, **fins}.items():
        lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, rot_x in [(1, 0.0), (24, 180.0), (48, 360.0)]:
        lib.key_bone(rig, "ChronoRing", f, rot_deg=(rot_x, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, sep, rot_x in [(1, 0.0, 0.0), (14, 0.26, 220.0), (28, 0.30, 360.0)]:
        lib.key_bone(rig, "Lance_L", f, loc=(0, sep, 0))
        lib.key_bone(rig, "Lance_R", f, loc=(0, -sep, 0))
        lib.key_bone(rig, "ChronoRing", f, rot_deg=(rot_x, 0, 0))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, rec in [(1, -0.45), (12, 0.05), (24, 0.0)]:
        lib.key_bone(rig, "Lance_L", f, loc=(rec, 0.22, 0))
        lib.key_bone(rig, "Lance_R", f, loc=(rec, -0.22, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("enemy_elite.glb")


# 7. Boss 0: Destroyer ("Iron Valkyrie" - Wedge -> Catamaran -> Inferno X)
def build_boss_destroyer() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    red, dark, gold, steel, glow = pal["c_red"], pal["c_dark"], pal["c_gold"], pal["c_steel"], pal["c_glow"]

    # --- SHARED CORE CITADEL & STERN THRUSTERS ---
    stern_hull = lib.build_lofted_hull(
        "Destroyer_SternHull",
        [
            (-1.18, lib.jet_profile(0.64, 0.24, -0.20, deck_w=0.46)),
            (-0.62, lib.jet_profile(0.84, 0.30, -0.24, deck_w=0.48)),
            (0.06,  lib.jet_profile(0.60, 0.24, -0.20, deck_w=0.44)),
            (0.48,  lib.jet_profile(0.28, 0.14, -0.15, deck_w=0.36)),
        ],
        dark, crease_indices={2, 7}, subsurf=1,
    )
    citadel_t1 = lib.build_beveled_armor_plate(
        "Destroyer_CitadelTier1",
        [(-1.02, -0.44), (-0.16, -0.48), (0.06, 0.0), (-0.16, 0.48), (-1.02, 0.44)],
        z_bottom=0.20, z_top=0.36, mat=red, top_inset=0.82,
    )
    citadel_t2 = lib.build_beveled_armor_plate(
        "Destroyer_CitadelTier2",
        [(-0.88, -0.32), (-0.28, -0.34), (-0.12, 0.0), (-0.28, 0.34), (-0.88, 0.32)],
        z_bottom=0.35, z_top=0.48, mat=dark, top_inset=0.80,
    )
    citadel_bridge = lib.build_beveled_armor_plate(
        "Destroyer_CommandBridge",
        [(-0.74, -0.20), (-0.36, -0.22), (-0.26, 0.0), (-0.36, 0.22), (-0.74, 0.20)],
        z_bottom=0.47, z_top=0.60, mat=steel, top_inset=0.76,
    )
    bridge_visor = lib.create_geo(
        "Destroyer_BridgeVisor", "cube", glow,
        location=(-0.30, 0, 0.52), scale=(0.07, 0.30, 0.045), bevel=0.0,
    )
    reactor_core = lib.create_geo(
        "Destroyer_ReactorCore", "sphere", glow,
        location=(0.28, 0, 0.14), scale=(0.40, 0.36, 0.34), segments=18, rings=12, bevel=0.0,
    )
    body: list[bpy.types.Object] = [
        stern_hull, citadel_t1, citadel_t2, citadel_bridge, bridge_visor, reactor_core
    ]
    body.extend(lib.build_sensor_mast_array("Destroyer_BridgeSensor", (-0.58, 0.0, 0.60), 0.78, dark, gold, glow))

    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        body.append(
            lib.build_beveled_armor_plate(
                f"Destroyer_BridgeWing_{side}",
                _mirror_y_poly([(-0.62, 0.20), (-0.42, 0.20), (-0.48, 0.52), (-0.68, 0.50)], sign),
                z_bottom=0.45, z_top=0.52, mat=red, top_inset=0.86,
            )
        )
        body.extend(
            lib.build_vls_missile_pod(
                f"Destroyer_VLS_{side}", (-0.82, 0.54 * sign, 0.24), rows=2, cols=3, cell_size=0.09,
                frame_mat=dark, cap_mat=steel, glow_mat=glow,
            )
        )
        aft_h, aft_b = lib.build_mechanical_turret(
            f"Destroyer_AftPD_{side}", (-0.70, 0.26 * sign, 0.48), scale_f=0.26,
            armor_mat=red, frame_mat=dark, glow_mat=glow, barrels=2,
        )
        body.extend([*aft_h, *aft_b])
        for row_z, rad_n, oy in ((0.0, 0.115, 0.19), (0.0, 0.115, 0.44), (0.14, 0.085, 0.32)):
            shroud, petals = lib.build_vector_nozzle(
                f"Destroyer_Noz_{side}_{oy:.2f}_{row_z:.2f}", (-1.18, oy * sign, row_z),
                radius=rad_n, length=0.34, shroud_mat=dark, frame_mat=steel, glow_mat=glow, petals=6,
            )
            body.extend([*shroud, *petals])

    # Spinal Laser Trench Clamps & Exposed Trench Core
    for i, cx in enumerate((0.12, 0.32, 0.52, 0.72, 0.92)):
        body.append(
            lib.create_geo(
                f"Destroyer_SpinalClamp_{i}", "cube", gold if i % 2 == 0 else steel,
                location=(cx, 0, -0.05), scale=(0.08, 0.32, 0.09), bevel=0.008, bevel_segments=1,
            )
        )
    body.append(
        lib.create_geo("Destroyer_SpinalLaserChannel", "cube", glow, location=(0.56, 0, 0.02), scale=(0.94, 0.12, 0.06), bevel=0.0)
    )

    # --- FORM I ONLY: SEALED DIAMOND SIEGE WEDGE (BOW SHIELD + REACTOR DOME + SKIRTS) ---
    body.append(
        lib.build_beveled_armor_plate(
            "Form1Only_Destroyer_BowShieldLock",
            [(0.12, -0.34), (0.98, -0.30), (1.36, 0.0), (0.98, 0.30), (0.12, 0.34)],
            z_bottom=-0.06, z_top=0.22, mat=red, top_inset=0.80, bevel=0.015, bevel_segments=1,
        )
    )
    body.append(
        lib.build_beveled_armor_plate(
            "Form1Only_Destroyer_BowGoldRidge",
            [(0.22, -0.14), (1.06, -0.08), (1.28, 0.0), (1.06, 0.08), (0.22, 0.14)],
            z_bottom=0.21, z_top=0.32, mat=gold, top_inset=0.72,
        )
    )
    body.append(
        lib.build_beveled_armor_plate(
            "Form1Only_Destroyer_ReactorCap",
            [(0.02, -0.32), (0.52, -0.26), (0.52, 0.26), (0.02, 0.32)],
            z_bottom=0.26, z_top=0.40, mat=dark, top_inset=0.76,
        )
    )
    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        body.append(
            lib.build_beveled_armor_plate(
                f"Form12_Destroyer_FlankSkirt_{side}",
                _mirror_y_poly([(-0.88, 0.56), (0.56, 0.50), (0.72, 0.88), (-0.96, 0.96)], sign),
                z_bottom=-0.16, z_top=0.14, mat=dark, top_inset=0.84,
            )
        )

    # Articulated Blast Doors over Core
    core_doors: dict[str, list[bpy.types.Object]] = {}
    for sign, dkey in ((1, "CoreDoor_L"), (-1, "CoreDoor_R")):
        door_plate = lib.build_beveled_armor_plate(
            f"Destroyer_{dkey}_Plate",
            _mirror_y_poly([(0.06, 0.02), (0.50, 0.02), (0.44, 0.25), (0.10, 0.26)], sign),
            z_bottom=0.20, z_top=0.29, mat=red, top_inset=0.80,
        )
        door_trim = lib.create_geo(
            f"Destroyer_{dkey}_Trim", "cube", gold,
            location=(0.28, 0.04 * sign, 0.295), scale=(0.36, 0.04, 0.03), bevel=0.0,
        )
        core_doors[dkey] = [door_plate, door_trim]

    # Twin Main Prows + Turrets + Radiators
    prow_parts: dict[str, list[bpy.types.Object]] = {}
    rad_parts: dict[str, list[bpy.types.Object]] = {}
    turrets: dict[str, list[bpy.types.Object]] = {}

    for sign, pkey, rkey in ((1, "Prow_L", "Rad_L"), (-1, "Prow_R", "Rad_R")):
        y_in_b, y_out_b = sorted((0.36 * sign, 0.86 * sign))
        y_in_m, y_out_m = sorted((0.28 * sign, 0.78 * sign))
        y_in_f, y_out_f = sorted((0.24 * sign, 0.60 * sign))
        y_in_t, y_out_t = sorted((0.26 * sign, 0.42 * sign))
        prow_hull = lib.build_lofted_hull(
            f"Destroyer_{pkey}_Body",
            [
                (-0.54, [(y_in_b, 0.18), (y_out_b, 0.15), (y_out_b, -0.15), (y_in_b, -0.18)]),
                (0.30,  [(y_in_m, 0.24), (y_out_m, 0.18), (y_out_m, -0.18), (y_in_m, -0.22)]),
                (0.92,  [(y_in_f, 0.16), (y_out_f, 0.12), (y_out_f, -0.13), (y_in_f, -0.15)]),
                (1.26,  [(y_in_t, 0.06), (y_out_t, 0.05), (y_out_t, -0.06), (y_in_t, -0.07)]),
            ],
            dark, crease_indices={0, 1, 2, 3}, subsurf=1,
        )
        prow_deck_1 = lib.build_beveled_armor_plate(
            f"Destroyer_{pkey}_DeckLower",
            _mirror_y_poly([(-0.46, 0.34), (0.92, 0.24), (1.12, 0.44), (0.76, 0.74), (-0.48, 0.82)], sign),
            z_bottom=0.14, z_top=0.25, mat=red, top_inset=0.84,
        )
        prow_deck_2 = lib.build_beveled_armor_plate(
            f"Destroyer_{pkey}_DeckUpper",
            _mirror_y_poly([(-0.34, 0.38), (0.80, 0.28), (0.92, 0.42), (0.62, 0.64), (-0.36, 0.72)], sign),
            z_bottom=0.24, z_top=0.33, mat=dark, top_inset=0.82,
        )
        ram_upper = lib.build_curved_blade(
            f"Destroyer_{pkey}_RamUpper",
            _mirror_y_points([(0.82, 0.34, 0.14), (1.14, 0.32, 0.10), (1.36, 0.24, 0.03)], sign),
            widths=[0.22, 0.16, 0.02], thicknesses=[0.11, 0.08, 0.015], mat=gold,
        )
        inner_heat = lib.create_geo(
            f"Destroyer_{pkey}_LaserRailGlow", "cube", glow,
            location=(0.62, 0.24 * sign, 0.04), scale=(0.94, 0.045, 0.065), bevel=0.0,
        )
        louvers = lib.build_louver_array(
            f"Destroyer_{pkey}_FlankLouvers",
            (0.05, 0.78 * sign, 0.10), (0.68, 0.60 * sign, 0.10),
            count=5, fin_w=0.13, fin_thick=0.04, fin_h=0.10,
            frame_mat=steel, glow_mat=glow, yaw_deg=-15 * sign,
        )
        casemates = [
            lib.create_geo(
                f"Destroyer_{pkey}_Casemate_{c_idx}", "cylinder", steel,
                location=(cx, cy * sign, 0.02), rotation_deg=(90 * sign, 0, -55 * sign),
                vertices=8, radius=0.032, depth=0.22, bevel=0.0,
            )
            for c_idx, (cx, cy) in enumerate(((0.18, 0.80), (0.44, 0.72), (0.68, 0.64)))
        ]
        # Form 1 only prow side cap (compact silhouette)
        prow_cap = lib.build_beveled_armor_plate(
            f"Form1Only_Destroyer_{pkey}_ClosedSideCap",
            _mirror_y_poly([(-0.42, 0.74), (0.66, 0.62), (0.86, 0.84), (-0.42, 0.94)], sign),
            z_bottom=-0.04, z_top=0.22, mat=red, top_inset=0.80,
        )
        prow_parts[pkey] = [
            prow_hull, prow_deck_1, prow_deck_2, ram_upper, inner_heat, *louvers, *casemates, prow_cap
        ]

        # Form 2+ Swept Heat-Radiator Vanes on stern flank
        rad_parts[rkey] = [
            lib.build_airfoil_wing(
                f"Form2_Destroyer_{rkey}_Vane_{vi}",
                _mirror_y_wing_stations([
                    (0.76 + vi * 0.04, -0.32 - vi * 0.10, -0.82 - vi * 0.08, 0.24 - vi * 0.05, 0.06),
                    (1.36 + vi * 0.03, -0.58 - vi * 0.10, -0.98 - vi * 0.08, 0.36 - vi * 0.04, 0.03),
                ], sign),
                mat=steel if vi % 2 == 0 else gold, bevel=0.008, bevel_segments=1,
            )
            for vi in range(3)
        ] + [
            lib.create_geo(
                f"Form2_Destroyer_{rkey}_Glow", "cube", glow,
                location=(-0.66, 0.84 * sign, 0.18), rotation_deg=(0, 0, -18 * sign),
                scale=(0.46, 0.07, 0.05), bevel=0.0,
            )
        ]

        t_head_f, t_bar_f = lib.build_heavy_turret(
            f"Destroyer_TurF_{sign}", (0.52, 0.46 * sign, 0.32), scale_f=0.38,
            armor_mat=steel, frame_mat=dark, glow_mat=glow, barrels=3,
        )
        t_head_r, t_bar_r = lib.build_heavy_turret(
            f"Destroyer_TurR_{sign}", (-0.12, 0.58 * sign, 0.32), scale_f=0.42,
            armor_mat=steel, frame_mat=dark, glow_mat=glow, barrels=2,
        )
        turrets[f"TurF_{sign}"] = [*t_head_f, *t_bar_f]
        turrets[f"TurR_{sign}"] = [*t_head_r, *t_bar_r]

    # --- FORM II ONLY: MASSIVE BROADSIDE ARTILLERY OUTRIGGER SPONSONS (span ±1.92!) ---
    form2_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, pod_key in ((1, "Form2_SiegePod_L"), (-1, "Form2_SiegePod_R")):
        outrigger_wing = lib.build_beveled_armor_plate(
            f"Form2Only_Destroyer_{pod_key}_OutriggerArm",
            _mirror_y_poly([(-0.62, 0.72), (0.64, 0.82), (0.82, 1.54), (-0.42, 1.88), (-0.82, 1.48)], sign),
            z_bottom=0.02, z_top=0.22, mat=red, top_inset=0.82, bevel=0.015, bevel_segments=1,
        )
        outrigger_greeb = lib.build_armor_greeble_strip(
            f"Form2Only_Destroyer_{pod_key}_Greebles",
            (0.28, 1.02 * sign, 0.24), (-0.28, 1.52 * sign, 0.24),
            count=3, tile_size=(0.24, 0.18, 0.05), mat=dark, accent_mat=gold,
        )
        outrigger_strut = lib.build_hydraulic_strut(
            f"Form2Only_Destroyer_{pod_key}_BoomStrut",
            (0.08, 0.68 * sign, 0.08), (0.14, 1.38 * sign, 0.14), 0.055, dark, steel,
        )
        ot_h, ot_b = lib.build_heavy_turret(
            f"Form2Only_Destroyer_{pod_key}_BroadTurret", (0.14, 1.42 * sign, 0.22), 0.52, steel, dark, glow, barrels=2
        )
        outer_rail = lib.build_railgun_assembly(
            f"Form2Only_Destroyer_{pod_key}_SiegeRail", (0.56, 1.66 * sign, 0.12), 0.88, dark, gold, glow
        )
        form2_parts[pod_key] = [
            outrigger_wing, *outrigger_greeb, *outrigger_strut, *ot_h, *ot_b, *outer_rail
        ]

    # --- FORM III: CRUCIFORM MOLTEN X-WINGS + APOCALYPSE BOW BEAM CANNON (span ±2.25!) ---
    form3_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, wkey in ((1, "Form3_InfernoWing_L"), (-1, "Form3_InfernoWing_R")):
        w_list: list[bpy.types.Object] = []
        # Swept forward & aft colossal molten cruciform wings per side
        fwd_wing = lib.build_airfoil_wing(
            f"Form3_Destroyer_{wkey}_XWingFwd",
            _mirror_y_wing_stations([
                (0.68, 0.56, -0.08, 0.18, 0.12),
                (1.48, 1.08, 0.28, 0.28, 0.08),
                (2.24, 1.46, 0.68, 0.34, 0.04),
            ], sign),
            mat=red, camber=0.05, bevel=0.01, bevel_segments=1,
        )
        fwd_vein = lib.build_curved_blade(
            f"Form3_Destroyer_{wkey}_FwdPlasma",
            _mirror_y_points([(0.32, 0.68, 0.24), (0.76, 1.48, 0.33), (1.18, 2.22, 0.38)], sign),
            widths=[0.16, 0.12, 0.02], thicknesses=[0.07, 0.05, 0.015], mat=glow, samples_per_seg=2,
        )
        aft_wing = lib.build_airfoil_wing(
            f"Form3_Destroyer_{wkey}_XWingAft",
            _mirror_y_wing_stations([
                (0.68, -0.18, -0.78, 0.14, 0.11),
                (1.44, -0.58, -1.24, 0.20, 0.07),
                (2.18, -1.04, -1.68, 0.26, 0.035),
            ], sign),
            mat=gold, camber=-0.03, bevel=0.01, bevel_segments=1,
        )
        aft_vein = lib.build_curved_blade(
            f"Form3_Destroyer_{wkey}_AftPlasma",
            _mirror_y_points([(-0.44, 0.68, 0.20), (-0.88, 1.44, 0.25), (-1.36, 2.16, 0.30)], sign),
            widths=[0.15, 0.11, 0.02], thicknesses=[0.07, 0.05, 0.015], mat=glow, samples_per_seg=2,
        )
        wing_strut = lib.build_hydraulic_strut(
            f"Form3_Destroyer_{wkey}_Piston", (0.04, 0.56 * sign, 0.18), (0.08, 1.32 * sign, 0.26), 0.055, dark, steel
        )
        w_list.extend([fwd_wing, fwd_vein, aft_wing, aft_vein, *wing_strut])
        form3_parts[wkey] = w_list

    # Giant forward Tri-Pronged Apocalypse Rail Cannon projecting out of central prow trench to x=+2.36!
    crown_list: list[bpy.types.Object] = []
    crown_list.extend(
        lib.build_railgun_assembly(
            "Form3_Destroyer_ApocMainLance", (0.72, 0.0, 0.08), 1.32, dark, gold, glow
        )
    )
    for ci, cx in enumerate((-0.82, -0.54, -0.26)):
        crown_list.append(
            lib.build_curved_blade(
                f"Form3_Destroyer_SpineCrown_{ci}",
                [(cx, 0.0, 0.50), (cx - 0.14, 0.0, 0.80 + ci * 0.04), (cx - 0.36, 0.0, 0.94 + ci * 0.05)],
                widths=[0.15, 0.10, 0.02], thicknesses=[0.07, 0.05, 0.012],
                mat=glow if ci == 1 else gold, up_hint=(0.0, 1.0, 0.0), samples_per_seg=2,
            )
        )
    form3_parts["Form3_SpineCrown"] = crown_list

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "DestroyerRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "CoreDoor_L": ((0.28, 0.12, 0.24), (0.28, 0.62, 0.24), "Root"),
            "CoreDoor_R": ((0.28, -0.12, 0.24), (0.28, 0.38, 0.24), "Root"),
            "Prow_L": ((0.10, 0.48, 0), (0.10, 0.98, 0), "Root"),
            "Prow_R": ((0.10, -0.48, 0), (0.10, 0.02, 0), "Root"),
            "Rad_L": ((-0.68, 0.72, 0.20), (-0.68, 1.22, 0.20), "Root"),
            "Rad_R": ((-0.68, -0.72, 0.20), (-0.68, -0.22, 0.20), "Root"),
            "TurF_1": ((0.52, 0.46, 0.32), (0.52, 0.96, 0.32), "Prow_L"),
            "TurR_1": ((-0.12, 0.58, 0.32), (-0.12, 1.08, 0.32), "Prow_L"),
            "TurF_-1": ((0.52, -0.46, 0.32), (0.52, 0.04, 0.32), "Prow_R"),
            "TurR_-1": ((-0.12, -0.58, 0.32), (-0.12, -0.08, 0.32), "Prow_R"),
            "Form2_SiegePod_L": ((0.12, 0.92, 0.14), (0.12, 1.42, 0.14), "Root"),
            "Form2_SiegePod_R": ((0.12, -0.92, 0.14), (0.12, -0.42, 0.14), "Root"),
            "Form3_InfernoWing_L": ((0.0, 0.68, 0.20), (0.0, 1.18, 0.20), "Root"),
            "Form3_InfernoWing_R": ((0.0, -0.68, 0.20), (0.0, -0.18, 0.20), "Root"),
            "Form3_SpineCrown": ((0.0, 0.0, 0.28), (0.0, 0.50, 0.28), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    for mp in (core_doors, prow_parts, rad_parts, turrets, form2_parts, form3_parts):
        for k, objs in mp.items():
            lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, yw in [(1, 0.0), (24, 12.0), (48, -12.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.02 if f == 24 else 0.0))
        lib.key_bone(rig, "TurF_1", f, rot_deg=(0, 0, yw))
        lib.key_bone(rig, "TurF_-1", f, rot_deg=(0, 0, -yw))
        lib.key_bone(rig, "TurR_1", f, rot_deg=(0, 0, -yw * 0.8))
        lib.key_bone(rig, "TurR_-1", f, rot_deg=(0, 0, yw * 0.8))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, split, door_s, rad_ang in [(1, 0.0, 0.0, 0.0), (14, 0.20, 0.18, 44.0), (28, 0.24, 0.22, 52.0)]:
        lib.key_bone(rig, "Prow_L", f, loc=(0, split, 0))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -split, 0))
        lib.key_bone(rig, "CoreDoor_L", f, loc=(-0.05, door_s, 0.04))
        lib.key_bone(rig, "CoreDoor_R", f, loc=(-0.05, -door_s, 0.04))
        lib.key_bone(rig, "Rad_L", f, rot_deg=(rad_ang, 0, 0))
        lib.key_bone(rig, "Rad_R", f, rot_deg=(-rad_ang, 0, 0))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, split, t1, t2 in [(1, 0.18, -0.10, 0.02), (10, 0.15, 0.02, -0.10), (20, 0.18, -0.10, 0.02)]:
        lib.key_bone(rig, "Prow_L", f, loc=(0, split, 0))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -split, 0))
        lib.key_bone(rig, "TurF_1", f, loc=(t1, 0, 0))
        lib.key_bone(rig, "TurF_-1", f, loc=(t2, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, split, z_up in [(1, 0.0, 0.0), (14, 0.28, 0.20), (28, 0.14, 0.04)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Prow_L", f, loc=(0, split, 0.08))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -split, 0.08))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, z_dn in [(1, -0.14), (24, -0.18), (48, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        lib.key_bone(rig, "CoreDoor_L", f, loc=(0, 0.22, 0))
        lib.key_bone(rig, "CoreDoor_R", f, loc=(0, -0.22, 0))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, split, ds, rad_a, s2, sy in [(1, 0.0, 0.0, 0.0, 0.01, -0.35), (14, 0.24, 0.22, 42.0, 0.65, 0.06), (28, 0.22, 0.20, 36.0, 1.18, 0.10), (42, 0.18, 0.18, 32.0, 1.00, 0.02)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.16 if f == 14 else 0.04))
        lib.key_bone(rig, "Prow_L", f, loc=(0, split, 0.03))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -split, 0.03))
        lib.key_bone(rig, "CoreDoor_L", f, loc=(0, ds, 0.04))
        lib.key_bone(rig, "CoreDoor_R", f, loc=(0, -ds, 0.04))
        lib.key_bone(rig, "Rad_L", f, rot_deg=(rad_a, 0, 0))
        lib.key_bone(rig, "Rad_R", f, rot_deg=(-rad_a, 0, 0))
        lib.key_bone(rig, "Form2_SiegePod_L", f, loc=(0, sy, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_SiegePod_R", f, loc=(0, -sy, 0), scale=(s2, s2, s2))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, sw in [(1, -6.0), (24, 6.0), (48, -6.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.04 if f == 24 else 0.0))
        lib.key_bone(rig, "Prow_L", f, loc=(0, 0.18, 0))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -0.18, 0))
        lib.key_bone(rig, "Rad_L", f, rot_deg=(32.0, 0, 0))
        lib.key_bone(rig, "Rad_R", f, rot_deg=(-32.0, 0, 0))
        lib.key_bone(rig, "Form2_SiegePod_L", f, rot_deg=(0, 0, sw), scale=(1, 1, 1))
        lib.key_bone(rig, "Form2_SiegePod_R", f, rot_deg=(0, 0, -sw), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, z_up, split, s3, wa in [(1, 0.04, 0.18, 0.01, -24.0), (16, 0.28, 0.30, 0.65, 16.0), (32, 0.18, 0.26, 1.22, 24.0), (48, 0.06, 0.24, 1.00, 12.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Prow_L", f, loc=(0, split, 0.05))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -split, 0.05))
        lib.key_bone(rig, "Form3_InfernoWing_L", f, rot_deg=(wa, 0, 0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_InfernoWing_R", f, rot_deg=(-wa, 0, 0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_SpineCrown", f, scale=(s3, s3, s3))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, wb, lx in [(1, 8.0, 0.0), (16, 20.0, 0.12), (32, 8.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.06 if f == 16 else 0.02))
        lib.key_bone(rig, "Prow_L", f, loc=(0, 0.24, 0.04))
        lib.key_bone(rig, "Prow_R", f, loc=(0, -0.24, 0.04))
        lib.key_bone(rig, "Form3_InfernoWing_L", f, rot_deg=(wb, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_InfernoWing_R", f, rot_deg=(-wb, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_SpineCrown", f, loc=(lx, 0, 0), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form3")

    lib.export_glb("boss_destroyer.glb")


# 8. Boss 1: Summoner ("Nyx-Empress" - Cocoon -> Mantis -> Eldritch Mandala)
def build_boss_summoner() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    chitin, dark, bone, glow, mag = pal["v_chitin"], pal["v_dark"], pal["v_bone"], pal["v_glow"], pal["v_magenta"]

    # --- SHARED CORE BIO-RIB SPINE + REACTOR CORE + JAWS ---
    spine_hull = lib.build_lofted_hull(
        "Summoner_CoreHull",
        [
            (-1.02, lib.jet_profile(0.22, 0.16, -0.13, deck_w=0.34)),
            (-0.42, lib.jet_profile(0.46, 0.30, -0.22, deck_w=0.38)),
            (0.18,  lib.jet_profile(0.52, 0.35, -0.25, deck_w=0.40)),
            (0.74,  lib.jet_profile(0.32, 0.24, -0.18, deck_w=0.36)),
            (1.12,  lib.jet_profile(0.10, 0.10, -0.07, deck_w=0.28)),
        ],
        dark, crease_indices={2, 7}, subsurf=1,
    )
    reactor_core = lib.create_geo(
        "Summoner_ReactorCore", "sphere", mag,
        location=(0.16, 0, 0.22), scale=(0.36, 0.34, 0.30), segments=18, rings=12, bevel=0.0,
    )
    crown_center = lib.build_curved_blade(
        "Summoner_CrownSpike",
        [(0.58, 0, 0.24), (0.94, 0, 0.34), (1.28, 0, 0.24)],
        widths=[0.20, 0.14, 0.02], thicknesses=[0.12, 0.08, 0.015], mat=bone,
    )
    body: list[bpy.types.Object] = [spine_hull, reactor_core, crown_center]

    for s_idx, sx in enumerate((0.62, 0.32, -0.04, -0.40, -0.74)):
        sw = 0.24 - s_idx * 0.022
        body.append(
            lib.build_beveled_armor_plate(
                f"Summoner_CarapaceSeg_{s_idx}",
                [(sx - 0.15, -sw * 0.85), (sx + 0.06, -sw), (sx + 0.19, 0.0), (sx + 0.06, sw), (sx - 0.15, sw * 0.85)],
                z_bottom=0.22, z_top=0.37 - s_idx * 0.02, mat=bone if s_idx % 2 == 0 else chitin, top_inset=0.66,
            )
        )
    for r_idx, rx in enumerate((0.44, 0.22, 0.0, -0.22, -0.44)):
        for sign in (1, -1):
            rw = 0.44 - abs(r_idx - 2) * 0.04
            body.append(
                lib.build_curved_blade(
                    f"Summoner_Rib_{r_idx}_{sign}",
                    _mirror_y_points([(rx + 0.05, 0.12, 0.30), (rx, rw * 0.65, 0.26), (rx - 0.08, rw, 0.06)], sign),
                    widths=[0.09, 0.08, 0.02], thicknesses=[0.06, 0.05, 0.015], mat=bone if r_idx % 2 == 0 else chitin,
                )
            )
    for sign in (1, -1):
        for e_idx, (ex, ey, ez) in enumerate(((0.88, 0.15, 0.18), (0.76, 0.23, 0.16))):
            body.append(
                lib.create_geo(
                    f"Summoner_Eye_{sign}_{e_idx}", "ico", glow,
                    location=(ex, ey * sign, ez), scale=(0.06, 0.045, 0.045), subdivisions=1, bevel=0.0,
                )
            )
        shroud, petals = lib.build_vector_nozzle(
            f"Summoner_Thruster_{sign}", (-1.02, 0.20 * sign, 0.0), radius=0.11, length=0.30,
            shroud_mat=dark, frame_mat=bone, glow_mat=mag, petals=6,
        )
        body.extend([*shroud, *petals])

    # --- FORM I ONLY: SEALED VOID CHRYSALIS COCOON (width ~1.22) ---
    for sign in (1, -1):
        side = "L" if sign > 0 else "R"
        body.append(
            lib.build_beveled_armor_plate(
                f"Form1Only_Summoner_Cocoon_{side}",
                _mirror_y_poly([(-0.92, 0.24), (0.68, 0.22), (0.86, 0.48), (0.12, 0.64), (-0.86, 0.56)], sign),
                z_bottom=-0.12, z_top=0.26, mat=chitin, top_inset=0.80, bevel=0.015, bevel_segments=1,
            )
        )
        body.append(
            lib.build_beveled_armor_plate(
                f"Form1Only_Summoner_CocoonPlate_{side}",
                _mirror_y_poly([(-0.68, 0.34), (0.48, 0.30), (0.58, 0.54), (-0.64, 0.50)], sign),
                z_bottom=0.24, z_top=0.38, mat=dark, top_inset=0.78,
            )
        )
        body.append(
            lib.build_beveled_armor_plate(
                f"Form12_Summoner_ShoulderMantle_{side}",
                _mirror_y_poly([(-0.56, 0.44), (0.38, 0.42), (0.46, 0.78), (-0.62, 0.72)], sign),
                z_bottom=-0.04, z_top=0.16, mat=bone, top_inset=0.80,
            )
        )
    body.append(
        lib.build_beveled_armor_plate(
            "Form1Only_Summoner_CoreShellCap",
            [(-0.24, -0.28), (0.52, -0.24), (0.52, 0.24), (-0.24, 0.28)],
            z_bottom=0.28, z_top=0.46, mat=chitin, top_inset=0.72, bevel=0.012, bevel_segments=1,
        )
    )

    jaw_parts: dict[str, list[bpy.types.Object]] = {}
    wing_parts: dict[str, list[bpy.types.Object]] = {}
    door_parts: dict[str, list[bpy.types.Object]] = {}
    fin_parts: dict[str, list[bpy.types.Object]] = {}

    for sign, wkey, dkey_f, dkey_r, jkey in (
        (1, "MantaWing_L", "BayDoorF_L", "BayDoorR_L", "Jaw_L"),
        (-1, "MantaWing_R", "BayDoorF_R", "BayDoorR_R", "Jaw_R"),
    ):
        jaw_upper = lib.build_curved_blade(
            f"Summoner_{jkey}_Upper",
            _mirror_y_points([(0.52, 0.34, 0.06), (1.06, 0.46, 0.10), (1.38, 0.18, 0.04)], sign),
            widths=[0.20, 0.13, 0.02], thicknesses=[0.11, 0.07, 0.015], mat=bone,
        )
        jaw_glow = lib.create_geo(
            f"Summoner_{jkey}_Glow", "cube", mag,
            location=(0.88, 0.40 * sign, 0.08), rotation_deg=(0, 0, -14 * sign),
            scale=(0.28, 0.04, 0.05), bevel=0.0,
        )
        jaw_parts[jkey] = [jaw_upper, jaw_glow]

        # --- FORM II ONLY: 4 MASSIVE RAZOR-SCYTHE MANTIS WINGS + HANGARS (span ±1.95) ---
        mantis_fwd = lib.build_airfoil_wing(
            f"Form2Only_Summoner_{wkey}_ScytheFwd",
            _mirror_y_wing_stations([
                (0.46, 0.68, -0.34, 0.06, 0.22),
                (1.18, 0.96, 0.18, 0.18, 0.13),
                (1.94, 0.44, -0.46, 0.08, 0.04),
            ], sign),
            mat=chitin, camber=0.10, subsurf=1,
        )
        mantis_aft = lib.build_airfoil_wing(
            f"Form2Only_Summoner_{wkey}_ScytheAft",
            _mirror_y_wing_stations([
                (0.46, -0.18, -0.92, 0.02, 0.16),
                (1.12, -0.62, -1.24, -0.02, 0.10),
                (1.76, -1.24, -1.68, -0.08, 0.035),
            ], sign),
            mat=dark, camber=0.04,
        )
        vein_out = lib.build_curved_blade(
            f"Form2Only_Summoner_{wkey}_Vein",
            _mirror_y_points([(0.44, 0.48, 0.14), (0.64, 1.24, 0.20), (-0.18, 1.90, 0.08)], sign),
            widths=[0.12, 0.09, 0.02], thicknesses=[0.06, 0.04, 0.012], mat=glow, samples_per_seg=2,
        )
        wing_strut = lib.build_hydraulic_strut(
            f"Form2Only_Summoner_{wkey}_Piston", (0.12, 0.42 * sign, 0.04), (0.36, 1.02 * sign, 0.12), 0.045, dark, bone
        )
        tail_segs = [
            lib.build_curved_blade(
                f"Form2Only_Summoner_{wkey}_Tail_{ti}",
                _mirror_y_points([(-0.62 - ti * 0.20, 0.34, 0.0), (-0.82 - ti * 0.20, 0.44, -0.02)], sign),
                widths=[0.15 * (1 - ti * 0.14), 0.10 * (1 - ti * 0.14)],
                thicknesses=[0.08, 0.05], mat=bone if ti % 2 == 0 else dark,
            )
            for ti in range(4)
        ]
        wing_parts[wkey] = [mantis_fwd, mantis_aft, vein_out, *wing_strut, *tail_segs]

        for dkey, (bx, by) in ((dkey_f, (0.14, 0.72)), (dkey_r, (-0.34, 0.88))):
            door_parts[dkey] = [
                lib.build_beveled_armor_plate(
                    f"Form2Only_Summoner_{dkey}_Cover",
                    _mirror_y_poly([(bx - 0.16, by - 0.13), (bx + 0.18, by - 0.11), (bx + 0.12, by + 0.13), (bx - 0.22, by + 0.11)], sign),
                    z_bottom=0.14, z_top=0.22, mat=bone, top_inset=0.72,
                )
            ]

        for j, (fx, fy, fz, reach) in enumerate([
            (-0.42, 1.24 * sign, 0.10, 0.46),
            (-0.64, 0.96 * sign, 0.16, 0.56),
        ]):
            fkey = f"Fin_{sign}_{j}"
            cfin_h = lib.build_curved_blade(
                f"Form2Only_Summoner_{fkey}_Frame",
                [(fx + 0.12, fy * 0.90, fz), (fx - reach, fy * 1.08, fz + 0.04)],
                widths=[0.11, 0.015], thicknesses=[0.05, 0.012], mat=bone if j % 2 == 0 else chitin,
            )
            fin_parts[fkey] = [cfin_h]

    # Form 2+: Twin Wingtip Precision Hex-Portal Rings
    form2_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, spkey in ((1, "Form2_PortalRing_L"), (-1, "Form2_PortalRing_R")):
        portal = lib.build_precision_ring_assembly(
            f"Form2_Summoner_{spkey}", (0.04, 1.64 * sign, 0.26), 0.36, 0.036, 20,
            chitin, bone, mag, clamp_count=4, rot_deg=(0, 26, -14 * sign),
        )
        form2_parts[spkey] = portal

    # --- FORM III: COLOSSAL 6-FOLD ELDRITCH STAR MANDALA + DUAL ASTROLABE RINGS (r = 2.18!) ---
    form3_parts: dict[str, list[bpy.types.Object]] = {}
    star_objs: list[bpy.types.Object] = []
    for si in range(6):
        ang = (si / 6.0) * math.tau
        ca, sa = math.cos(ang), math.sin(ang)
        star_blade = lib.build_curved_blade(
            f"Form3_Summoner_StarBlade_{si}",
            [(ca * 0.58, sa * 0.58, 0.18), (ca * 1.38 - sa * 0.22, sa * 1.38 + ca * 0.22, 0.34), (ca * 2.18, sa * 2.18, 0.14)],
            widths=[0.24, 0.30, 0.025], thicknesses=[0.11, 0.08, 0.02],
            mat=bone if si % 2 == 0 else chitin, samples_per_seg=2,
        )
        star_vein = lib.build_curved_blade(
            f"Form3_Summoner_StarVein_{si}",
            [(ca * 0.64, sa * 0.64, 0.22), (ca * 1.40 - sa * 0.16, sa * 1.40 + ca * 0.16, 0.38), (ca * 2.12, sa * 2.12, 0.18)],
            widths=[0.10, 0.12, 0.02], thicknesses=[0.05, 0.04, 0.012],
            mat=glow if si % 2 == 0 else mag, samples_per_seg=2,
        )
        star_objs.extend([star_blade, star_vein])
    form3_parts["Form3_StarMandala"] = star_objs

    astrolabe_in = lib.build_precision_ring_assembly(
        "Form3_Summoner_AstrolabeA", (0.0, 0.0, 0.34), 1.12, 0.052, 24, chitin, bone, mag, clamp_count=6, rot_deg=(18, -14, 0)
    )
    crown_shards = [
        lib.create_geo(
            f"Form3_Summoner_CrownShard_{ci}", "cone", mag if ci % 2 == 0 else glow,
            location=(math.cos(ci * math.tau / 6) * 0.56, math.sin(ci * math.tau / 6) * 0.56, 0.64),
            rotation_deg=(math.sin(ci * math.tau / 6) * 20, -math.cos(ci * math.tau / 6) * 20, 0),
            radius1=0.085, radius2=0.012, depth=0.38, vertices=5, bevel=0.0,
        )
        for ci in range(6)
    ]
    form3_parts["Form3_AbyssCrown"] = [*astrolabe_in, *crown_shards]

    astrolabe_out = lib.build_precision_ring_assembly(
        "Form3_Summoner_AstrolabeB", (0.0, 0.0, 0.34), 1.66, 0.060, 28, bone, chitin, glow, clamp_count=6, rot_deg=(-16, 12, 0)
    )
    form3_parts["Form3_AstrolabeOut"] = astrolabe_out

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    bones = {
        "Root": ((0, 0, 0), (0, 0.5, 0), None),
        "MantaWing_L": ((0.0, 0.40, 0.04), (0.0, 0.90, 0.04), "Root"),
        "MantaWing_R": ((0.0, -0.40, 0.04), (0.0, 0.10, 0.04), "Root"),
        "Jaw_L": ((0.50, 0.34, 0.02), (0.50, 0.84, 0.02), "Root"),
        "Jaw_R": ((0.50, -0.34, 0.02), (0.50, 0.16, 0.02), "Root"),
        "BayDoorF_L": ((0.14, 0.72, 0.18), (0.14, 1.22, 0.18), "MantaWing_L"),
        "BayDoorF_R": ((0.14, -0.72, 0.18), (0.14, -0.22, 0.18), "MantaWing_R"),
        "BayDoorR_L": ((-0.34, 0.88, 0.18), (-0.34, 1.38, 0.18), "MantaWing_L"),
        "BayDoorR_R": ((-0.34, -0.88, 0.18), (-0.34, -0.38, 0.18), "MantaWing_R"),
        "Form2_PortalRing_L": ((0.04, 1.64, 0.26), (0.04, 2.14, 0.26), "Root"),
        "Form2_PortalRing_R": ((0.04, -1.64, 0.26), (0.04, -1.14, 0.26), "Root"),
        "Form3_AbyssCrown": ((0.0, 0.0, 0.34), (0.0, 0.50, 0.34), "Root"),
        "Form3_StarMandala": ((0.0, 0.0, 0.22), (0.0, 0.50, 0.22), "Root"),
        "Form3_AstrolabeOut": ((0.0, 0.0, 0.34), (0.0, 0.50, 0.34), "Root"),
    }
    for fkey, objs in fin_parts.items():
        cx = sum(v.co.x for v in objs[0].data.vertices) / len(objs[0].data.vertices)
        cy = sum(v.co.y for v in objs[0].data.vertices) / len(objs[0].data.vertices)
        cz = sum(v.co.z for v in objs[0].data.vertices) / len(objs[0].data.vertices)
        bones[fkey] = ((cx, cy, cz), (cx, cy + 0.5, cz), "Root")

    rig = lib.create_rig("SummonerRig", bones)
    lib.parent_to_bone(body, rig, "Root")
    for mp in (wing_parts, door_parts, jaw_parts, fin_parts, form2_parts, form3_parts):
        for k, objs in mp.items():
            lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, flap, jaw_rot, z_off in [(1, -6.0, 2.0, 0.0), (24, 9.0, 7.0, 0.08), (48, -6.0, 2.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_off))
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(flap, 0, 0))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-flap, 0, 0))
        lib.key_bone(rig, "Jaw_L", f, rot_deg=(0, 0, jaw_rot))
        lib.key_bone(rig, "Jaw_R", f, rot_deg=(0, 0, -jaw_rot))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, curl, slide, jrot in [(1, 0.0, 0.0, 4.0), (14, -10.0, 0.16, 20.0), (28, -12.0, 0.20, 24.0)]:
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(14.0, 0, curl))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-14.0, 0, -curl))
        lib.key_bone(rig, "Jaw_L", f, rot_deg=(0, 0, jrot))
        lib.key_bone(rig, "Jaw_R", f, rot_deg=(0, 0, -jrot))
        lib.key_bone(rig, "BayDoorF_L", f, loc=(-slide, 0.08, 0.05))
        lib.key_bone(rig, "BayDoorF_R", f, loc=(-slide, -0.08, 0.05))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, snap, fwd in [(1, -12.0, 0.0), (10, 12.0, 0.18), (20, -8.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(fwd, 0, 0))
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(-8.0, 0, snap))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(8.0, 0, -snap))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, dih in [(1, 0.0), (14, 28.0), (28, 6.0)]:
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(dih, 0, 0))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-dih, 0, 0))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, droop, z_dn in [(1, -16.0, -0.14), (24, -20.0, -0.18), (48, -16.0, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(droop, 0, 12.0))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-droop, 0, -12.0))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, dih, bd, s2, rz in [(1, -14.0, 0.0, 0.01, 0.0), (14, 24.0, -0.18, 0.65, 120.0), (28, 18.0, -0.20, 1.18, 240.0), (42, 12.0, -0.16, 1.00, 360.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.16 if f == 28 else 0.04))
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(dih, 0, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-dih, 0, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "BayDoorF_L", f, loc=(bd, 0.08, 0.05))
        lib.key_bone(rig, "BayDoorF_R", f, loc=(bd, -0.08, 0.05))
        lib.key_bone(rig, "Form2_PortalRing_L", f, rot_deg=(0, 0, rz), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_PortalRing_R", f, rot_deg=(0, 0, -rz), scale=(s2, s2, s2))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, dih, spin in [(1, 10.0, 0.0), (24, 18.0, 180.0), (48, 10.0, 360.0)]:
        lib.key_bone(rig, "MantaWing_L", f, rot_deg=(dih, 0, 0))
        lib.key_bone(rig, "MantaWing_R", f, rot_deg=(-dih, 0, 0))
        lib.key_bone(rig, "Form2_PortalRing_L", f, rot_deg=(spin, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form2_PortalRing_R", f, rot_deg=(-spin, 0, 0), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, z_up, spin, s3 in [(1, 0.04, 0.0, 0.01), (16, 0.30, 120.0, 0.65), (32, 0.22, 240.0, 1.22), (48, 0.10, 360.0, 1.00)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "Form3_AbyssCrown", f, rot_deg=(0, 0, spin), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_StarMandala", f, rot_deg=(0, 0, spin * 0.5), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_AstrolabeOut", f, rot_deg=(0, 0, -spin), scale=(s3, s3, s3))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, spin, jr in [(1, 0.0, 8.0), (16, 180.0, 18.0), (32, 360.0, 8.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.10 if f == 16 else 0.04))
        lib.key_bone(rig, "Jaw_L", f, rot_deg=(0, 0, jr))
        lib.key_bone(rig, "Jaw_R", f, rot_deg=(0, 0, -jr))
        lib.key_bone(rig, "Form2_PortalRing_L", f, rot_deg=(spin, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form2_PortalRing_R", f, rot_deg=(-spin, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_AbyssCrown", f, rot_deg=(0, 0, spin), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_StarMandala", f, rot_deg=(0, 0, spin * 0.25), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_AstrolabeOut", f, rot_deg=(0, 0, -spin), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form3")

    lib.export_glb("boss_summoner.glb")


# 9. Boss 2: Overlord ("Aurelian Seraphim" - Spearhead -> Valkyrie -> Six-Wing Seraph)
def build_boss_overlord() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    ivory, gold, dark, solar, cyan = pal["s_ivory"], pal["s_gold"], pal["s_dark"], pal["s_solar"], pal["s_cyan"]

    # --- SHARED IMPERIAL ARCHON TORSO + CHEST + HELM + COMPACT LANCES ---
    torso = lib.build_lofted_hull(
        "Overlord_Torso",
        [
            (-1.02, lib.jet_profile(0.20, 0.15, -0.11, deck_w=0.36)),
            (-0.44, lib.jet_profile(0.42, 0.28, -0.20, deck_w=0.40)),
            (0.14,  lib.jet_profile(0.52, 0.34, -0.24, deck_w=0.42)),
            (0.68,  lib.jet_profile(0.36, 0.26, -0.18, deck_w=0.38)),
            (1.06,  lib.jet_profile(0.14, 0.14, -0.09, deck_w=0.30)),
        ],
        dark, crease_indices={2, 7}, subsurf=1,
    )
    chest_base = lib.build_beveled_armor_plate(
        "Overlord_ChestObsidian",
        [(-0.46, -0.34), (0.24, -0.40), (0.72, 0.0), (0.24, 0.40), (-0.46, 0.34)],
        z_bottom=0.16, z_top=0.30, mat=dark, top_inset=0.82,
    )
    chest_ivory = lib.build_beveled_armor_plate(
        "Overlord_IvoryChest",
        [(-0.36, -0.24), (0.18, -0.34), (0.64, 0.0), (0.18, 0.34), (-0.36, 0.24)],
        z_bottom=0.28, z_top=0.40, mat=ivory, top_inset=0.72,
    )
    head_crown = lib.build_curved_blade(
        "Overlord_SeraphCrown",
        [(0.46, 0.0, 0.34), (0.82, 0.0, 0.44), (1.18, 0.0, 0.28)],
        widths=[0.28, 0.20, 0.025], thicknesses=[0.18, 0.14, 0.02], mat=gold,
    )
    visor_slit = lib.create_geo(
        "Overlord_HelmVisor", "cube", cyan,
        location=(0.76, 0, 0.34), scale=(0.14, 0.24, 0.05), bevel=0.0,
    )
    reactor_core = lib.create_geo(
        "Overlord_ReactorCore", "sphere", solar,
        location=(0.14, 0, 0.38), scale=(0.34, 0.34, 0.28), segments=18, rings=12, bevel=0.0,
    )
    tail_center = lib.build_curved_blade(
        "Overlord_TailSkirt",
        [(-0.38, 0.0, 0.08), (-0.96, 0.0, 0.04), (-1.42, 0.0, -0.02)],
        widths=[0.36, 0.22, 0.025], thicknesses=[0.12, 0.08, 0.02], mat=ivory,
    )
    body: list[bpy.types.Object] = [
        torso, chest_base, chest_ivory, head_crown, visor_slit, reactor_core, tail_center
    ]

    for s_i, sx in enumerate((-0.10, -0.38, -0.68)):
        body.append(
            lib.build_beveled_armor_plate(
                f"Overlord_SpinePlate_{s_i}",
                [(sx - 0.12, -0.16), (sx + 0.12, -0.14), (sx + 0.18, 0.0), (sx + 0.12, 0.14), (sx - 0.12, 0.16)],
                z_bottom=0.22, z_top=0.33, mat=gold if s_i % 2 == 1 else ivory, top_inset=0.76,
            )
        )

    lances: dict[str, list[bpy.types.Object]] = {}
    for sign, lkey in ((1, "SolarLance_L"), (-1, "SolarLance_R")):
        body.append(
            lib.build_curved_blade(
                f"Overlord_CrownHorn_{sign}",
                _mirror_y_points([(0.48, 0.14, 0.38), (0.74, 0.32, 0.50), (0.98, 0.36, 0.44)], sign),
                widths=[0.12, 0.08, 0.015], thicknesses=[0.07, 0.04, 0.01], mat=ivory,
            )
        )
        body.append(
            lib.build_curved_blade(
                f"Overlord_SideSkirt_{sign}",
                _mirror_y_points([(-0.40, 0.28, 0.06), (-0.86, 0.46, 0.04), (-1.24, 0.36, 0.0)], sign),
                widths=[0.22, 0.14, 0.02], thicknesses=[0.08, 0.05, 0.015], mat=gold,
            )
        )
        for t_i, (y0, y1, z0, z1, pmat) in enumerate([
            (0.32, 0.58, 0.08, 0.24, dark),
            (0.35, 0.64, 0.22, 0.36, ivory),
            (0.40, 0.68, 0.34, 0.44, gold),
        ]):
            body.append(
                lib.build_beveled_armor_plate(
                    f"Overlord_PauldronT{t_i}_{sign}",
                    _mirror_y_poly([(-0.24 + t_i * 0.04, y0), (0.40 - t_i * 0.03, y0), (0.50 - t_i * 0.02, y1), (-0.30 + t_i * 0.03, y1)], sign),
                    z_bottom=z0, z_top=z1, mat=pmat, top_inset=0.80,
                )
            )
        for ty in (0.16, 0.34):
            shroud, petals = lib.build_vector_nozzle(
                f"Overlord_Noz_{sign}_{ty:.2f}", (-0.98, ty * sign, 0.0), radius=0.085, length=0.28,
                shroud_mat=gold, frame_mat=dark, glow_mat=cyan, petals=6,
            )
            body.extend([*shroud, *petals])

        # Shoulder Solar Lance cannons
        l_shroud = lib.build_curved_blade(
            f"Overlord_{lkey}_Outer",
            _mirror_y_points([(0.05, 0.48, 0.20), (0.68, 0.42, 0.18), (1.24, 0.28, 0.14)], sign),
            widths=[0.20, 0.15, 0.025], thicknesses=[0.13, 0.09, 0.02], mat=ivory,
        )
        l_glow = lib.create_geo(
            f"Overlord_{lkey}_Beam", "cube", cyan,
            location=(0.68, 0.40 * sign, 0.16), rotation_deg=(0, 0, -10 * sign),
            scale=(0.94, 0.045, 0.045), bevel=0.0,
        )
        lances[lkey] = [l_shroud, l_glow]

        # --- FORM I ONLY: SEALED IMPERIAL SPEARHEAD FOLDED SHIELD SHROUDS (width ~1.06!) ---
        body.append(
            lib.build_airfoil_wing(
                f"Form1Only_Overlord_FoldedShroud_{sign}",
                _mirror_y_wing_stations([
                    (0.42, 0.72, -0.78, 0.06, 0.18),
                    (0.84, 0.22, -0.98, 0.10, 0.10),
                    (1.06, -0.38, -1.16, 0.14, 0.04),
                ], sign),
                mat=ivory, camber=0.06, bevel=0.01, bevel_segments=1,
            )
        )
        body.append(
            lib.build_beveled_armor_plate(
                f"Form1Only_Overlord_ShroudGold_{sign}",
                _mirror_y_poly([(-0.62, 0.46), (0.56, 0.42), (0.44, 0.82), (-0.72, 0.76)], sign),
                z_bottom=0.14, z_top=0.28, mat=gold, top_inset=0.80,
            )
        )
        body.append(
            lib.build_beveled_armor_plate(
                f"Form12_Overlord_MantlePlate_{sign}",
                _mirror_y_poly([(-0.54, 0.56), (0.28, 0.54), (0.18, 0.96), (-0.64, 0.88)], sign),
                z_bottom=0.0, z_top=0.16, mat=dark, top_inset=0.82,
            )
        )

    prong_parts: dict[str, list[bpy.types.Object]] = {}
    for idx, ang in enumerate((0.45, math.pi - 0.45, math.pi + 0.45, math.tau - 0.45)):
        pkey = f"CoreProng_{idx}"
        ca, sa = math.cos(ang), math.sin(ang)
        prong_parts[pkey] = [
            lib.build_curved_blade(
                f"Overlord_{pkey}",
                [(0.14 + ca * 0.18, sa * 0.18, 0.36), (0.14 + ca * 0.28, sa * 0.28, 0.48)],
                widths=[0.07, 0.015], thicknesses=[0.05, 0.015], mat=gold,
            )
        ]

    # Precision Inner Halo (always present, spins cleanly)
    halo_inner = lib.build_precision_ring_assembly(
        "Overlord_HaloIn", (-0.48, 0.0, 0.26), 0.62, 0.042, 24, dark, gold, cyan, clamp_count=4, rot_deg=(0, 90, 0)
    )

    # Form 2+ Outer Halo + Form 3 Colossal Engraved Solar Astrolabe Halo!
    halo_outer: list[bpy.types.Object] = []
    halo_outer.extend(
        lib.build_precision_ring_assembly(
            "Form2_Overlord_HaloOut", (-0.62, 0.0, 0.26), 0.96, 0.052, 24, gold, ivory, solar, clamp_count=6, rot_deg=(0, 90, 0)
        )
    )
    halo_outer.extend(
        lib.build_precision_ring_assembly(
            "Form3_Overlord_SolarHalo", (-0.66, 0.0, 0.28), 1.48, 0.064, 28, gold, dark, cyan, clamp_count=8, rot_deg=(0, 90, 0)
        )
    )

    # --- FORM II ONLY: TWIN COLOSSAL CRESCENT VALKYRIE WINGS (span ±2.12!) ---
    valk_wings: dict[str, list[bpy.types.Object]] = {}
    form2_parts: dict[str, list[bpy.types.Object]] = {}
    for sign, wkey, skey in ((1, "ValkWing_L", "Form2_SolarSpear_L"), (-1, "ValkWing_R", "Form2_SolarSpear_R")):
        v_blade = lib.build_airfoil_wing(
            f"Form2Only_Overlord_{wkey}_Blade",
            _mirror_y_wing_stations([
                (0.46, 0.42, -0.34, 0.14, 0.16),
                (1.32, 0.96, 0.12, 0.24, 0.10),
                (2.14, 0.34, -0.58, 0.32, 0.04),
            ], sign),
            mat=gold, camber=0.06, bevel=0.01, bevel_segments=1,
        )
        v_ivory = lib.build_curved_blade(
            f"Form2Only_Overlord_{wkey}_Crescent",
            _mirror_y_points([(0.34, 0.48, 0.22), (0.68, 1.42, 0.30), (-0.18, 2.08, 0.24)], sign),
            widths=[0.24, 0.20, 0.03], thicknesses=[0.08, 0.06, 0.015], mat=ivory, samples_per_seg=2,
        )
        v_edge = lib.build_curved_blade(
            f"Form2Only_Overlord_{wkey}_CyanVein",
            _mirror_y_points([(0.38, 0.56, 0.24), (0.64, 1.38, 0.32), (0.04, 1.94, 0.28)], sign),
            widths=[0.10, 0.08, 0.015], thicknesses=[0.045, 0.035, 0.01], mat=cyan, samples_per_seg=2,
        )
        valk_wings[wkey] = [v_blade, v_ivory, v_edge]

        # Long Forward Extended Chrono-Lances reaching x = +1.98 (kept in Form 2 & Form 3)
        spear_shaft = lib.build_curved_blade(
            f"Form2_Overlord_{skey}_Lance",
            _mirror_y_points([(-0.08, 0.88, 0.34), (0.86, 0.82, 0.30), (1.96, 0.48, 0.24)], sign),
            widths=[0.20, 0.15, 0.025], thicknesses=[0.10, 0.07, 0.015], mat=gold, samples_per_seg=2,
        )
        spear_edge = lib.build_curved_blade(
            f"Form2_Overlord_{skey}_CyanEdge",
            _mirror_y_points([(0.08, 0.88, 0.38), (0.94, 0.82, 0.34), (1.88, 0.50, 0.26)], sign),
            widths=[0.09, 0.07, 0.015], thicknesses=[0.045, 0.035, 0.01], mat=cyan, samples_per_seg=2,
        )
        condenser = lib.build_hydraulic_strut(
            f"Form2_Overlord_{skey}_Strut", (-0.12, 0.48 * sign, 0.26), (0.14, 0.86 * sign, 0.34), 0.042, dark, ivory
        )
        form2_parts[skey] = [spear_shaft, spear_edge, *condenser]

    # --- FORM III: SIX COLOSSAL SERAPHIM PINION WINGS + CORONA + ARCHON SWORDS (span ±2.45!) ---
    wing_groups: dict[str, list[bpy.types.Object]] = {}
    wing_specs = [
        ("WingTop", 0.22, 0.36, 0.32, 6, 1.38, 0.14),
        ("WingMid", -0.08, 0.32, 0.16, 5, 1.16, -0.18),
        ("WingLow", -0.38, 0.28, 0.0, 4, 0.94, -0.46),
    ]
    for wname, bx, by_root, bz, f_count, f_len, base_sweep in wing_specs:
        for sign in (1, -1):
            side = "L" if sign > 0 else "R"
            wkey = f"{wname}_{side}"
            parts: list[bpy.types.Object] = []
            parts.append(
                lib.build_curved_blade(
                    f"Form3_Overlord_{wkey}_Spar",
                    _mirror_y_points([
                        (bx, by_root + 0.04, bz),
                        (bx + 0.18, by_root + 0.56, bz + 0.18),
                        (bx + 0.02, by_root + 1.12, bz + 0.26),
                    ], sign),
                    widths=[0.14, 0.10, 0.03], thicknesses=[0.08, 0.06, 0.02], mat=gold, samples_per_seg=2,
                )
            )
            for j in range(f_count):
                frac = j / max(1, f_count - 1)
                ang_fan = base_sweep + 0.38 - frac * 0.90
                sy0 = by_root + 0.28 + frac * 0.62
                sx0 = bx + 0.10 - frac * 0.24
                sz0 = bz + 0.08 + (1.0 - frac) * 0.12
                reach = f_len * (1.0 - frac * 0.24)
                p_pts = [
                    (sx0, sy0 * sign, sz0),
                    (sx0 + math.sin(ang_fan) * reach * 0.55 - 0.18, (sy0 + math.cos(ang_fan) * reach * 0.52) * sign, sz0 + 0.08),
                    (sx0 + math.sin(ang_fan) * reach - 0.48, (sy0 + math.cos(ang_fan) * reach) * sign, sz0 + 0.02),
                ]
                parts.append(
                    lib.build_curved_blade(
                        f"Form3_Overlord_{wkey}_Pinion_{j}", p_pts,
                        widths=[0.15, 0.11, 0.015], thicknesses=[0.048, 0.032, 0.01],
                        mat=ivory if j % 2 == 0 else gold, samples_per_seg=2,
                    )
                )
                if j == 0 or j == f_count - 1:
                    parts.append(
                        lib.build_curved_blade(
                            f"Form3_Overlord_{wkey}_Vein_{j}", [p_pts[0], p_pts[1]],
                            widths=[0.045, 0.018], thicknesses=[0.055, 0.024], mat=cyan, samples_per_seg=2,
                        )
                    )
            wing_groups[wkey] = parts

    form3_parts: dict[str, list[bpy.types.Object]] = {}
    corona_rays = [
        lib.build_curved_blade(
            f"Form3_Overlord_SunCorona_Ray_{ri}",
            [
                (-0.62, math.cos(ri * math.tau / 8) * 1.18, math.sin(ri * math.tau / 8) * 1.18 + 0.28),
                (-0.62, math.cos(ri * math.tau / 8) * 1.88, math.sin(ri * math.tau / 8) * 1.88 + 0.28),
            ],
            widths=[0.16, 0.02], thicknesses=[0.055, 0.012],
            mat=solar if ri % 2 == 0 else cyan, up_hint=(1, 0, 0), samples_per_seg=2,
        )
        for ri in range(8)
    ]
    form3_parts["Form3_SunCorona"] = corona_rays

    for sign, bkey in ((1, "Form3_ArchonBlade_L"), (-1, "Form3_ArchonBlade_R")):
        bl_list: list[bpy.types.Object] = []
        for bi, (bx, by, bz) in enumerate(((0.22, 1.38, 0.48), (-0.38, 1.56, 0.42))):
            bl_list.append(
                lib.build_curved_blade(
                    f"Form3_Overlord_{bkey}_Sword_{bi}",
                    _mirror_y_points([(bx - 0.36, by, bz), (bx + 0.28, by - 0.08, bz), (bx + 0.78, by - 0.24, bz - 0.04)], sign),
                    widths=[0.14, 0.16, 0.018], thicknesses=[0.055, 0.05, 0.012],
                    mat=gold if bi == 0 else ivory, samples_per_seg=2,
                )
            )
            bl_list.append(
                lib.create_geo(
                    f"Form3_Overlord_{bkey}_Core_{bi}", "cube", solar,
                    location=(bx, by * sign, bz + 0.03), rotation_deg=(0, 0, -14 * sign),
                    scale=(0.38, 0.045, 0.045), bevel=0.0,
                )
            )
        form3_parts[bkey] = bl_list

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_staged_vertex_ao(all_meshes, ao_samples=10, ao_radius=0.85)

    bones = {
        "Root": ((0, 0, 0), (0, 0.5, 0), None),
        "HaloIn": ((-0.48, 0, 0.26), (-0.48, 0.5, 0.26), "Root"),
        "HaloOut": ((-0.64, 0, 0.28), (-0.64, 0.5, 0.28), "Root"),
        "SolarLance_L": ((0.18, 0.46, 0.20), (0.18, 0.96, 0.20), "Root"),
        "SolarLance_R": ((0.18, -0.46, 0.20), (0.18, 0.04, 0.20), "Root"),
        "ValkWing_L": ((0.20, 0.46, 0.16), (0.20, 0.96, 0.16), "Root"),
        "ValkWing_R": ((0.20, -0.46, 0.16), (0.20, 0.04, 0.16), "Root"),
        "WingTop_L": ((0.22, 0.36, 0.32), (0.22, 0.86, 0.32), "Root"),
        "WingTop_R": ((0.22, -0.36, 0.32), (0.22, 0.14, 0.32), "Root"),
        "WingMid_L": ((-0.08, 0.32, 0.16), (-0.08, 0.82, 0.16), "Root"),
        "WingMid_R": ((-0.08, -0.32, 0.16), (-0.08, 0.18, 0.16), "Root"),
        "WingLow_L": ((-0.38, 0.28, 0.0), (-0.38, 0.78, 0.0), "Root"),
        "WingLow_R": ((-0.38, -0.28, 0.0), (-0.38, 0.22, 0.0), "Root"),
        "Form2_SolarSpear_L": ((0.22, 0.86, 0.34), (0.22, 1.36, 0.34), "Root"),
        "Form2_SolarSpear_R": ((0.22, -0.86, 0.34), (0.22, -0.36, 0.34), "Root"),
        "Form3_SunCorona": ((-0.62, 0.0, 0.28), (-0.62, 0.50, 0.28), "Root"),
        "Form3_ArchonBlade_L": ((-0.08, 1.44, 0.44), (-0.08, 1.94, 0.44), "Root"),
        "Form3_ArchonBlade_R": ((-0.08, -1.44, 0.44), (-0.08, -0.94, 0.44), "Root"),
    }
    for idx, ang in enumerate((0.45, math.pi - 0.45, math.pi + 0.45, math.tau - 0.45)):
        px, py = 0.14 + math.cos(ang) * 0.22, math.sin(ang) * 0.22
        bones[f"CoreProng_{idx}"] = ((px, py, 0.36), (px, py + 0.5, 0.36), "Root")

    rig = lib.create_rig("OverlordRig", bones)
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(halo_inner, rig, "HaloIn")
    lib.parent_to_bone(halo_outer, rig, "HaloOut")
    for mp in (lances, prong_parts, valk_wings, wing_groups, form2_parts, form3_parts):
        for k, objs in mp.items():
            lib.parent_to_bone(objs, rig, k)

    lib.start_action(rig, "Idle")
    for f, hi_x, ho_x in [(1, 0, 0), (24, 180, -180), (48, 360, -360)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.03 if f == 24 else 0.0))
        lib.key_bone(rig, "HaloIn", f, rot_deg=(hi_x, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(ho_x, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Charge")
    for f, lf, pf in [(1, 0.0, 1.0), (14, 0.18, 1.24), (28, 0.22, 1.32)]:
        lib.key_bone(rig, "HaloIn", f, rot_deg=(f * 16, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-f * 12, 0, 0))
        lib.key_bone(rig, "SolarLance_L", f, loc=(lf, 0.08, 0.02))
        lib.key_bone(rig, "SolarLance_R", f, loc=(lf, -0.08, 0.02))
        for p_idx in range(4):
            lib.key_bone(rig, f"CoreProng_{p_idx}", f, scale=(pf, pf, pf))
    lib.finalize_action_to_nla(rig, "Charge")

    lib.start_action(rig, "Attack")
    for f, flare, rec in [(1, -16.0, 0.18), (10, 24.0, -0.18), (20, -10.0, 0.08)]:
        lib.key_bone(rig, "SolarLance_L", f, loc=(rec, 0.04, 0))
        lib.key_bone(rig, "SolarLance_R", f, loc=(rec, -0.04, 0))
        lib.key_bone(rig, "ValkWing_L", f, rot_deg=(0, 0, flare))
        lib.key_bone(rig, "ValkWing_R", f, rot_deg=(0, 0, -flare))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.start_action(rig, "PhaseShift")
    for f, tilt in [(1, 0.0), (14, 32.0), (28, 10.0)]:
        lib.key_bone(rig, "HaloIn", f, rot_deg=(f * 20, tilt, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-f * 16, -tilt, 0))
    lib.finalize_action_to_nla(rig, "PhaseShift")

    lib.start_action(rig, "Rest")
    for f, z_dn in [(1, -0.14), (24, -0.18), (48, -0.14)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_dn))
        lib.key_bone(rig, "SolarLance_L", f, rot_deg=(0, 10.0, 0))
        lib.key_bone(rig, "SolarLance_R", f, rot_deg=(0, 10.0, 0))
    lib.finalize_action_to_nla(rig, "Rest")

    lib.start_action(rig, "ShiftToForm2")
    for f, pf, s2, ang in [(1, 1.0, 0.01, -28.0), (14, 1.38, 0.65, 16.0), (28, 1.32, 1.18, 6.0), (42, 1.25, 1.00, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.16 if f == 14 else 0.04))
        lib.key_bone(rig, "HaloIn", f, rot_deg=(f * 20, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-f * 16, 0, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "ValkWing_L", f, rot_deg=(10.0, 0, ang), scale=(s2, s2, s2))
        lib.key_bone(rig, "ValkWing_R", f, rot_deg=(-10.0, 0, -ang), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_SolarSpear_L", f, loc=(0.10, 0, 0), scale=(s2, s2, s2))
        lib.key_bone(rig, "Form2_SolarSpear_R", f, loc=(0.10, 0, 0), scale=(s2, s2, s2))
        for p_idx in range(4):
            lib.key_bone(rig, f"CoreProng_{p_idx}", f, scale=(pf, pf, pf))
    lib.finalize_action_to_nla(rig, "ShiftToForm2")

    lib.start_action(rig, "Form2")
    for f, h_deg, sp_x in [(1, 0.0, 0.0), (24, 180.0, 0.10), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "HaloIn", f, rot_deg=(h_deg, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-h_deg, 0, 0))
        lib.key_bone(rig, "ValkWing_L", f, rot_deg=(12.0 if f == 24 else 4.0, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "ValkWing_R", f, rot_deg=(-12.0 if f == 24 else -4.0, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form2_SolarSpear_L", f, loc=(sp_x, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form2_SolarSpear_R", f, loc=(sp_x, 0, 0), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form2")

    lib.start_action(rig, "ShiftToForm3")
    for f, z_up, w_fold, cor_x, s3 in [(1, 0.04, -18.0, 0.0, 0.01), (16, 0.32, 24.0, 120.0, 0.65), (32, 0.20, 20.0, 240.0, 1.22), (48, 0.08, 14.0, 360.0, 1.00)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_up))
        lib.key_bone(rig, "HaloIn", f, rot_deg=(f * 22, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-f * 18, 0, 0))
        for wname in ("WingTop", "WingMid", "WingLow"):
            lib.key_bone(rig, f"{wname}_L", f, rot_deg=(w_fold, 0, 8.0), scale=(s3, s3, s3))
            lib.key_bone(rig, f"{wname}_R", f, rot_deg=(-w_fold, 0, -8.0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_SunCorona", f, rot_deg=(cor_x, 0, 0), scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_ArchonBlade_L", f, scale=(s3, s3, s3))
        lib.key_bone(rig, "Form3_ArchonBlade_R", f, scale=(s3, s3, s3))
    lib.finalize_action_to_nla(rig, "ShiftToForm3")

    lib.start_action(rig, "Form3")
    for f, cor_x, wf, bz in [(1, 0.0, 10.0, -0.06), (16, 180.0, 22.0, 0.10), (32, 360.0, 10.0, -0.06)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, 0.08 if f == 16 else 0.03))
        lib.key_bone(rig, "HaloIn", f, rot_deg=(cor_x, 0, 0))
        lib.key_bone(rig, "HaloOut", f, rot_deg=(-cor_x, 0, 0))
        for wname in ("WingTop", "WingMid", "WingLow"):
            lib.key_bone(rig, f"{wname}_L", f, rot_deg=(wf, 0, 6.0), scale=(1, 1, 1))
            lib.key_bone(rig, f"{wname}_R", f, rot_deg=(-wf, 0, -6.0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_SunCorona", f, rot_deg=(cor_x, 0, 0), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_ArchonBlade_L", f, loc=(0, 0, bz), scale=(1, 1, 1))
        lib.key_bone(rig, "Form3_ArchonBlade_R", f, loc=(0, 0, -bz), scale=(1, 1, 1))
    lib.finalize_action_to_nla(rig, "Form3")

    lib.export_glb("boss_overlord.glb")


# 10. Sculpted Battlefield Props (crates, pickups & arena hardware)
def build_prop_nova_bomb() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    white, navy, frame, orange, glow = pal["p_white"], pal["p_navy"], pal["p_frame"], pal["p_orange"], pal["p_glow"]

    body = lib.build_lofted_hull(
        "Nova_Body",
        [
            (-0.96, lib.jet_profile(0.18, 0.18, -0.18, deck_w=0.45)),
            (-0.45, lib.jet_profile(0.28, 0.28, -0.28, deck_w=0.45)),
            (0.44,  lib.jet_profile(0.26, 0.26, -0.26, deck_w=0.45)),
            (0.96,  lib.jet_profile(0.05, 0.05, -0.05, deck_w=0.40)),
        ],
        white, crease_indices={2, 7}, subsurf=1,
    )
    nose_cone = lib.create_geo(
        "Nova_SeekerOptic", "cone", navy,
        location=(0.94, 0, 0), rotation_deg=(0, 90, 0), vertices=12, radius1=0.14, radius2=0.02, depth=0.28, bevel=0.0,
    )
    core_chamber = lib.create_geo(
        "Nova_PlasmaChamber", "cylinder", glow,
        location=(0.24, 0, 0), rotation_deg=(0, 90, 0), vertices=12, radius=0.22, depth=0.38, bevel=0.0,
    )
    coils = [
        lib.create_geo(
            f"Nova_ContainCoil_{i}", "cylinder", orange if i == 1 else frame,
            location=(cx, 0, 0), rotation_deg=(0, 90, 0), vertices=12, radius=0.295, depth=0.075, bevel=0.008, bevel_segments=1,
        )
        for i, cx in enumerate((0.08, 0.24, 0.40))
    ]
    shroud, petals = lib.build_vector_nozzle(
        "Nova_Booster", (-0.98, 0, 0), radius=0.16, length=0.40, shroud_mat=navy, frame_mat=frame, glow_mat=glow, petals=6
    )
    plume = lib.create_geo(
        "Nova_Flame", "cone", glow,
        location=(-1.28, 0, 0), rotation_deg=(0, -90, 0), vertices=10, radius1=0.14, radius2=0.02, depth=0.42, bevel=0.0,
    )
    strakes = [
        lib.create_geo(
            f"Nova_Strake_{i}", "cube", navy,
            location=(0.0, math.cos(i * math.pi * 0.5) * 0.26, math.sin(i * math.pi * 0.5) * 0.26),
            rotation_deg=(i * 90, 0, 0), scale=(0.82, 0.04, 0.06), bevel=0.005, bevel_segments=1,
        )
        for i in range(4)
    ]
    fin_objs: list[bpy.types.Object] = []
    for i in range(4):
        ang = i * math.pi * 0.5 + math.pi * 0.25
        cy, cz = math.cos(ang), math.sin(ang)
        fin_objs.append(
            lib.build_curved_blade(
                f"Nova_Fin_{i}",
                [(-0.55, cy * 0.24, cz * 0.24), (-0.84, cy * 0.56, cz * 0.56), (-1.02, cy * 0.60, cz * 0.60)],
                widths=[0.34, 0.22, 0.05], thicknesses=[0.05, 0.035, 0.015], mat=navy, up_hint=(-cz, cy, 0.0),
            )
        )
        fin_objs.append(
            lib.create_geo(
                f"Nova_FinTipGlow_{i}", "cube", glow,
                location=(-0.88, cy * 0.54, cz * 0.54), rotation_deg=(ang * 57.3, 0, 0),
                scale=(0.16, 0.04, 0.04), bevel=0.0,
            )
        )

    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.65)
    rig = lib.create_rig("NovaRig", {"Root": ((0, 0, 0), (0, 0.5, 0), None), "Fins": ((-0.75, 0, 0), (-0.75, 0.5, 0), "Root")})
    lib.parent_to_bone([body, nose_cone, core_chamber, *coils, *shroud, *petals, plume, *strakes], rig, "Root")
    lib.parent_to_bone(fin_objs, rig, "Fins")

    lib.start_action(rig, "Idle")
    for f, rx in [(1, 0.0), (24, 180.0), (48, 360.0)]:
        lib.key_bone(rig, "Fins", f, rot_deg=(rx, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, rx, sc in [(1, 0.0, 1.0), (12, 180.0, 1.18), (24, 360.0, 1.0)]:
        lib.key_bone(rig, "Fins", f, rot_deg=(rx, 0, 0), scale=(1.0, sc, sc))
    lib.finalize_action_to_nla(rig, "Attack")
    lib.export_glb("prop_nova_bomb.glb")


def build_prop_mine(filename: str, homing: bool) -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    dark = pal["v_dark"] if homing else pal["c_dark"]
    trim = pal["v_bone"] if homing else pal["c_gold"]
    accent = pal["v_chitin"] if homing else pal["c_red"]
    glow = pal["v_magenta"] if homing else pal["c_glow"]

    shell = lib.create_geo("Mine_Shell", "ico", dark, location=(0, 0, 0), scale=(0.66, 0.66, 0.50), subdivisions=2, bevel=0.0)
    upper_cap = lib.create_geo("Mine_DomeCap", "cylinder", accent, location=(0, 0, 0.14), vertices=12, radius=0.52, depth=0.16, bevel=0.015, bevel_segments=1)
    core = lib.create_geo("Mine_Core", "sphere", glow, location=(0, 0, 0.22), scale=(0.38, 0.38, 0.36), segments=14, rings=10, bevel=0.0)
    equator_ring = lib.build_precision_ring_assembly(
        "Mine_EquatorGimbal", (0.0, 0.0, 0.0), 0.72, 0.048, 22, dark, trim, glow, clamp_count=6
    )
    body: list[bpy.types.Object] = [shell, upper_cap, core, *equator_ring]

    if homing:
        for i in range(4):
            a = i * math.pi * 0.5
            body.append(
                lib.create_geo(
                    f"Mine_ThrusterPod_{i}", "cone", trim,
                    location=(math.cos(a) * 0.68, math.sin(a) * 0.68, -0.14),
                    rotation_deg=(0, 145, math.degrees(a)), vertices=8, radius1=0.09, radius2=0.03, depth=0.22, bevel=0.0,
                )
            )

    ring_arms: list[bpy.types.Object] = []
    arm_count = 6 if homing else 4
    for i in range(arm_count):
        ang = (i / arm_count) * math.tau
        ca, sa = math.cos(ang), math.sin(ang)
        ring_arms.append(
            lib.build_curved_blade(
                f"Mine_Claw_{i}",
                [(ca * 0.52, sa * 0.52, -0.04), (ca * 1.00, sa * 1.00, 0.20), (ca * 0.80, sa * 0.80, 0.64)],
                widths=[0.22, 0.16, 0.04], thicknesses=[0.12, 0.09, 0.03], mat=trim,
            )
        )
        ring_arms.extend(
            lib.build_hydraulic_strut(
                f"Mine_ClawStrut_{i}", (ca * 0.44, sa * 0.44, 0.08), (ca * 0.84, sa * 0.84, 0.20), 0.032, dark, trim
            )
        )
        ring_arms.append(
            lib.create_geo(
                f"Mine_TipGlow_{i}", "ico", glow,
                location=(ca * 0.80, sa * 0.80, 0.60), scale=(0.12, 0.12, 0.12), subdivisions=1, bevel=0.0,
            )
        )

    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.65)
    rig = lib.create_rig("MineRig", {"Root": ((0, 0, 0), (0, 0.5, 0), None), "Claws": ((0, 0, 0), (0, 0.5, 0), "Root")})
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(ring_arms, rig, "Claws")

    lib.start_action(rig, "Idle")
    for f, rz in [(1, 0.0), (24, 180.0), (48, 360.0)]:
        lib.key_bone(rig, "Claws", f, rot_deg=(0, 0, rz))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, rz, sc in [(1, 0.0, 1.0), (12, 180.0, 1.26), (24, 360.0, 1.0)]:
        lib.key_bone(rig, "Claws", f, rot_deg=(0, 0, rz), scale=(sc, sc, sc))
    lib.finalize_action_to_nla(rig, "Attack")
    lib.export_glb(filename)


def build_prop_powerup() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    dark, steel, orange, crystal = pal["p_navy"], pal["c_steel"], pal["p_orange"], pal["k_crystal"]

    gem = lib.build_lofted_hull(
        "Powerup_CoreGem",
        [
            (-0.70, [(0.02, 0.02), (0.02, -0.02), (-0.02, -0.02), (-0.02, 0.02)]),
            (0.0,   [(0.40, 0.40), (0.40, -0.40), (-0.40, -0.40), (-0.40, 0.40)]),
            (0.70,  [(0.02, 0.02), (0.02, -0.02), (-0.02, -0.02), (-0.02, 0.02)]),
        ],
        crystal, subsurf=0,
    )
    core_collar = lib.create_geo(
        "Powerup_CoreCollar", "cylinder", dark,
        location=(0, 0, 0), rotation_deg=(0, 90, 0), vertices=8, radius=0.48, depth=0.14, bevel=0.015, bevel_segments=1,
    )
    shroud_parts: list[bpy.types.Object] = []
    for i in range(4):
        ang = (i / 4.0) * math.tau
        cy, cz = math.cos(ang), math.sin(ang)
        shroud_parts.append(
            lib.build_curved_blade(
                f"Powerup_CollectorPetal_{i}",
                [(-0.56, cy * 0.52, cz * 0.52), (0.0, cy * 0.78, cz * 0.78), (0.56, cy * 0.46, cz * 0.46)],
                widths=[0.18, 0.24, 0.14], thicknesses=[0.09, 0.11, 0.06],
                mat=dark if i % 2 == 0 else steel, up_hint=(-cz, cy, 0.0),
            )
        )
        shroud_parts.append(
            lib.create_geo(
                f"Powerup_PetalTip_{i}", "cube", orange,
                location=(0.0, cy * 0.80, cz * 0.80), rotation_deg=(ang * 57.3, 0, 0),
                scale=(0.24, 0.05, 0.12), bevel=0.005, bevel_segments=1,
            )
        )

    gimbal_a = lib.build_precision_ring_assembly(
        "Powerup_GimbalA", (0.0, 0.0, 0.0), 0.94, 0.045, 22, dark, orange, crystal, clamp_count=4, rot_deg=(0, 90, 0)
    )
    gimbal_b = lib.build_precision_ring_assembly(
        "Powerup_GimbalB", (0.0, 0.0, 0.0), 1.08, 0.042, 22, steel, dark, crystal, clamp_count=4, rot_deg=(28, 0, 0)
    )

    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.65)
    rig = lib.create_rig(
        "PowerupRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "Shroud": ((0, 0, 0), (0, 0.5, 0), "Root"),
            "GimbalA": ((0, 0, 0), (0, 0.5, 0), "Root"),
            "GimbalB": ((0, 0, 0), (0, 0.5, 0), "Root"),
        },
    )
    lib.parent_to_bone([gem, core_collar], rig, "Root")
    lib.parent_to_bone(shroud_parts, rig, "Shroud")
    lib.parent_to_bone(gimbal_a, rig, "GimbalA")
    lib.parent_to_bone(gimbal_b, rig, "GimbalB")

    lib.start_action(rig, "Idle")
    for f, rx, rz, pulse in [(1, 0.0, 0.0, 1.0), (24, 180.0, -180.0, 1.08), (48, 360.0, -360.0, 1.0)]:
        lib.key_bone(rig, "Shroud", f, rot_deg=(rx, 0, 0), scale=(pulse, pulse, pulse))
        lib.key_bone(rig, "GimbalA", f, rot_deg=(0, rz, 0))
        lib.key_bone(rig, "GimbalB", f, rot_deg=(0, 0, rz))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("prop_powerup_pod.glb")


def build_prop_medkit() -> None:
    lib.reset_scene()
    pal = lib.make_faction_palette()
    white, dark, steel, emerald = pal["p_white"], pal["p_frame"], pal["c_steel"], pal["k_emerald"]

    vial = lib.create_geo("Medkit_BioCore", "ico", emerald, location=(0, 0, 0), scale=(0.44, 0.44, 0.44), subdivisions=2, bevel=0.0)
    bar_x = lib.build_lofted_hull(
        "Medkit_CrossX",
        [
            (-0.92, [(0.16, 0.16), (0.16, -0.16), (-0.16, -0.16), (-0.16, 0.16)]),
            (0.0,   [(0.26, 0.28), (0.26, -0.28), (-0.26, -0.28), (-0.26, 0.28)]),
            (0.92,  [(0.16, 0.16), (0.16, -0.16), (-0.16, -0.16), (-0.16, 0.16)]),
        ],
        white, subsurf=0,
    )
    bar_y = lib.build_lofted_hull(
        "Medkit_CrossY",
        [
            (-0.26, [(0.92, 0.16), (0.92, -0.16), (-0.92, -0.16), (-0.92, 0.16)]),
            (0.0,   [(0.96, 0.28), (0.96, -0.28), (-0.96, -0.28), (-0.96, 0.28)]),
            (0.26,  [(0.92, 0.16), (0.92, -0.16), (-0.92, -0.16), (-0.92, 0.16)]),
        ],
        white, subsurf=0,
    )
    core_badge = lib.create_geo("Medkit_GlowCross", "cylinder", emerald, location=(0, 0, 0.28), vertices=8, radius=0.34, depth=0.08, bevel=0.0)
    canisters: list[bpy.types.Object] = []
    for i, (cx, cy, rotz) in enumerate(((0.62, 0.0, 0), (-0.62, 0.0, 0), (0.0, 0.62, 90), (0.0, -0.62, 90))):
        canisters.append(
            lib.create_geo(
                f"Medkit_SerumCan_{i}", "cylinder", emerald,
                location=(cx, cy, 0.20), rotation_deg=(0, 90, rotz), vertices=10, radius=0.09, depth=0.38, bevel=0.0,
            )
        )
        canisters.append(
            lib.create_geo(
                f"Medkit_ClampRing_{i}", "cylinder", steel,
                location=(cx, cy, 0.20), rotation_deg=(0, 90, rotz), vertices=10, radius=0.115, depth=0.09, bevel=0.008, bevel_segments=1,
            )
        )

    cage_parts = lib.build_precision_ring_assembly(
        "Medkit_StabilizerGimbal", (0.0, 0.0, 0.0), 1.04, 0.045, 22, dark, steel, emerald, clamp_count=4
    )

    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.65)
    rig = lib.create_rig("MedkitRig", {"Root": ((0, 0, 0), (0, 0.5, 0), None), "Cage": ((0, 0, 0), (0, 0.5, 0), "Root")})
    lib.parent_to_bone([vial, bar_x, bar_y, core_badge, *canisters], rig, "Root")
    lib.parent_to_bone(cage_parts, rig, "Cage")
    lib.start_action(rig, "Idle")
    for f, rz, z_off in [(1, 0.0, 0.0), (24, 180.0, 0.08), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_off))
        lib.key_bone(rig, "Cage", f, rot_deg=(0, 0, rz))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("prop_medkit_pod.glb")


def main() -> None:
    t0 = time.time()
    if "--vanguard-only" in sys.argv:
        print("=== REBUILDING MODULAR PLAYER VANGUARD CHASSIS ===")
        build_player_vanguard()
        print(f"=== PLAYER VANGUARD REBUILT IN {time.time() - t0:.2f}s ===")
        return

    if "--bosses-only" in sys.argv:
        print("=== REBUILDING ALL 3 CLASSIC CAPITAL BOSSES WITH 3-STAGE FORMS ===")
        build_boss_destroyer()
        build_boss_summoner()
        build_boss_overlord()
        print(f"=== CLASSIC BOSSES REBUILT IN {time.time() - t0:.2f}s ===")
        return

    print("=== BUILDING NEBULA VANGUARD v4.0 SCULPTED FLEET ===")
    build_player_vanguard()
    build_enemy_small()
    build_enemy_medium()
    build_enemy_large()
    build_enemy_splitter()
    build_enemy_elite()
    build_boss_destroyer()
    build_boss_summoner()
    build_boss_overlord()
    build_prop_nova_bomb()
    build_prop_mine("prop_mine_static.glb", homing=False)
    build_prop_mine("prop_mine_homing.glb", homing=True)
    build_prop_powerup()
    build_prop_medkit()
    print(f"=== ALL 14 v4.0 GLB ASSETS BUILT IN {time.time() - t0:.2f}s ===")


if __name__ == "__main__":
    main()
