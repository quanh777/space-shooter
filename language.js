const LANGUAGES = {
    vi: {
        loading: 'Đang tải...',
        loadingCredit: 'bởi @Qu4nh',

        playGame: 'CHƠI GAME',
        leaderboard: 'BẢNG XẾP HẠNG',
        controls: 'HƯỚNG DẪN',
        back: 'QUAY LẠI',

        gameOver: 'THUA CUỘC',
        score: 'Điểm',
        wave: 'Wave',
        enterName: 'Nhập tên của bạn',
        submitScore: 'GỬI ĐIỂM',
        playAgain: 'CHƠI LẠI',
        mainMenu: 'MENU CHÍNH',
        top10: '🏆 TOP 10',

        movement: 'Di Chuyển',
        move: 'Di chuyển',
        dash: 'Lướt',
        combat: 'Chiến Đấu',
        autoShoot: 'Tự động ngắm và bắn',
        bombSkill: 'Skill Bomb (Sát thương diện rộng)',
        shop: 'Cửa Hàng',
        selectItems: 'Chọn vật phẩm',
        buyItems: 'Mua vật phẩm đã chọn',
        skipShop: 'Bỏ qua shop',
        tips: 'Mẹo Chơi',
        tip1: '• Wave 5, 10, 15... là BOSS waves',
        tip2: '• Shop xuất hiện sau khi hạ boss',
        tip3: '• Enemy vàng rơi nhiều tiền hơn',
        tip4: '• Nâng cấp skill để gây sát thương lớn',

        bossWave: 'BOSS WAVE',
        getReady: 'Sẵn sàng!',
        prepareForBattle: 'Chuẩn bị chiến đấu!',

        rank: 'Hạng',
        name: 'Tên',
        loadingScores: 'Đang tải...',
        noScores: 'Chưa có điểm nào!',
        submitSuccess: 'Gửi điểm thành công!',
        submitError: 'Lỗi kết nối. Vui lòng thử lại.',
        enterNameAlert: 'Vui lòng nhập tên!',
        nameTooLong: 'Tên không được quá 20 ký tự!',

        health: 'HP',
        energy: 'NL',
        money: 'Tiền',
        paused: 'TẠM DỪNG',
        resume: 'TIẾP TỤC',
        restart: 'CHƠI LẠI',
        pressEscResume: 'Nhấn ESC để tiếp tục',
        pressRRestart: 'Nhấn R để chơi lại',
        backToMenu: 'VỀ MENU',
        nextWaveIn: 'Wave tiếp trong',
        tutorial: 'Hướng dẫn',
        holdToStart: 'Giữ',
        shopTitle: 'CỬA HÀNG',
        waveCompleted: 'Hoàn thành Wave',
        yourMoney: 'Tiền của bạn',
        total: 'Tổng',
        remaining: 'Còn lại',
        buySelected: 'Mua Đã Chọn',
        skipShopBtn: 'Bỏ Qua (ESC)',
        shieldReady: 'Khiên: Sẵn sàng',
        shieldCd: 'Khiên CD'
    },
    en: {
        loading: 'Loading...',
        loadingCredit: 'by @Qu4nh',

        playGame: 'PLAY GAME',
        leaderboard: 'LEADERBOARD',
        controls: 'CONTROLS',
        back: 'BACK',

        gameOver: 'GAME OVER',
        score: 'Score',
        wave: 'Wave',
        enterName: 'Enter your name',
        submitScore: 'SUBMIT SCORE',
        playAgain: 'PLAY AGAIN',
        mainMenu: 'MAIN MENU',
        top10: '🏆 TOP 10',

        movement: 'Movement',
        move: 'Move',
        dash: 'Dash (costs energy)',
        combat: 'Combat',
        autoShoot: 'Auto-aim and shoot',
        bombSkill: 'Bomb Skill (Area damage)',
        shop: 'Shop',
        selectItems: 'Select items',
        buyItems: 'Buy selected items',
        skipShop: 'Skip shop',
        tips: 'Tips',
        tip1: '• Wave 5, 10, 15... are BOSS waves',
        tip2: '• Shop appears after defeating bosses',
        tip3: '• Yellow enemies drop more money',
        tip4: '• Upgrade your skill to deal massive damage',

        bossWave: 'BOSS WAVE',
        getReady: 'Get ready!',
        prepareForBattle: 'Prepare for battle!',

        rank: 'Rank',
        name: 'Name',
        loadingScores: 'Loading...',
        noScores: 'No scores yet!',
        submitSuccess: 'Score submitted successfully!',
        submitError: 'Connection error. Please try again.',
        enterNameAlert: 'Please enter your name!',
        nameTooLong: 'Name must be 20 characters or less!',

        health: 'HP',
        energy: 'EN',
        money: 'Money',
        paused: 'PAUSED',
        resume: 'RESUME',
        restart: 'RESTART',
        pressEscResume: 'Press ESC to resume',
        pressRRestart: 'Press R to restart',
        backToMenu: 'MAIN MENU',
        nextWaveIn: 'Next wave in',
        tutorial: 'Tutorial',
        holdToStart: 'Hold',
        shopTitle: 'SHOP',
        waveCompleted: 'Wave Completed',
        yourMoney: 'Your Money',
        total: 'Total',
        remaining: 'Remaining',
        buySelected: 'Buy Selected',
        skipShopBtn: 'Skip (ESC)',
        shieldReady: 'Shield: Ready',
        shieldCd: 'Shield CD'
    }
};

let currentLang = localStorage.getItem('spaceshooter_lang') || 'vi';

function getLang() {
    return LANGUAGES[currentLang];
}

function toggleLanguage() {
    currentLang = currentLang === 'vi' ? 'en' : 'vi';
    localStorage.setItem('spaceshooter_lang', currentLang);
    updateAllText();
    updateLangButton();
}

function updateLangButton() {
    const btn = document.getElementById('langToggle');
    if (btn) {
        btn.textContent = currentLang === 'vi' ? '🌐 EN' : '🌐 VI';
        btn.title = currentLang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt';
    }
}

function updateAllText() {
    const lang = getLang();

    const loadingText = document.querySelector('.loading-content p:not(.loading-credit)');
    if (loadingText) loadingText.textContent = lang.loading;

    const loadingCredit = document.querySelector('.loading-credit');
    if (loadingCredit) loadingCredit.textContent = lang.loadingCredit;

    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (lang[key]) {
            if (el.tagName === 'INPUT') {
                el.placeholder = lang[key];
            } else {
                el.textContent = lang[key];
            }
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    updateAllText();
    updateLangButton();
});
