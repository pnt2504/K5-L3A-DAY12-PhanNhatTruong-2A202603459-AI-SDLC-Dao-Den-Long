# Changelog

## Phase 4 · v1.0.0 · Test Contract v1.3

- Có hai lệnh đo benchmark 200 Bóng Mực và soak 10 đêm. Bản phát hành đóng gói tài nguyên tĩnh và trình chạy cục bộ.
- Có bảng xếp hạng lưu trên máy, giới hạn 10 mục, có lệnh xuất JSON.
- Đổi phím và khôi phục mặc định, có phụ đề và chỉ hướng, giảm chuyển động và cỡ chữ lớn.
- Renderer gom mô hình Bóng Mực và quầng sáng thành các lệnh vẽ dùng chung. Logic và JSONL của v1.2 được giữ.

## Phase 3 · Test Contract v1.2

### Thay đổi phá vỡ tương thích

- Không còn `all_lit`. Mây thắng với `dawn_survived` khi còn sống ở bình minh và còn đủ đèn sáng. Đồng hồ ba đêm đổi sang 240, 270 và 300 giây.
- Đèn sáng hao dầu, nhận châm dầu và có thể tắt. Đèn từng sáng mất tiến độ khi cạn dầu và cần 5 đom đóm để thắp lại.
- Vùng an toàn chỉ hoạt động từ 30 dầu trở lên. Bóng Mực có thể hút đèn yếu với trạng thái `drain`. `lantern_lit` có thêm `relight`. Các sự kiện mới là `refuel`, `lantern_out` và `fuel_drain`.
- Điểm nạp đổi thành 5. Thắp lại được 40. Tỏa Sáng trúng Bóng đang hút được tổng 15. Thưởng bình minh dựa vào đèn, dầu và Ngọn Lửa còn lại.
- Snapshot thêm `fuel`, `ever_lit`, `relit_count` và `player.capacity`. Sức chứa tăng theo lượt thắp và có trần 20. Scenario chấp nhận dầu, lịch sử đèn, số lần thắp và đèn mục tiêu của Bóng Mực.
- Hai replay cũ kiểm tra thắng sớm tại tag `phase-2`. Phát lại Phase 3 dùng trường hợp duy trì đèn cho đến bình minh.

## Phase 2 · Test Contract v1.1

- Chuẩn hóa số liệu, bản đồ, điểm và thứ tự cập nhật. Mở rộng Đảo Bến thành ba đêm với cầu tre, dốc và bục nhảy.
- Thêm Lướt, Bùa Gió, Gió Lạc, gió mạnh, tạm dừng, HUD mới và âm thanh.
- CLI nhận ba đêm. Snapshot có vận tốc, hồi chiêu, thời tiết và các thực thể mới. Tạm dừng dùng `sim_tick`.

## Phase 1 · Test Contract v1.0

- Màn Đảo Bến 3D với Mây, đom đóm, Bóng Mực, năm ngọn đèn, Tỏa Sáng và chơi lại.
- CLI headless 60 tick/giây dùng chung mô phỏng, hỗ trợ seed, scenario, input và JSONL.
