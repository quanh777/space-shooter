#!/usr/bin/env python3
"""Synthesize our procedural SFX patches, sanity-check WAVs via sfx/tools/qa.py, and pack everything into public/assets/sfx-bank.json (so IDM stops hijacking audio files)."""
import array
import base64
import json
import math
import os
import shutil
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATCH_DIR = os.path.join(ROOT, "sfx", "patches")
OUT_DIR = os.path.join(ROOT, "sfx", "rendered")
LEGACY_PUBLIC_SFX_DIR = os.path.join(ROOT, "public", "assets", "sfx")
SOUNDBANK_PATH = os.path.join(ROOT, "public", "assets", "sfx-bank.json")
PREVIEW_DIR = os.path.join(ROOT, "sfx", "preview")
SFX_PY = os.path.join(ROOT, "sfx", "tools", "synth.py")
DOCTOR_PY = os.path.join(ROOT, "sfx", "tools", "qa.py")

os.makedirs(PATCH_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# (patch_dict, variants)
PATCHES = [
    # UI clicks, hovers & garage wrenches
    ({
        "name": "ui_click",
        "description": "Crisp mechanical cockpit micro-switch tick + snappy sine drop.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.001, "release": 0.009, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1950, "q": 1.6}], "gain_db": -5},
            {"wave": "sine", "freq": [[0, 1400], [0.024, 420]],
             "env": {"attack": 0.0005, "hold": 0.002, "release": 0.022, "curve": 3}},
        ],
        "master": {"lufs": -20, "peak_db": -1, "highpass": 180},
        "expect": {"duration": [0.015, 0.07], "centroid": [450, 2800]},
    }, 1),
    ({
        "name": "ui_hover",
        "description": "Soft warm console hover tick without harsh 2-5kHz buildup.",
        "layers": [
            {"wave": "sine", "freq": [[0, 780], [0.022, 1040]],
             "env": {"attack": 0.001, "hold": 0.002, "release": 0.022, "curve": 3}},
            {"wave": "triangle", "freq": [[0, 1170], [0.02, 1480]],
             "env": {"attack": 0.001, "hold": 0.001, "release": 0.016, "curve": 3},
             "filters": [{"type": "lowpass", "cutoff": 1950}], "gain_db": -9},
        ],
        "master": {"lufs": -23, "peak_db": -1.5, "highpass": 220},
        "expect": {"duration": [0.014, 0.06], "centroid": [600, 2200]},
    }, 1),
    ({
        "name": "ui_confirm",
        "description": "Rising 5th telemetry confirm with clean FM shimmer.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.002, "release": 0.01, "curve": 3},
             "filters": [{"type": "highpass", "cutoff": 2600}, {"type": "lowpass", "cutoff": 9000}], "gain_db": -8},
            {"wave": "sine", "freq": [[0, 587], [0.065, 587], [0.065, 880]],
             "fm": {"ratio": 2, "index": [[0, 1.4], [0.18, 0.2]]},
             "env": {"attack": 0.002, "hold": 0.055, "release": 0.14, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 8000}]},
        ],
        "master": {"lufs": -19, "peak_db": -1, "highpass": 220, "reverb": {"mix": 0.1, "decay": 0.35}},
        "expect": {"duration": [0.12, 0.45], "centroid": [500, 4200]},
    }, 1),
    ({
        "name": "ui_back",
        "description": "Soft falling cancel tone.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 620], [0.09, 340]],
             "env": {"attack": 0.002, "hold": 0.01, "release": 0.085, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 4500}]},
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.0, "release": 0.012, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2200, "q": 1.6}], "gain_db": -9},
        ],
        "master": {"lufs": -20, "peak_db": -1, "highpass": 180},
        "expect": {"duration": [0.06, 0.25], "centroid": [350, 2600]},
    }, 1),
    ({
        "name": "ui_error",
        "description": "Two-pulse low damped console deny buzz.",
        "layers": [
            {"wave": "saw", "freq": [[0, 185], [0.08, 165], [0.08, 145], [0.22, 118]], "detune_cents": 12,
             "env": {"attack": 0.002, "hold": 0.06, "release": 0.15, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": 1400, "q": 1.2}]},
            {"wave": "noise", "at": [0, 0.08], "env": {"attack": 0.001, "hold": 0.002, "release": 0.018, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1500, "q": 2}], "gain_db": -8},
        ],
        "master": {"lufs": -19, "peak_db": -1, "highpass": 90},
        "expect": {"duration": [0.15, 0.38], "centroid": [150, 1400]},
    }, 1),
    ({
        "name": "shop_open",
        "description": "Docking bay airlock pressurize + warm triad chime.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.015, "hold": 0.05, "release": 0.2, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 420], [0.24, 1400]], "q": 1.4}], "gain_db": -6},
            {"wave": "sine", "freq": [[0, 110], [0.25, 165]], "drive": 0.8,
             "env": {"attack": 0.008, "hold": 0.06, "release": 0.24, "curve": 2}, "gain_db": -5},
            {"wave": "triangle", "freq": [[0.04, 330], [0.1, 330], [0.1, 494], [0.17, 494], [0.17, 659]],
             "env": {"attack": 0.003, "hold": 0.14, "release": 0.22, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 5500}], "gain_db": 1},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 70, "reverb": {"mix": 0.15, "decay": 0.45}},
        "expect": {"duration": [0.25, 0.75], "centroid": [180, 2600]},
    }, 1),
    ({
        "name": "shop_buy",
        "description": "Crisp mechanical bolt lock + positive credit chime.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.004, "release": 0.02, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2400, "q": 1.6}], "gain_db": -5},
            {"wave": "sine", "freq": [[0, 175], [0.07, 62]], "drive": 1.2,
             "env": {"attack": 0.002, "hold": 0.01, "release": 0.075, "curve": 2.5}, "gain_db": -3},
            {"wave": "triangle", "at": [0.03], "freq": [[0, 587], [0.055, 587], [0.055, 880]],
             "partials": [[1, 0, 1], [2, -10, 0.6]],
             "env": {"attack": 0.002, "hold": 0.05, "release": 0.16, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 7000}]},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 50, "reverb": {"mix": 0.1, "decay": 0.35}},
        "expect": {"duration": [0.14, 0.5], "centroid": [350, 3200]},
    }, 1),
    ({
        "name": "level_up",
        "description": "Tactical warship level-up triad arpeggio + clean shimmer.",
        "layers": [
            {"wave": "sine", "freq": [[0, 130.8], [0.18, 261.6]], "drive": 0.7,
             "env": {"attack": 0.005, "hold": 0.08, "release": 0.25, "curve": 2}, "gain_db": -5},
            {"wave": "triangle", "freq": [[0, 523.25], [0.065, 523.25], [0.065, 659.25], [0.13, 659.25], [0.13, 783.99], [0.2, 783.99], [0.2, 1046.5]],
             "partials": [[1, 0, 1], [2, -11, 0.5]],
             "env": {"attack": 0.003, "hold": 0.2, "release": 0.34, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 7800}]},
            {"wave": "noise", "at": [0.2], "env": {"attack": 0.002, "hold": 0.0, "release": 0.08, "curve": 3},
             "filters": [{"type": "highpass", "cutoff": 5500}, {"type": "lowpass", "cutoff": 10000}], "gain_db": -18},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 100, "reverb": {"mix": 0.16, "decay": 0.55}},
        "expect": {"duration": [0.35, 0.9], "centroid": [500, 3500]},
    }, 1),

    # Weapons, impacts & boss noise
    ({
        "name": "shoot_blaster",
        "description": "Tactile plasma repeater: snappy trigger + swept FM laser + punchy thump.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.001, "release": 0.012, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2800, "q": 1.3}], "gain_db": -6},
            {"wave": "saw", "freq": [[0, 1320], [0.082, 215]], "detune_cents": 7,
             "env": {"attack": 0.001, "hold": 0.008, "release": 0.075, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": [[0, 7600], [0.08, 1600]], "q": 1.1}], "gain_db": -2},
            {"wave": "sine", "freq": [[0, 235], [0.05, 68]], "drive": 1.5,
             "env": {"attack": 0.001, "hold": 0.005, "release": 0.048, "curve": 2.2}, "gain_db": -1},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 55},
        "vary": {"pitch": 1.2, "gain_db": 1.2},
        "expect": {"duration": [0.06, 0.2], "centroid": [350, 2400]},
    }, 3),
    ({
        "name": "shoot_pierce",
        "description": "Hyper-rail whip shot: bright FM magnetic crack + capacitor recoil punch.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.003, "release": 0.026, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": [[0, 4400], [0.028, 1650]], "q": 1.4}], "gain_db": -4},
            {"wave": "sine", "freq": [[0, 1680], [0.12, 260]],
             "fm": {"ratio": 1.4, "index": [[0, 2.0], [0.09, 0.3]]},
             "env": {"attack": 0.001, "hold": 0.01, "release": 0.115, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": 7600}]},
            {"wave": "sine", "freq": [[0, 210], [0.08, 56]], "drive": 1.7,
             "env": {"attack": 0.001, "hold": 0.008, "release": 0.08, "curve": 2}, "gain_db": -2},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 50},
        "vary": {"pitch": 0.9, "gain_db": 1.2},
        "expect": {"duration": [0.08, 0.24], "centroid": [350, 2900]},
    }, 2),
    ({
        "name": "drone_shot",
        "description": "Quiet suppressed scout-drone ion dart (low fatigue).",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.001, "release": 0.01, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2600, "q": 1.4}], "gain_db": -8},
            {"wave": "triangle", "freq": [[0, 820], [0.075, 360]],
             "env": {"attack": 0.001, "hold": 0.005, "release": 0.07, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 4200}]},
        ],
        "master": {"lufs": -21, "peak_db": -1.5, "highpass": 180},
        "vary": {"pitch": 1.5, "gain_db": 1.5},
        "expect": {"duration": [0.05, 0.15], "centroid": [400, 2000]},
    }, 2),
    ({
        "name": "hit_enemy",
        "description": "Juicy tactile hitmarker crunch: crisp 1950Hz snap + armor crunch + punchy sub.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 1950], [0.024, 780]],
             "env": {"attack": 0.0005, "hold": 0.002, "release": 0.024, "curve": 3},
             "filters": [{"type": "lowpass", "cutoff": 5200}], "gain_db": -2},
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.004, "release": 0.055, "curve": 2.6},
             "filters": [{"type": "bandpass", "cutoff": [[0, 2200], [0.055, 620]], "q": 1.6}], "gain_db": -4},
            {"wave": "sine", "freq": [[0, 195], [0.095, 58]], "drive": 1.5,
             "env": {"attack": 0.001, "hold": 0.008, "release": 0.095, "curve": 2.1}},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 48},
        "vary": {"pitch": 1.3, "gain_db": 1.5},
        "expect": {"duration": [0.06, 0.24], "centroid": [220, 2400]},
    }, 3),
    ({
        "name": "hit_crit",
        "description": "Critical strike crystal bell dink + sharp armor crack + heavy sub slam.",
        "layers": [
            {"wave": "sine", "freq": [[0, 1174.7], [0.028, 1760]],
             "fm": {"ratio": 1.5, "index": [[0, 2.1], [0.14, 0.15]]},
             "env": {"attack": 0.001, "hold": 0.015, "release": 0.16, "curve": 2.8},
             "filters": [{"type": "lowpass", "cutoff": 7500}]},
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.002, "release": 0.028, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3200, "q": 1.5}], "gain_db": -4},
            {"wave": "sine", "freq": [[0, 220], [0.12, 52]], "drive": 1.8,
             "env": {"attack": 0.001, "hold": 0.012, "release": 0.12, "curve": 2}, "gain_db": -2},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 45, "reverb": {"mix": 0.09, "decay": 0.32}},
        "vary": {"pitch": 0.8, "gain_db": 1.0},
        "expect": {"duration": [0.1, 0.45], "centroid": [300, 3200]},
    }, 2),
    ({
        "name": "kill_confirm",
        "description": "Sweet crystalline kill-confirmation ping layered on enemy kills and combo ticks.",
        "layers": [
            {"wave": "sine", "freq": [[0, 784], [0.045, 1174.7]],
             "partials": [[1, 0, 1], [2, -8, 0.6]],
             "env": {"attack": 0.001, "hold": 0.025, "release": 0.13, "curve": 2.8},
             "filters": [{"type": "lowpass", "cutoff": 6200}]},
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.001, "release": 0.014, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3000, "q": 1.6}], "gain_db": -10},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 240, "reverb": {"mix": 0.12, "decay": 0.3}},
        "expect": {"duration": [0.1, 0.45], "centroid": [600, 3000]},
    }, 1),
    ({
        "name": "enemy_explode_sm",
        "description": "Pop & shatter fighter detonation: tight pop core + staggered debris crackles + blast.",
        "layers": [
            {"wave": "sine", "freq": [[0, 290], [0.16, 44]], "drive": 1.8,
             "env": {"attack": 0.001, "hold": 0.018, "release": 0.16, "curve": 2.2}},
            {"wave": "noise", "at": [0, 0.026, 0.058],
             "env": {"attack": 0.0005, "hold": 0.002, "release": 0.024, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1850, "q": 1.8}], "gain_db": -4},
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.014, "release": 0.22, "curve": 2.2},
             "filters": [{"type": "lowpass", "cutoff": [[0, 3200], [0.22, 260]], "q": 0.9}], "gain_db": -2},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 38, "reverb": {"mix": 0.1, "decay": 0.35}},
        "vary": {"pitch": 1.4, "gain_db": 1.4},
        "expect": {"duration": [0.14, 0.55], "centroid": [120, 1800]},
    }, 3),
    ({
        "name": "enemy_explode_lg",
        "description": "Heavy cruiser pop & shatter blast: punchy pop core + staggered debris bursts + deep roar.",
        "layers": [
            {"wave": "sine", "freq": [[0, 165], [0.3, 30]], "drive": 2.0,
             "env": {"attack": 0.001, "hold": 0.036, "release": 0.32, "curve": 2}},
            {"wave": "noise", "at": [0, 0.032, 0.072],
             "env": {"attack": 0.0005, "hold": 0.003, "release": 0.032, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1750, "q": 1.7}], "gain_db": -3},
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.035, "release": 0.36, "curve": 2.0},
             "filters": [{"type": "lowpass", "cutoff": [[0, 3200], [0.36, 180]], "q": 0.9}], "gain_db": -1},
        ],
        "master": {"lufs": -13, "peak_db": -1, "highpass": 32, "reverb": {"mix": 0.14, "decay": 0.45}},
        "vary": {"pitch": 1.2, "gain_db": 1.5},
        "expect": {"duration": [0.24, 0.72], "centroid": [90, 1400]},
    }, 2),
    ({
        "name": "coin_pickup",
        "description": "ASMR crystal gem pluck: warm two-note fifth + gentle soft FM shimmer.",
        "layers": [
            {"wave": "sine", "freq": [[0, 987.8], [0.045, 987.8], [0.045, 1480]],
             "fm": {"ratio": 2, "index": [[0, 1.4], [0.2, 0.15]]},
             "env": {"attack": 0.001, "hold": 0.045, "release": 0.22, "curve": 3},
             "filters": [{"type": "lowpass", "cutoff": 5800}]},
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.001, "release": 0.01, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2800, "q": 1.6}], "gain_db": -12},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 240, "reverb": {"mix": 0.12, "decay": 0.4}},
        "vary": {"pitch": 1.1, "gain_db": 1.0},
        "expect": {"duration": [0.16, 0.55], "centroid": [700, 3200]},
    }, 3),
    ({
        "name": "powerup_pickup",
        "description": "Tactical buff pickup: rising synth arpeggio + clean high air.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 440], [0.05, 440], [0.05, 554.4], [0.1, 554.4], [0.1, 659.3], [0.15, 659.3], [0.15, 880]],
             "partials": [[1, 0, 1], [2, -10, 0.55]],
             "env": {"attack": 0.002, "hold": 0.15, "release": 0.2, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 7000}]},
            {"wave": "noise", "env": {"attack": 0.01, "hold": 0.04, "release": 0.18, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 800], [0.2, 3200]], "q": 1.6}], "gain_db": -12},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 140, "reverb": {"mix": 0.14, "decay": 0.4}},
        "expect": {"duration": [0.25, 0.6], "centroid": [550, 3200]},
    }, 1),
    ({
        "name": "dash_thrust",
        "description": "Phase thruster burst: sweeping plasma whoosh + turbine kick.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.004, "hold": 0.02, "release": 0.16, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 360], [0.08, 2200], [0.18, 520]], "q": 1.5}], "gain_db": 1},
            {"wave": "sine", "freq": [[0, 165], [0.13, 55]], "drive": 1.3,
             "env": {"attack": 0.002, "hold": 0.015, "release": 0.12, "curve": 2}, "gain_db": -4},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 45},
        "expect": {"duration": [0.12, 0.35], "centroid": [120, 2200]},
    }, 1),
    ({
        "name": "graze_spark",
        "description": "Close-call bullet graze: crisp ion static snap + tiny rise.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0008, "hold": 0.002, "release": 0.024, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3800, "q": 1.8}], "gain_db": -5},
            {"wave": "sine", "freq": [[0, 1180], [0.055, 1680]],
             "env": {"attack": 0.001, "hold": 0.005, "release": 0.05, "curve": 2.8}},
        ],
        "master": {"lufs": -19, "peak_db": -1, "highpass": 280},
        "expect": {"duration": [0.04, 0.12], "centroid": [800, 4200]},
    }, 1),
    ({
        "name": "player_hurt",
        "description": "Hull damage impact: metallic crunch + heavy sub punch + alarm dip.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.006, "release": 0.045, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": [[0, 1900], [0.05, 650]], "q": 1.4}], "gain_db": -2},
            {"wave": "sine", "freq": [[0, 145], [0.22, 38]], "drive": 1.9,
             "env": {"attack": 0.002, "hold": 0.025, "release": 0.22, "curve": 2}},
            {"wave": "saw", "freq": [[0, 320], [0.2, 95]],
             "env": {"attack": 0.003, "hold": 0.015, "release": 0.18, "curve": 2.2},
             "filters": [{"type": "lowpass", "cutoff": 1400}], "gain_db": -5},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 38},
        "expect": {"duration": [0.16, 0.45], "centroid": [80, 1600]},
    }, 1),
    ({
        "name": "shield_block",
        "description": "Aegis barrier deflection: resonant metallic shield ring + absorb thump.",
        "layers": [
            {"wave": "sine", "freq": [[0, 520], [0.18, 660]], "partials": [[1, 0, 1], [1.98, -6, 0.7], [3.02, -12, 0.4]],
             "env": {"attack": 0.002, "hold": 0.015, "release": 0.18, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 5500}]},
            {"wave": "sine", "freq": [[0, 180], [0.1, 72]], "drive": 1.1,
             "env": {"attack": 0.002, "hold": 0.01, "release": 0.09, "curve": 2}, "gain_db": -4},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 60, "reverb": {"mix": 0.14, "decay": 0.4}},
        "expect": {"duration": [0.15, 0.45], "centroid": [350, 2600]},
    }, 1),
    ({
        "name": "shield_activate",
        "description": "Aegis shield barrier boot-up hum + crystalline lock.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 220], [0.22, 440]], "detune_cents": 8,
             "env": {"attack": 0.015, "hold": 0.04, "release": 0.18, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": [[0, 600], [0.2, 2600]], "q": 1.6}], "gain_db": -2},
            {"wave": "sine", "at": [0.06], "freq": [[0, 880], [0.12, 1175]], "fm": {"ratio": 2, "index": 0.8},
             "env": {"attack": 0.004, "hold": 0.02, "release": 0.14, "curve": 2.5}, "gain_db": -4},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 90, "reverb": {"mix": 0.16, "decay": 0.45}},
        "expect": {"duration": [0.18, 0.55], "centroid": [250, 2200]},
    }, 1),
    ({
        "name": "railbeam_fire",
        "description": "Heavy hyper-rail beam: capacitor discharge crack + long tearing plasma sub.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.015, "release": 0.34, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 3200], [0.35, 600]], "q": 1.1}], "gain_db": -3},
            {"wave": "saw", "freq": [[0, 1100], [0.42, 115]], "detune_cents": 10,
             "env": {"attack": 0.002, "hold": 0.04, "release": 0.42, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": 4800}], "gain_db": -3},
            {"wave": "sine", "freq": [[0, 165], [0.48, 34]], "drive": 1.9,
             "env": {"attack": 0.002, "hold": 0.06, "release": 0.46, "curve": 2}},
        ],
        "master": {"lufs": -13, "peak_db": -1, "highpass": 35, "reverb": {"mix": 0.15, "decay": 0.55}},
        "expect": {"duration": [0.35, 0.85], "centroid": [90, 1800]},
    }, 1),
    ({
        "name": "emp_burst",
        "description": "Magnetic EMP dome shockwave: capacitor slam + sub drop + arc crackles.",
        "layers": [
            {"wave": "sine", "freq": [[0, 360], [0.45, 34]], "drive": 1.8,
             "env": {"attack": 0.002, "hold": 0.05, "release": 0.42, "curve": 2}},
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.03, "release": 0.28, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 2800], [0.25, 700]], "q": 1.4}], "gain_db": -4},
            {"wave": "triangle", "at": [0.02, 0.075, 0.13], "freq": [[0, 1280], [0.07, 740]],
             "env": {"attack": 0.001, "hold": 0.005, "release": 0.065, "curve": 3}, "gain_db": -8},
        ],
        "master": {"lufs": -13, "peak_db": -1, "highpass": 35, "reverb": {"mix": 0.16, "decay": 0.5}},
        "expect": {"duration": [0.35, 0.85], "centroid": [90, 1800]},
    }, 1),
    ({
        "name": "bomb_launch",
        "description": "VLS Salvo tube ejection thump + rising rocket ignition whoosh.",
        "layers": [
            {"wave": "sine", "freq": [[0, 160], [0.08, 62]], "drive": 1.3,
             "env": {"attack": 0.002, "hold": 0.01, "release": 0.08, "curve": 2}, "gain_db": -4},
            {"wave": "noise", "at": [0.02], "env": {"attack": 0.006, "hold": 0.04, "release": 0.16, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 500], [0.18, 2400]], "q": 1.3}], "gain_db": 0},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 50},
        "expect": {"duration": [0.15, 0.38], "centroid": [120, 2200]},
    }, 1),
    ({
        "name": "bomb_explode",
        "description": "Heavy plasma warhead detonation: sharp crack + sweeping roar + deep sub.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.01, "release": 0.06, "curve": 3},
             "filters": [{"type": "highpass", "cutoff": 1100}, {"type": "lowpass", "cutoff": 8000}], "gain_db": -2},
            {"wave": "sine", "freq": [[0, 120], [0.46, 28]], "drive": 2.0,
             "env": {"attack": 0.002, "hold": 0.06, "release": 0.44, "curve": 2}},
            {"wave": "noise", "env": {"attack": 0.004, "hold": 0.05, "release": 0.48, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": [[0, 2600], [0.45, 170]], "q": 0.9}], "gain_db": -1},
        ],
        "master": {"lufs": -12, "peak_db": -1, "highpass": 30, "reverb": {"mix": 0.15, "decay": 0.5}},
        "expect": {"duration": [0.38, 0.85], "centroid": [80, 900]},
    }, 1),
    ({
        "name": "thermal_purge",
        "description": "High-pressure cryo-steam vent: valve snap + rushing bandpass steam hiss + sub.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.08, "release": 0.28, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 900], [0.12, 3200], [0.35, 650]], "q": 1.3}], "gain_db": -1},
            {"wave": "sine", "freq": [[0, 210], [0.22, 65]], "drive": 1.3,
             "env": {"attack": 0.002, "hold": 0.03, "release": 0.22, "curve": 2}, "gain_db": -3},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 50, "reverb": {"mix": 0.12, "decay": 0.4}},
        "expect": {"duration": [0.25, 0.6], "centroid": [150, 2400]},
    }, 1),
    ({
        "name": "parry_reflect",
        "description": "Dash Parry metallic deflection: rich harmonic clang + crisp energy snap + punch.",
        "layers": [
            {"wave": "sine", "freq": [[0, 784], [0.18, 1175]],
             "partials": [[1, 0, 1], [1.5, -5, 0.7], [2.02, -9, 0.5]],
             "env": {"attack": 0.001, "hold": 0.015, "release": 0.18, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": 4800}]},
            {"wave": "sine", "freq": [[0, 190], [0.1, 65]], "drive": 1.4,
             "env": {"attack": 0.001, "hold": 0.01, "release": 0.1, "curve": 2}, "gain_db": -4},
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.003, "release": 0.02, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2400, "q": 1.6}], "gain_db": -7},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 90, "reverb": {"mix": 0.14, "decay": 0.4}},
        "expect": {"duration": [0.12, 0.6], "centroid": [350, 2800]},
    }, 1),
    ({
        "name": "chrono_start",
        "description": "Time-dilation bass drop + descending crystalline phase lock.",
        "layers": [
            {"wave": "sine", "freq": [[0, 240], [0.38, 42]], "drive": 1.6,
             "env": {"attack": 0.004, "hold": 0.04, "release": 0.36, "curve": 2}},
            {"wave": "triangle", "freq": [[0, 1180], [0.34, 420]],
             "env": {"attack": 0.008, "hold": 0.02, "release": 0.31, "curve": 2.4},
             "filters": [{"type": "lowpass", "cutoff": 4500}], "gain_db": -6},
            {"wave": "noise", "env": {"attack": 0.004, "hold": 0.02, "release": 0.24, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 2200], [0.25, 380]], "q": 1.6}], "gain_db": -10},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 35, "reverb": {"mix": 0.18, "decay": 0.55}},
        "expect": {"duration": [0.28, 0.7], "centroid": [80, 1600]},
    }, 1),
    ({
        "name": "chrono_end",
        "description": "Time snaps back to 1.0x speed: rising spring lock + air snap.",
        "layers": [
            {"wave": "sine", "freq": [[0, 140], [0.18, 560]],
             "env": {"attack": 0.004, "hold": 0.02, "release": 0.16, "curve": 2.2}},
            {"wave": "triangle", "at": [0.02], "freq": [[0, 420], [0.14, 920]],
             "env": {"attack": 0.003, "hold": 0.015, "release": 0.13, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 4800}], "gain_db": -5},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 100},
        "expect": {"duration": [0.14, 0.38], "centroid": [140, 1800]},
    }, 1),
    ({
        "name": "mutation_acquired",
        "description": "Exotic build mutation chime: harmonic triad + glassy FM sparkle.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 440], [0.06, 440], [0.06, 659.3], [0.12, 659.3], [0.12, 987.8]],
             "partials": [[1, 0, 1], [2, -9, 0.55]],
             "env": {"attack": 0.003, "hold": 0.12, "release": 0.24, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 6800}]},
            {"wave": "sine", "at": [0.11], "freq": 1318.5, "fm": {"ratio": 3, "index": [[0, 1.8], [0.2, 0.2]]},
             "env": {"attack": 0.003, "hold": 0.02, "release": 0.2, "curve": 3}, "gain_db": -6},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 180, "reverb": {"mix": 0.18, "decay": 0.5}},
        "expect": {"duration": [0.25, 0.85], "centroid": [550, 3200]},
    }, 1),

    # Hyperspace jumps & late-added combat cues
    ({
        "name": "sortie_launch",
        "description": "NEW: Launch from Hangar — canopy clamp + turbine spool + magnetic catapult thump.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.008, "release": 0.035, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1900, "q": 1.6}], "gain_db": -4},
            {"wave": "sine", "freq": [[0, 130], [0.1, 68], [0.35, 190]], "drive": 1.4,
             "env": {"attack": 0.004, "hold": 0.12, "release": 0.26, "curve": 2}},
            {"wave": "triangle", "at": [0.05], "freq": [[0, 220], [0.32, 660]], "detune_cents": 8,
             "env": {"attack": 0.02, "hold": 0.08, "release": 0.24, "curve": 2.2},
             "filters": [{"type": "lowpass", "cutoff": [[0, 800], [0.3, 4200]]}], "gain_db": -3},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 40, "reverb": {"mix": 0.15, "decay": 0.45}},
        "expect": {"duration": [0.3, 0.9], "centroid": [100, 1800]},
    }, 1),
    ({
        "name": "warp_jump",
        "description": "Hyperspace ignition: sub-bass gravity well drop + rising bandpass warp tunnel whoosh.",
        "layers": [
            {"wave": "sine", "freq": [[0, 185], [0.46, 42]], "drive": 1.7,
             "env": {"attack": 0.006, "hold": 0.08, "release": 0.4, "curve": 2}, "gain_db": -2},
            {"wave": "noise", "env": {"attack": 0.03, "hold": 0.18, "release": 0.32, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 320], [0.32, 2900], [0.55, 780]], "q": 1.5}], "gain_db": 0},
            {"wave": "triangle", "at": [0.04], "freq": [[0, 280], [0.46, 1280]], "detune_cents": 10,
             "env": {"attack": 0.02, "hold": 0.16, "release": 0.28, "curve": 2.2},
             "filters": [{"type": "lowpass", "cutoff": 5500}], "gain_db": -2},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 35, "reverb": {"mix": 0.2, "decay": 0.6}},
        "expect": {"duration": [0.4, 1.1], "centroid": [120, 2200]},
    }, 1),
    ({
        "name": "warp_arrival",
        "description": "NEW: Dropping out of lightspeed — retro-thruster air brake + crisp confirmation ping.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.004, "hold": 0.03, "release": 0.22, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 2200], [0.22, 340]], "q": 1.4}], "gain_db": -1},
            {"wave": "sine", "freq": [[0, 150], [0.22, 46]], "drive": 1.5,
             "env": {"attack": 0.002, "hold": 0.02, "release": 0.2, "curve": 2}, "gain_db": -2},
            {"wave": "sine", "at": [0.06], "freq": 784, "fm": {"ratio": 2, "index": [[0, 1.2], [0.16, 0.1]]},
             "env": {"attack": 0.003, "hold": 0.015, "release": 0.18, "curve": 2.8}, "gain_db": -5},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 38, "reverb": {"mix": 0.16, "decay": 0.45}},
        "expect": {"duration": [0.2, 0.75], "centroid": [100, 1800]},
    }, 1),
    ({
        "name": "module_drop",
        "description": "NEW: Loot pod drop — sonar beacon double chirp.",
        "layers": [
            {"wave": "sine", "at": [0, 0.09], "freq": [[0, 1046], [0.07, 1318]], "fm": {"ratio": 2, "index": 0.8},
             "env": {"attack": 0.002, "hold": 0.015, "release": 0.08, "curve": 2.8}},
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.002, "release": 0.018, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3400, "q": 1.5}], "gain_db": -12},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 250, "reverb": {"mix": 0.16, "decay": 0.45}},
        "expect": {"duration": [0.15, 0.7], "centroid": [800, 3600]},
    }, 1),
    ({
        "name": "boss_charge_warn",
        "description": "NEW: Boss charge telegraph — menacing low turbine wind-up snarl.",
        "layers": [
            {"wave": "saw", "freq": [[0, 115], [0.28, 360]], "detune_cents": 14,
             "env": {"attack": 0.015, "hold": 0.06, "release": 0.22, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": [[0, 600], [0.28, 2800]], "q": 1.6}], "gain_db": -2},
            {"wave": "noise", "env": {"attack": 0.01, "hold": 0.05, "release": 0.2, "curve": 2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 500], [0.26, 1900]], "q": 1.5}], "gain_db": -6},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 50},
        "expect": {"duration": [0.22, 0.55], "centroid": [120, 1800]},
    }, 1),
    ({
        "name": "boss_explode",
        "description": "Capital boss obliteration: multi-stage crack, seismic sub & rising victory brass.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.04, "release": 0.65, "curve": 1.8},
             "filters": [{"type": "lowpass", "cutoff": [[0, 3200], [0.65, 160]], "q": 0.9}], "gain_db": -1},
            {"wave": "sine", "freq": [[0, 110], [0.6, 26]], "drive": 2.0,
             "env": {"attack": 0.002, "hold": 0.1, "release": 0.55, "curve": 1.8}},
            {"wave": "triangle", "at": [0.18], "freq": [[0, 261.6], [0.08, 261.6], [0.08, 329.6], [0.16, 329.6], [0.16, 392], [0.24, 392], [0.24, 523.3]],
             "env": {"attack": 0.004, "hold": 0.24, "release": 0.28, "curve": 2.2},
             "filters": [{"type": "lowpass", "cutoff": 4200}], "gain_db": -7},
        ],
        "master": {"lufs": -12, "peak_db": -1, "highpass": 28, "reverb": {"mix": 0.2, "decay": 0.7}},
        "expect": {"duration": [0.55, 1.55], "centroid": [90, 1200]},
    }, 1),
    ({
        "name": "reinforcements_incoming",
        "description": "NEW: Wave 2 squad alert — urgent dual radar chirp.",
        "layers": [
            {"wave": "triangle", "at": [0, 0.11], "freq": [[0, 620], [0.07, 860]],
             "env": {"attack": 0.002, "hold": 0.025, "release": 0.05, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 4200}]},
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.002, "release": 0.015, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2400, "q": 1.5}], "gain_db": -10},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 180, "reverb": {"mix": 0.1, "decay": 0.3}},
        "expect": {"duration": [0.14, 0.55], "centroid": [450, 2400]},
    }, 1),
    ({
        "name": "storm_burn",
        "description": "NEW: Outside-storm radiation burn tick — subtle geiger crackle + hull sizzle.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.02, "release": 0.09, "curve": 2.5},
             "filters": [{"type": "bandpass", "cutoff": [[0, 1800], [0.1, 750]], "q": 1.6}], "gain_db": -2},
            {"wave": "saw", "freq": [[0, 145], [0.09, 95]],
             "env": {"attack": 0.003, "hold": 0.01, "release": 0.08, "curve": 2.4},
             "filters": [{"type": "lowpass", "cutoff": 1100}], "gain_db": -5},
        ],
        "master": {"lufs": -20, "peak_db": -1.5, "highpass": 80},
        "expect": {"duration": [0.08, 0.25], "centroid": [250, 2200]},
    }, 1),
    ({
        "name": "roulette_spin",
        "description": "NEW: Boss Roulette mechanical ratchet spin burst.",
        "layers": [
            {"wave": "noise", "at": [0, 0.045, 0.095, 0.155, 0.225],
             "env": {"attack": 0.001, "hold": 0.002, "release": 0.016, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2600, "q": 2.0}], "gain_db": -3},
            {"wave": "triangle", "at": [0, 0.045, 0.095, 0.155, 0.225],
             "freq": [[0, 720], [0.02, 420]],
             "env": {"attack": 0.001, "hold": 0.004, "release": 0.02, "curve": 3}, "gain_db": -4},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 200},
        "expect": {"duration": [0.2, 0.45], "centroid": [500, 3200]},
    }, 1),
    ({
        "name": "roulette_claim",
        "description": "NEW: Roulette reward claim — pneumatic latch + prize fanfare.",
        "layers": [
            {"wave": "sine", "freq": [[0, 140], [0.09, 55]], "drive": 1.2,
             "env": {"attack": 0.002, "hold": 0.01, "release": 0.08, "curve": 2.2}, "gain_db": -3},
            {"wave": "triangle", "at": [0.03], "freq": [[0, 523.3], [0.06, 523.3], [0.06, 784], [0.13, 784], [0.13, 1046.5]],
             "partials": [[1, 0, 1], [2, -10, 0.6]],
             "env": {"attack": 0.002, "hold": 0.14, "release": 0.22, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": 7200}]},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 60, "reverb": {"mix": 0.14, "decay": 0.45}},
        "expect": {"duration": [0.25, 0.8], "centroid": [400, 3000]},
    }, 1),
    ({
        "name": "augment_install",
        "description": "NEW: Heavy Sector Augment core installation — servo clamp + harmonic power-on.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.006, "release": 0.035, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 1600, "q": 1.6}], "gain_db": -4},
            {"wave": "sine", "freq": [[0, 180], [0.1, 58]], "drive": 1.5,
             "env": {"attack": 0.002, "hold": 0.02, "release": 0.12, "curve": 2}},
            {"wave": "triangle", "at": [0.04], "freq": [[0, 330], [0.22, 660]], "detune_cents": 8,
             "env": {"attack": 0.006, "hold": 0.08, "release": 0.22, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 5500}], "gain_db": -3},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 45, "reverb": {"mix": 0.14, "decay": 0.45}},
        "expect": {"duration": [0.24, 0.75], "centroid": [140, 2200]},
    }, 1),
    ({
        "name": "game_over",
        "description": "Hull destroyed / signal lost: slow falling minor triad + reactor power-down.",
        "layers": [
            {"wave": "sine", "freq": [[0, 160], [0.65, 36]], "drive": 1.3,
             "env": {"attack": 0.01, "hold": 0.15, "release": 0.52, "curve": 2}, "gain_db": -2},
            {"wave": "triangle", "freq": [[0, 392], [0.15, 392], [0.15, 349.2], [0.3, 349.2], [0.3, 311.1], [0.46, 311.1], [0.46, 261.6]],
             "env": {"attack": 0.005, "hold": 0.45, "release": 0.3, "curve": 2},
             "filters": [{"type": "lowpass", "cutoff": 3500}]},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 38, "reverb": {"mix": 0.18, "decay": 0.6}},
        "expect": {"duration": [0.55, 1.4], "centroid": [180, 1500]},
    }, 1),

    # Environmental explosions, lightning arcs & tactical alerts
    ({
        "name": "barrel_explode",
        "description": "Heavy TNT / Plasma Barrel detonation: metallic tank rupture + massive low roar + ember crackle.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0008, "hold": 0.014, "release": 0.075, "curve": 2.8},
             "filters": [{"type": "bandpass", "cutoff": [[0, 3200], [0.085, 880]], "q": 1.3}], "gain_db": -2},
            {"wave": "sine", "freq": [[0, 155], [0.5, 28]], "drive": 2.0,
             "env": {"attack": 0.001, "hold": 0.07, "release": 0.44, "curve": 2.0}},
            {"wave": "noise", "env": {"attack": 0.003, "hold": 0.06, "release": 0.52, "curve": 1.9},
             "filters": [{"type": "lowpass", "cutoff": [[0, 2900], [0.52, 160]], "q": 0.9}], "gain_db": -1},
        ],
        "master": {"lufs": -12, "peak_db": -1, "highpass": 32, "reverb": {"mix": 0.16, "decay": 0.5}},
        "vary": {"pitch": 1.1, "gain_db": 1.2},
        "expect": {"duration": [0.35, 0.95], "centroid": [80, 1200]},
    }, 2),
    ({
        "name": "lightning_zap",
        "description": "High-voltage arc lightning zap: crisp electric multi-spark + FM whip + short thunder punch.",
        "layers": [
            {"wave": "noise", "at": [0, 0.038, 0.082],
             "env": {"attack": 0.0005, "hold": 0.003, "release": 0.032, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": [[0, 3800], [0.035, 1600]], "q": 1.5}], "gain_db": -3},
            {"wave": "sine", "freq": [[0, 2100], [0.14, 460]],
             "fm": {"ratio": 1.7, "index": [[0, 2.4], [0.12, 0.4]]},
             "env": {"attack": 0.001, "hold": 0.01, "release": 0.14, "curve": 2.8},
             "filters": [{"type": "lowpass", "cutoff": 7600}], "gain_db": -3},
            {"wave": "sine", "freq": [[0, 185], [0.14, 52]], "drive": 1.4,
             "env": {"attack": 0.002, "hold": 0.015, "release": 0.12, "curve": 2.2}, "gain_db": -4},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 45, "reverb": {"mix": 0.12, "decay": 0.35}},
        "vary": {"pitch": 1.5, "gain_db": 1.2},
        "expect": {"duration": [0.12, 0.55], "centroid": [400, 3800]},
    }, 2),
    ({
        "name": "elemental_shatter",
        "description": "Elemental Shatter / Overload reaction: crystalline burst + resonant shock thump.",
        "layers": [
            {"wave": "sine", "freq": [[0, 230], [0.28, 42]], "drive": 1.7,
             "env": {"attack": 0.002, "hold": 0.03, "release": 0.25, "curve": 2.0}, "gain_db": -2},
            {"wave": "sine", "freq": [[0, 1650], [0.18, 560]],
             "fm": {"ratio": 1.6, "index": [[0, 2.2], [0.15, 0.3]]},
             "env": {"attack": 0.001, "hold": 0.02, "release": 0.19, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": 6800}], "gain_db": -3},
            {"wave": "noise", "env": {"attack": 0.001, "hold": 0.01, "release": 0.18, "curve": 2.4},
             "filters": [{"type": "bandpass", "cutoff": [[0, 3100], [0.18, 820]], "q": 1.4}], "gain_db": -4},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 42, "reverb": {"mix": 0.15, "decay": 0.42}},
        "expect": {"duration": [0.2, 0.72], "centroid": [220, 2800]},
    }, 1),
    ({
        "name": "asteroid_shatter",
        "description": "Ore asteroid fracture: rocky sub thump + staggered crystal chunk impacts.",
        "layers": [
            {"wave": "sine", "freq": [[0, 140], [0.24, 38]], "drive": 1.6,
             "env": {"attack": 0.002, "hold": 0.025, "release": 0.22, "curve": 2.1}, "gain_db": -2},
            {"wave": "noise", "at": [0, 0.035, 0.075],
             "env": {"attack": 0.001, "hold": 0.005, "release": 0.04, "curve": 2.8},
             "filters": [{"type": "bandpass", "cutoff": 1450, "q": 1.5}], "gain_db": -2},
            {"wave": "triangle", "at": [0.02], "freq": [[0, 1180], [0.14, 720]],
             "env": {"attack": 0.001, "hold": 0.01, "release": 0.13, "curve": 2.8}, "gain_db": -8},
        ],
        "master": {"lufs": -15, "peak_db": -1, "highpass": 40, "reverb": {"mix": 0.12, "decay": 0.38}},
        "expect": {"duration": [0.18, 0.65], "centroid": [140, 2200]},
    }, 1),
    ({
        "name": "sniper_lock",
        "description": "Double laser target lock warning before sniper discharge.",
        "layers": [
            {"wave": "sine", "at": [0, 0.07], "freq": [[0, 1320], [0.06, 1760]],
             "env": {"attack": 0.001, "hold": 0.015, "release": 0.055, "curve": 2.8}},
            {"wave": "noise", "at": [0], "env": {"attack": 0.0005, "hold": 0.001, "release": 0.01, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3400, "q": 1.6}], "gain_db": -10},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 260, "reverb": {"mix": 0.1, "decay": 0.28}},
        "expect": {"duration": [0.12, 0.4], "centroid": [800, 3400]},
    }, 1),
    ({
        "name": "sniper_fire",
        "description": "High-velocity hostile sniper needle discharge.",
        "layers": [
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.005, "release": 0.05, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": [[0, 4200], [0.05, 1200]], "q": 1.4}], "gain_db": -3},
            {"wave": "saw", "freq": [[0, 1650], [0.16, 220]], "detune_cents": 8,
             "env": {"attack": 0.001, "hold": 0.012, "release": 0.15, "curve": 2.5},
             "filters": [{"type": "lowpass", "cutoff": 6200}], "gain_db": -2},
            {"wave": "sine", "freq": [[0, 210], [0.11, 52]], "drive": 1.6,
             "env": {"attack": 0.001, "hold": 0.01, "release": 0.1, "curve": 2.1}, "gain_db": -3},
        ],
        "master": {"lufs": -14, "peak_db": -1, "highpass": 45},
        "expect": {"duration": [0.12, 0.45], "centroid": [260, 2600]},
    }, 1),
    ({
        "name": "bomber_warn",
        "description": "Rapid bomb countdown alarm from approaching Bomber drone.",
        "layers": [
            {"wave": "triangle", "at": [0, 0.095, 0.19], "freq": [[0, 820], [0.06, 1080]],
             "env": {"attack": 0.002, "hold": 0.02, "release": 0.05, "curve": 2.6},
             "filters": [{"type": "lowpass", "cutoff": 4800}]},
            {"wave": "noise", "at": [0, 0.095, 0.19],
             "env": {"attack": 0.001, "hold": 0.001, "release": 0.012, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 2600, "q": 1.8}], "gain_db": -9},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 180},
        "expect": {"duration": [0.22, 0.55], "centroid": [550, 2400]},
    }, 1),
    ({
        "name": "hazard_explode",
        "description": "Orbital barrage mortar & space mine detonation: heavy bass blast + low rumble.",
        "layers": [
            {"wave": "sine", "freq": [[0, 138], [0.38, 30]], "drive": 1.9,
             "env": {"attack": 0.002, "hold": 0.045, "release": 0.34, "curve": 2.0}},
            {"wave": "noise", "env": {"attack": 0.002, "hold": 0.035, "release": 0.36, "curve": 2.0},
             "filters": [{"type": "lowpass", "cutoff": [[0, 2400], [0.36, 180]], "q": 0.9}], "gain_db": -2},
        ],
        "master": {"lufs": -13, "peak_db": -1, "highpass": 34, "reverb": {"mix": 0.14, "decay": 0.45}},
        "expect": {"duration": [0.28, 0.78], "centroid": [80, 1100]},
    }, 1),
    ({
        "name": "shield_break",
        "description": "Aegis pylon / Mirage clone / Bastion armor plate shatter.",
        "layers": [
            {"wave": "sine", "freq": [[0, 960], [0.26, 210]],
             "fm": {"ratio": 1.4, "index": [[0, 2.0], [0.2, 0.2]]},
             "env": {"attack": 0.001, "hold": 0.025, "release": 0.24, "curve": 2.4},
             "filters": [{"type": "lowpass", "cutoff": 5800}]},
            {"wave": "noise", "at": [0, 0.038, 0.078],
             "env": {"attack": 0.001, "hold": 0.004, "release": 0.04, "curve": 2.8},
             "filters": [{"type": "bandpass", "cutoff": 2800, "q": 1.5}], "gain_db": -3},
            {"wave": "sine", "freq": [[0, 170], [0.22, 42]], "drive": 1.6,
             "env": {"attack": 0.002, "hold": 0.02, "release": 0.2, "curve": 2.0}, "gain_db": -3},
        ],
        "master": {"lufs": -13, "peak_db": -1, "highpass": 42, "reverb": {"mix": 0.15, "decay": 0.45}},
        "expect": {"duration": [0.22, 0.75], "centroid": [200, 2800]},
    }, 1),
    ({
        "name": "overload_alarm",
        "description": "Cockpit overheat klaxon + pressurized thermal hiss.",
        "layers": [
            {"wave": "saw", "at": [0, 0.14], "freq": [[0, 520], [0.11, 250]], "detune_cents": 10,
             "env": {"attack": 0.003, "hold": 0.025, "release": 0.09, "curve": 2.3},
             "filters": [{"type": "lowpass", "cutoff": 2600}], "gain_db": -2},
            {"wave": "noise", "env": {"attack": 0.004, "hold": 0.05, "release": 0.22, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": 1900, "q": 1.4}], "gain_db": -7},
        ],
        "master": {"lufs": -16, "peak_db": -1, "highpass": 110},
        "expect": {"duration": [0.22, 0.58], "centroid": [260, 2200]},
    }, 1),
    ({
        "name": "enemy_teleport",
        "description": "Spatial blink warp whoosh for Elite skirmishers and Chrono Ambush.",
        "layers": [
            {"wave": "triangle", "freq": [[0, 320], [0.12, 1380], [0.26, 420]],
             "env": {"attack": 0.004, "hold": 0.04, "release": 0.22, "curve": 2.4},
             "filters": [{"type": "lowpass", "cutoff": 5400}], "gain_db": -2},
            {"wave": "noise", "env": {"attack": 0.005, "hold": 0.03, "release": 0.2, "curve": 2.2},
             "filters": [{"type": "bandpass", "cutoff": [[0, 550], [0.12, 2600], [0.25, 680]], "q": 1.5}], "gain_db": -4},
        ],
        "master": {"lufs": -17, "peak_db": -1, "highpass": 90, "reverb": {"mix": 0.16, "decay": 0.4}},
        "expect": {"duration": [0.18, 0.58], "centroid": [320, 2600]},
    }, 1),
    ({
        "name": "armor_deflect",
        "description": "Short metallic ricochet ping when rounds hit heavy shield or Bastion armor.",
        "layers": [
            {"wave": "sine", "freq": [[0, 820], [0.09, 1240]],
             "partials": [[1, 0, 1], [1.9, -7, 0.6]],
             "env": {"attack": 0.001, "hold": 0.008, "release": 0.085, "curve": 2.8},
             "filters": [{"type": "lowpass", "cutoff": 4800}]},
            {"wave": "noise", "env": {"attack": 0.0005, "hold": 0.001, "release": 0.015, "curve": 3},
             "filters": [{"type": "bandpass", "cutoff": 3000, "q": 1.7}], "gain_db": -6},
        ],
        "master": {"lufs": -18, "peak_db": -1, "highpass": 180, "reverb": {"mix": 0.08, "decay": 0.25}},
        "expect": {"duration": [0.07, 0.3], "centroid": [450, 3400]},
    }, 1),
]

def trim_and_encode_wav(wav_path: str) -> tuple[int, str]:
    """Read 16-bit mono WAV, shave off dead silence with a smooth cosine fade, and encode base64."""
    with wave.open(wav_path, "rb") as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2, f"Unsupported WAV format in {wav_path}"
        sr = w.getframerate()
        pcm = array.array("h")
        pcm.frombytes(w.readframes(w.getnframes()))

    last_active = 0
    for idx in range(len(pcm) - 1, -1, -1):
        if abs(pcm[idx]) > 18:
            last_active = idx
            break

    keep_len = min(len(pcm), max(220, last_active + 256))
    trimmed = pcm[:keep_len]
    fade_len = min(128, len(trimmed))
    for i in range(fade_len):
        pos = len(trimmed) - fade_len + i
        gain = 0.5 * (1.0 + math.cos(math.pi * (i + 1) / fade_len))
        trimmed[pos] = int(round(trimmed[pos] * gain))

    b64 = base64.b64encode(trimmed.tobytes()).decode("ascii")
    return sr, b64


def main():
    shutil.rmtree(OUT_DIR, ignore_errors=True)
    shutil.rmtree(LEGACY_PUBLIC_SFX_DIR, ignore_errors=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(SOUNDBANK_PATH), exist_ok=True)

    rendered = []
    clips_by_name: dict[str, list[str]] = {}
    sample_rate = 44100

    for i, (patch, variants) in enumerate(PATCHES):
        patch_path = os.path.join(PATCH_DIR, f"{patch['name']}.json")
        with open(patch_path, "w", encoding="utf-8") as f:
            json.dump(patch, f, indent=2)
        cmd = [sys.executable, SFX_PY, patch_path, "-o", OUT_DIR, "--seed", str(42 + i)]
        if variants > 1:
            cmd.extend(["--variants", str(variants)])
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[FAIL RENDER] {patch['name']}: {res.stdout}\n{res.stderr}")
            sys.exit(1)

        patch_files: list[str] = []
        if variants == 1:
            patch_files.append(os.path.join(OUT_DIR, f"{patch['name']}.wav"))
        else:
            for v in range(1, variants + 1):
                patch_files.append(os.path.join(OUT_DIR, f"{patch['name']}_{v:02d}.wav"))

        rendered.extend(patch_files)
        encoded_variants: list[str] = []
        for wf in patch_files:
            sr, b64 = trim_and_encode_wav(wf)
            sample_rate = sr
            encoded_variants.append(b64)
        clips_by_name[patch["name"]] = encoded_variants

    # Spit out spectrogram PNGs into sfx/preview so we can eyeball frequencies
    for key_name in (
        "shoot_blaster_01.wav",
        "hit_enemy_01.wav",
        "coin_pickup_01.wav",
        "enemy_explode_sm_01.wav",
        "warp_jump.wav",
        "boss_explode.wav",
    ):
        wav_p = os.path.join(OUT_DIR, key_name)
        subprocess.run([sys.executable, DOCTOR_PY, wav_p, "--png"], check=True)
        png_src = os.path.splitext(wav_p)[0] + ".png"
        png_dst = os.path.join(PREVIEW_DIR, os.path.splitext(key_name)[0] + ".png")
        if os.path.exists(png_src):
            os.replace(png_src, png_dst)

    print(f"RENDERED_WAV_COUNT={len(rendered)}")
    doc = subprocess.run([sys.executable, DOCTOR_PY, *rendered], capture_output=True, text=True)
    print(doc.stdout)
    if doc.returncode != 0:
        print(doc.stderr)
        sys.exit(doc.returncode)

    bank_payload = {
        "version": "20.6",
        "sampleRate": sample_rate,
        "clips": clips_by_name,
    }
    with open(SOUNDBANK_PATH, "w", encoding="utf-8") as bf:
        json.dump(bank_payload, bf, separators=(",", ":"))
    bank_size = os.path.getsize(SOUNDBANK_PATH)
    print(f"PACKED_SOUNDBANK={SOUNDBANK_PATH} ({bank_size} bytes, {len(clips_by_name)} keys, {len(rendered)} clips)")

if __name__ == "__main__":
    main()
