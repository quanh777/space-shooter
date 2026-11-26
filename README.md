# Space Shooter: Nebula Vanguard

> Tựa game bắn tàu 2.5D/3D ngoài vũ trụ làm bằng **Vite + TypeScript + Three.js (WebGL2)** — nơi bạn bắt đầu với đúng một khẩu súng cùi Mk.I trên cánh trái, tự lắp thêm hàng nóng lên 6 ổ cứng thân tàu, vừa né đạn vừa canh không để lò phản ứng... tự nướng chín mình.

Nghe đơn giản vậy thôi chứ đừng tưởng vào game bấm giữ nút bắn là thắng nhé: quái không tự hiện giữa mặt để bạn spawn-kill đâu, chúng bay từ ngoài rìa màn hình vào theo đội hình đàng hoàng; trùm cuối cũng không còn là bao cát 2 giây bốc hơi nữa, và lỡ đi ra ngoài vòng bo thì đừng hỏi vì sao thanh máu tụt nhanh hơn lương cuối tháng.

---

## Điểm nhấn phiên bản hiện tại

- **Đồ họa 2.5D/3D WebGL2 & VFX "đã tay"**:
  - Chiến hạm, vũ khí, thùng plasma nổ, quặng vũ trụ và **6 Đại Boss 3 hình thái** đều có model 3D dựng sẵn từ Blender (`.glb` PBR) hoặc procedural mesh sắc nét.
  - Camera nghiêng theo chuyển động tàu, rung kiểu `Trauma²` mượt mà (không giật đùng đùng như bàn chải điện), nháy hitmarker 3 cấp (`thường / chí mạng / kết liễu`), số sát thương nảy parabol, và thanh máu phụ trễ 260ms cho bạn đủ thời gian... tiếc nuối pha né hụt.
- **Vòng lặp Hades 5 Phòng & Du hành Siêu Không Gian**:
  - Mỗi Sector gồm 5 phòng; dọn xong phòng sẽ mở **Cổng Dịch Chuyển** cho bạn chọn nhánh tiếp theo (Kho Vũ Khí, Kho Đột Biến, Trạm Sửa Chữa...) kèm hiệu ứng nhảy bước sóng xuyên qua không gian 3D thực thụ.
  - Phòng 1 thiết kế nhẹ nhàng với đám trinh sát máu giấy cho bạn làm quen súng Mk.I, rồi độ khó mới leo thang dần sang Khiên Chắn (`Shielder`), Tàu Y Tế (`Medic`) và Phòng 5 đụng Boss.
- **Tùy biến 6 Ổ Cứng & 22 Đột Biến Hạt Nhân**:
  - 4 lớp Chiến Hạm khởi đầu (`Vanguard Tiêm Kích`, `Mẫu Hạm Aether`, `Pháo Đài Bastion`, `U Linh Phantom`) mở khóa dần bằng `Scrap Shards` trong Meta-Forge.
  - Lắp súng trực tiếp lên mũi tàu, 4 ổ cánh và 1 ổ kỹ năng sống lưng (`VLS Salvo`, `Spinal Rail-Beam`, `Cryo-EMP Halo`). Chơi liều thì đẩy **Nhiệt (`Heat`)** lên cao ăn bonus, sắp nổ thì bấm `R` Xả Nhiệt hất văng quái.
- **Âm thanh không bị IDM "chôm" nữa**:
  - Toàn bộ 56 hiệu ứng âm thanh tổng hợp (`sfx/build_sfx.py`) được đóng gói thẳng thành JSON tại `public/assets/sfx-bank.json` (tải qua `fetch`) thay vì gọi hàng tá file `.wav` rời — nên Internet Download Manager có nhanh tay tới mấy cũng đành ngồi ngó.

---

## Phím điều khiển (Đọc kỹ kẻo vào trận bấm nhầm nút nổ tàu)

| Phím / Chuột | Tác dụng | Ghi chú kiểu người thật |
|---|---|---|
| `WASD` / Phím mũi tên | Lái tàu | Quán tính mượt, không phải xe tăng nhưng cũng đừng lao đầu vào đạn |
| Chuột / `Tab` | Ngắm bắn / Đổi `Auto-Aim` | Lười rê chuột thì bật `Auto-Aim`, thích bắn tay cho oai thì tắt |
| `Space` / Chuột trái | Bắn súng chính | Có nút `Auto-Fire` nếu ngón trỏ bạn muốn nghỉ phép |
| `Shift` | Lướt Pha (`Dash` / `Parry`) | Lướt đúng lúc đạn chạm mũi tàu sẽ **Parry** phản đạn ngược lại cực phê |
| `E` / Chuột phải | Kỹ năng Sống Lưng | Chỉ lắp được 1 lõi Skill ở sống lưng nên chọn cho khéo |
| `F` | Chrono Overdrive | Làm chậm thời gian để lách đạn như trong phim (nhớ sạc bằng Graze) |
| `R` | Xả Nhiệt Cưỡng Bức | Hạ nhiệt khẩn cấp + thổi bay quái/đạn quanh tàu khi sắp cháy máy |
| `G` | Xưởng Nâng Cấp | Mở/đóng Shop giữa các nhịp nghỉ |
| `P` / `Esc` | Tạm dừng | Nghỉ uống ngụm nước, nhớ là không xóa được đạn đang bay đâu nhé |

---

## Chạy dự án & Kiểm tra tại máy

```bash
npm install                  # Cài thư viện (bắt buộc làm bước này trước)
npm run dev                  # Chạy Vite dev server (mặc định http://localhost:5173)
npm run typecheck            # Soi lỗi TypeScript strict mode
npx vitest run               # Chạy toàn bộ 54 unit tests phần lõi simulation (không cần mở browser)
npm run build                # Build bản production ra thư mục dist/
node scripts/audio_doctor.mjs # Khám sức khỏe toàn bộ 56 file âm thanh & sfx-bank.json
```

> **Mẹo nhỏ cho dev**: Nếu sửa âm thanh trong `sfx/build_sfx.py`, hãy chạy lại script sinh `.wav` và đóng gói lại `public/assets/sfx-bank.json`, sau đó chạy `node scripts/audio_doctor.mjs` để chắc chắn không bài nào bị rè (clipping) hay lệch âm lượng.

---

## Cấu hình Firebase cho Bảng Xếp Hạng (Tùy chọn)

Nếu muốn tự host bảng đua top riêng:
1. Sao chép `.env.example` thành `.env` và điền thông số Firebase project của bạn (tuyệt đối không commit file `.env` thật lên git).
2. Vào **Firebase Console -> Realtime Database -> Rules** và dán rule dưới đây để bật chỉ mục `.indexOn`, lưu được thông tin tàu/trang bị (`hullId`, `build`) và cho phép ghi bản mới + xóa bản cũ khi cập nhật trùng tên:

```json
{
  "rules": {
    "leaderboard": {
      ".indexOn": ["score"],
      ".read": true,
      "$entryId": {
        ".write": "!data.exists() || !newData.exists()",
        ".validate": "newData.hasChildren(['name','score','wave','timestamp']) && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 20 && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() <= 10000000 && newData.child('wave').isNumber() && newData.child('wave').val() >= 0 && newData.child('wave').val() <= 999 && (!newData.hasChild('hullId') || newData.child('hullId').isString()) && (!newData.hasChild('build') || newData.child('build').hasChildren(['hullId']))"
      }
    }
  }
}
```
