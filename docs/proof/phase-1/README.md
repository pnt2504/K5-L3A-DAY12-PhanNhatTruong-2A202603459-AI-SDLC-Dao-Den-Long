# Bằng chứng Phase 1

Chạy `node scripts/verify-phase1.js` từ gốc repo để chạy các kiểm tra và tạo lại log.

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Màn chơi 3D góc nhìn thứ ba, nón lá, đèn nhỏ, HUD | [Ảnh Chrome khi bắt đầu Đêm 1](gameplay.jpg) | Chrome hiển thị cảnh 3D, Mây và HUD |
| Màn thua và Chơi lại trên trình duyệt | [Thua](loss.jpg) · [Sau khi chơi lại](restart.jpg) | Đứng yên để Bóng Mực lấy hết lửa. Nhấn Chơi lại khôi phục 3 lửa, 04:00 và 0/5 đèn |
| Hoàn thành màn từ trạng thái mặc định | [Đầu vào](../../../test/fixtures/full-night.inputs.json) · [JSONL](full-night.jsonl) | Seed 12, không override scenario. Thắp được cả 5 đèn. Thắng tick 2284, được 1302 điểm |
| Giữ trạng thái input, xoay theo yaw, nhảy | [TAP](tests.tap) · [Test](../../../test/headless.test.js) | Kiểm tra tọa độ, độ cao, cạnh kích hoạt và tick |
| Nhặt trong bán kính, nạp nhiều lần, tính điểm | [Thắng một tick](win.jsonl) · [TAP](tests.tap) | Nhặt 3 đom đóm và nạp 5 vào đèn cuối. Thắng tick 1, được 398 điểm |
| Bóng Mực, Tỏa Sáng, bất tử, vùng sáng, rơi và thua | [Tỏa Sáng rồi thua](pulse-loss.jsonl) · [TAP](tests.tap) | Làm choáng, đẩy Bóng Mực rồi thua tại tick 202. Test bổ sung kiểm tra vùng sáng, thời gian bất tử, rơi và hết giờ |
| Schema, lỗi định dạng, tất định | [TAP](tests.tap) · [So sánh SHA-256](determinism.txt) | 12 bài test thành công. Hai lần chạy cùng seed và tham số cho JSONL khớp từng byte |

`gameplay.jpg` được chụp khi chạy bản web mặc định với `?seed=12`. Các kịch bản CLI kiểm tra hành vi từ đầu đến cuối thông qua cùng mô phỏng mà bản web sử dụng. Thời gian trong báo cáo TAP có thể thay đổi theo máy.
