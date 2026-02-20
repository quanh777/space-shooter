<<<<<<< HEAD
﻿let waveTransition = { active: false, frame: 0, maxFrames: 150, wave: 0 };

function showWaveTransition(waveNum) {
    waveTransition = { active: true, frame: 0, maxFrames: 150, wave: waveNum };
}

function isTransitionActive() {
    return waveTransition.active;
}

function updateWaveTransition() {
    if (!waveTransition.active) return;
    waveTransition.frame++;
    if (waveTransition.frame >= waveTransition.maxFrames) {
        waveTransition.active = false;
    }
}

function drawWaveTransition() {
    if (!waveTransition.active) return;

    const f = waveTransition.frame;
    const isBoss = waveTransition.wave % 5 === 0;

    let alpha = 1;
    if (f < 25) alpha = f / 25;
    else if (f >= 125) alpha = (150 - f) / 25;

    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    ctx.fillStyle = isBoss ? 'rgba(255,50,50,0.5)' : 'rgba(200,200,255,0.5)';
    ctx.font = 'bold 100px Arial';
    const mainText = isBoss ? `BOSS WAVE ${waveTransition.wave}` : `Wave ${waveTransition.wave}`;
    ctx.fillText(mainText, W / 2 + 3, H / 2 - 30 + 3);

    ctx.fillStyle = isBoss ? 'rgb(255,50,50)' : 'rgb(200,200,255)';
    ctx.fillText(mainText, W / 2, H / 2 - 30);

    ctx.font = 'bold 50px Arial';
    const lang = typeof getLang === 'function' ? getLang() : { getReady: 'Sẵn sàng!', prepareForBattle: 'Chuẩn bị chiến đấu!' };
    const subText = isBoss ? lang.prepareForBattle : lang.getReady;
    ctx.fillStyle = isBoss ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.fillText(subText, W / 2 + 3, H / 2 + 30 + 3);

    ctx.fillStyle = isBoss ? 'rgb(255,100,100)' : '#fff';
    ctx.fillText(subText, W / 2, H / 2 + 30);

    if (Math.random() < 0.3) {
        const color = isBoss ? 'rgb(255,50,50)' : 'rgb(200,200,255)';
        particles.push(new Particle(Math.random() * W, Math.random() * H, color, 1, 3, 30));
    }

    ctx.restore();
}
=======
﻿let waveTransition = { active: false, frame: 0, maxFrames: 150, wave: 0 };

function showWaveTransition(waveNum) {
    waveTransition = { active: true, frame: 0, maxFrames: 150, wave: waveNum };
}

function isTransitionActive() {
    return waveTransition.active;
}

function updateWaveTransition() {
    if (!waveTransition.active) return;
    waveTransition.frame++;
    if (waveTransition.frame >= waveTransition.maxFrames) {
        waveTransition.active = false;
    }
}

function drawWaveTransition() {
    if (!waveTransition.active) return;

    const f = waveTransition.frame;
    const isBoss = waveTransition.wave % 5 === 0;

    let alpha = 1;
    if (f < 25) alpha = f / 25;
    else if (f >= 125) alpha = (150 - f) / 25;

    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    ctx.fillStyle = isBoss ? 'rgba(255,50,50,0.5)' : 'rgba(200,200,255,0.5)';
    ctx.font = 'bold 100px Arial';
    const mainText = isBoss ? `BOSS WAVE ${waveTransition.wave}` : `Wave ${waveTransition.wave}`;
    ctx.fillText(mainText, W / 2 + 3, H / 2 - 30 + 3);

    ctx.fillStyle = isBoss ? 'rgb(255,50,50)' : 'rgb(200,200,255)';
    ctx.fillText(mainText, W / 2, H / 2 - 30);

    ctx.font = 'bold 50px Arial';
    const lang = typeof getLang === 'function' ? getLang() : { getReady: 'Sẵn sàng!', prepareForBattle: 'Chuẩn bị chiến đấu!' };
    const subText = isBoss ? lang.prepareForBattle : lang.getReady;
    ctx.fillStyle = isBoss ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.fillText(subText, W / 2 + 3, H / 2 + 30 + 3);

    ctx.fillStyle = isBoss ? 'rgb(255,100,100)' : '#fff';
    ctx.fillText(subText, W / 2, H / 2 + 30);

    if (Math.random() < 0.3) {
        const color = isBoss ? 'rgb(255,50,50)' : 'rgb(200,200,255)';
        particles.push(new Particle(Math.random() * W, Math.random() * H, color, 1, 3, 30));
    }

    ctx.restore();
}
>>>>>>> 887d870520c4e106a9b8fdd58bb653fdf0be3a1f
