

function updateBossEntry(boss) {
    boss.entryTimer++;
    const t = boss.entryTimer;

    boss.x = W / 2 - boss.w / 2;

    if (boss.bossType === 0) {

        if (boss.entryState === 0) {
            boss.y += 12;

            const c = ['#ff4400', '#ff8800', '#ffffff'][Math.floor(Math.random() * 3)];
            particles.push(new Particle(W / 2 + (Math.random() - 0.5) * boss.w, boss.y - boss.h / 2, c, 3 + Math.random() * 4, 10, 30));

            if (boss.y >= 50) {
                boss.y = 50;
                boss.entryState = 1;
                boss.entryTimer = 0;
                screenShake = 40;

                for (let i = 0; i < 40; i++) {
                    const ang = (i / 40) * Math.PI * 2;
                    particles.push(new Particle(W / 2 + Math.cos(ang) * 80, 50 + boss.h / 2 + Math.sin(ang) * 80, '#ff4400', 4, 8, 40));
                }
            }
        } else if (boss.entryState === 1) {

            boss.y = 50 - Math.sin(t * 0.2) * (20 - t / 3);
            if (t > 60) boss.entering = false;
        }

    } else if (boss.bossType === 1) {

        if (boss.entryState === 0) {
            boss.y = 50;
            screenShake = 2;
            if (t % 5 === 0) {

                const ang = Math.random() * Math.PI * 2;
                particles.push(new Particle(W / 2 + Math.cos(ang) * 150, 50 + boss.h / 2 + Math.sin(ang) * 150, '#ff00ff', 2, -6, 25));
            }
            if (t > 40) { boss.entryState = 1; boss.entryTimer = 0; }
        } else if (boss.entryState === 1) {

            screenShake = 5;
            if (t > 60) {
                boss.entryState = 2;
                boss.entryTimer = 0;
                screenShake = 30;

                for (let i = 0; i < 60; i++) {
                    particles.push(new Particle(W / 2 + (Math.random() - 0.5) * 200, 50 + boss.h / 2, i % 2 === 0 ? '#aa00ff' : '#ffffff', 2 + Math.random() * 3, 10 - Math.random() * 20, 30));
                }
            }
        } else if (boss.entryState === 2) {
            if (t > 20) boss.entering = false;
        }

    } else {

        if (boss.entryState === 0) {
            if (t === 1) boss.y = -200;

            if (t > 40) { boss.entryState = 1; boss.entryTimer = 0; }
        } else if (boss.entryState === 1) {
            boss.y += 1.5;
            screenShake = 3;
            if (boss.y >= 50) {
                boss.y = 50;
                boss.entryState = 2;
                boss.entryTimer = 0;
                screenShake = 25;

                for (let i = 0; i < 50; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(W / 2, 50 + boss.h / 2, '#ffee00', 3 + Math.random() * 5, 8 + Math.random() * 4, 50));
                }
            }
        } else if (boss.entryState === 2) {
            if (t > 30) boss.entering = false;
        }
    }
}

function updateBossDeath(boss) {
    boss.deathTimer++;
    const t = boss.deathTimer;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;

    boss.mines = [];
    boss.clonesActive = false;
    boss.laserFiring = false;
    boss.shieldActive = false;

    if (boss.bossType === 0) {

        if (boss.deathState === 0) {
            screenShake = 15;

            if (t % 8 === 0) {
                const ex = cx + (Math.random() - 0.5) * boss.w;
                const ey = cy + (Math.random() - 0.5) * boss.h;
                for (let i = 0; i < 8; i++) particles.push(new Particle(ex, ey, ['#ff4400', '#ffaa00'][Math.floor(Math.random() * 2)], 2 + Math.random() * 3, 5, 20));
            }
            if (t > 90) { boss.deathState = 1; boss.deathTimer = 0; }
        } else if (boss.deathState === 1) {
            screenShake = 30;

            if (t > 60) {
                boss.deathState = 2;
                boss.deathTimer = 0;
                screenShake = 60;
                for (let i = 0; i < 150; i++) particles.push(new Particle(cx, cy, '#ffffff', 3 + Math.random() * 6, 15 + Math.random() * 10, 60));
                for (let i = 0; i < 50; i++) particles.push(new Particle(cx, cy, '#ff2200', 5 + Math.random() * 8, 20 + Math.random() * 15, 50));
            }
        } else if (boss.deathState === 2) {
            if (t > 10) finalizeBossDeath(boss);
        }

    } else if (boss.bossType === 1) {

        if (boss.deathState === 0) {
            screenShake = 10;

            if (t % 3 === 0) {
                const a = Math.random() * Math.PI * 2;
                particles.push(new Particle(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100, '#aa00ff', 2, -15, 10));
            }
            if (t > 70) { boss.deathState = 1; boss.deathTimer = 0; }
        } else if (boss.deathState === 1) {
            screenShake = 40;

            if (t > 30) {
                boss.deathState = 2;
                boss.deathTimer = 0;
                screenShake = 70;

                for (let i = 0; i < 120; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(cx, cy, ['#ff00ff', '#cc00ff', '#ffffff'][Math.floor(Math.random() * 3)], 2 + Math.random() * 4, 25 + Math.random() * 15, 60));
                }
            }
        } else if (boss.deathState === 2) {
            if (t > 10) finalizeBossDeath(boss);
        }

    } else {

        if (boss.deathState === 0) {
            screenShake = 20;

            if (t > 60) { boss.deathState = 1; boss.deathTimer = 0; }
        } else if (boss.deathState === 1) {
            screenShake = 45;

            if (t > 50) {
                boss.deathState = 2;
                boss.deathTimer = 0;
                screenShake = 80;

                for (let i = 0; i < 200; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(cx, cy, ['#ffee00', '#ffffff', '#ffaa00'][Math.floor(Math.random() * 3)], 4 + Math.random() * 6, 30 + Math.random() * 20, 70));
                }
            }
        } else if (boss.deathState === 2) {
            if (t > 15) finalizeBossDeath(boss);
        }
    }
}

function finalizeBossDeath(boss) {
    boss.hp = -999;

    bossKills++;
    const earnedScore = Math.floor(200 * comboMultiplier);
    score += earnedScore;
    addComboKill(earnedScore, 'boss');

    const bossNumber = Math.max(1, Math.floor(wave / 5));
    const minReward = 200 + bossNumber * 50;
    const maxReward = 300 + bossNumber * 80;
    const bossReward = Math.floor(minReward + Math.random() * (maxReward - minReward));

    for (let c = 0; c < 30; c++) {
        goldPickups.push({
            x: boss.x + boss.w / 2,
            y: boss.y + boss.h / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.5) * 16,
            value: Math.ceil(bossReward / 30),
            life: 900,
            maxLife: 900
        });
    }

    if (typeof onBossDefeated === 'function') onBossDefeated();
}

function bossPhaseTransitionEffect(boss, newPhase) {

    screenShake = 10 + newPhase * 3;
}

function bossAmbientParticles(boss) {
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    const t = Date.now();

    if (Math.random() > 0.3) return;

    if (boss.bossType === 0) {
        const ang = Math.random() * Math.PI * 2;
        particles.push(new Particle(cx + Math.cos(ang) * boss.w * 0.4, cy + Math.sin(ang) * boss.h * 0.4, Math.random() > 0.5 ? '#ff4400' : '#ff8800', 1 + Math.random() * 2, 3, 20));
    } else if (boss.bossType === 1) {
        const ang = Math.random() * Math.PI * 2;
        const dist = boss.w * 0.3 + Math.random() * 20;
        particles.push(new Particle(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, Math.random() > 0.5 ? '#aa44ff' : '#cc88ff', 1 + Math.random(), 2, 25));
    } else {
        const ang = Math.random() * Math.PI * 2;
        particles.push(new Particle(cx + Math.cos(ang) * boss.w * 0.35, cy + Math.sin(ang) * boss.h * 0.35, Math.random() > 0.5 ? '#ffcc00' : '#ffee88', 1 + Math.random() * 2, 3, 18));
    }

    if (boss.phase === 3) {
        const ragAng = Math.random() * Math.PI * 2;
        const ragDist = boss.w * 0.5 + Math.random() * 15;
        const pColor = typeof boss.getBloodColor === 'function' ? boss.getBloodColor() : '#ff0000';
        particles.push(new Particle(cx + Math.cos(ragAng) * ragDist, cy + Math.sin(ragAng) * ragDist, pColor, 1.5, 4, 15));
    }
}

function drawBossCinematics_Under(boss, ctx, cx, cy) {
    if (boss.entering) {
        if (boss.bossType === 1) {

            const t = boss.entryTimer;
            ctx.save();
            ctx.translate(cx, cy);
            let riftScale = 0;
            if (boss.entryState === 0) riftScale = t / 40;
            else if (boss.entryState === 1) riftScale = 1;
            else if (boss.entryState === 2) riftScale = 1 - (t / 20);

            ctx.scale(riftScale, riftScale);
            ctx.rotate(Date.now() * 0.005);
            ctx.globalCompositeOperation = 'lighter';

            const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
            rg.addColorStop(0, 'rgba(255,255,255,0.8)');
            rg.addColorStop(0.2, 'rgba(255,0,255,0.6)');
            rg.addColorStop(0.6, 'rgba(100,0,200,0.3)');
            rg.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.ellipse(0, 0, 80, 120, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (boss.bossType === 2) {

            const t = boss.entryTimer;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            let beamAlpha = 0;
            if (boss.entryState === 0) beamAlpha = t / 40;
            else if (boss.entryState === 1) beamAlpha = 1;
            else if (boss.entryState === 2) beamAlpha = 1 - (t / 30);

            const bg = ctx.createLinearGradient(cx - 150, 0, cx + 150, 0);
            bg.addColorStop(0, 'rgba(255,255,100,0)');
            bg.addColorStop(0.5, `rgba(255,255,200,${0.3 * beamAlpha})`);
            bg.addColorStop(1, 'rgba(255,255,100,0)');

            ctx.fillStyle = bg;
            ctx.fillRect(cx - 150, 0, 300, H);
            ctx.restore();
        }
    } else if (boss.dying) {
        if (boss.bossType === 1 && boss.deathState === 1) {

            const scale = 1 - boss.deathTimer / 30;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath(); ctx.arc(0, 0, 100 * scale + 20, 0, Math.PI * 2);
            ctx.fillStyle = '#000'; ctx.fill();
            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 10 * scale; ctx.stroke();
            ctx.restore();
        } else if (boss.bossType === 2 && boss.deathState >= 0) {

            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalCompositeOperation = 'lighter';
            let r = 0;
            if (boss.deathState === 0) r = (boss.deathTimer / 60) * 200;
            else if (boss.deathState === 1) r = 200 + (boss.deathTimer / 50) * 800;

            const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            sg.addColorStop(0, '#ffffff');
            sg.addColorStop(0.5, '#ffee00');
            sg.addColorStop(1, 'rgba(255,100,0,0)');

            ctx.fillStyle = sg;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }
}

function applyBossCinematicTransforms(boss, ctx, cx, cy) {
    if (boss.entering) {
        if (boss.bossType === 0) {

            if (boss.entryState === 0) {
                ctx.translate(cx, boss.y + boss.h / 2);
                ctx.scale(0.8, 1.5);
                ctx.translate(-cx, -(boss.y + boss.h / 2));
            }
        } else if (boss.bossType === 1) {

            if (boss.entryState === 0) {
                ctx.globalAlpha = 0;
            } else if (boss.entryState === 1) {
                const ratio = Math.min(1, boss.entryTimer / 60);
                ctx.globalAlpha = ratio;
                ctx.translate(cx, cy);
                ctx.scale(ratio, ratio);
                ctx.translate(-cx, -cy);
            }
        } else if (boss.bossType === 2) {

        }
    } else if (boss.dying) {
        if (boss.bossType === 0) {

            if (boss.deathState === 1) {
                ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
            }
        } else if (boss.bossType === 1) {

            if (boss.deathState === 0) {
                ctx.translate((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
                ctx.globalAlpha = 0.5 + Math.random() * 0.5;
            } else if (boss.deathState === 1) {
                const tr = Math.max(0, 1 - (boss.deathTimer / 30));
                ctx.translate(cx, cy);
                ctx.scale(tr, tr);
                ctx.rotate(boss.deathTimer * 0.5);
                ctx.translate(-cx, -cy);
            }
        } else if (boss.bossType === 2) {

            if (boss.deathState === 0) {
                ctx.globalAlpha = Math.max(0, 1 - (boss.deathTimer / 60));
                ctx.translate(cx, cy);
                ctx.scale(1 + boss.deathTimer / 30, 1 + boss.deathTimer / 30);
                ctx.translate(-cx, -cy);
            } else if (boss.deathState >= 1) {
                ctx.globalAlpha = 0;
            }
        }
    }
}

function drawBossCinematics_Over(boss, ctx, cx, cy) {
    if (boss.entering) {
        if (boss.bossType === 0 && boss.entryState === 0) {

            ctx.save();
            ctx.translate(cx, boss.y + boss.h / 2);
            ctx.scale(0.8, 1.5);
            ctx.globalCompositeOperation = 'lighter';
            const flare = ctx.createRadialGradient(0, Math.max(0, boss.h / 2), 0, 0, Math.max(0, boss.h / 2), boss.w * 1.5);
            flare.addColorStop(0, 'rgba(255,255,255,0.8)');
            flare.addColorStop(0.3, 'rgba(255,100,0,0.6)');
            flare.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = flare;
            ctx.beginPath(); ctx.arc(0, Math.max(0, Math.max(0, boss.h / 2)), boss.w * 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (boss.bossType === 2 && boss.entryState === 1) {

            const ratio = boss.entryTimer / 60;
            if (ratio < 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = `rgba(255,255,255,${1 - ratio})`;

                ctx.fillRect(boss.x - 50, boss.y - 50, boss.w + 100, boss.h + 100);
                ctx.restore();
            }
        }
    } else if (boss.dying) {
        if (boss.bossType === 0) {
            if (boss.deathState === 0) {

                const t = boss.deathTimer;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 3; i++) {
                    const bTime = (t - i * 20);
                    if (bTime > 0 && bTime < 20) {
                        const tr = bTime / 20;
                        ctx.fillStyle = `rgba(255,${200 - tr * 200},0,${1 - tr})`;
                        ctx.beginPath();
                        ctx.arc(cx + Math.sin(i * 72) * 40, cy + Math.cos(i * 31) * 40, tr * 40, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                ctx.restore();
            } else if (boss.deathState === 1) {

                const t = boss.deathTimer;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.globalCompositeOperation = 'lighter';
                const r = t * 6;
                const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(0, r));
                coreGrad.addColorStop(0, '#ffffff');
                coreGrad.addColorStop(0.5, '#ff4400');
                coreGrad.addColorStop(1, 'rgba(255,0,0,0)');
                ctx.fillStyle = coreGrad;
                ctx.beginPath(); ctx.arc(0, 0, Math.max(0, Math.max(0, Math.max(0, r))), 0, Math.PI * 2); ctx.fill();

                ctx.lineWidth = 4 + (t / 10);
                for (let i = 0; i < 12; i++) {
                    const ang = (i / 12) * Math.PI * 2 + t * 0.02;
                    ctx.strokeStyle = `rgba(255,200,100,${Math.min(1, t / 60)})`;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 2, Math.sin(ang) * r * 2); ctx.stroke();
                }
                ctx.restore();
            }
        }
    }
}
