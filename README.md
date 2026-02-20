# Space Shooter - Web Version 🚀

Game bắn súng không gian với leaderboard online, được convert từ Pygame sang HTML5 Canvas.

## 🎮 Cách Chơi

**Controls:**
- `W` `A` `S` `D` - Di chuyển
- `Shift` - Dash (tốn năng lượng)
- `Space` - Bắn (tự động ngắm)
- `E` - Skill Bomb (sát thương vùng)

**Shop Controls:**
- `1` `2` `3` `4` - Chọn item
- `Enter` - Mua items đã chọn
- `Esc` - Skip shop

## 🔥 Tính Năng

✅ Wave progression với boss mỗi 5 waves  
✅ Shop system sau khi đánh bại boss  
✅ Skill system với upgrades  
✅ Particle effects và animations  
✅ **Online Leaderboard** với Firebase  
✅ Auto-save top scores  

## 🛠️ Setup Firebase (BẮT BUỘC)

### Bước 1: Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" (hoặc "Thêm dự án")
3. Đặt tên project (vd: `     `)
4. Disable Google Analytics (không cần thiết)
5. Click "Create project"

### Bước 2: Tạo Realtime Database

1. Trong project vừa tạo, chọn **"Realtime Database"** từ menu bên trái
2. Click "Create Database"
3. Chọn location (us-central1 hoặc gần bạn nhất)
4. Chọn **"Start in test mode"** (để cho phép đọc/ghi)
5. Click "Enable"

### Bước 3: Lấy Config

1. Click vào **Settings** (biểu tượng bánh răng) → "Project settings"
2. Scroll xuống phần "Your apps"
3. Click vào icon **Web** (`</>`)
4. Đặt nickname (vd: "  ")
5. **KHÔNG** check "Firebase Hosting"
6. Click "Register app"
7. Copy đoạn `firebaseConfig` object

### Bước 4: Update Code

Mở file `firebase-config.js` và thay thế:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",  // Thay bằng key của bạn
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123:web:abc..."
};
```

✅ **Xong! Game đã sẵn sàng với leaderboard online**

## 🌐 Deploy lên GitHub Pages

### Cách 1: Sử dụng GitHub Desktop
1. Tạo repo mới trên GitHub
2. Upload toàn bộ folder `spacegame/`
3. Vào Settings → Pages
4. Source: Deploy from branch
5. Branch: `main`, folder: `/` (root)
6. Save → Đợi vài phút
7. Game sẽ có URL: `https://username.github.io/repo-name/`

### Cách 2: Command Line
```bash
cd spacegame
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

Sau đó enable GitHub Pages như Cách 1.

## 📁 Cấu Trúc Files

```
spacegame/
├── index.html          # Main HTML
├── style.css           # Styling
├── game.js             # Core game logic
├── leaderboard.js      # Firebase leaderboard
├── firebase-config.js  # Firebase setup (CẦN CHỈNH SỬA!)
└── README.md           # File này
```

## 🎯 Tips

- Wave 5, 10, 15... là **Boss waves**
- Boss có 5 attack patterns khác nhau
- Shop xuất hiện sau khi đánh bại boss
- Enemy màu vàng sáng = drop nhiều tiền hơn
- Upgrade skill để tăng damage và giảm cooldown
- Max health có thể tăng lên qua shop

## 🐛 Troubleshooting

**Leaderboard không hoạt động?**
- Kiểm tra console (F12) xem có lỗi Firebase
- Chắc chắn đã update `firebase-config.js`
- Database Rules phải là test mode hoặc:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**Game lag?**
- Đóng các tab khác
- Sử dụng Chrome/Edge để performance tốt nhất

## 📝 Credits

**Original Pygame version:** @Qu4nh  
**Web conversion:** Antigravity AI  
**Powered by:** HTML5 Canvas, Firebase Realtime Database

---

**Made with ❤️ by @Qu4nh**
