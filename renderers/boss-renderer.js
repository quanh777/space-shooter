// ============================================================
// BOSS RENDERER — Separated graphics for all boss types
// Replaces Boss.draw() with ultra-detailed, expressive designs
// ============================================================

function drawBoss(boss, ctx) {
    if (boss.teleporting && boss.teleportTimer < 200) return;
    if (boss.dying && boss.deathState >= 2) return; // Completely hidden during final cinematic flash

    ctx.save();
    const cx = boss.x + boss.w / 2, cy = boss.y + boss.h / 2;
    const t = Date.now();
    const r = boss.w / 2;
    const isResting = boss.state === 'RESTING';
    const br = Math.sin(boss.breathe) * 0.03;
    const recoilX = (Math.random() - 0.5) * boss.bodyRecoil * 8;
    const recoilY = -boss.bodyRecoil * 4;
    const p = boss.phase;
    const ce = boss.coreEnergy;
    const wu = boss.attackWindup;

    // ====== CHARGE TELEGRAPH ======
    if (boss.preChargeTimer > 0 && boss.chargeDirection) {
        ctx.save();
        const chargeRatio = 1 - boss.preChargeTimer / 90;
        const angle = Math.atan2(boss.chargeDirection.y, boss.chargeDirection.x);
        const perpX = Math.cos(angle + Math.PI / 2) * r;
        const perpY = Math.sin(angle + Math.PI / 2) * r;
        ctx.globalAlpha = 0.08 + chargeRatio * 0.15;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(cx + perpX, cy + perpY);
        ctx.lineTo(cx + perpX + boss.chargeDirection.x * 2000, cy + perpY + boss.chargeDirection.y * 2000);
        ctx.lineTo(cx - perpX + boss.chargeDirection.x * 2000, cy - perpY + boss.chargeDirection.y * 2000);
        ctx.lineTo(cx - perpX, cy - perpY);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ff3300';
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.025) * 0.2 + chargeRatio * 0.4;
        ctx.lineWidth = 2 + chargeRatio * 4;
        ctx.setLineDash([25 - chargeRatio * 20, 8]);
        ctx.beginPath();
        ctx.moveTo(cx + perpX, cy + perpY);
        ctx.lineTo(cx + perpX + boss.chargeDirection.x * 2000, cy + perpY + boss.chargeDirection.y * 2000);
        ctx.moveTo(cx - perpX, cy - perpY);
        ctx.lineTo(cx - perpX + boss.chargeDirection.x * 2000, cy - perpY + boss.chargeDirection.y * 2000);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ====== SNIPER TELEGRAPH ======
    if (boss.sniperActive && boss.sniperTimer > 0) {
        ctx.save();
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const angle = Math.atan2(py - cy, px - cx);
        const laserGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * 600, cy + Math.sin(angle) * 600);
        laserGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        laserGrad.addColorStop(0.3, 'rgba(255,255,100,0.3)');
        laserGrad.addColorStop(1, 'rgba(255,255,100,0)');
        ctx.strokeStyle = laserGrad;
        ctx.lineWidth = 2 + Math.sin(t * 0.04) * 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * 600, cy + Math.sin(angle) * 600);
        ctx.stroke();
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(px, py, 8 + Math.sin(t * 0.02) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ====== CHARGE TRAIL ======
    boss.chargeTrail.forEach(tr => {
        const ratio = tr.life / 20;
        ctx.globalAlpha = ratio * 0.5;
        ctx.fillStyle = boss.color;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, r * 0.4 * ratio, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // ====== SHIELD VISUAL ======
    if (boss.shieldActive) {
        const sr = r * 1.5 + Math.sin(t * 0.008) * 4;
        const shieldG = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, sr);
        shieldG.addColorStop(0, 'rgba(0,200,255,0.02)');
        shieldG.addColorStop(0.7, 'rgba(0,200,255,0.08)');
        shieldG.addColorStop(1, 'rgba(0,200,255,0.2)');
        ctx.fillStyle = shieldG;
        ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,200,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 6; i++) {
            const a1 = boss.rotation * 0.5 + (i / 6) * Math.PI * 2;
            const a2 = a1 + Math.PI / 6;
            ctx.strokeStyle = `rgba(0,200,255,${0.1 + Math.sin(t * 0.006 + i * 0.7) * 0.08})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * sr, cy + Math.sin(a1) * sr);
            ctx.lineTo(cx + Math.cos(a2) * sr, cy + Math.sin(a2) * sr);
            ctx.stroke();
        }
    }

    // ====== AURA GLOW ======
    const glowAmt = 12 + boss.pulse + (boss.enraged ? 15 : 0) + ce * 20;
    const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r + glowAmt);
    let auraColor;
    if (isResting) {
        auraColor = 'rgba(0,255,136,0.08)';
    } else if (boss.bossType === 0) {
        auraColor = `rgba(255,${Math.floor(50 + ce * 100)},0,${0.12 + ce * 0.12})`;
    } else if (boss.bossType === 1) {
        auraColor = `rgba(${Math.floor(120 + ce * 80)},50,255,${0.12 + ce * 0.12})`;
    } else {
        auraColor = `rgba(255,${Math.floor(180 + ce * 50)},0,${0.12 + ce * 0.12})`;
    }
    auraGrad.addColorStop(0, auraColor);
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r + glowAmt, 0, Math.PI * 2); ctx.fill();

    // ====== CLONE PHANTOM ======
    if (boss.clonesActive && boss.cloneTimer > 0) {
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.012) * 0.12;
        boss.clonePositions.forEach(pos => {
            const ccx = pos.x + boss.w / 2 + (Math.random() - 0.5) * 5;
            const ccy = pos.y + boss.h / 2 + (Math.random() - 0.5) * 5;
            ctx.fillStyle = boss.color; ctx.shadowColor = boss.color; ctx.shadowBlur = 25;
            ctx.beginPath(); ctx.arc(ccx, ccy, r * 0.9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = boss.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1; ctx.restore(); return;
    }

    // ====== TRANSITION FLASH ======
    if (boss.transitioning) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const tf = boss.transitionTimer / 60;
        ctx.fillStyle = `rgba(255,255,255,${tf * 0.4})`;
        ctx.beginPath(); ctx.arc(cx, cy, r * 2 * tf, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ====== CINEMATICS BACKGROUND ======
    if (typeof drawBossCinematics_Under === 'function') drawBossCinematics_Under(boss, ctx, cx, cy);

    // ====== MAIN BODY ======
    ctx.save();
    if (typeof applyBossCinematicTransforms === 'function') applyBossCinematicTransforms(boss, ctx, cx, cy);
    ctx.translate(cx + recoilX, cy + recoilY);

    if (!isResting) {
        const faceAngle = Math.atan2((playerY + PH / 2) - cy, (playerX + PW / 2) - cx);
        ctx.rotate(faceAngle - Math.PI / 2);
    }

    ctx.scale(1 + br, 1 + br);

    if (boss.bossType === 0) {
        drawDestroyer(boss, ctx, r, t, ce, wu, p, isResting);
    } else if (boss.bossType === 1) {
        drawSummoner(boss, ctx, r, t, ce, wu, p, isResting);
    } else {
        drawOverlord(boss, ctx, r, t, ce, wu, p, isResting);
    }

    ctx.restore();

    // ====== CINEMATICS FOREGROUND ======
    if (typeof drawBossCinematics_Over === 'function') drawBossCinematics_Over(boss, ctx, cx, cy);

    // ====== LASER CHARGE/FIRE ======
    if (boss.laserCharging) {
        ctx.save();
        const chargePct = 1 - boss.laserTimer / 1000;
        for (let i = 0; i < 3; i++) {
            const off = (i - 1) * 8;
            ctx.strokeStyle = `rgba(255,${180 - chargePct * 120},0,${0.15 + chargePct * 0.25})`;
            ctx.lineWidth = 1 + chargePct * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(boss.laserAngle + Math.PI / 2) * off, cy + Math.sin(boss.laserAngle + Math.PI / 2) * off);
            ctx.lineTo(cx + Math.cos(boss.laserAngle) * 250, cy + Math.sin(boss.laserAngle) * 250);
            ctx.stroke();
        }
        // Charge orb at muzzle
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,200,50,${chargePct * 0.8})`;
        ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 20 * chargePct;
        ctx.beginPath(); ctx.arc(cx + Math.cos(boss.laserAngle) * r * 0.6, cy + Math.sin(boss.laserAngle) * r * 0.6, 5 + chargePct * 10, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    if (boss.laserFiring) {
        const bw = 28 + Math.sin(t * 0.06) * 8;
        const lx = cx + Math.cos(boss.laserAngle) * 1500;
        const ly = cy + Math.sin(boss.laserAngle) * 1500;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,80,30,0.2)'; ctx.lineWidth = bw * 3.5;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,40,0,0.65)'; ctx.lineWidth = bw * 1.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,230,200,0.85)'; ctx.lineWidth = bw * 0.4;
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 35;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.shadowBlur = 0; ctx.restore();
    }

    // ====== MINES ======
    drawMines(boss, ctx, t);

    // ====== RESTING PARTICLES ======
    if (isResting && boss.ambientTimer % 40 === 0) {
        particles.push(new Particle(cx + (Math.random() - 0.5) * r, cy - r * 0.3, '#55ff88', 0.5, 2, 60));
    }

    ctx.restore();

    // ====== HEALTH BAR + NAME ======
    boss.drawHealthBar();
    ctx.save();
    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = boss.color; ctx.shadowColor = boss.color; ctx.shadowBlur = 10;
    ctx.fillText(boss.displayName, cx, boss.y - 14);
    ctx.shadowBlur = 0; ctx.restore();
}

// ============================================================
// DESTROYER (Type 0) — Armored War Machine
// ============================================================
function drawDestroyer(boss, ctx, r, t, ce, wu, phase, isResting) {
    const rot = boss.rotation;

    // === OUTER ARMORED HULL (8-sided with beveled edges) ===
    ctx.save(); ctx.rotate(rot);
    const hullG = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    hullG.addColorStop(0, '#3a2020');
    hullG.addColorStop(0.6, '#1a0a0a');
    hullG.addColorStop(1, '#0a0505');
    ctx.fillStyle = hullG;
    ctx.strokeStyle = '#552222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const indent = (i % 2 === 0) ? 0.95 : 0.88;
        const px = Math.cos(a) * r * indent;
        const py = Math.sin(a) * r * indent;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Panel lines
    ctx.strokeStyle = 'rgba(255,50,20,0.12)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
        ctx.stroke();
    }

    // Rivets
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rx = Math.cos(a) * r * 0.7, ry = Math.sin(a) * r * 0.7;
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(rx - 0.5, ry - 0.5, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // === REACTOR VENTS (Phase 2+: cracked hull reveals inner fire) ===
    if (boss.currentPhaseLevel > 0) {
        ctx.save(); ctx.rotate(rot * 1.1);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 8; i++) {
            const va = (i / 8) * Math.PI * 2;
            const ventAlpha = (0.15 + ce * 0.3 + (boss.currentPhaseLevel > 1 ? (boss.currentPhaseLevel - 1) * 0.3 : 0)) * Math.min(1, boss.currentPhaseLevel);
            ctx.strokeStyle = `rgba(255,${Math.floor(100 - boss.currentPhaseLevel * 30)},0,${ventAlpha})`;
            ctx.lineWidth = 1.5 + ce * 2;
            ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 8 * ventAlpha;
            ctx.beginPath();
            ctx.moveTo(Math.cos(va) * r * 0.35, Math.sin(va) * r * 0.35);
            ctx.quadraticCurveTo(
                Math.cos(va + 0.2) * r * 0.6, Math.sin(va + 0.2) * r * 0.6,
                Math.cos(va - 0.1) * r * 0.85, Math.sin(va - 0.1) * r * 0.85
            );
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    // === 8 DIAMOND-TIPPED SPIKES ===
    const spikeRetract = boss.restProgress * r * 0.3;
    const spikeExtend = wu * r * 0.2 * (1 - boss.restProgress);
    const sLen = r * 0.5 + spikeExtend - spikeRetract + (boss.enraged ? r * 0.15 : 0);

    for (let i = 0; i < 8; i++) {
        const ang = -rot * 0.5 + (i / 8) * Math.PI * 2;
        const base = r * 0.85;
        const bx = Math.cos(ang) * base, by = Math.sin(ang) * base;
        const tx = Math.cos(ang) * (base + sLen), ty = Math.sin(ang) * (base + sLen);
        const perpAng = ang + Math.PI / 2;
        const w = 6 + wu * 3;

        // Spike body gradient
        const sg = ctx.createLinearGradient(bx, by, tx, ty);
        sg.addColorStop(0, '#551111');
        sg.addColorStop(0.3, '#aa2222');
        sg.addColorStop(0.7, '#ff3333');
        sg.addColorStop(1, '#ffffff');
        ctx.fillStyle = sg;
        ctx.strokeStyle = '#330000';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(perpAng) * w, by + Math.sin(perpAng) * w);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - Math.cos(perpAng) * w, by - Math.sin(perpAng) * w);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // Hot conduit on spike
        if (!isResting) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255,200,100,${0.3 + ce * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx * 1.05, by * 1.05);
            ctx.lineTo(tx * 0.9, ty * 0.9);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // === ATTACK FLASH VENTS ===
    if (boss.attackFlash > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
            const wa = rot + (i / 4) * Math.PI * 2;
            const wx = Math.cos(wa) * r * 0.55, wy = Math.sin(wa) * r * 0.55;
            ctx.fillStyle = `rgba(255,200,100,${boss.attackFlash * 0.6})`;
            ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 15 * boss.attackFlash;
            ctx.beginPath(); ctx.arc(wx, wy, 5 + boss.attackFlash * 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
    }

    // === VOLCANIC CORE ===
    const coreR = r * 0.38;
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    cg.addColorStop(0, `rgba(255,255,255,${0.5 + ce * 0.5})`);
    cg.addColorStop(0.2, `rgba(255,${Math.floor(200 * ce)},${Math.floor(50 * ce)},${0.4 + ce * 0.5})`);
    cg.addColorStop(0.6, `rgba(200,${Math.floor(40 * ce)},0,${ce * 0.5})`);
    cg.addColorStop(1, 'rgba(80,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();

    // Inner ring
    ctx.strokeStyle = `rgba(255,100,0,${0.2 + ce * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, coreR * 0.7, 0, Math.PI * 2); ctx.stroke();

    // === EYE / EXPRESSION ===
    ctx.save();

    // Sleeping slit
    if (boss.eyeOpenness < 1) {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(8, 2); ctx.stroke();
    }

    if (boss.eyeOpenness > 0.05) {
        ctx.scale(1, boss.eyeOpenness);
        // Active eye that tracks player
        // Since the whole body rotates to face the player, the player is always at Math.PI / 2 locally.
        const ea = Math.PI / 2;
        const eyeOff = 4;
        // Eye housing
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.arc(0, 0, coreR * 0.5, 0, Math.PI * 2); ctx.fill();
        // Pupil
        ctx.fillStyle = boss.enraged ? '#ff0000' : '#cc2200';
        ctx.shadowColor = boss.enraged ? '#ff0000' : '#cc2200';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(Math.cos(ea) * eyeOff, Math.sin(ea) * eyeOff, coreR * 0.2, 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(Math.cos(ea) * eyeOff - 2, Math.sin(ea) * eyeOff - 2, coreR * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Angry brow when enraged
        if (boss.enraged) {
            ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-coreR * 0.4, -coreR * 0.35);
            ctx.lineTo(0, -coreR * 0.2);
            ctx.lineTo(coreR * 0.4, -coreR * 0.35);
            ctx.stroke();
        }
    }
    ctx.restore();

    if (isResting && boss.eyeOpenness < 0.5) {
        ctx.fillStyle = `rgba(0,255,100,${(0.5 - boss.eyeOpenness) * 2 * (0.3 + Math.sin(t * 0.003) * 0.2)})`;
        ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
        ctx.fillText('z', r * 0.25, -r * 0.2);
        ctx.fillText('Z', r * 0.35, -r * 0.35);
    }

    // Hit flash overlay
    if (boss.hitFlash > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${boss.hitFlash * 0.5})`;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
}

// ============================================================
// SUMMONER (Type 1) — Eldritch Crystal Entity
// ============================================================
function drawSummoner(boss, ctx, r, t, ce, wu, phase, isResting) {
    const rot = boss.rotation;

    // === DIAMOND HULL ===
    ctx.save(); ctx.rotate(rot);
    const vertices = [
        { x: 0, y: -r * 1.15 }, { x: r * 0.95, y: 0 },
        { x: 0, y: r * 1.15 }, { x: -r * 0.95, y: 0 }
    ];
    const faceColors = [
        ['#4a0088', '#2a0055'], ['#5a00aa', '#350066'],
        ['#3a0077', '#220044'], ['#480099', '#2d0055']
    ];
    for (let i = 0; i < 4; i++) {
        const v1 = vertices[i], v2 = vertices[(i + 1) % 4];
        const facGrad = ctx.createLinearGradient(0, 0, v1.x, v1.y);
        facGrad.addColorStop(0, faceColors[i][0]);
        facGrad.addColorStop(1, faceColors[i][1]);
        ctx.fillStyle = facGrad;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y);
        ctx.closePath(); ctx.fill();
    }
    // Edge highlight
    ctx.strokeStyle = '#aa44ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    vertices.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
    ctx.closePath(); ctx.stroke();

    // Inner energy lines
    ctx.strokeStyle = `rgba(180,80,255,${0.15 + ce * 0.3})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vertices[i].x * 0.85, vertices[i].y * 0.85);
        ctx.stroke();
    }
    ctx.restore();

    // === 4 ORGANIC TENTACLE CLAWS ===
    const clawRetract = boss.restProgress * 0.4;
    for (let i = 0; i < 4; i++) {
        const ca = rot * 0.7 + (i / 4) * Math.PI * 2 + Math.sin(t * 0.003 + i) * 0.15;
        const clawLen = r * (0.8 + wu * 0.3 - clawRetract);

        ctx.save();
        ctx.rotate(ca);
        ctx.translate(r * 0.6, 0);

        // Tentacle segments
        const segG = ctx.createLinearGradient(0, 0, clawLen, 0);
        segG.addColorStop(0, '#330055');
        segG.addColorStop(0.5, '#6600aa');
        segG.addColorStop(1, '#cc44ff');
        ctx.fillStyle = segG;
        ctx.strokeStyle = '#220033';
        ctx.lineWidth = 1.5;

        const wave = Math.sin(t * 0.005 + i * 1.5) * 4;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.quadraticCurveTo(clawLen * 0.5, -6 + wave, clawLen, -2);
        ctx.lineTo(clawLen + 5, 0);
        ctx.lineTo(clawLen, 2);
        ctx.quadraticCurveTo(clawLen * 0.5, 6 - wave, 0, 5);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // Claw tip glow
        if (!isResting) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(200,100,255,${0.3 + ce * 0.4})`;
            ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(clawLen, 0, 4 + ce * 3, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    // === Phase 2+: Orbiting crystal shards ===
    if (boss.currentPhaseLevel > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const shardCount = 8;
        for (let i = 0; i < shardCount; i++) {
            if (i >= 5 && boss.currentPhaseLevel <= 1) continue; // Show extra shards only in phase 3 smoothly
            const sa = t * 0.004 + (i / shardCount) * Math.PI * 2;
            const phaseScale = i >= 5 ? boss.currentPhaseLevel - 1 : Math.min(1, boss.currentPhaseLevel);
            const sd = r * (1.1 + Math.sin(t * 0.002 + i) * 0.15) * Math.max(0.1, phaseScale);
            const sx = Math.cos(sa) * sd, sy = Math.sin(sa) * sd;
            ctx.fillStyle = `rgba(200,100,255,${(0.3 + Math.sin(t * 0.008 + i) * 0.2) * Math.min(1, phaseScale * 2)})`;
            ctx.shadowColor = '#cc66ff'; ctx.shadowBlur = 6;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa * 2);
            ctx.fillRect(-3, -6, 6, 12);
            ctx.restore();
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
    }

    // === VOID CENTER ===
    const voidR = r * 0.32;
    const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, voidR);
    vg.addColorStop(0, `rgba(220,150,255,${0.4 + ce * 0.5})`);
    vg.addColorStop(0.3, `rgba(150,50,220,${0.3 + ce * 0.4})`);
    vg.addColorStop(0.7, `rgba(60,0,120,${ce * 0.3})`);
    vg.addColorStop(1, 'rgba(20,0,40,0)');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.arc(0, 0, voidR, 0, Math.PI * 2); ctx.fill();

    // === EXPRESSION ===
    ctx.save();

    if (boss.eyeOpenness < 1) {
        // Dormant: small dim dot
        ctx.fillStyle = `rgba(150,80,200,${(1 - boss.eyeOpenness) * (0.3 + Math.sin(t * 0.002) * 0.15)})`;
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }

    if (boss.eyeOpenness > 0.05) {
        ctx.scale(1, boss.eyeOpenness);
        // Active: pulsing void pupil
        ctx.fillStyle = boss.enraged ? '#ff00ff' : '#cc88ff';
        ctx.shadowColor = boss.enraged ? '#ff00ff' : '#aa44ff';
        ctx.shadowBlur = 12;
        const pupilR = 5 + ce * 3 + Math.sin(t * 0.006) * 2;
        ctx.beginPath(); ctx.arc(0, 0, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.5, -1.5, pupilR * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        if (boss.enraged) {
            // Angry: spiky iris rays
            ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + t * 0.01;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * pupilR, Math.sin(a) * pupilR);
                ctx.lineTo(Math.cos(a) * (pupilR + 8), Math.sin(a) * (pupilR + 8));
                ctx.stroke();
            }
        }
    }
    ctx.restore();

    if (isResting && boss.eyeOpenness < 0.5) {
        ctx.fillStyle = `rgba(180,100,255,${(0.5 - boss.eyeOpenness) * 2 * (0.3 + Math.sin(t * 0.003) * 0.2)})`;
        ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
        ctx.fillText('z', r * 0.2, -r * 0.2);
        ctx.fillText('Z', r * 0.3, -r * 0.35);
    }

    // Hit flash
    if (boss.hitFlash > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(220,150,255,${boss.hitFlash * 0.5})`;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
}

// ============================================================
// OVERLORD (Type 2) — Mechanical Sun Emperor
// ============================================================
function drawOverlord(boss, ctx, r, t, ce, wu, phase, isResting) {
    const rot = boss.rotation;

    // === GEAR BODY ===
    ctx.save(); ctx.rotate(rot);
    const teeth = 12;
    const toothH = r * 0.18 + (-boss.restProgress * r * -0.05 + (1 - boss.restProgress) * wu * r * 0.05);
    const bodyG = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
    bodyG.addColorStop(0, '#4a3a10');
    bodyG.addColorStop(0.5, '#2a1a08');
    bodyG.addColorStop(1, '#120a04');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
        const a3 = ((i + 1) / teeth) * Math.PI * 2;
        ctx.lineTo(Math.cos(a1) * (r - toothH), Math.sin(a1) * (r - toothH));
        ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
        ctx.lineTo(Math.cos(a3) * (r - toothH), Math.sin(a3) * (r - toothH));
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#665520'; ctx.lineWidth = 2; ctx.stroke();

    // Hub ring
    ctx.strokeStyle = `rgba(255,200,50,${0.2 + ce * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // === 4 ARTICULATED ARMS ===
    const armRetract = boss.restProgress * 0.3;
    for (let i = 0; i < 4; i++) {
        const aa = rot * 0.6 + (i / 4) * Math.PI * 2;
        const armLen = r * (0.7 + wu * 0.2 - armRetract);

        ctx.save(); ctx.rotate(aa); ctx.translate(r * 0.5, 0);

        // Upper arm
        const armG = ctx.createLinearGradient(0, 0, armLen * 0.6, 0);
        armG.addColorStop(0, '#333');
        armG.addColorStop(1, '#111');
        ctx.fillStyle = armG;
        ctx.fillRect(0, -4, armLen * 0.6, 8);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.strokeRect(0, -4, armLen * 0.6, 8);

        // Joint
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(armLen * 0.6, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.stroke();

        // Forearm + weapon pod
        const foreG = ctx.createLinearGradient(armLen * 0.6, 0, armLen, 0);
        foreG.addColorStop(0, '#222');
        foreG.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = foreG;
        ctx.fillRect(armLen * 0.55, -3, armLen * 0.45, 6);

        // Weapon pod glow
        if (!isResting) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255,200,50,${0.2 + ce * 0.3})`;
            ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(armLen, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    // === Phase 2+: Energy conduits between arms ===
    if (boss.currentPhaseLevel > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
            const a1 = rot * 0.6 + (i / 4) * Math.PI * 2;
            const a2 = rot * 0.6 + ((i + 1) / 4) * Math.PI * 2;
            const x1 = Math.cos(a1) * r * 0.9, y1 = Math.sin(a1) * r * 0.9;
            const x2 = Math.cos(a2) * r * 0.9, y2 = Math.sin(a2) * r * 0.9;
            const alpha = (0.15 + Math.sin(t * 0.005 + i) * 0.1 + (boss.currentPhaseLevel > 1 ? (boss.currentPhaseLevel - 1) * 0.2 : 0)) * Math.min(1, boss.currentPhaseLevel);
            ctx.strokeStyle = `rgba(255,200,50,${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(0, 0, x2, y2);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // === SUN CORE ===
    const sunR = r * 0.35;
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sunR);
    sg.addColorStop(0, `rgba(255,255,200,${0.5 + ce * 0.5})`);
    sg.addColorStop(0.2, `rgba(255,220,50,${0.4 + ce * 0.5})`);
    sg.addColorStop(0.5, `rgba(255,150,0,${0.3 + ce * 0.3})`);
    sg.addColorStop(1, 'rgba(150,80,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(0, 0, sunR, 0, Math.PI * 2); ctx.fill();

    // Solar flares (Phase 3)
    if (boss.currentPhaseLevel > 1) {
        const flareAlpha = boss.currentPhaseLevel - 1;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
            const fa = t * 0.003 + (i / 5) * Math.PI * 2;
            const fl = sunR * (0.5 + Math.sin(t * 0.008 + i * 2) * 0.3) * flareAlpha;
            ctx.strokeStyle = `rgba(255,200,50,${(0.3 + Math.sin(t * 0.006 + i) * 0.2) * flareAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(fa) * sunR * 0.8, Math.sin(fa) * sunR * 0.8);
            ctx.lineTo(Math.cos(fa) * (sunR + fl), Math.sin(fa) * (sunR + fl));
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // === VISOR EXPRESSION ===
    ctx.save();

    if (boss.eyeOpenness < 1) {
        // Sleeping visor: dim horizontal lines
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-4, -2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(10, -2); ctx.stroke();
    }

    if (boss.eyeOpenness > 0.05) {
        ctx.scale(1, boss.eyeOpenness);
        // LED visor
        const visorG = ctx.createLinearGradient(-12, 0, 12, 0);
        visorG.addColorStop(0, '#000');
        visorG.addColorStop(0.2, boss.enraged ? '#ff4400' : '#ffcc00');
        visorG.addColorStop(0.5, boss.enraged ? '#ff8800' : '#ffee88');
        visorG.addColorStop(0.8, boss.enraged ? '#ff4400' : '#ffcc00');
        visorG.addColorStop(1, '#000');
        ctx.fillStyle = visorG;
        ctx.shadowColor = boss.enraged ? '#ff4400' : '#ffcc00';
        ctx.shadowBlur = 8;
        // Visor shape
        ctx.beginPath();
        ctx.moveTo(-12, -4); ctx.lineTo(-8, -6); ctx.lineTo(8, -6); ctx.lineTo(12, -4);
        ctx.lineTo(12, 0); ctx.lineTo(8, 2); ctx.lineTo(-8, 2); ctx.lineTo(-12, 0);
        ctx.closePath(); ctx.fill();

        // Eye dots
        ctx.fillStyle = boss.enraged ? '#ffffff' : '#ffffcc';
        ctx.beginPath(); ctx.arc(-5, -2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        if (boss.enraged) {
            ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-5, -5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(5, -5); ctx.stroke();
        }
    }
    ctx.restore();

    if (isResting && boss.eyeOpenness < 0.5) {
        ctx.fillStyle = `rgba(255,200,50,${(0.5 - boss.eyeOpenness) * 2 * (0.3 + Math.sin(t * 0.003) * 0.2)})`;
        ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
        ctx.fillText('z', r * 0.25, -r * 0.2);
        ctx.fillText('Z', r * 0.35, -r * 0.35);
    }

    // Hit flash
    if (boss.hitFlash > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,220,100,${boss.hitFlash * 0.5})`;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // Attack flash vents
    if (boss.attackFlash > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
            const wa = rot + (i / 4) * Math.PI * 2 + Math.PI / 4;
            const wx = Math.cos(wa) * r * 0.5, wy = Math.sin(wa) * r * 0.5;
            ctx.fillStyle = `rgba(255,220,50,${boss.attackFlash * 0.5})`;
            ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 12 * boss.attackFlash;
            ctx.beginPath(); ctx.arc(wx, wy, 4 + boss.attackFlash * 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
    }
}

// ============================================================
// MINES — Tactical Bombs with Radar Countdown
// ============================================================
function drawMines(boss, ctx, t) {
    boss.mines.forEach(m => {
        const danger = m.timer < 1000;
        const pulse = Math.sin(m.pulse * (danger ? 8 : 2)) * 0.3 + 0.7;
        const mr = m.homing ? 18 : 14;
        ctx.save(); ctx.translate(m.x, m.y);

        // Metallic shell
        const shellG = ctx.createRadialGradient(-mr * 0.3, -mr * 0.3, 0, 0, 0, mr);
        shellG.addColorStop(0, '#666');
        shellG.addColorStop(0.4, '#333');
        shellG.addColorStop(0.8, '#111');
        shellG.addColorStop(1, '#000');
        ctx.fillStyle = shellG;
        ctx.beginPath(); ctx.arc(0, 0, mr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, mr, 0, Math.PI * 2); ctx.stroke();

        // Inner core
        ctx.globalCompositeOperation = 'lighter';
        const coreColor = danger ? `rgba(255,50,0,${pulse})` : `rgba(${m.color === '#ffcc00' ? '255,200,0' : '170,0,255'},${0.5 + pulse * 0.3})`;
        ctx.fillStyle = coreColor;
        ctx.shadowColor = danger ? '#ff2200' : m.color;
        ctx.shadowBlur = 10 + (danger ? pulse * 15 : 0);
        ctx.beginPath(); ctx.arc(0, 0, mr * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';

        // Cross bolts
        ctx.fillStyle = '#444';
        ctx.fillRect(-mr * 0.5, -1.5, mr, 3);
        ctx.fillRect(-1.5, -mr * 0.5, 3, mr);

        // Countdown arc
        const tr = m.timer / 5000;
        const sweepAngle = -Math.PI / 2 + Math.PI * 2 * tr;
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        if (danger) {
            ctx.strokeStyle = `rgba(255,30,0,${pulse})`;
            ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8;
        } else {
            ctx.strokeStyle = 'rgba(255,255,100,0.7)';
        }
        ctx.beginPath(); ctx.arc(0, 0, mr + 5, -Math.PI / 2, sweepAngle); ctx.stroke();
        ctx.shadowBlur = 0;

        // Sweep tip
        ctx.fillStyle = danger ? '#ff4400' : '#ffff88';
        ctx.beginPath();
        ctx.arc(Math.cos(sweepAngle) * (mr + 5), Math.sin(sweepAngle) * (mr + 5), 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}
