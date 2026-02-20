<<<<<<< HEAD
// Achievement definitions with levels (like Clash Royale)
const ACHIEVEMENTS = {
    kills: {
        id: 'kills',
        icon: '🎯',
        vi: { name: 'Xạ Thủ', desc: 'Tiêu diệt {target} enemy' },
        en: { name: 'Sharpshooter', desc: 'Kill {target} enemies' },
        levels: [10, 50, 100, 250, 500, 1000],
        type: 'cumulative'
    },
    waves: {
        id: 'waves',
        icon: '🌊',
        vi: { name: 'Thợ Săn Wave', desc: 'Vượt qua wave {target}' },
        en: { name: 'Wave Hunter', desc: 'Survive past wave {target}' },
        levels: [5, 10, 15, 20, 30, 50],
        type: 'cumulative'
    },
    bosses: {
        id: 'bosses',
        icon: '👹',
        vi: { name: 'Kẻ Diệt Boss', desc: 'Hạ gục {target} boss' },
        en: { name: 'Boss Slayer', desc: 'Defeat {target} bosses' },
        levels: [1, 5, 10, 25, 50],
        type: 'cumulative'
    },
    money: {
        id: 'money',
        icon: '💰',
        vi: { name: 'Giàu Có', desc: 'Kiếm tổng cộng {target} tiền' },
        en: { name: 'Wealthy', desc: 'Earn {target} total money' },
        levels: [500, 2000, 5000, 10000, 25000],
        type: 'cumulative'
    },
    dashes: {
        id: 'dashes',
        icon: '💨',
        vi: { name: 'Bậc Thầy Lướt', desc: 'Dash {target} lần' },
        en: { name: 'Dash Master', desc: 'Dash {target} times' },
        levels: [50, 200, 500, 1000, 2500],
        type: 'cumulative'
    },
    purchases: {
        id: 'purchases',
        icon: '🛒',
        vi: { name: 'Mua Sắm', desc: 'Mua {target} vật phẩm' },
        en: { name: 'Shopaholic', desc: 'Buy {target} items' },
        levels: [10, 50, 100, 250, 500],
        type: 'cumulative'
    },
    games: {
        id: 'games',
        icon: '🎮',
        vi: { name: 'Game Thủ', desc: 'Chơi {target} ván' },
        en: { name: 'Gamer', desc: 'Play {target} games' },
        levels: [5, 25, 50, 100, 250],
        type: 'cumulative'
    },
    highScore: {
        id: 'highScore',
        icon: '🏆',
        vi: { name: 'Điểm Cao', desc: 'Đạt {target} điểm' },
        en: { name: 'High Score', desc: 'Reach {target} score' },
        levels: [1000, 5000, 10000, 25000, 50000],
        type: 'best'
    }
};

// Progress data stored in localStorage
let achievementData = {
    kills: 0,
    waves: 0,
    bosses: 0,
    money: 0,
    dashes: 0,
    purchases: 0,
    games: 0,
    highScore: 0
};

let achievementQueue = [];
let showingAchievement = false;

function loadAchievements() {
    const saved = localStorage.getItem('spaceshooter_achievements_v2');
    if (saved) {
        achievementData = { ...achievementData, ...JSON.parse(saved) };
    }
}

function saveAchievements() {
    localStorage.setItem('spaceshooter_achievements_v2', JSON.stringify(achievementData));
}

function getAchievementLevel(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return 0;

    const value = achievementData[id] || 0;
    let level = 0;

    for (let i = 0; i < ach.levels.length; i++) {
        if (value >= ach.levels[i]) {
            level = i + 1;
        } else {
            break;
        }
    }

    return level;
}

function getNextTarget(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return null;

    const level = getAchievementLevel(id);
    if (level >= ach.levels.length) return null;

    return ach.levels[level];
}

function getProgress(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return { current: 0, target: 1, percent: 0 };

    const current = achievementData[id] || 0;
    const level = getAchievementLevel(id);
    const prevTarget = level > 0 ? ach.levels[level - 1] : 0;
    const nextTarget = ach.levels[level] || ach.levels[ach.levels.length - 1];

    const progressInLevel = current - prevTarget;
    const levelRange = nextTarget - prevTarget;
    const percent = Math.min(100, (progressInLevel / levelRange) * 100);

    return { current, target: nextTarget, percent };
}

function updateAchievement(id, value, isBest = false) {
    const prevLevel = getAchievementLevel(id);

    if (isBest) {
        if (value > achievementData[id]) {
            achievementData[id] = value;
        }
    } else {
        achievementData[id] = (achievementData[id] || 0) + value;
    }

    saveAchievements();

    const newLevel = getAchievementLevel(id);
    if (newLevel > prevLevel) {
        achievementQueue.push({ id, level: newLevel });
        showNextAchievement();
    }
}

function showNextAchievement() {
    if (showingAchievement || achievementQueue.length === 0) return;

    showingAchievement = true;
    const { id, level } = achievementQueue.shift();
    const ach = ACHIEVEMENTS[id];
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'vi');
    const data = ach[lang] || ach.vi;

    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
            <div class="achievement-unlocked">${lang === 'vi' ? 'THÀNH TỰU CẤP ' + level + '!' : 'ACHIEVEMENT LVL ' + level + '!'}</div>
            <div class="achievement-name">${data.name}</div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 50);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
            showingAchievement = false;
            showNextAchievement();
        }, 400);
    }, 3000);
}

// Game integration functions
function onEnemyKilled() {
    updateAchievement('kills', 1);
}

function onWaveComplete(waveNum) {
    updateAchievement('waves', 1, true);
    if (waveNum > achievementData.waves) {
        achievementData.waves = waveNum;
        saveAchievements();
    }
}

function onBossDefeated() {
    updateAchievement('bosses', 1);
}

function onMoneyEarned(amount) {
    updateAchievement('money', amount);
}

function onDash() {
    updateAchievement('dashes', 1);
}

function onPurchase() {
    updateAchievement('purchases', 1);
}

function onGameStart() {
    updateAchievement('games', 1);
}

function onGameOver(finalScore) {
    updateAchievement('highScore', finalScore, true);
}

// UI Functions
function showAchievements() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('achievementsScreen').classList.remove('hidden');
    renderAchievementsList();
}

function hideAchievements() {
    document.getElementById('achievementsScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function renderAchievementsList() {
    const container = document.getElementById('achievementsList');
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'vi');

    let totalLevels = 0;
    let unlockedLevels = 0;

    Object.values(ACHIEVEMENTS).forEach(ach => {
        totalLevels += ach.levels.length;
        unlockedLevels += getAchievementLevel(ach.id);
    });

    let html = `<div class="achievements-progress">${unlockedLevels}/${totalLevels} ${lang === 'vi' ? 'cấp' : 'levels'}</div>`;

    Object.values(ACHIEVEMENTS).forEach(ach => {
        const level = getAchievementLevel(ach.id);
        const maxLevel = ach.levels.length;
        const isMaxed = level >= maxLevel;
        const progress = getProgress(ach.id);
        const data = ach[lang] || ach.vi;
        const desc = data.desc.replace('{target}', progress.target);

        // Gradient class based on level
        const levelClass = isMaxed ? 'level-max' : level > 0 ? `level-${Math.min(level, 5)}` : 'level-0';

        html += `
            <div class="achievement-item ${levelClass}" data-level="${level}">
                <div class="achievement-item-icon">${ach.icon}</div>
                <div class="achievement-item-info">
                    <div class="achievement-item-header">
                        <span class="achievement-item-name">${data.name}</span>
                        <span class="achievement-item-level">${lang === 'vi' ? 'Cấp' : 'Lv'} ${level}/${maxLevel}</span>
                    </div>
                    <div class="achievement-item-desc">${desc}</div>
                    ${!isMaxed ? `
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill level-${Math.min(level + 1, 5)}" style="width: ${progress.percent}%"></div>
                        </div>
                        <div class="achievement-progress-text">${progress.current}/${progress.target}</div>
                    ` : `<div class="achievement-maxed-text">${lang === 'vi' ? '✓ Hoàn thành!' : '✓ Completed!'}</div>`}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Initialize
loadAchievements();
=======
const ACHIEVEMENTS = {
    kills: {
        id: 'kills',
        icon: '🎯',
        vi: { name: 'Xạ Thủ', desc: 'Tiêu diệt {target} enemy' },
        en: { name: 'Sharpshooter', desc: 'Kill {target} enemies' },
        levels: [10, 50, 100, 250, 500, 1000],
        type: 'cumulative'
    },
    waves: {
        id: 'waves',
        icon: '🌊',
        vi: { name: 'Thợ Săn Wave', desc: 'Vượt qua wave {target}' },
        en: { name: 'Wave Hunter', desc: 'Survive past wave {target}' },
        levels: [5, 10, 15, 20, 30, 50],
        type: 'cumulative'
    },
    bosses: {
        id: 'bosses',
        icon: '👹',
        vi: { name: 'Kẻ Diệt Boss', desc: 'Hạ gục {target} boss' },
        en: { name: 'Boss Slayer', desc: 'Defeat {target} bosses' },
        levels: [1, 5, 10, 25, 50],
        type: 'cumulative'
    },
    money: {
        id: 'money',
        icon: '💰',
        vi: { name: 'Giàu Có', desc: 'Kiếm tổng cộng {target} tiền' },
        en: { name: 'Wealthy', desc: 'Earn {target} total money' },
        levels: [500, 2000, 5000, 10000, 25000],
        type: 'cumulative'
    },
    dashes: {
        id: 'dashes',
        icon: '💨',
        vi: { name: 'Bậc Thầy Lướt', desc: 'Dash {target} lần' },
        en: { name: 'Dash Master', desc: 'Dash {target} times' },
        levels: [50, 200, 500, 1000, 2500],
        type: 'cumulative'
    },
    purchases: {
        id: 'purchases',
        icon: '🛒',
        vi: { name: 'Mua Sắm', desc: 'Mua {target} vật phẩm' },
        en: { name: 'Shopaholic', desc: 'Buy {target} items' },
        levels: [10, 50, 100, 250, 500],
        type: 'cumulative'
    },
    games: {
        id: 'games',
        icon: '🎮',
        vi: { name: 'Game Thủ', desc: 'Chơi {target} ván' },
        en: { name: 'Gamer', desc: 'Play {target} games' },
        levels: [5, 25, 50, 100, 250],
        type: 'cumulative'
    },
    highScore: {
        id: 'highScore',
        icon: '🏆',
        vi: { name: 'Điểm Cao', desc: 'Đạt {target} điểm' },
        en: { name: 'High Score', desc: 'Reach {target} score' },
        levels: [1000, 5000, 10000, 25000, 50000],
        type: 'best'
    }
};

let achievementData = {
    kills: 0,
    waves: 0,
    bosses: 0,
    money: 0,
    dashes: 0,
    purchases: 0,
    games: 0,
    highScore: 0
};

let achievementQueue = [];
let showingAchievement = false;

function loadAchievements() {
    const saved = localStorage.getItem('spaceshooter_achievements_v2');
    if (saved) {
        achievementData = { ...achievementData, ...JSON.parse(saved) };
    }
}

function saveAchievements() {
    localStorage.setItem('spaceshooter_achievements_v2', JSON.stringify(achievementData));
}

function getAchievementLevel(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return 0;

    const value = achievementData[id] || 0;
    let level = 0;

    for (let i = 0; i < ach.levels.length; i++) {
        if (value >= ach.levels[i]) {
            level = i + 1;
        } else {
            break;
        }
    }

    return level;
}

function getNextTarget(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return null;

    const level = getAchievementLevel(id);
    if (level >= ach.levels.length) return null;

    return ach.levels[level];
}

function getProgress(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return { current: 0, target: 1, percent: 0 };

    const current = achievementData[id] || 0;
    const level = getAchievementLevel(id);
    const prevTarget = level > 0 ? ach.levels[level - 1] : 0;
    const nextTarget = ach.levels[level] || ach.levels[ach.levels.length - 1];

    const progressInLevel = current - prevTarget;
    const levelRange = nextTarget - prevTarget;
    const percent = Math.min(100, (progressInLevel / levelRange) * 100);

    return { current, target: nextTarget, percent };
}

function updateAchievement(id, value, isBest = false) {
    const prevLevel = getAchievementLevel(id);

    if (isBest) {
        if (value > achievementData[id]) {
            achievementData[id] = value;
        }
    } else {
        achievementData[id] = (achievementData[id] || 0) + value;
    }

    saveAchievements();

    const newLevel = getAchievementLevel(id);
    if (newLevel > prevLevel) {
        achievementQueue.push({ id, level: newLevel });
        showNextAchievement();
    }
}

function showNextAchievement() {
    if (showingAchievement || achievementQueue.length === 0) return;

    showingAchievement = true;
    const { id, level } = achievementQueue.shift();
    const ach = ACHIEVEMENTS[id];
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'vi');
    const data = ach[lang] || ach.vi;

    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
            <div class="achievement-unlocked">${lang === 'vi' ? 'THÀNH TỰU CẤP ' + level + '!' : 'ACHIEVEMENT LVL ' + level + '!'}</div>
            <div class="achievement-name">${data.name}</div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 50);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
            showingAchievement = false;
            showNextAchievement();
        }, 400);
    }, 3000);
}

function onEnemyKilled() {
    updateAchievement('kills', 1);
}

function onWaveComplete(waveNum) {
    updateAchievement('waves', 1, true);
    if (waveNum > achievementData.waves) {
        achievementData.waves = waveNum;
        saveAchievements();
    }
}

function onBossDefeated() {
    updateAchievement('bosses', 1);
}

function onMoneyEarned(amount) {
    updateAchievement('money', amount);
}

function onDash() {
    updateAchievement('dashes', 1);
}

function onPurchase() {
    updateAchievement('purchases', 1);
}

function onGameStart() {
    updateAchievement('games', 1);
}

function onGameOver(finalScore) {
    updateAchievement('highScore', finalScore, true);
}

function showAchievements() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('achievementsScreen').classList.remove('hidden');
    renderAchievementsList();
}

function hideAchievements() {
    document.getElementById('achievementsScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function renderAchievementsList() {
    const container = document.getElementById('achievementsList');
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'vi');

    let totalLevels = 0;
    let unlockedLevels = 0;

    Object.values(ACHIEVEMENTS).forEach(ach => {
        totalLevels += ach.levels.length;
        unlockedLevels += getAchievementLevel(ach.id);
    });

    let html = `<div class="achievements-progress">${unlockedLevels}/${totalLevels} ${lang === 'vi' ? 'cấp' : 'levels'}</div>`;

    Object.values(ACHIEVEMENTS).forEach(ach => {
        const level = getAchievementLevel(ach.id);
        const maxLevel = ach.levels.length;
        const isMaxed = level >= maxLevel;
        const progress = getProgress(ach.id);
        const data = ach[lang] || ach.vi;
        const desc = data.desc.replace('{target}', progress.target);

        const levelClass = isMaxed ? 'level-max' : level > 0 ? `level-${Math.min(level, 5)}` : 'level-0';

        html += `
            <div class="achievement-item ${levelClass}" data-level="${level}">
                <div class="achievement-item-icon">${ach.icon}</div>
                <div class="achievement-item-info">
                    <div class="achievement-item-header">
                        <span class="achievement-item-name">${data.name}</span>
                        <span class="achievement-item-level">${lang === 'vi' ? 'Cấp' : 'Lv'} ${level}/${maxLevel}</span>
                    </div>
                    <div class="achievement-item-desc">${desc}</div>
                    ${!isMaxed ? `
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill level-${Math.min(level + 1, 5)}" style="width: ${progress.percent}%"></div>
                        </div>
                        <div class="achievement-progress-text">${progress.current}/${progress.target}</div>
                    ` : `<div class="achievement-maxed-text">${lang === 'vi' ? '✓ Hoàn thành!' : '✓ Completed!'}</div>`}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

loadAchievements();

>>>>>>> 887d870520c4e106a9b8fdd58bb653fdf0be3a1f
