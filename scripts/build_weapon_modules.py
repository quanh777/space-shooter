"""
Modular Ship Hardpoint & Superstructure Asset Builder.
Builds all 8 weapon & skill modules as swappable airframe sections (Nose, Inner Wing
+ Cap, Outer Wingtip, Dorsal Spine) sharing `ShipHull_*` PBR materials so swapping gear
actually reshapes the ship in flight.

Coordinate contract (Blender X-fwd, +Y Port/Left, +Z Up):
  - SlotNose_    local (0,0,0) mates to Vanguard Nose Bulkhead   ( 0.88,  0.00, 0.00)
  - SlotWingIn_  local (0,0,0) mates to Vanguard Wing Root       (-0.18, +0.52, 0.00)
      -> Standardized Outer Flange sits at local (-0.24, +1.04, +0.02) == ship (-0.42, +1.56, +0.02)
  - SlotWingOut_ local (0,0,0) mates flush onto Outer Flange     (-0.42, +1.56, +0.02)
  - Skill spine  local (0,0,0) mates onto Dorsal Spine Bay       (-0.78,  0.00, +0.26)
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import blender_sculpt_lib as lib  # noqa: E402
import bpy  # noqa: E402


def _mirror_y_poly(poly: list[tuple[float, float]], sign: int) -> list[tuple[float, float]]:
    res = [(px, py * sign) for px, py in poly]
    return list(reversed(res)) if sign < 0 else res


def _mirror_y_wing_stations(
    stations: list[tuple[float, float, float, float, float]], sign: int
) -> list[tuple[float, float, float, float, float]]:
    return [(y * sign, xf, xb, zc, th) for y, xf, xb, zc, th in stations]


def _root_dock_collar(prefix: str, frame: bpy.types.Material, primary: bpy.types.Material, is_nose: bool = False) -> list[bpy.types.Object]:
    """Precision structural bulkhead collar interlocking at local (0,0,0)."""
    if is_nose:
        collar = lib.create_geo(
            f"{prefix}_RootCollar", "cylinder", frame,
            location=(-0.02, 0.0, 0.0), rotation_deg=(0, 90, 0), vertices=8, radius=0.22, depth=0.10,
            bevel=0.008, bevel_segments=1,
        )
        rib = lib.create_geo(
            f"{prefix}_RootRing", "cube", primary,
            location=(0.02, 0.0, 0.0), scale=(0.08, 0.44, 0.24), bevel=0.008, bevel_segments=1,
        )
        return [collar, rib]
    collar = lib.create_geo(
        f"{prefix}_RootCollar", "cube", frame,
        location=(0.0, 0.0, 0.0), scale=(0.86, 0.11, 0.19), bevel=0.008, bevel_segments=1,
    )
    lug_a = lib.create_geo(
        f"{prefix}_RootLugF", "cube", primary,
        location=(0.24, 0.02, 0.09), scale=(0.12, 0.08, 0.05), bevel=0.005, bevel_segments=1,
    )
    lug_b = lib.create_geo(
        f"{prefix}_RootLugB", "cube", primary,
        location=(-0.24, 0.02, 0.09), scale=(0.12, 0.08, 0.05), bevel=0.005, bevel_segments=1,
    )
    return [collar, lug_a, lug_b]


def _wing_in_flange_and_cap(
    wing_tag: str,
    frame: bpy.types.Material,
    secondary: bpy.types.Material,
    accent: bpy.types.Material,
    sig_glow: bpy.types.Material,
    cap_style: str = "sleek",
) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    """Standardized (-0.24, 1.04, 0.02) outer bulkhead flange + conditional OuterCap wingtip."""
    flange = lib.create_geo(
        f"SlotWingIn_{wing_tag}_OuterFlange", "cube", frame,
        location=(-0.24, 1.04, 0.02), scale=(0.74, 0.08, 0.15), bevel=0.008, bevel_segments=1,
    )
    flange_pin = lib.create_geo(
        f"SlotWingIn_{wing_tag}_OuterPin", "cube", accent,
        location=(-0.24, 1.06, 0.09), scale=(0.30, 0.04, 0.04), bevel=0.004, bevel_segments=1,
    )

    cap_objs: list[bpy.types.Object] = []
    if cap_style == "heavy":
        cap_objs.append(
            lib.build_beveled_armor_plate(
                f"SlotWingIn_OuterCap_{wing_tag}_Bumper",
                [(-0.60, 1.02), (0.12, 1.02), (-0.02, 1.38), (-0.54, 1.36)],
                z_bottom=-0.06, z_top=0.14, mat=secondary, top_inset=0.82, bevel_segments=1,
            )
        )
        cap_objs.append(
            lib.create_geo(
                f"SlotWingIn_OuterCap_{wing_tag}_CapGlow", "cube", sig_glow,
                location=(-0.24, 1.35, 0.06), scale=(0.24, 0.045, 0.05), bevel=0.0,
            )
        )
    elif cap_style == "forward":
        cap_objs.append(
            lib.build_airfoil_wing(
                f"SlotWingIn_OuterCap_{wing_tag}_Spike",
                [(1.02, 0.14, -0.58, 0.02, 0.10), (1.42, 0.42, -0.34, 0.14, 0.035)],
                mat=secondary, camber=0.03, bevel_segments=1,
            )
        )
        cap_objs.append(
            lib.create_geo(
                f"SlotWingIn_OuterCap_{wing_tag}_TipBeam", "cube", sig_glow,
                location=(0.16, 1.36, 0.12), rotation_deg=(0, 0, -24), scale=(0.36, 0.03, 0.03), bevel=0.0,
            )
        )
    elif cap_style == "stealth":
        cap_objs.append(
            lib.build_airfoil_wing(
                f"SlotWingIn_OuterCap_{wing_tag}_Cowl",
                [(1.02, 0.12, -0.62, 0.02, 0.10), (1.38, -0.22, -0.68, 0.16, 0.035)],
                mat=secondary, camber=0.03, bevel_segments=1,
            )
        )
        cap_objs.append(
            lib.create_geo(
                f"SlotWingIn_OuterCap_{wing_tag}_EdgeGlow", "cube", sig_glow,
                location=(-0.44, 1.35, 0.14), rotation_deg=(-18, 0, -26), scale=(0.34, 0.035, 0.035), bevel=0.0,
            )
        )
    else:
        cap_objs.append(
            lib.build_airfoil_wing(
                f"SlotWingIn_OuterCap_{wing_tag}_Winglet",
                [(1.02, 0.12, -0.58, 0.02, 0.10), (1.40, -0.30, -0.76, 0.24, 0.035)],
                mat=secondary, camber=0.04, bevel_segments=1,
            )
        )
        cap_objs.append(
            lib.create_geo(
                f"SlotWingIn_OuterCap_{wing_tag}_Accent", "cube", accent,
                location=(-0.36, 1.24, 0.12), rotation_deg=(-22, 0, -22), scale=(0.28, 0.10, 0.04), bevel=0.004, bevel_segments=1,
            )
        )
        cap_objs.append(
            lib.create_geo(
                f"SlotWingIn_OuterCap_{wing_tag}_Glow", "cube", sig_glow,
                location=(-0.48, 1.36, 0.20), rotation_deg=(-24, 0, -22), scale=(0.34, 0.035, 0.035), bevel=0.0,
            )
        )

    return [flange, flange_pin], cap_objs


def _wing_out_root_collar(prefix: str, frame: bpy.types.Material, accent: bpy.types.Material) -> list[bpy.types.Object]:
    """Interlocking root sleeve at (0,0,0) mating flush onto SlotWingIn/StockWingIn (-0.24, 1.04, 0.02)."""
    return [
        lib.create_geo(
            f"{prefix}_OutCollar", "cube", frame,
            location=(0.0, 0.0, 0.0), scale=(0.74, 0.10, 0.15), bevel=0.008, bevel_segments=1,
        ),
        lib.create_geo(
            f"{prefix}_OutClamp", "cube", accent,
            location=(0.0, 0.04, 0.08), scale=(0.32, 0.06, 0.04), bevel=0.004, bevel_segments=1,
        ),
    ]


# 1. Pulse Blaster (NovaCorp Valkyrie Twin-Pulse Airframe)
def build_pulse_blaster() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_cyan"]

    # --- SLOT NOSE: Twin-intake needle fighter prow + twin lower cheek repeaters ---
    nose_static: list[bpy.types.Object] = []
    nose_static.extend(_root_dock_collar("SlotNose_Pulse", frame, white, is_nose=True))
    nose_static.append(
        lib.build_lofted_hull(
            "SlotNose_Pulse_SpearHull",
            [
                (-0.04, lib.jet_profile(0.24, 0.16, -0.13, deck_w=0.34)),
                (0.55,  lib.jet_profile(0.18, 0.13, -0.10, deck_w=0.35)),
                (1.22,  lib.jet_profile(0.10, 0.08, -0.06, deck_w=0.32)),
                (1.86,  lib.jet_profile(0.02, 0.02, -0.015, deck_w=0.25)),
            ],
            mat=white, crease_indices={2, 7}, subsurf=1, bevel_segments=1,
        )
    )
    nose_static.append(
        lib.build_beveled_armor_plate(
            "SlotNose_Pulse_DorsalSpine",
            [(0.02, -0.12), (1.35, -0.05), (1.48, 0.0), (1.35, 0.05), (0.02, 0.12)],
            z_bottom=0.08, z_top=0.19, mat=navy, top_inset=0.76, bevel_segments=1,
        )
    )
    for sign, s in ((1, "L"), (-1, "R")):
        nose_static.append(
            lib.build_airfoil_wing(
                f"SlotNose_Pulse_Canard_{s}",
                [(0.18 * sign, 0.72, 0.18, 0.02, 0.065), (0.64 * sign, 0.44, 0.12, 0.06, 0.03)] if sign > 0 else
                [(-0.18, 0.72, 0.18, 0.02, 0.065), (-0.64, 0.44, 0.12, 0.06, 0.03)],
                mat=accent, camber=0.03, bevel_segments=1,
            )
        )
    nose_static.append(
        lib.build_beveled_armor_plate(
            "SlotNose_Tier2_SensorCowl",
            [(0.12, -0.18), (0.95, -0.11), (0.95, 0.11), (0.12, 0.18)],
            z_bottom=-0.16, z_top=-0.04, mat=navy, top_inset=0.80, bevel_segments=1,
        )
    )
    nose_static.append(
        lib.create_geo("SlotNose_Tier3_VentralFin", "cube", accent, location=(0.68, 0.0, -0.18), scale=(0.56, 0.04, 0.12), bevel=0.005, bevel_segments=1)
    )

    nose_barrels: list[bpy.types.Object] = []
    for sign, s in ((1, "L"), (-1, "R")):
        nose_barrels.extend([
            lib.create_geo(
                f"SlotNose_Pulse_Barrel_{s}", "cylinder", frame,
                location=(1.05, 0.15 * sign, -0.02), rotation_deg=(0, 90, 0), vertices=10, radius=0.038, depth=0.68, bevel=0.004, bevel_segments=1,
            ),
            lib.create_geo(
                f"SlotNose_Pulse_Muzzle_{s}", "cylinder", sig,
                location=(1.42, 0.15 * sign, -0.02), rotation_deg=(0, 90, 0), vertices=8, radius=0.030, depth=0.08, bevel=0.0,
            ),
            lib.create_geo(
                f"SlotNose_Tier2_CoolRing_{s}", "cylinder", accent,
                location=(1.22, 0.15 * sign, -0.02), rotation_deg=(0, 90, 0), vertices=10, radius=0.048, depth=0.05, bevel=0.0,
            ),
        ])

    # --- SLOT WING IN: Supersonic swept delta wing (-0.18,+0.52) -> flange (-0.24,+1.04,+0.02) ---
    wi_static: list[bpy.types.Object] = []
    wi_static.extend(_root_dock_collar("SlotWingIn_Pulse", frame, white, is_nose=False))
    wi_static.append(
        lib.build_airfoil_wing(
            "SlotWingIn_Pulse_MainWing",
            [
                (-0.03, 0.44, -0.78, 0.00, 0.17),
                (0.48,  0.22, -0.76, 0.01, 0.14),
                (1.04, -0.02, -0.72, 0.02, 0.11),
            ],
            mat=white, camber=0.06, bevel_segments=1,
        )
    )
    wi_static.append(
        lib.build_airfoil_wing(
            "SlotWingIn_Pulse_LeadArmor",
            [
                (0.02, 0.46, 0.06, 0.01, 0.15),
                (1.02, 0.00, -0.34, 0.02, 0.10),
            ],
            mat=navy, camber=0.04, bevel_segments=1,
        )
    )
    wi_static.extend([
        lib.build_beveled_armor_plate(
            "SlotWingIn_Pulse_CapBay",
            [(-0.42, 0.18), (0.20, 0.14), (0.04, 0.88), (-0.48, 0.88)],
            z_bottom=-0.04, z_top=0.11, mat=accent, top_inset=0.84, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Pulse_ReactorStrip", "cube", sig,
            location=(-0.18, 0.56, 0.09), rotation_deg=(0, 0, -18), scale=(0.48, 0.05, 0.045), bevel=0.0,
        ),
        *lib.build_armor_greeble_strip("SlotWingIn_Tier2_StrakeTiles", (0.14, 0.18, 0.10), (-0.16, 0.92, 0.09), 4, (0.14, 0.14, 0.035), navy, accent),
        lib.create_geo(
            "SlotWingIn_Tier3_Fence", "cube", frame,
            location=(-0.14, 0.72, 0.14), rotation_deg=(0, 0, -14), scale=(0.68, 0.035, 0.12), bevel=0.004, bevel_segments=1,
        ),
    ])
    wi_flange, wi_cap = _wing_in_flange_and_cap("Pulse", frame, navy, accent, sig, cap_style="sleek")
    wi_static.extend([*wi_flange, *wi_cap])

    wi_barrels: list[bpy.types.Object] = []
    for oy in (0.34, 0.54):
        wi_barrels.extend([
            lib.create_geo(
                f"SlotWingIn_Pulse_Cannon_{oy:.2f}", "cylinder", frame,
                location=(0.36, oy, -0.01), rotation_deg=(0, 90, 0), vertices=10, radius=0.044, depth=0.66, bevel=0.005, bevel_segments=1,
            ),
            lib.create_geo(
                f"SlotWingIn_Pulse_Tip_{oy:.2f}", "cylinder", sig,
                location=(0.72, oy, -0.01), rotation_deg=(0, 90, 0), vertices=8, radius=0.034, depth=0.08, bevel=0.0,
            ),
            lib.create_geo(
                f"SlotWingIn_Tier2_Collar_{oy:.2f}", "cylinder", accent,
                location=(0.54, oy, -0.01), rotation_deg=(0, 90, 0), vertices=10, radius=0.054, depth=0.05, bevel=0.0,
            ),
        ])

    # --- SLOT WING OUT: Scimitar outer repeater wingtip (0,0,0) -> +1.28 ---
    wo_static: list[bpy.types.Object] = []
    wo_static.extend(_wing_out_root_collar("SlotWingOut_Pulse", frame, accent))
    wo_static.extend([
        lib.build_airfoil_wing(
            "SlotWingOut_Pulse_ScimitarWing",
            [
                (-0.02, 0.34, -0.38, 0.00, 0.11),
                (0.62,  0.04, -0.52, 0.04, 0.075),
                (1.24, -0.44, -0.78, 0.30, 0.035),
            ],
            mat=navy, camber=0.05, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Pulse_EdgeBand", "cube", accent,
            location=(-0.08, 0.64, 0.05), rotation_deg=(4, 0, -24), scale=(0.34, 0.56, 0.04), bevel=0.004, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Pulse_NavLaser", "cube", sig,
            location=(-0.54, 1.20, 0.25), rotation_deg=(-22, 0, -26), scale=(0.42, 0.04, 0.04), bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingOut_Tier2_AuxFin", "cube", white,
            location=(-0.28, 0.92, -0.06), rotation_deg=(18, 0, -24), scale=(0.32, 0.22, 0.03), bevel=0.004, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier3_CapPod", "cylinder", frame,
            location=(-0.38, 1.18, 0.18), rotation_deg=(0, 90, 0), vertices=10, radius=0.045, depth=0.38, bevel=0.004, bevel_segments=1,
        ),
    ])
    wo_barrels = [
        lib.create_geo(
            "SlotWingOut_Pulse_Gun", "cylinder", frame,
            location=(0.24, 0.42, -0.01), rotation_deg=(0, 90, 0), vertices=10, radius=0.040, depth=0.58, bevel=0.004, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Pulse_GunGlow", "cylinder", sig,
            location=(0.56, 0.42, -0.01), rotation_deg=(0, 90, 0), vertices=8, radius=0.030, depth=0.07, bevel=0.0,
        ),
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [nose_static + nose_barrels, wi_static + wi_barrels, wo_static + wo_barrels],
        base_meshes=[],
        ao_samples=10,
        ao_radius=0.75,
    )

    rig = lib.create_rig(
        "PulseModularRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Barrel_Nose": ((0.95, 0, -0.02), (0.95, 0.35, -0.02), "Root"),
            "Barrel_WingIn": ((0.36, 0.44, -0.01), (0.36, 0.78, -0.01), "Root"),
            "Barrel_WingOut": ((0.24, 0.42, -0.01), (0.24, 0.72, -0.01), "Root"),
        },
    )
    lib.parent_to_bone([*nose_static, *wi_static, *wo_static], rig, "Root")
    lib.parent_to_bone(nose_barrels, rig, "Barrel_Nose")
    lib.parent_to_bone(wi_barrels, rig, "Barrel_WingIn")
    lib.parent_to_bone(wo_barrels, rig, "Barrel_WingOut")

    lib.start_action(rig, "Idle")
    for f, k in [(1, 0.0), (16, -0.015), (32, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(k, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, k in [(1, 0.0), (6, -0.18), (14, -0.05), (22, -0.16), (30, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(k, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_pulse_blaster.glb")


# 2. Scatter Cannon (IronForge Broadsword Heavy Gunship Sponson)
def build_scatter_cannon() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_amber"]

    # --- SLOT NOSE: Broad armored hammerhead ram-prow + triple heavy bores ---
    nose_static: list[bpy.types.Object] = []
    nose_static.extend(_root_dock_collar("SlotNose_Scatter", frame, navy, is_nose=True))
    nose_static.extend([
        lib.build_beveled_armor_plate(
            "SlotNose_Scatter_HammerHull",
            [(-0.04, -0.26), (0.36, -0.58), (1.06, -0.62), (1.18, 0.0), (1.06, 0.62), (0.36, 0.58), (-0.04, 0.26)],
            z_bottom=-0.15, z_top=0.19, mat=navy, top_inset=0.84, bevel_segments=1,
        ),
        lib.build_beveled_armor_plate(
            "SlotNose_Scatter_TopShield",
            [(0.10, -0.28), (0.94, -0.46), (1.06, 0.0), (0.94, 0.46), (0.10, 0.28)],
            z_bottom=0.16, z_top=0.28, mat=white, top_inset=0.80, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Scatter_RamBumper", "cube", accent,
            location=(1.12, 0.0, 0.14), scale=(0.14, 0.92, 0.10), bevel=0.01, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Tier2_ERASlab", "cube", frame,
            location=(0.56, 0.0, 0.29), scale=(0.48, 0.44, 0.06), bevel=0.008, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Tier3_RamSpike", "cube", accent,
            location=(1.24, 0.0, 0.02), scale=(0.24, 0.20, 0.16), bevel=0.006, bevel_segments=1,
        ),
    ])
    nose_barrels: list[bpy.types.Object] = []
    for by in (-0.34, 0.0, 0.34):
        nose_barrels.extend([
            lib.create_geo(
                f"SlotNose_Scatter_Bore_{by:.2f}", "cylinder", frame,
                location=(1.14, by, 0.02), rotation_deg=(0, 90, 0), vertices=10, radius=0.065, depth=0.38, bevel=0.006, bevel_segments=1,
            ),
            lib.create_geo(
                f"SlotNose_Scatter_Muzzle_{by:.2f}", "cylinder", sig,
                location=(1.35, by, 0.02), rotation_deg=(0, 90, 0), vertices=8, radius=0.048, depth=0.05, bevel=0.0,
            ),
        ])

    # --- SLOT WING IN: Chunky composite gunship stub-wing + triple flak battery ---
    wi_static: list[bpy.types.Object] = []
    wi_static.extend(_root_dock_collar("SlotWingIn_Scatter", frame, navy, is_nose=False))
    wi_static.extend([
        lib.build_beveled_armor_plate(
            "SlotWingIn_Scatter_GunDeck",
            [(-0.66, -0.02), (0.64, -0.02), (0.48, 1.04), (-0.64, 1.04)],
            z_bottom=-0.10, z_top=0.14, mat=navy, top_inset=0.88, bevel_segments=1,
        ),
        lib.build_beveled_armor_plate(
            "SlotWingIn_Scatter_SlopeArmor",
            [(-0.46, 0.08), (0.44, 0.08), (0.34, 0.96), (-0.52, 0.96)],
            z_bottom=0.12, z_top=0.25, mat=white, top_inset=0.82, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Scatter_HazardBar", "cube", accent,
            location=(0.44, 0.52, 0.14), rotation_deg=(0, 0, -9), scale=(0.14, 0.88, 0.11), bevel=0.008, bevel_segments=1,
        ),
        *lib.build_hydraulic_strut("SlotWingIn_Scatter_Damper", (-0.28, 0.16, 0.22), (0.28, 0.82, 0.22), 0.026, frame, white),
        lib.create_geo(
            "SlotWingIn_Tier2_AmmoDrum", "cylinder", frame,
            location=(-0.38, 0.48, 0.25), rotation_deg=(0, 90, 0), vertices=12, radius=0.14, depth=0.38, bevel=0.008, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Tier3_ShieldRib", "cube", accent,
            location=(0.04, 0.52, 0.28), scale=(0.56, 0.16, 0.08), bevel=0.006, bevel_segments=1,
        ),
    ])
    wi_flange, wi_cap = _wing_in_flange_and_cap("Scatter", frame, navy, accent, sig, cap_style="heavy")
    wi_static.extend([*wi_flange, *wi_cap])

    wi_barrels: list[bpy.types.Object] = []
    for idx, oy in enumerate((0.26, 0.52, 0.78)):
        wi_barrels.extend([
            lib.create_geo(
                f"SlotWingIn_Scatter_Tube_{idx}", "cylinder", frame,
                location=(0.56, oy, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.062, depth=0.40, bevel=0.006, bevel_segments=1,
            ),
            lib.create_geo(
                f"SlotWingIn_Scatter_Ring_{idx}", "cylinder", accent,
                location=(0.74, oy, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.072, depth=0.055, bevel=0.0,
            ),
            lib.create_geo(
                f"SlotWingIn_Scatter_Glow_{idx}", "cylinder", sig,
                location=(0.79, oy, 0.04), rotation_deg=(0, 90, 0), vertices=8, radius=0.046, depth=0.04, bevel=0.0,
            ),
        ])

    # --- SLOT WING OUT: Blunt armored flak-shield wingtip + staggered double choke ---
    wo_static: list[bpy.types.Object] = []
    wo_static.extend(_wing_out_root_collar("SlotWingOut_Scatter", frame, accent))
    wo_static.extend([
        lib.build_beveled_armor_plate(
            "SlotWingOut_Scatter_Bulwark",
            [(-0.38, -0.02), (0.38, -0.02), (0.48, 0.94), (0.18, 1.18), (-0.42, 1.12)],
            z_bottom=-0.08, z_top=0.14, mat=navy, top_inset=0.86, bevel_segments=1,
        ),
        lib.build_beveled_armor_plate(
            "SlotWingOut_Scatter_Plate",
            [(-0.24, 0.14), (0.28, 0.18), (0.34, 0.88), (-0.28, 0.92)],
            z_bottom=0.12, z_top=0.22, mat=white, top_inset=0.80, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Scatter_Guard", "cube", accent,
            location=(0.36, 0.98, 0.12), scale=(0.24, 0.36, 0.14), bevel=0.008, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier2_Slab", "cube", frame,
            location=(-0.10, 0.62, 0.24), scale=(0.36, 0.42, 0.06), bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier3_ProwPlate", "cube", accent,
            location=(0.14, 1.12, 0.10), scale=(0.48, 0.14, 0.16), bevel=0.006, bevel_segments=1,
        ),
    ])
    wo_barrels = [
        lib.create_geo(
            "SlotWingOut_Scatter_GunA", "cylinder", frame,
            location=(0.44, 0.36, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.056, depth=0.36, bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Scatter_GunB", "cylinder", frame,
            location=(0.44, 0.68, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.056, depth=0.36, bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Scatter_GlowA", "cylinder", sig,
            location=(0.64, 0.36, 0.04), rotation_deg=(0, 90, 0), vertices=8, radius=0.040, depth=0.04, bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingOut_Scatter_GlowB", "cylinder", sig,
            location=(0.64, 0.68, 0.04), rotation_deg=(0, 90, 0), vertices=8, radius=0.040, depth=0.04, bevel=0.0,
        ),
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [nose_static + nose_barrels, wi_static + wi_barrels, wo_static + wo_barrels],
        base_meshes=[],
        ao_samples=10,
        ao_radius=0.75,
    )

    rig = lib.create_rig(
        "ScatterModularRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Barrel_Nose": ((1.10, 0, 0.02), (1.10, 0.35, 0.02), "Root"),
            "Barrel_WingIn": ((0.56, 0.52, 0.04), (0.56, 0.85, 0.04), "Root"),
            "Barrel_WingOut": ((0.44, 0.52, 0.04), (0.44, 0.85, 0.04), "Root"),
        },
    )
    lib.parent_to_bone([*nose_static, *wi_static, *wo_static], rig, "Root")
    lib.parent_to_bone(nose_barrels, rig, "Barrel_Nose")
    lib.parent_to_bone(wi_barrels, rig, "Barrel_WingIn")
    lib.parent_to_bone(wo_barrels, rig, "Barrel_WingOut")

    lib.start_action(rig, "Idle")
    for f, rx in [(1, 0.0), (18, -0.02), (36, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(rx, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, rx in [(1, 0.0), (5, -0.22), (16, -0.06), (26, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(rx, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_scatter_cannon.glb")


# 3. Rail Sniper (Aether Longbow Forward-Swept Rail-Lance)
def build_rail_sniper() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_ice"]

    # --- SLOT NOSE: 2.5m Split Tuning-Fork Hyper-Velocity Rail-Lance ---
    nose_static: list[bpy.types.Object] = []
    nose_static.extend(_root_dock_collar("SlotNose_Rail", frame, white, is_nose=True))
    nose_static.extend([
        lib.build_beveled_armor_plate(
            "SlotNose_Rail_BreechDeck",
            [(-0.04, -0.22), (0.62, -0.26), (0.78, 0.0), (0.62, 0.26), (-0.04, 0.22)],
            z_bottom=-0.12, z_top=0.17, mat=navy, top_inset=0.80, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Rail_PlasmaCore", "cube", sig,
            location=(1.28, 0.0, 0.04), scale=(1.18, 0.032, 0.032), bevel=0.0,
        ),
        lib.build_beveled_armor_plate(
            "SlotNose_Rail_OpticScope",
            [(0.06, -0.06), (0.74, -0.04), (0.82, 0.0), (0.74, 0.04), (0.06, 0.06)],
            z_bottom=0.16, z_top=0.28, mat=white, top_inset=0.72, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Tier3_SpineFin", "cube", accent,
            location=(0.40, 0.0, 0.30), scale=(0.56, 0.04, 0.14), bevel=0.005, bevel_segments=1,
        ),
    ])

    nose_barrels: list[bpy.types.Object] = []
    for sign, s in ((1, "L"), (-1, "R")):
        nose_barrels.append(
            lib.build_beveled_armor_plate(
                f"SlotNose_Rail_Prong_{s}",
                _mirror_y_poly([(0.34, 0.065), (2.46, 0.032), (2.52, 0.092), (0.34, 0.18)], sign),
                z_bottom=-0.06, z_top=0.12, mat=white, top_inset=0.80, bevel_segments=1,
            )
        )
        nose_barrels.extend(
            lib.build_armor_greeble_strip(
                f"SlotNose_Rail_Coils_{s}", (0.68, 0.12 * sign, 0.04), (2.10, 0.08 * sign, 0.04),
                5, (0.08, 0.055, 0.14), frame, accent,
            )
        )
        nose_barrels.append(
            lib.create_geo(
                f"SlotNose_Tier2_Capacitor_{s}", "cylinder", navy,
                location=(0.52, 0.24 * sign, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.06, depth=0.62, bevel=0.005, bevel_segments=1,
            )
        )
    nose_barrels.extend(
        lib.build_precision_ring_assembly(
            "SlotNose_Tier2_CoilRing", (1.65, 0.0, 0.04), 0.18, 0.022, 16, frame, accent, sig, clamp_count=2, rot_deg=(0, 90, 0),
        )
    )

    # --- SLOT WING IN: Dramatic FORWARD-SWEPT High-Aspect Sniper Wing ---
    wi_static: list[bpy.types.Object] = []
    wi_static.extend(_root_dock_collar("SlotWingIn_Rail", frame, white, is_nose=False))
    wi_static.extend([
        lib.build_airfoil_wing(
            "SlotWingIn_Rail_ForwardWing",
            [
                (-0.02, 0.42, -0.44, 0.00, 0.15),
                (0.50,  0.82, -0.46, 0.02, 0.12),
                (1.04,  1.24, -0.58, 0.02, 0.095),
            ],
            mat=white, camber=0.04, bevel_segments=1,
        ),
        lib.build_airfoil_wing(
            "SlotWingIn_Rail_LeadEdge",
            [
                (0.02, 0.44, 0.14, 0.01, 0.14),
                (1.02, 1.24, 0.88, 0.02, 0.09),
            ],
            mat=navy, camber=0.03, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Tier3_AeroFin", "cube", accent,
            location=(0.44, 0.62, 0.12), rotation_deg=(0, 0, 36), scale=(0.68, 0.04, 0.12), bevel=0.004, bevel_segments=1,
        ),
    ])
    wi_flange, wi_cap = _wing_in_flange_and_cap("Rail", frame, navy, accent, sig, cap_style="forward")
    wi_static.extend([*wi_flange, *wi_cap])

    wi_barrels = [
        lib.create_geo(
            "SlotWingIn_Rail_LanceSpar", "cube", frame,
            location=(0.74, 0.88, 0.04), scale=(1.12, 0.09, 0.09), bevel=0.006, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Rail_BoreGlow", "cube", sig,
            location=(0.94, 0.88, 0.04), scale=(0.86, 0.035, 0.035), bevel=0.0,
        ),
        *lib.build_armor_greeble_strip(
            "SlotWingIn_Tier2_CoilBank", (0.36, 0.88, 0.06), (1.18, 0.88, 0.06), 4, (0.07, 0.13, 0.12), frame, accent,
        ),
    ]

    # --- SLOT WING OUT: Forward-Swept Razor Saber Wingtip (+1.38 span, tip +1.45 forward) ---
    wo_static: list[bpy.types.Object] = []
    wo_static.extend(_wing_out_root_collar("SlotWingOut_Rail", frame, accent))
    wo_static.extend([
        lib.build_airfoil_wing(
            "SlotWingOut_Rail_SaberTip",
            [
                (-0.02, 0.36, -0.34, 0.00, 0.095),
                (0.68,  0.88,  0.14, 0.06, 0.065),
                (1.36,  1.42,  0.76, 0.22, 0.032),
            ],
            mat=white, camber=0.03, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Rail_KnifeTrim", "cube", accent,
            location=(0.56, 0.74, 0.09), rotation_deg=(8, 0, 38), scale=(0.74, 0.07, 0.045), bevel=0.004, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier3_TipSpike", "cone", navy,
            location=(1.32, 1.38, 0.22), rotation_deg=(0, 90, 0), vertices=6, radius1=0.055, radius2=0.008, depth=0.46, bevel=0.0,
        ),
    ])
    wo_barrels = [
        lib.create_geo(
            "SlotWingOut_Rail_CoilGun", "cube", frame,
            location=(0.62, 0.62, 0.04), scale=(0.94, 0.075, 0.075), bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Rail_BeamStrip", "cube", sig,
            location=(0.76, 0.62, 0.04), scale=(0.74, 0.03, 0.03), bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingOut_Tier2_Ring", "cylinder", accent,
            location=(0.88, 0.62, 0.04), rotation_deg=(0, 90, 0), vertices=10, radius=0.08, depth=0.05, bevel=0.0,
        ),
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [nose_static + nose_barrels, wi_static + wi_barrels, wo_static + wo_barrels],
        base_meshes=[],
        ao_samples=10,
        ao_radius=0.75,
    )

    rig = lib.create_rig(
        "RailModularRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Barrel_Nose": ((0.85, 0, 0.04), (0.85, 0.35, 0.04), "Root"),
            "Barrel_WingIn": ((0.74, 0.88, 0.04), (0.74, 1.22, 0.04), "Root"),
            "Barrel_WingOut": ((0.62, 0.62, 0.04), (0.62, 0.96, 0.04), "Root"),
        },
    )
    lib.parent_to_bone([*nose_static, *wi_static, *wo_static], rig, "Root")
    lib.parent_to_bone(nose_barrels, rig, "Barrel_Nose")
    lib.parent_to_bone(wi_barrels, rig, "Barrel_WingIn")
    lib.parent_to_bone(wo_barrels, rig, "Barrel_WingOut")

    lib.start_action(rig, "Idle")
    for f, rx in [(1, 0.0), (20, 0.02), (40, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(rx, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, rx in [(1, 0.0), (5, -0.24), (16, -0.07), (28, 0.0)]:
        for bn in ("Barrel_Nose", "Barrel_WingIn", "Barrel_WingOut"):
            lib.key_bone(rig, bn, f, loc=(rx, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_rail_sniper.glb")


# 4. Homing Pod (VoidTech Hydra Stealth Wing & Missile Bays)
def build_homing_pod() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_violet"]
    tip_glow = pal["wpn_amber"]

    # --- SLOT NOSE: Faceted diamond stealth bomber prow + hinged warhead doors ---
    nose_static: list[bpy.types.Object] = []
    nose_static.extend(_root_dock_collar("SlotNose_Homing", frame, navy, is_nose=True))
    nose_static.extend([
        lib.build_beveled_armor_plate(
            "SlotNose_Homing_StealthHull",
            [(-0.04, -0.24), (0.68, -0.44), (1.42, -0.14), (1.66, 0.0), (1.42, 0.14), (0.68, 0.44), (-0.04, 0.24)],
            z_bottom=-0.14, z_top=0.16, mat=navy, top_inset=0.80, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Homing_TargetEye", "sphere", sig,
            location=(1.28, 0.0, 0.15), scale=(0.08, 0.08, 0.06), bevel=0.0,
        ),
        lib.build_beveled_armor_plate(
            "SlotNose_Tier2_StealthDeck",
            [(0.12, -0.16), (1.06, -0.10), (1.16, 0.0), (1.06, 0.10), (0.12, 0.16)],
            z_bottom=0.15, z_top=0.23, mat=white, top_inset=0.76, bevel_segments=1,
        ),
    ])
    for sign, s in ((1, "L"), (-1, "R")):
        for wi in range(2):
            nose_static.append(
                lib.create_geo(
                    f"SlotNose_Homing_Warhead_{s}_{wi}", "cone", tip_glow,
                    location=(0.94 + wi * 0.18, 0.24 * sign, 0.06), rotation_deg=(0, 75, 18 * sign),
                    vertices=8, radius1=0.046, radius2=0.008, depth=0.16, bevel=0.0,
                )
            )
        nose_static.append(
            lib.create_geo(
                f"SlotNose_Tier3_Fang_{s}", "cone", accent,
                location=(1.42, 0.24 * sign, 0.02), rotation_deg=(0, 90, -12 * sign),
                vertices=6, radius1=0.045, radius2=0.008, depth=0.34, bevel=0.0,
            )
        )

    nose_doors: dict[str, list[bpy.types.Object]] = {}
    for sign, dk in ((1, "Door_Nose_L"), (-1, "Door_Nose_R")):
        ya, yb = sorted((0.06 * sign, 0.40 * sign))
        shutter = lib.build_beveled_armor_plate(
            f"SlotNose_Homing_{dk}",
            [(0.48, ya), (1.18, ya), (1.12, yb), (0.44, yb)],
            z_bottom=0.14, z_top=0.22, mat=accent, top_inset=0.82, bevel_segments=1,
        )
        nose_doors[dk] = [shutter]

    # --- SLOT WING IN: Cranked-kite stealth wing + 6-cell conformal missile bay ---
    wi_static: list[bpy.types.Object] = []
    wi_static.extend(_root_dock_collar("SlotWingIn_Homing", frame, navy, is_nose=False))
    wi_static.extend([
        lib.build_airfoil_wing(
            "SlotWingIn_Homing_KiteWing",
            [
                (-0.02, 0.44, -0.78, 0.00, 0.16),
                (0.54,  0.32, -0.68, 0.02, 0.14),
                (1.04, -0.02, -0.64, 0.02, 0.10),
            ],
            mat=navy, camber=0.04, bevel_segments=1,
        ),
        *lib.build_vls_missile_pod(
            "SlotWingIn_Homing_Bay", (-0.10, 0.50, 0.11), rows=2, cols=3, cell_size=0.14,
            frame_mat=frame, cap_mat=accent, glow_mat=tip_glow,
        ),
    ])
    for r in range(2):
        for c in range(3):
            wi_static.append(
                lib.create_geo(
                    f"SlotWingIn_Homing_Tube_{r}_{c}", "cone", tip_glow,
                    location=(-0.18 + r * 0.16, 0.34 + c * 0.16, 0.17), vertices=8, radius1=0.042, radius2=0.008, depth=0.10, bevel=0.0,
                )
            )
    wi_static.extend([
        lib.create_geo(
            "SlotWingIn_Tier2_Sawtooth", "cube", white,
            location=(0.24, 0.56, 0.06), rotation_deg=(0, 0, -24), scale=(0.48, 0.14, 0.08), bevel=0.006, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Tier3_Prong", "cube", sig,
            location=(0.42, 0.78, 0.10), scale=(0.38, 0.05, 0.05), bevel=0.0,
        ),
    ])
    wi_flange, wi_cap = _wing_in_flange_and_cap("Homing", frame, white, accent, sig, cap_style="stealth")
    wi_static.extend([*wi_flange, *wi_cap])

    wi_door = [
        lib.build_beveled_armor_plate(
            "SlotWingIn_Homing_BayDoor",
            [(-0.28, 0.24), (0.14, 0.24), (0.12, 0.80), (-0.30, 0.80)],
            z_bottom=0.18, z_top=0.25, mat=white, top_inset=0.84, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Homing_DoorStripe", "cube", accent,
            location=(-0.08, 0.52, 0.26), scale=(0.28, 0.36, 0.025), bevel=0.0,
        ),
    ]

    # --- SLOT WING OUT: Hooked crescent void-reaper wingtip + mini seeker bay ---
    wo_static: list[bpy.types.Object] = []
    wo_static.extend(_wing_out_root_collar("SlotWingOut_Homing", frame, accent))
    wo_static.extend([
        lib.build_airfoil_wing(
            "SlotWingOut_Homing_Crescent",
            [
                (-0.02, 0.28, -0.44, 0.00, 0.10),
                (0.68,  0.14, -0.58, 0.05, 0.075),
                (1.30,  0.46, -0.18, 0.24, 0.032),
            ],
            mat=navy, camber=0.04, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Homing_ReaperEdge", "cube", accent,
            location=(0.14, 0.92, 0.13), rotation_deg=(12, 0, 22), scale=(0.48, 0.38, 0.045), bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Homing_MiniWarhead", "cone", tip_glow,
            location=(-0.04, 0.44, 0.14), vertices=8, radius1=0.045, radius2=0.008, depth=0.12, bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingOut_Tier2_StealthFence", "cube", white,
            location=(-0.18, 0.62, 0.12), rotation_deg=(0, 0, 12), scale=(0.42, 0.04, 0.10), bevel=0.004, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier3_SeekEye", "sphere", sig,
            location=(0.42, 1.24, 0.22), scale=(0.08, 0.08, 0.06), bevel=0.0,
        ),
    ])
    wo_door = [
        lib.build_beveled_armor_plate(
            "SlotWingOut_Homing_MiniDoor",
            [(-0.22, 0.28), (0.08, 0.28), (0.08, 0.60), (-0.22, 0.60)],
            z_bottom=0.15, z_top=0.22, mat=white, top_inset=0.82, bevel_segments=1,
        )
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [nose_static + nose_doors["Door_Nose_L"] + nose_doors["Door_Nose_R"], wi_static + wi_door, wo_static + wo_door],
        base_meshes=[],
        ao_samples=10,
        ao_radius=0.75,
    )

    rig = lib.create_rig(
        "HomingModularRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Door_Nose_L": ((0.82, 0.40, 0.18), (1.12, 0.40, 0.18), "Root"),
            "Door_Nose_R": ((0.82, -0.40, 0.18), (1.12, -0.40, 0.18), "Root"),
            "Door_WingIn": ((-0.08, 0.80, 0.22), (0.14, 0.80, 0.22), "Root"),
            "Door_WingOut": ((-0.08, 0.60, 0.18), (0.10, 0.60, 0.18), "Root"),
        },
    )
    lib.parent_to_bone([*nose_static, *wi_static, *wo_static], rig, "Root")
    for dk, dobjs in nose_doors.items():
        lib.parent_to_bone(dobjs, rig, dk)
    lib.parent_to_bone(wi_door, rig, "Door_WingIn")
    lib.parent_to_bone(wo_door, rig, "Door_WingOut")

    lib.start_action(rig, "Idle")
    for f, d in [(1, 4.0), (20, 12.0), (40, 4.0)]:
        lib.key_bone(rig, "Door_Nose_L", f, rot_deg=(0, d, 0))
        lib.key_bone(rig, "Door_Nose_R", f, rot_deg=(0, -d, 0))
        lib.key_bone(rig, "Door_WingIn", f, rot_deg=(0, d, 0))
        lib.key_bone(rig, "Door_WingOut", f, rot_deg=(0, d, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, d in [(1, 14.0), (8, 66.0), (20, 58.0), (30, 10.0)]:
        lib.key_bone(rig, "Door_Nose_L", f, rot_deg=(0, d, 0))
        lib.key_bone(rig, "Door_Nose_R", f, rot_deg=(0, -d, 0))
        lib.key_bone(rig, "Door_WingIn", f, rot_deg=(0, d, 0))
        lib.key_bone(rig, "Door_WingOut", f, rot_deg=(0, d, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_homing_pod.glb")


# 5. Thermal Sink (IronForge Glacier Cryo-Radiator Airframe)
def build_thermal_sink() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    ice, emerald = pal["wpn_ice"], pal["wpn_emerald"]

    # --- SLOT NOSE: Cryo-intake louver prow + articulated side heat vanes ---
    nose_static: list[bpy.types.Object] = []
    nose_static.extend(_root_dock_collar("SlotNose_Sink", frame, white, is_nose=True))
    nose_static.extend([
        lib.build_lofted_hull(
            "SlotNose_Sink_Body",
            [
                (-0.04, lib.jet_profile(0.24, 0.16, -0.13, deck_w=0.36)),
                (0.62,  lib.jet_profile(0.22, 0.14, -0.11, deck_w=0.40)),
                (1.24,  lib.jet_profile(0.14, 0.09, -0.07, deck_w=0.38)),
                (1.52,  lib.jet_profile(0.05, 0.04, -0.03, deck_w=0.30)),
            ],
            mat=navy, crease_indices={2, 7}, subsurf=1, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Sink_CryoPipe", "cylinder", ice,
            location=(0.68, 0.0, 0.17), rotation_deg=(0, 90, 0), vertices=10, radius=0.055, depth=0.92, bevel=0.0,
        ),
        *lib.build_louver_array("SlotNose_Sink_Grill", (0.14, 0.0, 0.22), (1.02, 0.0, 0.18), 6, 0.20, 0.032, 0.06, frame, emerald),
        lib.create_geo(
            "SlotNose_Tier2_CoolBand", "cube", accent,
            location=(0.56, 0.0, 0.19), scale=(0.24, 0.34, 0.06), bevel=0.005, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotNose_Tier3_CryoMast", "cube", ice,
            location=(0.26, 0.0, 0.26), scale=(0.42, 0.05, 0.08), bevel=0.0,
        ),
    ])
    nose_vanes: dict[str, list[bpy.types.Object]] = {}
    for sign, vk in ((1, "Vane_Nose_L"), (-1, "Vane_Nose_R")):
        nose_vanes[vk] = [
            lib.build_airfoil_wing(
                f"SlotNose_Sink_{vk}",
                _mirror_y_wing_stations([(0.20, 1.02, 0.22, 0.04, 0.055), (0.58, 0.72, 0.12, 0.14, 0.03)], sign),
                mat=white, camber=0.03, bevel_segments=1,
            ),
            lib.create_geo(
                f"SlotNose_Sink_{vk}_Frost", "cube", ice,
                location=(0.56, 0.34 * sign, 0.08), scale=(0.44, 0.04, 0.035), bevel=0.0,
            ),
        ]

    # --- SLOT WING IN: Sculpted Radiator Wing cradling 6 cryo louver vanes ---
    wi_static: list[bpy.types.Object] = []
    wi_static.extend(_root_dock_collar("SlotWingIn_Sink", frame, white, is_nose=False))
    wi_static.extend([
        lib.build_beveled_armor_plate(
            "SlotWingIn_Sink_FrameArmF",
            [(0.18, -0.02), (0.44, -0.02), (0.16, 1.04), (-0.08, 1.04)],
            z_bottom=-0.06, z_top=0.10, mat=navy, top_inset=0.84, bevel_segments=1,
        ),
        lib.build_beveled_armor_plate(
            "SlotWingIn_Sink_FrameArmR",
            [(-0.56, -0.02), (-0.30, -0.02), (-0.42, 1.04), (-0.64, 1.04)],
            z_bottom=-0.06, z_top=0.10, mat=navy, top_inset=0.84, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingIn_Sink_CryoPipe", "cylinder", emerald,
            location=(-0.18, 0.52, 0.03), rotation_deg=(90, 0, -14), vertices=10, radius=0.052, depth=0.92, bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingIn_Tier2_Manifold", "cylinder", ice,
            location=(0.04, 0.52, 0.08), rotation_deg=(90, 0, -14), vertices=8, radius=0.038, depth=0.88, bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingIn_Tier3_CoreGauge", "cylinder", accent,
            location=(-0.14, 0.42, 0.14), vertices=10, radius=0.11, depth=0.06, bevel=0.005, bevel_segments=1,
        ),
    ])
    wi_flange, wi_cap = _wing_in_flange_and_cap("Sink", frame, navy, accent, ice, cap_style="sleek")
    wi_static.extend([*wi_flange, *wi_cap])

    wi_vanes = [
        *lib.build_louver_array("SlotWingIn_Sink_Louvers", (-0.06, 0.14, 0.08), (-0.28, 0.90, 0.08), 5, 0.34, 0.04, 0.09, white, ice),
        lib.create_geo("SlotWingIn_Sink_TopVane", "cube", white, location=(-0.16, 0.52, 0.16), rotation_deg=(0, 0, -12), scale=(0.46, 0.72, 0.04), bevel=0.005, bevel_segments=1),
    ]

    # --- SLOT WING OUT: Split triple-blade cryo solar-radiator fan wingtip ---
    wo_static: list[bpy.types.Object] = []
    wo_static.extend(_wing_out_root_collar("SlotWingOut_Sink", frame, accent))
    wo_static.extend([
        lib.create_geo(
            "SlotWingOut_Sink_Spine", "cube", navy,
            location=(-0.08, 0.46, 0.02), rotation_deg=(0, 0, -14), scale=(0.42, 0.92, 0.09), bevel=0.008, bevel_segments=1,
        ),
        lib.create_geo(
            "SlotWingOut_Tier2_CoolPipe", "cylinder", emerald,
            location=(-0.12, 0.52, 0.06), rotation_deg=(90, 0, -14), vertices=10, radius=0.042, depth=0.88, bevel=0.0,
        ),
        lib.create_geo(
            "SlotWingOut_Tier3_TipNode", "ico", ice,
            location=(-0.22, 0.98, 0.10), scale=(0.11, 0.11, 0.08), subdivisions=1, bevel=0.0,
        ),
    ])
    wo_vanes = [
        lib.build_airfoil_wing(
            f"SlotWingOut_Sink_Blade_{bi}",
            [(0.06, 0.24 - bi * 0.16, -0.18 - bi * 0.16, 0.03 + bi * 0.05, 0.065),
             (1.32, -0.18 - bi * 0.18, -0.52 - bi * 0.16, 0.16 + bi * 0.10, 0.03)],
            mat=white if bi != 1 else accent, camber=0.03, bevel_segments=1,
        )
        for bi in range(3)
    ]
    wo_vanes.append(
        lib.create_geo("SlotWingOut_Sink_BladeGlow", "cube", ice, location=(-0.22, 1.18, 0.22), rotation_deg=(-12, 0, -18), scale=(0.44, 0.04, 0.04), bevel=0.0)
    )

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(
        all_meshes,
        [
            nose_static + nose_vanes["Vane_Nose_L"] + nose_vanes["Vane_Nose_R"],
            wi_static + wi_vanes,
            wo_static + wo_vanes,
        ],
        base_meshes=[],
        ao_samples=10,
        ao_radius=0.75,
    )

    rig = lib.create_rig(
        "SinkModularRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Vane_Nose_L": ((0.56, 0.22, 0.04), (0.86, 0.22, 0.04), "Root"),
            "Vane_Nose_R": ((0.56, -0.22, 0.04), (0.86, -0.22, 0.04), "Root"),
            "Vane_WingIn": ((-0.16, 0.52, 0.12), (0.20, 0.52, 0.12), "Root"),
            "Vane_WingOut": ((-0.12, 0.52, 0.04), (0.20, 0.52, 0.04), "Root"),
        },
    )
    lib.parent_to_bone([*nose_static, *wi_static, *wo_static], rig, "Root")
    for vk, vobjs in nose_vanes.items():
        lib.parent_to_bone(vobjs, rig, vk)
    lib.parent_to_bone(wi_vanes, rig, "Vane_WingIn")
    lib.parent_to_bone(wo_vanes, rig, "Vane_WingOut")

    lib.start_action(rig, "Idle")
    for f, t in [(1, 0.0), (22, 6.0), (44, 0.0)]:
        lib.key_bone(rig, "Vane_Nose_L", f, rot_deg=(t, 0, 0))
        lib.key_bone(rig, "Vane_Nose_R", f, rot_deg=(-t, 0, 0))
        lib.key_bone(rig, "Vane_WingIn", f, rot_deg=(t, 0, 0))
        lib.key_bone(rig, "Vane_WingOut", f, rot_deg=(t * 1.5, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, t in [(1, 6.0), (8, 40.0), (24, 34.0), (36, 6.0)]:
        lib.key_bone(rig, "Vane_Nose_L", f, rot_deg=(t, 0, 0))
        lib.key_bone(rig, "Vane_Nose_R", f, rot_deg=(-t, 0, 0))
        lib.key_bone(rig, "Vane_WingIn", f, rot_deg=(t, 0, 0))
        lib.key_bone(rig, "Vane_WingOut", f, rot_deg=(t, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_thermal_sink.glb")


# 6. Skill Salvo (Archangel Dorsal VLS Spine & Twin V-Tails)
def build_skill_salvo() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_amber"]

    body_parts: list[bpy.types.Object] = []
    body_parts.append(
        lib.build_beveled_armor_plate(
            "Salvo_SpineDeck",
            [(-0.76, -0.48), (0.60, -0.34), (0.74, 0.0), (0.60, 0.34), (-0.76, 0.48)],
            z_bottom=-0.06, z_top=0.22, mat=navy, top_inset=0.86, bevel_segments=1,
        )
    )
    body_parts.extend(lib.build_sensor_mast_array("Salvo_RadarMast", (-0.54, 0.0, 0.22), 0.56, frame, white, sig))

    doors_l: list[bpy.types.Object] = []
    doors_r: list[bpy.types.Object] = []
    for sign, sname in ((1, "L"), (-1, "R")):
        yc = 0.46 * sign
        casing = lib.build_beveled_armor_plate(
            f"Salvo_Pod_{sname}",
            [(-0.66, yc - 0.26), (0.50, yc - 0.22), (0.56, yc), (0.50, yc + 0.22), (-0.66, yc + 0.26)],
            z_bottom=0.04, z_top=0.30, mat=white, top_inset=0.84, bevel_segments=1,
        )
        vls_cells = lib.build_vls_missile_pod(
            f"Salvo_VLS_{sname}", (0.0, yc, 0.30), rows=3, cols=2, cell_size=0.14,
            frame_mat=frame, cap_mat=accent, glow_mat=sig,
        )
        warheads = [
            lib.create_geo(
                f"Salvo_Warhead_{sname}_{r}_{c}", "cone", sig,
                location=((r - 1.0) * 0.16, yc + (c - 0.5) * 0.16, 0.35),
                vertices=8, radius1=0.046, radius2=0.008, depth=0.11, bevel=0.0,
            )
            for r in range(3) for c in range(2)
        ]
        # Dramatic Canted V-Tail Superstructure replacing StockSpine tail
        vtail = lib.build_curved_blade(
            f"Salvo_VTail_{sname}",
            [(-0.22, 0.46 * sign, 0.14), (-0.64, 0.88 * sign, 0.56), (-1.04, 1.12 * sign, 0.82)] if sign > 0 else
            [(-0.22, -0.46, 0.14), (-0.64, -0.88, 0.56), (-1.04, -1.12, 0.82)],
            widths=[0.74, 0.46, 0.18], thicknesses=[0.08, 0.06, 0.03],
            mat=navy, up_hint=(0.0, -sign * 0.4, 0.9),
        )
        vtail_tip = lib.create_geo(
            f"Salvo_VTailTip_{sname}", "cube", accent,
            location=(-0.92, 1.04 * sign, 0.72), rotation_deg=(-22 * sign, 18, -14 * sign),
            scale=(0.34, 0.05, 0.18), bevel=0.005, bevel_segments=1,
        )
        body_parts.extend([casing, *vls_cells, *warheads, vtail, vtail_tip])

        door = lib.build_beveled_armor_plate(
            f"Salvo_Door_{sname}",
            [(-0.44, yc - 0.19), (0.42, yc - 0.17), (0.42, yc + 0.17), (-0.44, yc + 0.19)],
            z_bottom=0.36, z_top=0.44, mat=navy, top_inset=0.82, bevel_segments=1,
        )
        rib = lib.create_geo(
            f"Salvo_Tier2_DoorRib_{sname}", "cube", accent,
            location=(0.0, yc, 0.45), scale=(0.64, 0.14, 0.04), bevel=0.005, bevel_segments=1,
        )
        if sign > 0:
            doors_l.extend([door, rib])
        else:
            doors_r.extend([door, rib])

    body_parts.append(
        lib.create_geo("Salvo_Tier3_SpineRail", "cube", sig, location=(0.24, 0.0, 0.25), scale=(0.54, 0.08, 0.06), bevel=0.0)
    )

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(all_meshes, [body_parts, doors_l, doors_r], base_meshes=[], ao_samples=10, ao_radius=0.75)

    rig = lib.create_rig(
        "SkillSalvoRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Door_L": ((0.0, 0.62, 0.38), (0.45, 0.62, 0.38), "Root"),
            "Door_R": ((0.0, -0.62, 0.38), (0.45, -0.62, 0.38), "Root"),
        },
    )
    lib.parent_to_bone(body_parts, rig, "Root")
    lib.parent_to_bone(doors_l, rig, "Door_L")
    lib.parent_to_bone(doors_r, rig, "Door_R")

    lib.start_action(rig, "Idle")
    for f, tilt in [(1, 2.0), (22, 10.0), (44, 2.0)]:
        lib.key_bone(rig, "Door_L", f, rot_deg=(0, tilt, 0))
        lib.key_bone(rig, "Door_R", f, rot_deg=(0, -tilt, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, tilt in [(1, 10.0), (8, 66.0), (26, 58.0), (38, 6.0)]:
        lib.key_bone(rig, "Door_L", f, rot_deg=(0, tilt, 0))
        lib.key_bone(rig, "Door_R", f, rot_deg=(0, -tilt, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_skill_salvo.glb")


# 7. Skill Beam (Aegis Over-Spine Rail-Cannon Superstructure)
def build_skill_beam() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig = pal["wpn_violet"]

    body_parts: list[bpy.types.Object] = []
    body_parts.append(
        lib.build_lofted_hull(
            "Beam_SpinalCradle",
            [
                (-0.92, lib.jet_profile(0.32, 0.24, -0.04, deck_w=0.52)),
                (-0.30, lib.jet_profile(0.38, 0.30, -0.05, deck_w=0.58)),
                (0.38,  lib.jet_profile(0.30, 0.26, -0.04, deck_w=0.52)),
                (0.84,  lib.jet_profile(0.20, 0.18, -0.02, deck_w=0.44)),
            ],
            mat=navy, crease_indices={2, 7}, subsurf=1, location=(0.0, 0.0, 0.12), bevel_segments=1,
        )
    )
    for sign, s in ((1, "L"), (-1, "R")):
        # Swept twin-boom cooling wings replacing StockSpine tail
        body_parts.append(
            lib.build_airfoil_wing(
                f"Beam_CoolingWing_{s}",
                [(0.28 * sign, 0.34, -0.82, 0.16, 0.065), (1.06 * sign, -0.22, -1.04, 0.42, 0.03)] if sign > 0 else
                [(-0.28, 0.34, -0.82, 0.16, 0.065), (-1.06, -0.22, -1.04, 0.42, 0.03)],
                mat=white, camber=0.04, bevel_segments=1,
            )
        )
        body_parts.append(
            lib.create_geo(
                f"Beam_Tier2_WingEdge_{s}", "cube", accent,
                location=(-0.38, 0.72 * sign, 0.34), rotation_deg=(-20 * sign, 0, -28 * sign),
                scale=(0.56, 0.08, 0.045), bevel=0.004, bevel_segments=1,
            )
        )
        body_parts.extend(
            lib.build_louver_array(
                f"Beam_Heatsink_{s}", (-0.64, 0.26 * sign, 0.28), (0.22, 0.24 * sign, 0.28),
                count=5, fin_w=0.14, fin_thick=0.032, fin_h=0.12, frame_mat=frame, glow_mat=sig,
            )
        )

    barrel_main: list[bpy.types.Object] = [
        lib.create_geo(
            "Beam_Main_SpinalLance", "cube", white,
            location=(0.52, 0.0, 0.36), scale=(1.78, 0.18, 0.16), bevel=0.012, bevel_segments=1,
        ),
        lib.create_geo(
            "Beam_Main_PlasmaCore", "cylinder", sig,
            location=(0.76, 0.0, 0.36), rotation_deg=(0, 90, 0), vertices=12, radius=0.072, depth=1.62, bevel=0.0,
        ),
        *lib.build_precision_ring_assembly("Beam_Main_Coil1", (0.22, 0.0, 0.36), 0.26, 0.032, 18, frame, accent, sig, clamp_count=4, rot_deg=(0, 90, 0)),
        *lib.build_precision_ring_assembly("Beam_Main_Coil2", (0.86, 0.0, 0.36), 0.22, 0.028, 18, frame, accent, sig, clamp_count=4, rot_deg=(0, 90, 0)),
        lib.create_geo("Beam_Tier3_MuzzleHorn", "cube", accent, location=(1.46, 0.0, 0.44), scale=(0.48, 0.05, 0.10), bevel=0.004, bevel_segments=1),
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(all_meshes, [body_parts, barrel_main], base_meshes=[], ao_samples=10, ao_radius=0.75)

    rig = lib.create_rig(
        "SkillBeamRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Barrel_Main": ((0.22, 0.0, 0.36), (0.22, 0.35, 0.36), "Root"),
        },
    )
    lib.parent_to_bone(body_parts, rig, "Root")
    lib.parent_to_bone(barrel_main, rig, "Barrel_Main")

    lib.start_action(rig, "Idle")
    for f, k in [(1, 0.0), (22, -0.03), (44, 0.0)]:
        lib.key_bone(rig, "Barrel_Main", f, loc=(k, 0, 0))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, k in [(1, 0.0), (8, -0.28), (24, -0.14), (36, 0.0)]:
        lib.key_bone(rig, "Barrel_Main", f, loc=(k, 0, 0))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_skill_beam.glb")


# 8. Skill EMP (Tempest Halo AWACS Twin-Ring Dish)
def build_skill_emp() -> None:
    lib.reset_scene()
    pal = lib.make_modular_ship_palette()
    white, navy, frame, accent = pal["primary"], pal["secondary"], pal["frame"], pal["accent"]
    sig, ice = pal["wpn_cyan"], pal["wpn_ice"]

    body_parts: list[bpy.types.Object] = []
    body_parts.append(
        lib.build_beveled_armor_plate(
            "Emp_PedestalDeck",
            [(-0.66, -0.44), (0.52, -0.34), (0.62, 0.0), (0.52, 0.34), (-0.66, 0.44)],
            z_bottom=-0.04, z_top=0.14, mat=navy, top_inset=0.86, bevel_segments=1,
        )
    )
    body_parts.extend(lib.build_louver_array("Emp_BaseCooling", (-0.48, 0.0, 0.14), (0.30, 0.0, 0.14), 5, 0.28, 0.034, 0.05, frame, sig))
    for sign, s in ((1, "L"), (-1, "R")):
        body_parts.append(
            lib.build_curved_blade(
                f"Emp_AftStrut_{s}",
                [(-0.34, 0.36 * sign, 0.08), (-0.28, 0.64 * sign, 0.32), (-0.18, 0.56 * sign, 0.48)],
                widths=[0.46, 0.28, 0.16], thicknesses=[0.09, 0.07, 0.05],
                mat=white, up_hint=(0.0, sign * 0.3, 0.9),
            )
        )
        body_parts.extend(
            lib.build_hydraulic_strut(f"Emp_Damper_{s}", (-0.18, 0.34 * sign, 0.14), (-0.18, 0.54 * sign, 0.44), 0.026, frame, white)
        )
    # Forward tripod pylon bracing the large 1.02m AWACS ring
    body_parts.append(
        lib.create_geo("Emp_ForePylon", "cube", accent, location=(0.24, 0.0, 0.28), rotation_deg=(0, -18, 0), scale=(0.24, 0.16, 0.34), bevel=0.008, bevel_segments=1)
    )

    ring_outer = lib.build_precision_ring_assembly(
        "Emp_OuterHalo", (-0.12, 0.0, 0.48), 0.98, 0.062, 24, frame, accent, sig, clamp_count=6
    )
    for i in range(4):
        ang = math.radians(i * 90.0 + 45.0)
        vx, vy = -0.12 + math.cos(ang) * 1.00, math.sin(ang) * 1.00
        ring_outer.append(
            lib.create_geo(
                f"Emp_Tier2_RadomeVane_{i}", "cube", white,
                location=(vx, vy, 0.49), rotation_deg=(0, 0, math.degrees(ang)),
                scale=(0.26, 0.12, 0.09), bevel=0.008, bevel_segments=1,
            )
        )
        ring_outer.append(
            lib.create_geo(
                f"Emp_Tier3_ArcSpire_{i}", "cone", ice,
                location=(vx + math.cos(ang) * 0.16, vy + math.sin(ang) * 0.16, 0.52),
                rotation_deg=(0, -68, math.degrees(ang)), vertices=6, radius1=0.052, radius2=0.01, depth=0.18, bevel=0.0,
            )
        )

    ring_inner = lib.build_precision_ring_assembly(
        "Emp_InnerStator", (-0.12, 0.0, 0.52), 0.60, 0.044, 20, white, navy, ice, clamp_count=4, rot_deg=(16, 0, 0)
    )
    plasma_core = [
        lib.create_geo("Emp_TeslaCore", "ico", sig, location=(-0.12, 0.0, 0.52), scale=(0.24, 0.24, 0.20), subdivisions=2, bevel=0.0),
    ]

    all_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    lib.bake_modular_vertex_ao(all_meshes, [body_parts, ring_outer, ring_inner, plasma_core], base_meshes=[], ao_samples=10, ao_radius=0.75)

    rig = lib.create_rig(
        "SkillEmpRig",
        {
            "Root": ((0, 0, 0), (0, 0.35, 0), None),
            "Ring_Outer": ((-0.12, 0, 0.48), (-0.12, 0.35, 0.48), "Root"),
            "Ring_Inner": ((-0.12, 0, 0.52), (-0.12, 0.35, 0.52), "Root"),
            "Core": ((-0.12, 0, 0.52), (-0.12, 0.35, 0.52), "Root"),
        },
    )
    lib.parent_to_bone(body_parts, rig, "Root")
    lib.parent_to_bone(ring_outer, rig, "Ring_Outer")
    lib.parent_to_bone(ring_inner, rig, "Ring_Inner")
    lib.parent_to_bone(plasma_core, rig, "Core")

    lib.start_action(rig, "Idle")
    for f, zrot, sc in [(1, 0.0, 1.0), (24, 180.0, 1.08), (48, 360.0, 1.0)]:
        lib.key_bone(rig, "Ring_Outer", f, rot_deg=(0, 0, zrot * 0.5))
        lib.key_bone(rig, "Ring_Inner", f, rot_deg=(16.0, 0, -zrot))
        lib.key_bone(rig, "Core", f, scale=(sc, sc, sc))
    lib.finalize_action_to_nla(rig, "Idle")

    lib.start_action(rig, "Attack")
    for f, zrot, pz, sc in [(1, 0.0, 0.0, 1.0), (10, 180.0, 0.16, 1.40), (24, 360.0, 0.11, 1.24), (36, 540.0, 0.0, 1.0)]:
        lib.key_bone(rig, "Ring_Outer", f, loc=(0, 0, pz * 0.6), rot_deg=(0, 0, zrot))
        lib.key_bone(rig, "Ring_Inner", f, loc=(0, 0, pz), rot_deg=(28.0, 0, -zrot * 1.5))
        lib.key_bone(rig, "Core", f, loc=(0, 0, pz), scale=(sc, sc, sc))
    lib.finalize_action_to_nla(rig, "Attack")

    lib.export_glb("wpn_skill_emp.glb")


# Studio Modular Assembly Showcase Renderer (--showcase <out.png>)
_SHOWCASE_LIVERIES: dict[str, dict[str, tuple[float, float, float, float]]] = {
    "NOVACORP": {
        "ShipHull_Primary": (0.88, 0.92, 0.97, 1.0),
        "ShipHull_Secondary": (0.09, 0.14, 0.22, 1.0),
        "ShipHull_Accent": (0.98, 0.44, 0.06, 1.0),
        "ShipHull_Frame": (0.16, 0.19, 0.25, 1.0),
        "ShipHull_Glow": (0.22, 0.91, 1.00, 1.0),
    },
    "IRONFORGE": {
        "ShipHull_Primary": (0.28, 0.31, 0.36, 1.0),
        "ShipHull_Secondary": (0.14, 0.16, 0.20, 1.0),
        "ShipHull_Accent": (0.96, 0.56, 0.10, 1.0),
        "ShipHull_Frame": (0.10, 0.11, 0.14, 1.0),
        "ShipHull_Glow": (1.00, 0.58, 0.14, 1.0),
    },
    "AETHER": {
        "ShipHull_Primary": (0.93, 0.94, 0.90, 1.0),
        "ShipHull_Secondary": (0.12, 0.24, 0.48, 1.0),
        "ShipHull_Accent": (0.90, 0.70, 0.24, 1.0),
        "ShipHull_Frame": (0.20, 0.25, 0.34, 1.0),
        "ShipHull_Glow": (0.58, 0.96, 1.00, 1.0),
    },
    "VOIDTECH": {
        "ShipHull_Primary": (0.12, 0.10, 0.20, 1.0),
        "ShipHull_Secondary": (0.05, 0.04, 0.10, 1.0),
        "ShipHull_Accent": (0.92, 0.22, 0.48, 1.0),
        "ShipHull_Frame": (0.15, 0.13, 0.24, 1.0),
        "ShipHull_Glow": (0.78, 0.36, 1.00, 1.0),
    },
}


def _apply_blender_livery(objs: list[bpy.types.Object], faction: str) -> None:
    """Repaints imported glTF `ShipHull_*` material copies cleanly in Blender showcase scene."""
    pal = _SHOWCASE_LIVERIES.get(faction, _SHOWCASE_LIVERIES["NOVACORP"])
    cache: dict[int, bpy.types.Material] = {}
    for o in objs:
        if o.type != "MESH" or not o.data or not o.data.materials:
            continue
        for idx, mat in enumerate(list(o.data.materials)):
            if not mat:
                continue
            mat_base = mat.name.split(".")[0]
            if mat_base not in pal:
                continue
            cloned = cache.get(id(mat))
            if cloned is None:
                cloned = mat.copy()
                cache[id(mat)] = cloned
                sr, sg, sb, sa = pal[mat_base]
                # Convert sRGB-style UI palette values to linear PBR albedo for Blender AgX
                col = (sr ** 2.2, sg ** 2.2, sb ** 2.2, sa)
                if cloned.use_nodes and cloned.node_tree:
                    for node in cloned.node_tree.nodes:
                        if node.type == "BSDF_PRINCIPLED":
                            if not node.inputs["Base Color"].is_linked:
                                node.inputs["Base Color"].default_value = col
                            if mat_base == "ShipHull_Glow" and "Emission Color" in node.inputs:
                                node.inputs["Emission Color"].default_value = col
                            if faction == "AETHER" and mat_base == "ShipHull_Accent":
                                node.inputs["Metallic"].default_value = 0.88
                                node.inputs["Roughness"].default_value = 0.18
                            elif faction == "IRONFORGE" and mat_base == "ShipHull_Primary":
                                node.inputs["Metallic"].default_value = 0.62
                                node.inputs["Roughness"].default_value = 0.30
                        elif node.type in ("MIX", "MIX_RGB"):
                            for inp in node.inputs:
                                if inp.type == "RGBA" and not inp.is_linked:
                                    inp.default_value = col
                        elif node.type == "RGB":
                            node.outputs[0].default_value = col
            o.data.materials[idx] = cloned


def _setup_v14_showcase_studio(res_x: int, res_y: int, ortho_scale: float) -> bpy.types.Scene:
    import mathutils  # noqa: PLC0415

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = eng
            break
        except Exception:
            continue
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
    elif hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 24

    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = (
        "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    )
    scene.view_settings.exposure = 0.30

    world = bpy.data.worlds.new("V14ShowroomWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.022, 0.032, 0.052, 1.0)
        bg.inputs[1].default_value = 1.1

    cam_data = bpy.data.cameras.new("V14Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam_obj = bpy.data.objects.new("V14Cam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_loc = (0.0, -9.0, 14.5)
    cam_obj.location = cam_loc
    cam_obj.rotation_euler = (mathutils.Vector((0.0, 0.0, 0.0)) - mathutils.Vector(cam_loc)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    for name, rot_deg, energy, col in [
        ("Key", (32.0, -24.0, 38.0), 3.6, (1.0, 0.97, 0.94)),
        ("Fill", (-36.0, 28.0, -108.0), 1.4, (0.65, 0.84, 1.0)),
        ("Rim", (56.0, 16.0, 148.0), 2.3, (0.80, 0.92, 1.0)),
    ]:
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = energy
        ld.color = col
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    return scene


def _import_and_freeze(
    glb_path: Path, parent_root: bpy.types.Object, clip: str = "Idle", frame: int = 1
) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o not in before]
    for o in imported:
        if o.parent is None:
            o.parent = parent_root
        ad = o.animation_data
        if ad and ad.nla_tracks:
            matched = None
            for tr in ad.nla_tracks:
                act_name = tr.strips[0].action.name if tr.strips and tr.strips[0].action else ""
                if tr.name.split(".")[0] == clip or act_name.split(".")[0] == clip or act_name.startswith(clip + "_"):
                    matched = tr
                tr.mute = True
            if matched:
                matched.mute = False
                if matched.strips and matched.strips[0].action:
                    ad.action = matched.strips[0].action
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    for o in imported:
        if o.animation_data:
            loc, rm, re, rq, sc = o.location.copy(), o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy(), o.scale.copy()
            o.animation_data_clear()
            o.location, o.rotation_mode, o.rotation_euler, o.rotation_quaternion, o.scale = loc, rm, re, rq, sc
    return imported


def _render_modular_ships_sheet(out_path: Path) -> None:
    """Renders 6 complete assembled ships proving zero bulkhead seams, structural swaps & faction liveries."""
    scene = _setup_v14_showcase_studio(2400, 1600, ortho_scale=22.5)
    configs = [
        {
            "pos": (-7.2, 4.2, 0.0), "faction": "NOVACORP", "clip": "Idle", "frame": 1,
            "armor": 0, "engine": 0, "shield": False, "cryo": False, "sensor": False,
            "slots": {},
        },
        {
            "pos": (0.0, 4.2, 0.0), "faction": "IRONFORGE", "clip": "Attack", "frame": 6,
            "armor": 1, "engine": 1, "shield": False, "cryo": False, "sensor": False,
            "slots": {
                "nose": ("wpn_scatter_cannon.glb", 2),
                "wing_l1": ("wpn_scatter_cannon.glb", 2), "wing_r1": ("wpn_scatter_cannon.glb", 2),
                "wing_l2": ("wpn_scatter_cannon.glb", 2), "wing_r2": ("wpn_scatter_cannon.glb", 2),
                "skill_1": ("wpn_skill_salvo.glb", 2),
            },
        },
        {
            "pos": (7.2, 4.2, 0.0), "faction": "AETHER", "clip": "Idle", "frame": 1,
            "armor": 1, "engine": 2, "shield": True, "cryo": False, "sensor": True,
            "slots": {
                "nose": ("wpn_rail_sniper.glb", 3),
                "wing_l1": ("wpn_rail_sniper.glb", 3), "wing_r1": ("wpn_rail_sniper.glb", 3),
                "wing_l2": ("wpn_rail_sniper.glb", 3), "wing_r2": ("wpn_rail_sniper.glb", 3),
                "skill_1": ("wpn_skill_beam.glb", 3),
            },
        },
        {
            "pos": (-7.2, -4.2, 0.0), "faction": "VOIDTECH", "clip": "Attack", "frame": 8,
            "armor": 2, "engine": 2, "shield": True, "cryo": False, "sensor": True,
            "slots": {
                "nose": ("wpn_homing_pod.glb", 2),
                "wing_l1": ("wpn_homing_pod.glb", 2), "wing_r1": ("wpn_homing_pod.glb", 2),
                "wing_l2": ("wpn_homing_pod.glb", 2), "wing_r2": ("wpn_homing_pod.glb", 2),
                "skill_1": ("wpn_skill_emp.glb", 2),
            },
        },
        {
            "pos": (0.0, -4.2, 0.0), "faction": "NOVACORP", "clip": "Attack", "frame": 8,
            "armor": 1, "engine": 1, "shield": True, "cryo": False, "sensor": False,
            "slots": {
                "nose": ("wpn_rail_sniper.glb", 2),
                "wing_l1": ("wpn_scatter_cannon.glb", 2), "wing_l2": ("wpn_thermal_sink.glb", 2),
                "wing_r1": ("wpn_homing_pod.glb", 2), "wing_r2": ("wpn_pulse_blaster.glb", 2),
                "skill_1": ("wpn_skill_salvo.glb", 1),
            },
        },
        {
            "pos": (7.2, -4.2, 0.0), "faction": "IRONFORGE", "clip": "Attack", "frame": 8,
            "armor": 2, "engine": 2, "shield": True, "cryo": True, "sensor": True,
            "slots": {
                "nose": ("wpn_pulse_blaster.glb", 3),
                "wing_l1": ("wpn_thermal_sink.glb", 3), "wing_r1": ("wpn_thermal_sink.glb", 3),
                "wing_l2": ("wpn_thermal_sink.glb", 3), "wing_r2": ("wpn_thermal_sink.glb", 3),
                "skill_1": ("wpn_skill_emp.glb", 3),
            },
        },
    ]

    # Exact Blender-space bulkheads matching Three.js SHIP_GRID_SLOTS
    slot_bulkheads = {
        "nose":    ((0.88,  0.00, 0.00), "nose",    1.0),
        "wing_l1": ((-0.18, 0.52, 0.00), "wing_in", 1.0),
        "wing_r1": ((-0.18, -0.52, 0.00), "wing_in", -1.0),
        "wing_l2": ((-0.42, 1.56, 0.02), "wing_out", 1.0),
        "wing_r2": ((-0.42, -1.56, 0.02), "wing_out", -1.0),
        "skill_1": ((-0.78, 0.00, 0.26), "any",     1.0),
    }

    for idx, cfg in enumerate(configs):
        ship_root = bpy.data.objects.new(f"ShowcaseShip_{idx}", None)
        scene.collection.objects.link(ship_root)
        slots = cfg["slots"]

        hull_objs = _import_and_freeze(lib.OUT_DIR / "player_vanguard.glb", ship_root, clip="Idle", frame=1)
        _apply_blender_livery(hull_objs, cfg["faction"])

        has_nose = "nose" in slots
        has_l1, has_r1 = "wing_l1" in slots, "wing_r1" in slots
        has_l2, has_r2 = "wing_l2" in slots, "wing_r2" in slots
        has_sk = "skill_1" in slots
        for o in hull_objs:
            if o.type != "MESH":
                continue
            nm = o.name.split(".")[0]
            vis = True
            if "StockHullShell_" in nm:
                vis = cfg["armor"] == 0
            elif "StockNose_" in nm:
                vis = not has_nose
            elif "StockWingIn_L_" in nm:
                vis = not has_l1
            elif "StockWingIn_R_" in nm:
                vis = not has_r1
            elif "StockWingOut_L_" in nm:
                vis = not has_l1 and not has_l2
            elif "StockWingOut_R_" in nm:
                vis = not has_r1 and not has_r2
            elif "StockSpine_" in nm:
                vis = not has_sk
            elif "StockEngine_" in nm:
                vis = cfg["engine"] == 0
            elif "CoreArmor_T1_" in nm:
                vis = cfg["armor"] >= 1
            elif "CoreArmor_T2_" in nm:
                vis = cfg["armor"] >= 2
            elif "CoreShield_" in nm:
                vis = cfg["shield"]
            elif "CoreEngine_T1_" in nm:
                vis = cfg["engine"] == 1
            elif "CoreEngine_T2_" in nm:
                vis = cfg["engine"] >= 2
            elif "CoreCryo_" in nm:
                vis = cfg["cryo"]
            elif "CoreSensor_" in nm:
                vis = cfg["sensor"]
            o.hide_viewport = not vis
            o.hide_render = not vis

        for sid, (glb_name, tier) in slots.items():
            loc, sform, sy_sign = slot_bulkheads[sid]
            has_outer = (sid == "wing_l1" and has_l2) or (sid == "wing_r1" and has_r2)
            m_holder = bpy.data.objects.new(f"Mount_{idx}_{sid}", None)
            scene.collection.objects.link(m_holder)
            m_holder.parent = ship_root
            m_holder.location = loc
            m_holder.scale = (1.0, sy_sign, 1.0)
            w_objs = _import_and_freeze(lib.OUT_DIR / glb_name, m_holder, clip=cfg["clip"], frame=cfg["frame"])
            _apply_blender_livery(w_objs, cfg["faction"])

            for o in w_objs:
                if o.type != "MESH":
                    continue
                nm = o.name.split(".")[0]
                is_nose = "SlotNose_" in nm
                is_wi = "SlotWingIn_" in nm
                is_wo = "SlotWingOut_" in nm
                slot_ok = (sform == "nose" and is_nose) or (sform == "wing_in" and is_wi) or (sform == "wing_out" and is_wo) or (sform == "any" and not (is_nose or is_wi or is_wo))
                cap_ok = not ("OuterCap_" in nm and has_outer)
                tier_ok = (not ("Tier2_" in nm and tier < 2)) and (not ("Tier3_" in nm and tier < 3))
                vis = slot_ok and cap_ok and tier_ok
                o.hide_viewport = not vis
                o.hide_render = not vis

        ship_root.location = cfg["pos"]
        ship_root.rotation_euler = (0.0, 0.0, math.radians(-30.0))

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def _render_weapon_forms_sheet(out_path: Path) -> None:
    """Renders 5 primary weapons x (SlotNose, SlotWingIn+OuterCap, SlotWingOut) + 3 skill superstructures."""
    import mathutils  # noqa: PLC0415

    scene = _setup_v14_showcase_studio(2000, 2200, ortho_scale=18.0)
    primaries = [
        ("wpn_pulse_blaster.glb", "Attack"),
        ("wpn_scatter_cannon.glb", "Attack"),
        ("wpn_rail_sniper.glb", "Attack"),
        ("wpn_homing_pod.glb", "Attack"),
        ("wpn_thermal_sink.glb", "Attack"),
    ]
    row_ys = [6.2, 3.7, 1.2, -1.3, -3.8, -6.5]
    col_xs = [-4.2, 0.0, 4.2]

    for r, (glb_name, clip) in enumerate(primaries):
        for c, form in enumerate(("nose", "wing_in", "wing_out")):
            holder = bpy.data.objects.new(f"Cell_{r}_{c}", None)
            scene.collection.objects.link(holder)
            objs = _import_and_freeze(lib.OUT_DIR / glb_name, holder, clip=clip, frame=8)
            min_v, max_v = [1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]
            for o in objs:
                if o.type != "MESH":
                    continue
                nm = o.name.split(".")[0]
                vis = (
                    (form == "nose" and "SlotNose_" in nm)
                    or (form == "wing_in" and "SlotWingIn_" in nm)
                    or (form == "wing_out" and "SlotWingOut_" in nm)
                )
                o.hide_viewport = not vis
                o.hide_render = not vis
                if vis:
                    for corner in o.bound_box:
                        wc = o.matrix_world @ mathutils.Vector(corner)
                        for ax in range(3):
                            min_v[ax] = min(min_v[ax], wc[ax])
                            max_v[ax] = max(max_v[ax], wc[ax])
            span = max(max_v[0] - min_v[0], max_v[1] - min_v[1], max_v[2] - min_v[2], 0.5)
            sc = 2.4 / span
            cx, cy, cz = 0.5 * (min_v[0] + max_v[0]), 0.5 * (min_v[1] + max_v[1]), 0.5 * (min_v[2] + max_v[2])
            holder.scale = (sc, sc, sc)
            holder.rotation_euler = (0.0, 0.0, math.radians(-28.0))
            bpy.context.view_layer.update()
            off = holder.matrix_world.to_3x3() @ mathutils.Vector((cx, cy, cz))
            holder.location = (col_xs[c] - off.x, row_ys[r] - off.y, -off.z)

    for c, glb_name in enumerate(("wpn_skill_salvo.glb", "wpn_skill_beam.glb", "wpn_skill_emp.glb")):
        holder = bpy.data.objects.new(f"Skill_{c}", None)
        scene.collection.objects.link(holder)
        objs = _import_and_freeze(lib.OUT_DIR / glb_name, holder, clip="Attack", frame=8)
        min_v, max_v = [1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]
        for o in objs:
            if o.type != "MESH":
                continue
            for corner in o.bound_box:
                wc = o.matrix_world @ mathutils.Vector(corner)
                for ax in range(3):
                    min_v[ax] = min(min_v[ax], wc[ax])
                    max_v[ax] = max(max_v[ax], wc[ax])
        span = max(max_v[0] - min_v[0], max_v[1] - min_v[1], max_v[2] - min_v[2], 0.5)
        sc = 2.6 / span
        cx, cy, cz = 0.5 * (min_v[0] + max_v[0]), 0.5 * (min_v[1] + max_v[1]), 0.5 * (min_v[2] + max_v[2])
        holder.scale = (sc, sc, sc)
        holder.rotation_euler = (0.0, 0.0, math.radians(-28.0))
        bpy.context.view_layer.update()
        off = holder.matrix_world.to_3x3() @ mathutils.Vector((cx, cy, cz))
        holder.location = (col_xs[c] - off.x, row_ys[5] - off.y, -off.z)

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def render_weapons_showcase(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    _render_modular_ships_sheet(out_path)
    forms_path = out_path.with_name("showcase_v14_weapon_forms.png")
    _render_weapon_forms_sheet(forms_path)


def main() -> None:
    if "--render-only" not in sys.argv:
        build_pulse_blaster()
        build_scatter_cannon()
        build_rail_sniper()
        build_homing_pod()
        build_skill_salvo()
        build_skill_beam()
        build_skill_emp()
        build_thermal_sink()
        print("\n=== ALL 8 v14 MODULAR STRUCTURAL WEAPON .GLB ASSETS BUILT SUCCESSFULLY ===")

    if "--showcase" in sys.argv:
        idx = sys.argv.index("--showcase")
        if idx + 1 < len(sys.argv):
            render_weapons_showcase(Path(sys.argv[idx + 1]))


if __name__ == "__main__":
    main()
