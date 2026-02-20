<<<<<<< HEAD
﻿const LANGUAGES = {
    vi: {
        loading: 'Đang tải...',
        loadingCredit: 'bởi @Qu4nh',
        subtitle: 'Cuộc chiến vũ trụ 67',

        playGame: 'CHƠI',
        leaderboard: 'BẢNG XẾP HẠNG',
        instructions: 'HƯỚNG DẪN',
        info: 'THÔNG TIN',
        achievementsTitle: 'THÀNH TỰU',
        back: 'QUAY LẠI',

        gameOver: 'THUA CUỘC',
        score: 'Điểm',
        wave: 'Wave',
        enterName: 'Nhập tên của bạn',
        submitScore: 'GỬI ĐIỂM',
        encourageSubmit: '🏆 Ghi danh vào bảng xếp hạng!',
        rankPreview: 'Bạn sẽ xếp hạng #{rank}!',
        playAgain: 'CHƠI LẠI',
        mainMenu: 'MENU CHÍNH',
        top10: '🏆 TOP 10',

        controls: 'HƯỚNG DẪN',
        leaderboardTitle: 'BẢNG XẾP HẠNG',
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
        tips: 'Mẹo',
        tip1: '• Wave 5, 10, 15... là BOSS waves',
        tip2: '• Shop xuất hiện sau khi hạ boss',
        tip3: '• Enemy vàng rơi nhiều tiền hơn',
        tip4: '• Nâng cấp skill để gây sát thương lớn',

        aboutGame: 'Về Game',
        gameDescription: 'Trò chơi arcade vũ trụ được phát triển độc lập, kết hợp cơ chế di chuyển nhanh nhẹn với hệ thống tiến hóa nhân vật sâu sắc.',
        credits: 'Credits',
        developer: 'Phát triển bởi',
        version: 'Phiên bản',
        releaseDate: 'Ngày phát hành',
        lastUpdated: 'Cập nhật cuối',
        codeLines: 'Dòng code',
        techSkills: 'Kỹ năng kỹ thuật',
        skill1: '• Canvas 2D rendering & tối ưu game loop',
        skill2: '• Thiết kế hướng đối tượng (Factory, State pattern)',
        skill3: '• Tích hợp Firebase Realtime Database',
        skill4: '• Responsive design & xử lý touch event',
        skill5: '• Đa ngôn ngữ (i18n)',
        highlights: 'Điểm nổi bật',
        highlight1: '• Hệ thống điều khiển phản hồi tức thì',
        highlight2: '• Boss với nhiều giai đoạn chiến đấu',
        highlight3: '• Hơn 10 nâng cấp đa dạng',
        highlight4: '• Xếp hạng trực tuyến toàn cầu',
        feedback: 'Góp ý & Đánh giá',
        feedbackDesc: 'Ý kiến của bạn giúp game ngày càng hoàn thiện!',
        sendFeedback: 'Gửi Góp Ý',

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
        subtitle: '67 space battles',

        playGame: 'PLAY',
        leaderboard: 'LEADERBOARD',
        instructions: 'INSTRUCTIONS',
        info: 'INFO',
        achievementsTitle: 'ACHIEVEMENTS',
        back: 'BACK',

        gameOver: 'GAME OVER',
        score: 'Score',
        wave: 'Wave',
        enterName: 'Enter your name',
        submitScore: 'SUBMIT SCORE',
        encourageSubmit: '🏆 Join the leaderboard!',
        rankPreview: 'You would rank #{rank}!',
        playAgain: 'PLAY AGAIN',
        mainMenu: 'MAIN MENU',
        top10: '🏆 TOP 10',

        controls: 'CONTROLS',
        leaderboardTitle: 'LEADERBOARD',
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

        aboutGame: 'About Game',
        gameDescription: 'An independently developed space arcade game combining responsive movement mechanics with deep character progression.',
        credits: 'Credits',
        developer: 'Developed by',
        version: 'Version',
        releaseDate: 'Release Date',
        lastUpdated: 'Last Updated',
        codeLines: 'Lines of code',
        techSkills: 'Technical Skills',
        skill1: '• Canvas 2D rendering & game loop optimization',
        skill2: '• Object-oriented design patterns (Factory, State)',
        skill3: '• Firebase Realtime Database integration',
        skill4: '• Responsive design & touch event handling',
        skill5: '• Multi-language internationalization (i18n)',
        highlights: 'Highlights',
        highlight1: '• Instant-response control system',
        highlight2: '• Multi-phase boss battles',
        highlight3: '• 10+ diverse upgrades',
        highlight4: '• Global online leaderboard',
        feedback: 'Feedback & Review',
        feedbackDesc: 'Your feedback helps improve the game!',
        sendFeedback: 'Send Feedback',

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

    const leaderboardScreen = document.getElementById('leaderboardScreen');
    if (leaderboardScreen && !leaderboardScreen.classList.contains('hidden')) {
        loadLeaderboard();
    }

    const gameOverLeaderboard = document.getElementById('gameOverLeaderboard');
    if (gameOverLeaderboard && gameOverLeaderboard.innerHTML.includes('leaderboard-table')) {
        loadGameOverLeaderboard();
    }

    const achievementsScreen = document.getElementById('achievementsScreen');
    if (achievementsScreen && !achievementsScreen.classList.contains('hidden')) {
        if (typeof renderAchievementsList === 'function') renderAchievementsList();
    }
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
=======
const LANGUAGES = {
    vi: {
        loading: 'Đang tải...',
        loadingCredit: 'bởi @Qu4nh',
        subtitle: 'Cuộc chiến vũ trụ 67',

        playGame: 'CHƠI',
        leaderboard: 'BẢNG XẾP HẠNG',
        instructions: 'HƯỚNG DẪN',
        info: 'THÔNG TIN',
        achievementsTitle: 'THÀNH TỰU',
        back: 'QUAY LẠI',

        gameOver: 'THUA CUỘC',
        score: 'Điểm',
        wave: 'Wave',
        enterName: 'Nhập tên của bạn',
        submitScore: 'GỬI ĐIỂM',
        encourageSubmit: '🏆 Ghi danh vào bảng xếp hạng!',
        rankPreview: 'Bạn sẽ xếp hạng #{rank}!',
        playAgain: 'CHƠI LẠI',
        mainMenu: 'MENU CHÍNH',
        top10: '🏆 TOP 10',

        controls: 'HƯỚNG DẪN',
        leaderboardTitle: 'BẢNG XẾP HẠNG',
        movement: 'Di Chuyển',
        move: 'Di chuyển',
        dash: 'Lướt (tốn năng lượng)',
        combat: 'Chiến Đấu',
        autoShoot: 'Tự động ngắm và bắn',
        bombSkill: 'Skill Bomb (Sát thương diện rộng)',
        shop: 'Cửa Hàng',
        selectItems: 'Chọn vật phẩm',
        buyItems: 'Mua vật phẩm đã chọn',
        skipShop: 'Bỏ qua shop',
        tips: 'Mẹo',
        tip1: '• Wave 5, 10, 15... là BOSS waves',
        tip2: '• Shop xuất hiện sau khi hạ boss',
        tip3: '• Enemy vàng rơi nhiều tiền hơn',
        tip4: '• Nâng cấp skill để gây sát thương lớn',

        aboutGame: 'Về Game',
        gameDescription: 'Trò chơi arcade vũ trụ được phát triển độc lập, kết hợp cơ chế di chuyển nhanh nhẹn với hệ thống tiến hóa nhân vật sâu sắc.',
        credits: 'Credits',
        developer: 'Phát triển bởi',
        version: 'Phiên bản',
        releaseDate: 'Ngày phát hành',
        lastUpdated: 'Cập nhật cuối',
        codeLines: 'Dòng code',
        techSkills: 'Kỹ năng kỹ thuật',
        skill1: '• Canvas 2D rendering & tối ưu game loop',
        skill2: '• Thiết kế hướng đối tượng (Factory, State pattern)',
        skill3: '• Tích hợp Firebase Realtime Database',
        skill4: '• Responsive design & xử lý touch event',
        skill5: '• Đa ngôn ngữ (i18n)',
        highlights: 'Điểm nổi bật',
        highlight1: '• Hệ thống điều khiển phản hồi tức thì',
        highlight2: '• Boss với nhiều giai đoạn chiến đấu',
        highlight3: '• Hơn 10 nâng cấp đa dạng',
        highlight4: '• Xếp hạng trực tuyến toàn cầu',
        feedback: 'Góp ý & Đánh giá',
        feedbackDesc: 'Ý kiến của bạn giúp game ngày càng hoàn thiện!',
        sendFeedback: 'Gửi Góp Ý',

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
        subtitle: '67 space battles',

        playGame: 'PLAY',
        leaderboard: 'LEADERBOARD',
        instructions: 'INSTRUCTIONS',
        info: 'INFO',
        achievementsTitle: 'ACHIEVEMENTS',
        back: 'BACK',

        gameOver: 'GAME OVER',
        score: 'Score',
        wave: 'Wave',
        enterName: 'Enter your name',
        submitScore: 'SUBMIT SCORE',
        encourageSubmit: '🏆 Join the leaderboard!',
        rankPreview: 'You would rank #{rank}!',
        playAgain: 'PLAY AGAIN',
        mainMenu: 'MAIN MENU',
        top10: '🏆 TOP 10',

        controls: 'INSTRUCTIONS',
        leaderboardTitle: 'LEADERBOARD',
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

        aboutGame: 'About Game',
        gameDescription: 'An independently developed space arcade game combining responsive movement mechanics with deep character progression.',
        credits: 'Credits',
        developer: 'Developed by',
        version: 'Version',
        releaseDate: 'Release Date',
        lastUpdated: 'Last Updated',
        codeLines: 'Lines of code',
        techSkills: 'Technical Skills',
        skill1: '• Canvas 2D rendering & game loop optimization',
        skill2: '• Object-oriented design patterns (Factory, State)',
        skill3: '• Firebase Realtime Database integration',
        skill4: '• Responsive design & touch event handling',
        skill5: '• Multi-language internationalization (i18n)',
        highlights: 'Highlights',
        highlight1: '• Instant-response control system',
        highlight2: '• Multi-phase boss battles',
        highlight3: '• 10+ diverse upgrades',
        highlight4: '• Global online leaderboard',
        feedback: 'Feedback & Review',
        feedbackDesc: 'Your feedback helps improve the game!',
        sendFeedback: 'Send Feedback',

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

    const leaderboardScreen = document.getElementById('leaderboardScreen');
    if (leaderboardScreen && !leaderboardScreen.classList.contains('hidden')) {
        loadLeaderboard();
    }

    const gameOverLeaderboard = document.getElementById('gameOverLeaderboard');
    if (gameOverLeaderboard && gameOverLeaderboard.innerHTML.includes('leaderboard-table')) {
        loadGameOverLeaderboard();
    }

    const achievementsScreen = document.getElementById('achievementsScreen');
    if (achievementsScreen && !achievementsScreen.classList.contains('hidden')) {
        if (typeof renderAchievementsList === 'function') renderAchievementsList();
    }
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


>>>>>>> 887d870520c4e106a9b8fdd58bb653fdf0be3a1f
