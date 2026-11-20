# Bằng chứng Phase 2

Chạy `node scripts/verify-phase2.js` để chạy bộ test, phát lại đầu vào thắng, đo 21.600 tick và so hai tệp JSONL theo từng byte. Bản Phase 1 có thể chạy từ checkout riêng bằng `node --test --test-reporter=tap`.

| Yêu cầu | Bằng chứng |
|---|---|
| Hồi quy và schema v1.1 | [TAP Windows](tests.tap) · [TAP và phép đo Linux](linux-verification.txt) · [TAP tag phase-1](phase-1-regression.tap) |
| Đảo Bến và Đảo Cau chơi được từ bản đồ mặc định | [Đêm 1, seed 12](night-1-win.jsonl) · [Đêm 2, seed 2](night-2-win.jsonl) |
| Bục nhảy và đèn cuối ở Đảo Chuông | [Đêm 3 dùng scenario sáu đèn đã sáng](night-3-win.jsonl) · [Scenario](../../../test/fixtures/phase-2/night-3-final.scenario.json) |
| Gió mạnh, cầu tre, dốc, vách, Lướt, Gió Lạc, Bùa Gió và vùng an toàn | [Test tích hợp CLI](../../../test/headless.test.js) · [TAP v1.1](tests.tap) |
| Chuỗi đêm và điểm tích lũy | Test gọi CLI cho từng đêm rồi dùng cùng logic chuyển đêm và điểm của bản web. [TAP v1.1](tests.tap) |
| Menu, lời Ông Đăng, HUD, tạm dừng, chơi lại, cài đặt được lưu | [Ảnh HUD và FPS](fps-and-hud.jpg) · [Tạm dừng](pause.jpg) · [Cài đặt](settings.jpg) · [Trạng thái trình duyệt](browser.json) |
| Nhạc và hiệu ứng âm thanh | [Test lập lịch Web Audio](../../../test/audio.test.js) · [TAP](tests.tap) |
| Hiệu năng headless | [Hai phép đo, SHA-256 và kết quả](headless-performance.json) |

Phép đo hình ảnh dùng bản production qua `npm run preview`, khung 1280×720, Windows 11, Intel Core i5-12500H, Intel Iris Xe và NVIDIA RTX 3050 Laptop có trên máy. Mở `?seed=12&fps=1`, vào Đêm 1 và đọc trung bình của 10 giây sau giai đoạn làm nóng 1,2 giây. Kịch bản đo headless tắt gió và giữ bất tử để chạy trọn Đêm 3 với thực thể tự sinh. Chuyển cảnh sau thắng được kiểm bằng logic chuỗi đêm và các lần chạy CLI. Phép thử trình duyệt trong bảng dùng Đêm 1.
