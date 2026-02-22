function drawPlayer() {
    const cx = playerX + PW / 2, cy = playerY + PH / 2;
    ctx.save();

    const angle = (dirX != 0 || dirY != 0) ? Math.atan2(dirY, dirX) : -Math.PI / 2;
    const isMoving = dirX != 0 || dirY != 0;
    const t = Date.now();
    const hw = PW / 2, hh = PH / 2;

    const timeSinceSkill = t - skill.lastUse;
    const cdRatio = Math.min(1, timeSinceSkill / skill.cooldown);
    const isReady = cdRatio === 1 && energy >= skill.cost;
    const justCast = timeSinceSkill < 300;

    ctx.translate(cx, cy);
    ctx.rotate(angle + Math.PI / 2);

    if (isMoving) {
        const thrustColor = isSliding ? '#00ffff' : '#ff5500';
        const coreColor = isSliding ? '#ffffff' : '#ffccaa';
        const thrustLen = (isSliding ? 60 : 30) + Math.random() * 15;
        const coreLen = thrustLen * 0.6;

        const drawThrust = (xOffset) => {
            const grad = ctx.createLinearGradient(0, hh * 0.3, 0, hh * 0.3 + thrustLen);
            grad.addColorStop(0, thrustColor);
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.shadowBlur = 15;
            ctx.shadowColor = thrustColor;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(xOffset - hw * 0.2, hh * 0.3);
            ctx.lineTo(xOffset, hh * 0.3 + thrustLen);
            ctx.lineTo(xOffset + hw * 0.2, hh * 0.3);
            ctx.fill();

            const gradCore = ctx.createLinearGradient(0, hh * 0.3, 0, hh * 0.3 + coreLen);
            gradCore.addColorStop(0, coreColor);
            gradCore.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = gradCore;
            ctx.beginPath();
            ctx.moveTo(xOffset - hw * 0.1, hh * 0.3);
            ctx.lineTo(xOffset, hh * 0.3 + coreLen);
            ctx.lineTo(xOffset + hw * 0.1, hh * 0.3);
            ctx.fill();

            ctx.shadowBlur = 0;
            const rings = isSliding ? 6 : 3;
            ctx.strokeStyle = coreColor;
            for (let i = 1; i <= rings; i++) {
                const ringY = hh * 0.3 + (i / rings) * coreLen;
                const ringW = hw * 0.15 * (1 - i / rings) + 1;
                ctx.globalAlpha = Math.max(0, 1 - (i / rings));
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(xOffset, ringY, ringW, ringW * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        };

        drawThrust(-hw * 0.35);
        drawThrust(hw * 0.35);
    }

    if (isSliding) {
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(0, -hh * 1.5);
        ctx.quadraticCurveTo(hw * 1.5, -hh * 0.5, hw * 1.8, hh);
        ctx.moveTo(0, -hh * 1.5);
        ctx.quadraticCurveTo(-hw * 1.5, -hh * 0.5, -hw * 1.8, hh);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, -hh * 1.5);
        ctx.quadraticCurveTo(hw * 1.5, -hh * 0.5, hw * 1.8, hh);
        ctx.lineTo(-hw * 1.8, hh);
        ctx.quadraticCurveTo(-hw * 1.5, -hh * 0.5, 0, -hh * 1.5);
        ctx.fill();
        ctx.restore();

        ctx.scale(0.8, 1.3);
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const wingGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    wingGrad.addColorStop(0, '#2c3e50');
    wingGrad.addColorStop(0.5, '#4a627a');
    wingGrad.addColorStop(1, '#2c3e50');

    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(0, -hh * 0.4);
    ctx.lineTo(hw * 1.1, hh * 0.2);
    ctx.lineTo(hw * 0.9, hh * 0.5);
    ctx.lineTo(hw * 0.3, hh * 0.3);
    ctx.lineTo(0, hh * 0.45);
    ctx.lineTo(-hw * 0.3, hh * 0.3);
    ctx.lineTo(-hw * 0.9, hh * 0.5);
    ctx.lineTo(-hw * 1.1, hh * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#1a2530';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetY = 0;

    const shotRecoil = Math.max(0, 1 - (t - lastShot) / 100);
    const gunRecoilOff = shotRecoil * 5;

    const drawGun = (sideX) => {
        ctx.fillStyle = '#111822';
        ctx.beginPath();
        ctx.moveTo(sideX - 4, -hh * 0.05);
        ctx.lineTo(sideX + 4, -hh * 0.05);
        ctx.lineTo(sideX + 5, hh * 0.25);
        ctx.lineTo(sideX - 5, hh * 0.25);
        ctx.fill();
        ctx.strokeStyle = '#334455';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#334455';
        ctx.fillRect(sideX - 2.5, -hh * 0.15 + gunRecoilOff, 5, 12);

        const barrelGrad = ctx.createLinearGradient(0, -hh * 0.2 + gunRecoilOff, 0, -hh * 0.05 + gunRecoilOff);
        barrelGrad.addColorStop(0, '#99aabb');
        barrelGrad.addColorStop(1, '#556677');
        ctx.fillStyle = barrelGrad;
        ctx.fillRect(sideX - 1.5, -hh * 0.25 + gunRecoilOff, 3, 10);

        ctx.fillStyle = '#0ff';
        ctx.fillRect(sideX - 0.5, -hh * 0.2 + gunRecoilOff, 1, 5);

        if (shotRecoil > 0.5) {
            ctx.fillStyle = '#00ffcc';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(sideX, -hh * 0.25 + gunRecoilOff - 2, 5 * shotRecoil, 3 * shotRecoil, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = `rgba(0, 255, 204, ${shotRecoil})`;
            ctx.beginPath();
            ctx.moveTo(sideX, -hh * 0.25 + gunRecoilOff - 4);
            ctx.lineTo(sideX, -hh * 0.25 + gunRecoilOff - 12);
            ctx.stroke();
        }
    };

    drawGun(-hw * 0.65);
    drawGun(hw * 0.65);

    ctx.fillStyle = '#3a4f6b';
    ctx.beginPath();
    ctx.moveTo(0, -hh * 0.4);
    ctx.lineTo(hw * 0.8, hh * 0.1);
    ctx.lineTo(hw * 0.3, hh * 0.2);
    ctx.lineTo(0, hh * 0.1);
    ctx.lineTo(-hw * 0.3, hh * 0.2);
    ctx.lineTo(-hw * 0.8, hh * 0.1);
    ctx.fill();
    ctx.strokeStyle = '#5a789c';
    ctx.lineWidth = 1;
    ctx.stroke();

    const hullGrad = ctx.createLinearGradient(0, -hh * 0.9, 0, hh * 0.4);
    hullGrad.addColorStop(0, '#ffffff');
    hullGrad.addColorStop(0.3, '#daddf0');
    hullGrad.addColorStop(1, '#667799');

    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(0, -hh * 0.95);
    ctx.lineTo(hw * 0.3, -hh * 0.2);
    ctx.lineTo(hw * 0.35, hh * 0.3);
    ctx.lineTo(hw * 0.15, hh * 0.45);
    ctx.lineTo(0, hh * 0.35);
    ctx.lineTo(-hw * 0.15, hh * 0.45);
    ctx.lineTo(-hw * 0.35, hh * 0.3);
    ctx.lineTo(-hw * 0.3, -hh * 0.2);
    ctx.closePath();
    ctx.fill();

    const cxL = -hw * 0.35;
    const cxR = hw * 0.35;
    const cyLed = hh * 0.35;

    ctx.fillStyle = '#0a0f18';
    ctx.beginPath(); ctx.ellipse(cxL, cyLed, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cxR, cyLed, 5, 2, 0, 0, Math.PI * 2); ctx.fill();

    if (justCast) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(cxL, cyLed, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cxR, cyLed, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        if (isReady) {
            const readyPulse = Math.sin(t * 0.005) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(0, 255, 255, ${0.5 + 0.5 * readyPulse})`;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 4 + 2 * readyPulse;
        } else {
            ctx.fillStyle = '#ff5500';
            ctx.shadowBlur = 0;
        }

        ctx.beginPath(); ctx.ellipse(cxL, cyLed, 4 * cdRatio, 1.5 * cdRatio, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cxR, cyLed, 4 * cdRatio, 1.5 * cdRatio, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -hh * 0.9); ctx.lineTo(0, hh * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-hw * 0.15, -hh * 0.1); ctx.lineTo(hw * 0.15, -hh * 0.1); ctx.stroke();
    ctx.globalAlpha = 1;

    const cockpitGrad = ctx.createLinearGradient(0, -hh * 0.3, 0, hh * 0.1);
    cockpitGrad.addColorStop(0, '#00e5ff');
    cockpitGrad.addColorStop(1, '#004488');

    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.moveTo(0, -hh * 0.45);
    ctx.quadraticCurveTo(hw * 0.25, -hh * 0.2, hw * 0.15, hh * 0.1);
    ctx.lineTo(-hw * 0.15, hh * 0.1);
    ctx.quadraticCurveTo(-hw * 0.25, -hh * 0.2, 0, -hh * 0.45);
    ctx.fill();

    ctx.strokeStyle = '#aaffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.06, -hh * 0.25, 2, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    const glowPulse = Math.sin(t * 0.005) * 0.5 + 0.5;
    let coreGlow = 0.5 + 0.5 * glowPulse;

    if (justCast) {
        coreGlow = 2.5;
    } else if (isReady) {
        coreGlow = 1.0 + 0.5 * glowPulse;
    }

    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = justCast ? 20 : (isReady ? 12 : 6);

    ctx.fillStyle = `rgba(0, 255, 255, ${Math.min(1, coreGlow)})`;
    ctx.beginPath(); ctx.arc(0, hh * 0.2, 4 + (isReady ? glowPulse : 0) + (justCast ? 2 : 0), 0, Math.PI * 2); ctx.fill();

    if (justCast || isReady) {
        ctx.fillStyle = `rgba(255, 255, 255, ${justCast ? 1 : 0.4})`;
        ctx.beginPath(); ctx.arc(0, hh * 0.2, 2 + (justCast ? 2 : 0), 0, Math.PI * 2); ctx.fill();
    }

    ctx.shadowBlur = 0;

    ctx.restore();

    if (invincible) {
        ctx.save();

        const shieldDuration = 1250 + (shopItems["Shield"].b * 750);
        const remainingShield = shieldDuration - (t - invTime);
        const fadeRatio = Math.max(0, Math.min(1, remainingShield / 1500));

        if (fadeRatio > 0.01) {
            ctx.translate(cx, cy);

            const pulse = Math.sin(t * 0.005) * 0.15 + 0.85;
            const r = PW * 0.85 + Math.sin(t * 0.008) * 3;

            const spinMult = 1 + (1 - fadeRatio) * 3;
            const expandOffset = (1 - fadeRatio) * 12;

            ctx.globalAlpha = pulse * fadeRatio;
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 18;

            const sGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r + expandOffset + 5);
            sGrad.addColorStop(0, 'rgba(0, 255, 204, 0)');
            sGrad.addColorStop(0.7, `rgba(0, 255, 204, ${0.15 * fadeRatio})`);
            sGrad.addColorStop(1, `rgba(0, 200, 255, ${0.45 * fadeRatio})`);

            ctx.fillStyle = sGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r + expandOffset + 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r + expandOffset + 5, 0, Math.PI * 2);
            ctx.clip();

            ctx.rotate(t * 0.0005 * spinMult);
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.4 * fadeRatio})`;
            ctx.lineWidth = 1;

            const hexSize = 10;
            const h = Math.sqrt(3) * hexSize;
            const gridW = r * 3;
            const gridH = r * 3;

            ctx.beginPath();
            for (let y = -gridH; y <= gridH; y += h) {
                let offsetIndex = 0;
                for (let x = -gridW; x <= gridW; x += hexSize * 1.5) {
                    const yOffset = (offsetIndex % 2 === 0) ? 0 : h / 2;
                    const cxHex = x;
                    const cyHex = y + yOffset;

                    if (cxHex * cxHex + cyHex * cyHex < (r + expandOffset + 15) ** 2) {
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const px = cxHex + hexSize * Math.cos(angle);
                            const py = cyHex + hexSize * Math.sin(angle);
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.lineTo(cxHex + hexSize * Math.cos(0), cyHex + hexSize * Math.sin(0));
                    }
                    offsetIndex++;
                }
            }
            ctx.stroke();
            ctx.restore();

            ctx.lineWidth = 2.5;
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.8 * fadeRatio})`;
            ctx.beginPath();
            ctx.arc(0, 0, r + expandOffset, 0, Math.PI * 2);
            ctx.stroke();

            ctx.lineWidth = 3;
            const t1 = t * 0.002 * spinMult;
            ctx.setLineDash([15, 10, 5, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, r - 4 + expandOffset * 0.6, t1, t1 + Math.PI * 2);
            ctx.stroke();

            ctx.lineWidth = 2;
            const t2 = t * -0.0025 * spinMult;
            ctx.setLineDash([8, 12, 20, 15]);
            ctx.strokeStyle = `rgba(0, 200, 255, ${0.9 * fadeRatio})`;
            ctx.beginPath();
            ctx.arc(0, 0, r + 4 + expandOffset * 1.2, t2, t2 + Math.PI * 2);
            ctx.stroke();

            ctx.setLineDash([]);

            if (Math.random() < 0.4 * fadeRatio) {
                const sa = Math.random() * Math.PI * 2;
                particles.push(new Particle(
                    cx + Math.cos(sa) * (r + expandOffset), cy + Math.sin(sa) * (r + expandOffset),
                    '#00ffcc', 1.5, 3, 15
                ));
            }
        }

        ctx.restore();
    }
}

function drawGradientBar(x, y, w, h, val, maxVal, colors, label) {
    ctx.fillStyle = `rgb(${colors.bg.r},${colors.bg.g},${colors.bg.b})`;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    const fill = Math.min(w, Math.floor(val / maxVal * w));
    if (fill > 0) {
        const colSet = val > maxVal * 0.7 ? colors.high : (val > maxVal * 0.3 ? colors.mid : colors.low);
        const barGrad = ctx.createLinearGradient(x, y, x + fill, y);
        barGrad.addColorStop(0, `rgb(${colSet.r},${colSet.g},${colSet.b})`);
        barGrad.addColorStop(1, `rgb(${Math.min(255, colSet.r + 40)},${Math.min(255, colSet.g + 40)},${Math.min(255, colSet.b + 40)})`);
        ctx.fillStyle = barGrad;
        ctx.beginPath(); ctx.roundRect(x, y, fill, h, h / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.roundRect(x + 2, y + 1, Math.max(0, fill - 4), h / 2 - 1, h / 4); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '11px Arial';
    ctx.fillText(label, x + w + 5, y + h - 1);
}

function drawUI() {
    drawGradientBar(10, 30, 110, 10, playerHealth, maxHealth, {
        bg: { r: 40, g: 10, b: 10 }, bg2: { r: 80, g: 40, b: 40 },
        high: { r: 100, g: 200, b: 30 }, mid: { r: 200, g: 200, b: 30 }, low: { r: 200, g: 30, b: 30 }
    }, 'HP');

    drawGradientBar(10, 10, 110, 10, energy, 100, {
        bg: { r: 20, g: 20, b: 60 }, bg2: { r: 50, g: 50, b: 120 },
        high: { r: 30, g: 100, b: 200 }, mid: { r: 30, g: 100, b: 200 }, low: { r: 30, g: 100, b: 200 }
    }, 'EN');

    const now = Date.now();

    if (now - lastSlide < 2000) {
        const pct = (now - lastSlide) / 2000;
        ctx.fillStyle = 'rgba(0,200,255,0.3)';
        ctx.beginPath(); ctx.roundRect(10, 23, Math.floor(110 * pct), 3, 1.5); ctx.fill();
    }

    const sx = 10, sy = H - 60;
    const skillCx = sx + 20, skillCy = sy + 20;
    const cdPct = (now - skill.lastUse) / skill.cooldown;

    ctx.fillStyle = 'rgba(30,10,10,0.7)';
    ctx.beginPath(); ctx.arc(skillCx, skillCy, 22, 0, Math.PI * 2); ctx.fill();

    const skillGrad = ctx.createRadialGradient(skillCx, skillCy, 0, skillCx, skillCy, 18);
    skillGrad.addColorStop(0, '#ff4444');
    skillGrad.addColorStop(1, '#881111');
    ctx.fillStyle = skillGrad;
    ctx.beginPath(); ctx.arc(skillCx, skillCy, 18, 0, Math.PI * 2); ctx.fill();

    if (cdPct < 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(skillCx, skillCy);
        ctx.arc(skillCx, skillCy, 18, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (1 - cdPct)));
        ctx.closePath(); ctx.fill();
        const cdSec = Math.ceil((skill.cooldown - (now - skill.lastUse)) / 1000);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`${cdSec}`, skillCx, skillCy + 5);
        ctx.textAlign = 'left';
    } else {
        const pulse = Math.sin(now * 0.008) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(100, 255, 150, ${pulse})`;
        ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(skillCx, skillCy, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(skillCx, skillCy, 22, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#fff';
    const maxDots = Math.min(skill.level, 5);
    for (let i = 0; i < maxDots; i++) {
        ctx.beginPath(); ctx.arc(sx + 5 + i * 7, sy - 5, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (skill.level > 5) {
        ctx.font = '10px Arial'; ctx.fillText(`+${skill.level - 5}`, sx + 40, sy - 2);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('E', skillCx, skillCy + (cdPct >= 1 ? 5 : -8));
    ctx.textAlign = 'left';

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.roundRect(5, H - 170, 130, 95, 8); ctx.fill();
    ctx.font = '15px Arial';
    ctx.fillStyle = '#ccc'; ctx.fillText(`Wave ${wave}`, 15, H - 148);
    ctx.fillStyle = '#fff'; ctx.fillText(`Score: ${score}`, 15, H - 128);
    ctx.fillStyle = '#ffd700'; ctx.fillText(`$ ${playerMoney}`, 15, H - 108);
    ctx.restore();

    let py = 50;
    ctx.font = '15px Arial';
    if (doubleShotCount > 0) { ctx.fillStyle = '#88bbff'; ctx.fillText(`Double x${doubleShotCount}`, W - 140, py); py += 22; }
    if (tripleShotCount > 0) { ctx.fillStyle = '#88bbff'; ctx.fillText(`Triple x${tripleShotCount}`, W - 140, py); py += 22; }

    if (invincible) {
        const shieldDuration = 1250 + (shopItems["Shield"].b * 750);
        const remaining = Math.ceil((shieldDuration - (now - invTime)) / 1000 * 10) / 10;
        ctx.fillStyle = '#00ffcc';
        ctx.fillText(`Shield: ${remaining.toFixed(1)}s`, W - 150, py);
        py += 22;
    }

    if (shieldCooldown > 0) {
        const cdRemaining = Math.ceil(shieldCooldown / 1000);
        ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.fillText(`Shield CD: ${cdRemaining}s`, W - 160, py);
        py += 22;
    } else if (!invincible) {
        ctx.fillStyle = '#44ff88';
        ctx.fillText('Shield: Ready', W - 150, py);
        py += 22;
    }

    if (wave === 0 && tutorialCircle) {
        const tc = tutorialCircle;
        const pulseSize = Math.sin(tc.pulse) * 10;
        ctx.save();
        ctx.strokeStyle = `rgba(100, 255, 100, ${0.5 + Math.sin(tc.pulse) * 0.3})`;
        ctx.shadowColor = '#44ff66'; ctx.shadowBlur = 15;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tc.x, tc.y, tc.radius + pulseSize, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(100, 255, 100, 0.1)';
        ctx.beginPath(); ctx.arc(tc.x, tc.y, tc.radius, 0, Math.PI * 2); ctx.fill();

        const progress = tutorialProgress / 2000;
        if (progress > 0) {
            ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 6;
            ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(tc.x, tc.y, tc.radius - 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.stroke(); ctx.shadowBlur = 0;
        }

        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Enter to Start', tc.x, tc.y - 10);
        const remaining = Math.ceil((2000 - tutorialProgress) / 1000);
        ctx.font = '16px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`Hold: ${remaining}s`, tc.x, tc.y + 15);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    if (isResting && wave >= 0 && !isShop) {
        const duration = wave === 0 ? 15000 : 5000;
        const remain = Math.ceil((duration - (now - restStart)) / 1000);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.roundRect(W - 230, 5, 220, wave === 0 ? 50 : 28, 8); ctx.fill();
        ctx.fillStyle = 'rgb(180,200,255)'; ctx.font = '15px Arial';
        if (wave === 0) {
            ctx.fillText(`Tutorial - Wave 1 in: ${remain}s`, W - 220, 24);
            ctx.font = '12px Arial'; ctx.fillStyle = 'rgba(180,200,255,0.6)';
            ctx.fillText('Practice your movement!', W - 200, 44);
        } else {
            ctx.fillText(`Next wave in: ${remain}s`, W - 210, 24);
        }
        ctx.restore();
    }
}

function drawShop() {
    ctx.fillStyle = 'rgba(5,5,15,0.95)';
    ctx.fillRect(0, 0, W, H);
    const t = Date.now();

    ctx.save();
    ctx.shadowColor = '#4466ff'; ctx.shadowBlur = 15;
    const titleGrad = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
    titleGrad.addColorStop(0, '#6688ff');
    titleGrad.addColorStop(0.5, '#ffffff');
    titleGrad.addColorStop(1, '#ff6688');
    ctx.fillStyle = titleGrad; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
    ctx.fillText('SHOP', W / 2, 42);
    ctx.shadowBlur = 0;
    ctx.font = '14px Arial'; ctx.fillStyle = 'rgba(180,200,255,0.4)';
    ctx.fillText(`Wave ${wave - 1} Complete`, W / 2, 64);
    ctx.restore();

    const flashTime = Date.now() % 600 < 300;
    const canAffordAny = selectedItems.length > 0 && playerMoney >= selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
    const moneyColor = selectedItems.length == 0 ? '#ffd700' : (canAffordAny ? '#44ff88' : (flashTime ? '#ff4444' : '#ff6666'));
    ctx.fillStyle = moneyColor; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`$ ${playerMoney}`, W / 2, 92);

    if (selectedItems.length > 0) {
        const total = selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
        const remaining = playerMoney - total;
        ctx.font = '13px Arial';
        ctx.fillStyle = remaining >= 0 ? '#44ff88' : '#ff4444';
        ctx.fillText(`Cost: ${total}  |  After: ${remaining}`, W / 2, 112);
    }

    const itemColors = {
        'Health Upgrade': '#44dd44', 'Max Health': '#ff6688', 'Speed': '#44ccff', 'Fire Rate': '#ff8844',
        'Damage': '#ff4444', 'Shield': '#00ddcc', 'Double Shot': '#6688ff', 'Triple Shot': '#8866ff',
        'Piercing': '#ffcc44', 'Skill Up': '#ff6633', 'Luck': '#66dd66', 'Magnet': '#dd88ff', 'Greed': '#ffdd44'
    };

    if (typeof shopRevealTime === 'undefined') shopRevealTime = Date.now();
    const elapsed = Date.now() - shopRevealTime;
    const shuffleDur = 400, dealDur = 300, dealStagger = 80;

    const sl = getShopLayout();
    const deckCX = W / 2, deckCY = sl.gridStartY + sl.cardH + sl.gridGap / 2;

    if (typeof window.shopCardFlipped === 'undefined') window.shopCardFlipped = {};
    if (elapsed < shuffleDur) {
        window.shopCardFlipped = {};
        window.shopParticles = [];
    }

    if (elapsed < shuffleDur) {
        const sp = elapsed / shuffleDur;
        const count = Math.min(itemsToSell.length, 4);
        for (let i = count - 1; i >= 0; i--) {
            const angle = (i / count) * Math.PI * 2 + sp * Math.PI * 4 + i * 1.3;
            const orbitR = 22 * Math.sin(sp * Math.PI) * (1 + i * 0.15);
            const ox = Math.cos(angle) * orbitR;
            const oy = Math.sin(angle) * orbitR * 0.5;
            const cw = 80, ch = 50;
            ctx.fillStyle = `rgba(30,35,60,${0.65 + i * 0.05})`;
            ctx.beginPath(); ctx.roundRect(deckCX - cw / 2 + ox, deckCY - ch / 2 + oy, cw, ch, 6); ctx.fill();
            ctx.strokeStyle = 'rgba(100,130,220,0.2)'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.roundRect(deckCX - cw / 2 + ox, deckCY - ch / 2 + oy, cw, ch, 6); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(150,170,220,0.35)'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
        ctx.fillText('?', deckCX, deckCY + 7);
    }

    itemsToSell.forEach((item, i) => {
        if (i >= 4) return;
        const itm = shopItems[item];
        const price = getItemPrice(item);
        const maxed = itm.max !== -1 && itm.b >= itm.max;
        const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;
        const afford = playerMoney >= price;
        const sel = selectedItems.includes(item);
        const canSelect = afford && !maxed && !skillUpLimited;
        const accent = itemColors[item] || '#888';

        const target = sl.positions[i];

        const stg = 40;
        const cardStart = shuffleDur + i * stg;
        const ce = elapsed - cardStart;
        if (ce < 0) return;

        const p = Math.min(1, ce / dealDur);

        const s = 1.70158;
        const t = p - 1;
        const ease = (t * t * ((s + 1) * t + s) + 1);

        const isLanded = p >= 1;

        const cx = deckCX - sl.cardW / 2 + (target.x - (deckCX - sl.cardW / 2)) * ease;
        const cy = deckCY - sl.cardH / 2 + (target.y - (deckCY - sl.cardH / 2)) * ease;
        const scl = Math.max(0, ease);

        ctx.save();

        if (!isLanded && ease > 0.1) {
            const trailEase = Math.max(0, ease - 0.15);
            const tCx = deckCX - sl.cardW / 2 + (target.x - (deckCX - sl.cardW / 2)) * trailEase;
            const tCy = deckCY - sl.cardH / 2 + (target.y - (deckCY - sl.cardH / 2)) * trailEase;
            const tScl = Math.max(0, trailEase);

            ctx.translate(tCx + sl.cardW / 2, tCy + sl.cardH / 2);
            ctx.scale(tScl, tScl);
            ctx.translate(-(tCx + sl.cardW / 2), -(tCy + sl.cardH / 2));

            ctx.globalAlpha = 0.25 * (1 - p);
            ctx.fillStyle = `rgba(100, 150, 255, 0.4)`;
            ctx.beginPath(); ctx.roundRect(tCx, tCy, sl.cardW, sl.cardH, 10); ctx.fill();

            ctx.resetTransform();
        }

        ctx.translate(cx + sl.cardW / 2, cy + sl.cardH / 2);
        ctx.scale(scl, scl);
        ctx.translate(-(cx + sl.cardW / 2), -(cy + sl.cardH / 2));

        if (isLanded && !window.shopCardFlipped[i]) {
            window.shopCardFlipped[i] = true;
            window.shopParticles = window.shopParticles || [];

            window.shopParticles.push({ type: 'ring', x: target.x + sl.cardW / 2, y: target.y + sl.cardH / 2, color: accent, life: 25, maxLife: 25 });

            for (let k = 0; k < 12; k++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 3 + Math.random() * 6;
                const pColor = Math.random() > 0.3 ? accent : '#ffffff';
                window.shopParticles.push({
                    type: 'dot', x: target.x + sl.cardW / 2, y: target.y + sl.cardH / 2,
                    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                    color: pColor, life: 15 + Math.random() * 20, maxLife: 35, size: 2 + Math.random() * 4
                });
            }
        }

        ctx.globalAlpha = (canSelect ? 1 : 0.4);

        const cGrad = ctx.createLinearGradient(cx, cy, cx, cy + sl.cardH);
        if (sel) { cGrad.addColorStop(0, 'rgba(25,80,40,0.65)'); cGrad.addColorStop(1, 'rgba(15,50,25,0.5)'); }
        else { cGrad.addColorStop(0, 'rgba(22,25,45,0.7)'); cGrad.addColorStop(1, 'rgba(12,14,28,0.6)'); }
        ctx.fillStyle = cGrad;
        ctx.beginPath(); ctx.roundRect(cx, cy, sl.cardW, sl.cardH, 10); ctx.fill();
        ctx.strokeStyle = sel ? 'rgba(80,255,120,0.5)' : 'rgba(70,90,140,0.15)';
        ctx.lineWidth = sel ? 1.5 : 0.5;
        ctx.beginPath(); ctx.roundRect(cx, cy, sl.cardW, sl.cardH, 10); ctx.stroke();

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * 0.7;
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.roundRect(cx + 3, cy + 3, sl.cardW - 6, 3, 1.5); ctx.fill();
        ctx.globalAlpha = prevAlpha;

        if (ce < dealDur + 200 && isLanded) {
            const fp = Math.max(0, 1 - (ce - dealDur) / 200);
            if (fp > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.shadowColor = accent; ctx.shadowBlur = fp * 30;
                ctx.fillStyle = `rgba(200,220,255,${fp * 0.3})`;
                ctx.beginPath(); ctx.roundRect(cx, cy, sl.cardW, sl.cardH, 10); ctx.fill();
                ctx.restore();
            }
        }

        ctx.globalAlpha = (canSelect ? 1 : 0.5);
        ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(cx + sl.cardW / 2, cy + 26, 9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.textAlign = 'center';
        ctx.font = 'bold 13px Arial'; ctx.fillStyle = '#fff';
        ctx.fillText(item, cx + sl.cardW / 2, cy + 50);

        ctx.font = '10px Arial'; ctx.fillStyle = 'rgba(170,180,210,0.8)';
        const lang = typeof getLang === 'function' ? getLang() : null;
        const desc = item == 'Skill Up' ? `Upgrade bomb (Lv ${skill.level}/${skill.maxLvl})`
            : (lang && itm.descVI ? (lang === LANGUAGES.vi ? itm.descVI : itm.desc) : itm.desc);

        const words = desc.split(' ');
        let line = '';
        let dY = cy + 64;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > sl.cardW - 20 && n > 0) {
                ctx.fillText(line.trim(), cx + sl.cardW / 2, dY);
                line = words[n] + ' ';
                dY += 12;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), cx + sl.cardW / 2, dY);

        const pText = maxed ? 'MAX' : (skillUpLimited ? 'BOUGHT' : `${price}$`);
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = maxed ? '#888' : (afford ? '#ffd700' : '#ff6666');
        ctx.fillText(pText, cx + sl.cardW / 2, cy + 92);

        if (item != 'Skill Up' && itm.max !== -1) {
            ctx.font = '9px Arial'; ctx.fillStyle = 'rgba(140,150,170,0.4)';
            ctx.fillText(`${itm.b}/${itm.max}`, cx + sl.cardW / 2, cy + 106);
        }

        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = sel ? '#44ff88' : 'rgba(140,160,200,0.2)';
        ctx.fillText(`[${i + 1}]`, cx + sl.cardW - 14, cy + 14);

        ctx.globalAlpha = 1;
        ctx.restore();
    });

    if (window.shopParticles && window.shopParticles.length > 0) {
        window.shopParticles = window.shopParticles.filter(p => {
            if (p.type === 'dot') {
                p.x += p.vx; p.y += p.vy;
                p.vx *= 0.94; p.vy *= 0.94;
            }
            p.life--;
            return p.life > 0;
        });

        ctx.save();
        window.shopParticles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            if (p.type === 'ring') {
                const size = 30 + (1 - alpha) * 80;
                ctx.strokeStyle = p.color; ctx.lineWidth = 4 * alpha;
                ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.stroke();
            } else if (p.type === 'dot') {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color; ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
        ctx.restore();
    }

    const btnW = sl.btnW, btnH = sl.btnH;
    const buyY = sl.buyY, refY = sl.refY, skipY = sl.skipY;
    ctx.textAlign = 'center';

    const canBuy = selectedItems.length > 0 && canAffordAny;
    const buyGrad = ctx.createLinearGradient(W / 2 - btnW / 2, buyY, W / 2 + btnW / 2, buyY);
    buyGrad.addColorStop(0, canBuy ? '#1a7733' : '#2a2a2a');
    buyGrad.addColorStop(1, canBuy ? '#22aa44' : '#3a3a3a');
    ctx.fillStyle = buyGrad;
    ctx.beginPath(); ctx.roundRect(W / 2 - btnW / 2, buyY, btnW, btnH, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial';
    ctx.fillText('BUY (Enter)', W / 2, buyY + 24);

    const refreshCost = 20 + shopRefreshCount * 15;
    const canRefresh = playerMoney >= refreshCost;
    const refGrad = ctx.createLinearGradient(W / 2 - btnW / 2, refY, W / 2 + btnW / 2, refY);
    refGrad.addColorStop(0, canRefresh ? '#1a4488' : '#222');
    refGrad.addColorStop(1, canRefresh ? '#2266bb' : '#333');
    ctx.globalAlpha = canRefresh ? 1 : 0.5;
    ctx.fillStyle = refGrad;
    ctx.beginPath(); ctx.roundRect(W / 2 - btnW / 2, refY, btnW, btnH, 6); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = canRefresh ? '#fff' : '#888'; ctx.font = 'bold 13px Arial';
    ctx.fillText(`REFRESH (${refreshCost}$)`, W / 2, refY + 23);

    const skipGrad = ctx.createLinearGradient(W / 2 - btnW / 2, skipY, W / 2 + btnW / 2, skipY);
    skipGrad.addColorStop(0, '#551a1a');
    skipGrad.addColorStop(1, '#772222');
    ctx.fillStyle = skipGrad;
    ctx.beginPath(); ctx.roundRect(W / 2 - btnW / 2, skipY, btnW, btnH, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial';
    ctx.fillText('SKIP (Esc)', W / 2, skipY + 23);

    ctx.textAlign = 'left';
}

function getShopLayout() {
    const cardW = 200, cardH = 120, gridGap = 12;
    const gridW = cardW * 2 + gridGap;
    const gridStartX = W / 2 - gridW / 2;
    const gridStartY = 125;
    const btnH = 36, btnW = 280;
    const btnAreaY = gridStartY + (cardH + gridGap) * 2 + 15;
    return {
        cardW, cardH, gridGap, gridStartX, gridStartY, btnW, btnH,
        positions: [
            { x: gridStartX, y: gridStartY },
            { x: gridStartX + cardW + gridGap, y: gridStartY },
            { x: gridStartX, y: gridStartY + cardH + gridGap },
            { x: gridStartX + cardW + gridGap, y: gridStartY + cardH + gridGap }
        ],
        buyY: btnAreaY,
        refY: btnAreaY + btnH + 8,
        skipY: btnAreaY + (btnH + 8) * 2 - 8
    };
}