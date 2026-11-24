# Tiêu Chuẩn Âm Thanh: Nebula Vanguard (v20.6+)

> Đọc lướt 1 phút trước khi đụng vào `sfx/build_sfx.py`, kẻo tiếng súng bắn ra nghe như chuông lò vi sóng hoặc làm điếc tai người chơi khi họ lỡ nâng 5x tốc bắn.

## Cá Tính Âm Thanh Của Game
- **Bối cảnh**: Bắn tàu chiến thuật 2.5D/3D vượt phòng kiểu Hades, có lắp súng vật lý và đánh trùm thiết giáp nhiều pha.
- **Chất âm**: *Tactical Sci-Fi + Foley Giòn Khét*. Tuyệt đối nói **không** với tiếng `beep` sóng sin trần trụi thời 1980. Đạn trúng phải có cảm giác khựng/gõ giòn (`hitmarker`), chí mạng phải lanh canh như vỡ pha lê, nổ Boss phải có lực sub-bass rung bàn, và nhặt tiền/combo phải chạy thang âm ngũ cung cho sướng tai.
- **Công cụ phát**: TypeScript + WebAudio `AudioBuffer`. Toàn bộ 56 mẫu `.wav` được nén vào đúng một file `public/assets/sfx-bank.json` để trình duyệt và IDM (Internet Download Manager) khỏi tưởng nhầm game là trang tải nhạc chuông miễn phí.

## Bảng Nguyên Liệu Tổng Hợp
- **Dao động sạch**: Sóng PolyBLEP chống răng cưa (`triangle`, `saw`, `square`), tỷ lệ FM kim loại/thủy tinh (`1.4`, `2.0`, `3.0`), bão hòa `tanh` làm ấm cú đấm sub-bass, và white noise cắt tần cao cho đỡ xè chói.
- **Chất liệu trong thế giới game**: Vỏ tàu composite gốm, tia plasma, cuộn từ trường, khiên năng lượng, tiểu hành tinh quặng và thùng nổ công nghiệp.
- **Nhịp & Không gian**: Tông A thứ / C trưởng (`A1 = 110Hz`), nhịp hành quân `166 BPM` (đẩy gấp hơn khi gặp Boss). Phòng chiến đấu có vang nhẹ (`reverb mix 0.08–0.18`), còn tiếng bấm UI thì khô ráo sắc nét (`dry`).

## Thang Đo Âm Lượng (Loudness Ladder - `master.lufs`)
Đừng để tiếng rê chuột to hơn tiếng nổ Boss — giữ đúng thứ bậc này khi chạy `node scripts/audio_doctor.mjs`:

| Tầng ưu tiên | Ngưỡng LUFS | Những âm nào nằm ở đây |
|---|---|---|
| **Hero (Siêu sao)** | `-12` đến `-14` | Boss nổ tung, Bomb/Salvo, Railbeam, EMP, Xuất kích, Nhảy không gian |
| **Gameplay (Chủ lực)** | `-15` đến `-18` | Tiếng súng chính, trúng đạn, bật khiên, Dash, nhặt vàng, Đột biến, Lên cấp |
| **Support (Nền phụ)** | `-19` đến `-21` | Tiếng Drone trinh sát bắn (cố tình vặn nhỏ `-21 LUFS` để bầy Drone không át hết súng chính), tia lửa Graze, cảnh báo rìa bão |
| **UI (Giao diện)** | `-19` đến `-24` | Click nút, lướt thẻ, xác nhận, quay lại, báo lỗi hết tiền, vòng quay đồ |

## Quy Tắc Sinh Tồn Cho Đôi Tai
1. **Không spam trùng pha**: Cùng một loại súng bắn liên thanh phải đảo biến thể + lệch pitch nhẹ, nếu không nghe như máy khoan bê tông.
2. **Sửa xong phải khám bác sĩ**: Sau khi chạy `sfx/build_sfx.py` và đóng gói lại `public/assets/sfx-bank.json`, bắt buộc chạy `node scripts/audio_doctor.mjs` cho tới khi `0 FAIL, 0 WARN`.
