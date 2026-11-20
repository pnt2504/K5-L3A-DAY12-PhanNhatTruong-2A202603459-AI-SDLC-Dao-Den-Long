# Bằng chứng Phase 3

Chạy `node scripts/verify-phase3.js` để chạy test, ghi JSONL của kịch bản duy trì đèn và so sánh hai lần chạy đủ Đêm 3. Kịch bản đặt sẵn đèn và Bóng Mực để quan sát các luật mới trong ba giây. Thời gian kiểm chứng có thể thay đổi theo máy.

| Yêu cầu | Bằng chứng |
|---|---|
| Hao dầu, cạn và reset tiến độ, thắp lại, châm dầu, thắng bình minh | [JSONL tái tạo được](maintenance.jsonl) · [Scenario](../../../test/fixtures/phase-3/maintenance.scenario.json) · [Inputs](../../../test/fixtures/phase-3/maintenance.inputs.json) |
| Ngưỡng an toàn đúng 30, hút cộng dồn, chọn mục tiêu, đẩy ra và điểm Tỏa Sáng | [Test tích hợp](../../../test/headless.test.js) · [Báo cáo](tests.tap) |
| Sức chứa, ba ngưỡng bình minh, thứ tự cập nhật và ưu tiên hết lửa | [Báo cáo](tests.tap) |
| Hồi quy | [Tag phase-1](phase-1-regression.tap) · [Tag phase-2](phase-2-regression.tap) · [Báo cáo Linux](linux-verification.txt) |
| Tất định và thời gian headless | [Kết quả và SHA-256](headless-performance.json) |
| Giao diện và bảng màu lưu sau khi tải lại | [Cài đặt](palette.jpg) · [Trạng thái kiểm tra](browser.json) |
| Đèn tắt xẹp có vết rách, thanh dầu và màu Bóng Mực | [Màu chuẩn](lanterns-standard.jpg) · [Màu dễ phân biệt ở nửa giây sau](lanterns-distinct.jpg) |

Để mở [trang kiểm tra hình ảnh](visual-check.html), chạy `npm run dev` rồi truy cập `/docs/proof/phase-3/visual-check.html`. Trang này dùng dữ liệu tình huống riêng và bộ dựng cảnh của game. Bản web kiểm tra menu, tùy chọn màu và HUD Đêm 1. Luật bình minh được kiểm tra qua CLI cho cả ba đêm.

Phép đo bản web dùng `npm run preview`, tham số `?seed=12&fps=1`, Windows 11 và khung 1280×720. Đêm 1 đạt 107,3 FPS trung bình trong 10 giây. Chuỗi ba đêm chưa được chơi trọn trên trình duyệt trong lần kiểm chứng này.
