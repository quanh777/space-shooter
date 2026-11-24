# Sổ Tay Thiết Kế & Kiến Trúc — Nebula Vanguard

> *Ghi chú của dev (`@Qu4nh`): Tài liệu hồi xưa từng đặt tên mã là "The Modular Scavenger" làm kiểu 2D phẳng cơ bản, nhưng đời không như mơ — dự án đã tiến hóa thành bản Three.js WebGL2 full 3D/2.5D hẳn hoi rồi. Mình viết lại trang này cho đúng với code đang chạy thật, để mai mốt mở lại đỡ tự hỏi "ủa đống bản thiết kế 2D hồi đó mình vứt đâu mất tiêu rồi?".*

---

## 1. Bức Tranh Tổng Quan (Thứ game này thực sự đang làm)

**Space Shooter: Nebula Vanguard** là game bắn tàu arcade roguelite góc nhìn 2.5D/3D trên trình duyệt:
- **Trái tim mô phỏng 2D phẳng 60Hz (`src/game/`)**: Toàn bộ toán học va chạm, đạn đạo, nhiệt độ, phòng ốc, Boss AI nằm gọn trong TypeScript thuần, không phụ thuộc DOM hay WebGL. Nhờ vậy mới chạy được `npx vitest run` kiểm tra 54 ca test trong vài giây mà khỏi cần bật Chrome.
- **Bộ áo 3D Three.js WebGL2 (`src/render/`)**: Đọc snapshot trạng thái từ Simulation mỗi frame để dựng tàu, lắp súng lên đúng 6 ổ cứng, đổ hiệu ứng hậu kỳ (`UnrealBloomPass` + `TacticalPostPass` custom), và quay góc nghiêng camera theo độ "trauma".
- **Lớp HUD & Menu (`src/ui/`)**: HTML/CSS tách biệt với canvas WebGL, cập nhật có chọn lọc (dirty-check) để trình duyệt khỏi phải vẽ lại DOM 60 lần/giây một cách vô nghĩa.

---

## 2. Cấu Trúc Thư Mục Thực Tế (Không Vẽ Vời Thêm)

```text
src/
├── audio/
│   └── SoundEngine.ts           # Phát SFX từ sfx-bank.json (né IDM) + nhạc nền synth theo pha
├── config/
│   ├── constants.ts             # Hằng số kích thước arena, bảng màu, ngưỡng nhiệt & cân bằng
│   ├── hulls.ts                 # 4 lớp Chiến Hạm & 6 nâng cấp Meta-Forge vĩnh viễn
│   ├── weapons.ts               # Vũ khí chính, Kỹ năng lưng, Hãng sản xuất, Augment & Môi trường
│   ├── mutations.ts             # 22 Đột Biến Hạt Nhân & Synergy theo 4 hệ (Vortex/Solar/Swarm/Chrono)
│   ├── shopItems.ts             # 18 nâng cấp lõi trong Shop giữa trận
│   ├── achievements.ts          # Danh sách thành tựu nhiều cấp độ
│   └── languages.ts             # Từ điển song ngữ VI / EN (nơi có cả mấy câu trêu người chơi)
├── engine/
│   └── GameLoop.ts              # Vòng lặp fixed-timestep 60Hz, tự kẹp dt nếu tab bị chuyển nền
├── game/
│   ├── types.ts & GameState.ts  # Kiểu dữ liệu + bộ nhớ trạng thái toàn trận
│   ├── GameSimulation.ts        # Nhạc trưởng điều phối mọi system trong 1 tick mô phỏng
│   ├── map/SectorMapGenerator.ts# Sinh cây phòng phân nhánh cho từng Sector
│   └── systems/
│       ├── PlayerSystem.ts      # Điều khiển tàu, nhiệt, Dash Parry, Drone (giới hạn 3 bé cho đỡ loạn)
│       ├── EnemySystem.ts       # Spawn ngoài màn hình, bay vào đội hình & leo thang độ khó theo phòng
│       ├── BossSystem.ts        # 6 Đại Boss với nhiều phase biến hình & đòn cảnh báo rõ ràng
│       ├── CombatSystem.ts      # Đạn đạo, xuyên giáp, nảy đạn, thùng nổ & tính sát thương
│       ├── RigidContact2D.ts    # Va chạm đẩy lùi vật rắn 2D (nhẹ hơn lôi cả engine vật lý nặng vào)
│       ├── RoomSystem.ts        # Quản lý 5 phòng mỗi Sector + Cổng Dịch Chuyển kiểu Hades
│       ├── RaidSystem.ts        # Độ sâu chiến dịch, đợt tăng viện & bốc thăm nâng cấp nhanh
│       ├── ShopSystem.ts        # Kinh tế vàng/Scrap, mua đồ & kiểm tra đủ tiền
│       └── WaveSystem.ts        # Nhịp đếm đợt quái & thưởng qua ải
├── render/
│   ├── SceneManager.ts          # Camera, ánh sáng, tàu 3D, rung Trauma², nghiêng thân & co giãn khi trúng đạn
│   ├── VFXSystem.ts             # Bể tái chế hạt (Object Pool) cho tia lửa, khói, sốc nhiệt, vệt Dash
│   ├── BackdropSystem.ts        # Nền vũ trụ 3D & hiệu ứng du hành siêu không gian lao vùn vụt qua mặt
│   ├── AssetLoader.ts           # Nạp model .glb từ Blender (có fallback nếu thiếu file)
│   ├── MeshFactory.ts           # Dựng lưới procedural cho quái/vũ khí khi cần
│   └── shaders/                 # GLSL thuần ASCII (gameShaders, shaderLib, TacticalPostPass)
├── services/                    # Lưu điểm cao Firebase, thành tựu, tiến trình Meta-Forge & Kho dự phòng
└── ui/                          # UIManager, icon chiến thuật SVG & styles.css
```

---

## 3. Những Quyết Định Thiết Kế Đã "Va Vấp" Mới Ngộ Ra

### 3.1. Vòng lặp 5 Phòng (Hades-style) & Spawn Ngoài Màn Hình
- **Bài học xương máu**: Hồi đầu quái mọc thẳng giữa bản đồ, kết quả là người chơi vừa lướt qua đã va mặt vào con quái vừa hiện hình — rất ức chế.
- **Cách xử lý hiện tại**: `EnemySystem.computeOffscreenSpawnPoint()` đẩy điểm xuất hiện ra hẳn ngoài khung hình (`rx = 830..920`, `ry = 590..670`), ép quái phải **bay vào đội hình (`ingressActive`)** rồi mới xả đạn. Đồng thời Phòng 1 (`progressTier === 1`) khóa chặt chỉ ra quái nhẹ (`<= 80 HP`, cấm quái to / Shielder / Elite) để người chơi nâng cấp dần từ cây súng Mk.I yếu ớt, sang Phòng 2–4 mới tăng dần độ "chua".

### 3.2. Nhiệt Lượng (`Heat`), Xả Nhiệt (`[R]`) & Dash Parry (`[Shift]`)
- Bắn xả láng mà không nhìn thanh Nhiệt thì chạm ngưỡng Redline sẽ bị rút máu vì quá nhiệt — nhưng ngược lại, nếu biết giữ nhiệt cao với `Hellfire Reactor` hoặc căn nút `[R]` thổi bay quái vây quanh thì lại thành lợi thế lớn.
- Khẩu khởi đầu `pulse_blaster` từng vô tình dính hiệu ứng tự đốt máu ở bản cũ — đã dọn sạch để tân binh vào trận không còn cảnh "tự bắn xong tự nổ".
- **Dash Parry**: Lướt đúng lúc đạn sắp trúng để phản đòn ngược lại; nếu chỉ lướt sượt qua (`Graze`) cũng tích thêm năng lượng **Chrono `[F]`**. Khuyến khích đánh chủ động thay vì chui rúc góc bản đồ.

### 3.3. Kinh Tế & Mini-Pet (Drone)
- Hồi bản cũ Drone tự bắn mạnh tới mức người chơi... bỏ tay khỏi chuột vẫn thắng, còn nâng cấp level thì lên vù vù.
- Nay đã siết trần tối đa `3` Drone, tăng đường cong XP (`145` điểm cơ bản mỗi cấp), chỉnh Boss 1 trâu thực sự (`>= 3200 HP`) để trận đánh trùm có cảm giác sinh tử chứ không phải màn "test DPS 3 giây".

### 3.4. Game Feel ("Đã Tay" Mà Không Mù Mắt)
- **Thị giác có phân cấp**: Ánh sáng, bloom và hạt nổ rực rỡ ưu tiên cho đạn người chơi, chiêu kết liễu và đòn đánh dấu nguy hiểm của Boss. Hạn chế tối đa rác thị giác che mất vùng né đạn.
- **VFX Object Pooling**: Không ai muốn quạt laptop kêu như phản lực chỉ vì `new THREE.Mesh()` 60 lần mỗi giây. Mọi tia lửa, vòng xung kích, muzzle flash starburst 2 cánh, vệt dash cyan->tím đều được cấp phát sẵn trong pool.
- **Thanh máu trễ 260ms (`#hpDelayFill`)**: Khi ăn đạn, thanh máu chính tụt ngay lập tức nhưng thanh vạch vàng phía sau giữ lại `260ms` rồi mới tuột xuống — một tiểu tiết tâm lý kinh điển để cú đánh nhìn "đau" hơn hẳn.
- **Du hành siêu không gian**: Không chỉ vẽ vài đường kẻ giả lập đứng im trước camera, cả tinh vân lẫn lớp sao chiều sâu đều được kéo giãn và phóng thật trong không gian 3D khi nhảy phòng.

### 3.5. Quy Trình Âm Thanh Chống IDM (`sfx/` -> `sfx-bank.json`)
- Tổng hợp 56 file `.wav` thủ tục bằng Python (`sfx/build_sfx.py`) với bộ tổng hợp `sfx/tools/` (sóng PolyBLEP, FM, bão hòa `tanh`, đảo biến thể tránh mỏi tai).
- Toàn bộ 56 file được kiểm định bằng `node scripts/audio_doctor.mjs` (đo dải LUFS, peak trần, độ dài đuôi âm).
- Khi chạy thật trên web, game tải duy nhất một gói JSON (`public/assets/sfx-bank.json` chứa Base64 WAV) và giải mã trực tiếp vào `AudioBuffer` — tạm biệt cảnh Internet Download Manager bật 56 cửa sổ hỏi "Bạn có muốn tải `laser_01.wav` về thư mục Nhạc không?".

---

## 4. Pipeline Đồ Họa 3D Blender (`scripts/build_*.py`)

Nếu sau này có hứng dựng lại tàu hoặc boss mới trong Blender headless:
- Các script nằm trong `scripts/build_*.py` (`build_blender_assets.py`, `build_v11_bosses.py`, `build_weapon_modules.py`, `build_raid_objects.py`, `build_v19_assets.py`).
- Xuất ra `.glb` đặt trong `public/assets/models/`, còn `AssetLoader.ts` sẽ lo phần nạp bất đồng bộ (và nếu thiếu model nào thì `MeshFactory.ts` vẫn có lưới dự phòng để game không bao giờ chết trắng).

---

*Ghi chú cuối: Code nào cũng có thể tối ưu thêm, nhưng nguyên tắc bất di bất dịch của dự án này là **simulation tách rời render**, **test chạy xanh trước khi gáy**, và **game chơi phải sướng tay**.*
