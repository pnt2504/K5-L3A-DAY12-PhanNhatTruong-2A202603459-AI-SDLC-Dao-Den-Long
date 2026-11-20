# Changelog

## Phase 3 · Test Contract v1.2

### Thay đổi phá vỡ tương thích

- Không còn `all_lit`. Mây thắng với `dawn_survived` khi còn sống ở bình minh và còn đủ đèn sáng. Đồng hồ ba đêm đổi sang 240, 270 và 300 giây.
- Đèn sáng hao dầu, nhận châm dầu và có thể tắt. Đèn từng sáng mất tiến độ khi cạn dầu và cần 5 đom đóm để thắp lại.
- Vùng an toàn chỉ hoạt động từ 30 dầu trở lên. Bóng Mực có thể hút đèn yếu với trạng thái `drain`. `lantern_lit` có thêm `relight`. Các sự kiện mới là `refuel`, `lantern_out` và `fuel_drain`.
- Điểm nạp đổi thành 5. Thắp lại được 40. Tỏa Sáng trúng Bóng đang hút được tổng 15. Thưởng bình minh dựa vào đèn, dầu và Ngọn Lửa còn lại.
- Snapshot thêm `fuel`, `ever_lit`, `relit_count` và `player.capacity`. Sức chứa tăng theo lượt thắp và có trần 20. Scenario chấp nhận dầu, lịch sử đèn, số lần thắp và đèn mục tiêu của Bóng Mực.
- Hai replay cũ kiểm tra thắng sớm tại tag `phase-2`. Phát lại Phase 3 dùng trường hợp duy trì đèn cho đến bình minh.
