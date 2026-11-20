# Phase 2 · Ba hòn đảo

Ticket-02 và các bảng số liệu, màu sắc nằm trên [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW). So với Phase 1, ticket thay bản đồ và công thức điểm. Đom đóm ghi điểm lúc nạp, các phép đo có yêu cầu chênh cao, và bộ đếm gameplay dùng `sim_tick`.

## Tiêu chí nghiệm thu Phần 3

| Mục | Tiêu chí và cách kiểm |
|---|---|
| Gió Lạc | Từ tick 1200 ở Đêm 2–3, tối đa hai. Chuyển trạng thái theo khoảng cách, số đom đóm và va chạm. Cướp tối đa ba, không trừ lửa. Pulse làm nó bỏ chạy hoặc trả lại đom đóm đã cướp |
| Bùa Gió | Nhặt theo bán kính và độ cao của đom đóm. Tăng tốc lên 7,2 m/s trong 600 tick, bỏ hồi chiêu Lướt và hồi bùa sau 2700 tick |
| Chuỗi 3 Đêm | Bắt đầu từ menu, qua lời giới thiệu của Ông Đăng. Thắng mở Đêm tiếp theo. Thua hoặc chơi lại chỉ đặt lại Đêm hiện tại. Thắng Đêm 3 hiện Bình Minh và tổng điểm ba Đêm |
| Tạm dừng | Esc/P và cạnh tín hiệu `pause`. Thời gian, hồi chiêu, spawn và TTL đứng yên. Menu cho phép tiếp tục, chơi lại Đêm, cài đặt và về menu |
| Cài đặt | Thay đổi âm lượng và độ nhạy, tải lại trang vẫn giữ cả hai |
| Âm thanh | Có nhạc nền và âm riêng cho nhặt, thắp, tỏa sáng, trúng đòn, nhảy, lướt, thắng, thua, Bóng Mực sinh, đếm ngược và báo gió |
| HUD | Vị trí chỉ số đúng đề, đồng hồ đỏ và nhấp nháy ở 30 giây cuối, 10 ô đom đóm, hồi chiêu, nhắc E kèm số đã nạp, mũi tên tới đèn chưa sáng gần nhất nằm ngoài màn hình |
| Màu và ánh sáng | Màu vật liệu theo bảng chuẩn. Ánh sáng môi trường có cường độ `0.15 + 0.55 × số đèn sáng / tổng số đèn` |

## Quy ước cho các trường hợp đề để mở

- Tick nhấn bỏ tạm dừng tiếp tục mô phỏng ngay. Sự kiện `night_start` ghi ở tick 0 sau snapshot đầu tiên. Việc dựng dữ liệu scenario giữ nguyên điểm 0.
- Bóng Mực mới có 30 tick hiện hình, Bóng trong scenario mặc định ở trạng thái `chase`. Gió Lạc chỉ cướp khi đang đuổi. `dir_deg` là 0 trước khi có hướng gió đầu tiên. Đom đóm tự sinh có `ttl_s: null`.
- Tương tác đèn đo trên XZ theo v1.0. Tại Đêm 3, các đèn ở tầng khác vẫn có thể nạp từ cùng XZ theo hợp đồng. Bục nhảy kích hoạt khi chân chạm mặt đất; Lướt xen giữa dừng biến thiên độ cao và tiếp tục vận tốc phóng sau Lướt.
- Đêm 3 giữ điểm xuất phát v1.0 ở tầng 0. Mặt bên tầng 2 mờ đi khi Mây đứng bên dưới để camera thấy Mây.
- Sự kiện rơi ghi `dropped: 0` vì đom đóm không nằm lại trên đảo, và `lost` là số mất. `removed` của Gió Lạc có nghĩa là rời khỏi danh sách thực thể hoạt động.

## Nhật ký AI và hồi quy

- Codex đối chiếu bản Ticket-02 dán vào chat với lab board để lấy các bảng còn thiếu, sau đó cập nhật thông số, bản đồ, mô phỏng, CLI và trình duyệt.
- Test kiểm tra chính xác sát mép rơi phát hiện sai số tại Y = −10. Sửa ngưỡng so sánh với sai số nhỏ. Test đẩy Bóng Mực khỏi vùng sáng phát hiện việc chọn hướng thay đổi khi các điểm cách đều, nên thêm quy tắc giữ hướng đầu tiên khi khoảng cách bằng nhau.
- Giữ test phản hồi theo camera, cạnh phím, nhập sai, thắng/thua và tất định. Cập nhật kỳ vọng của các test cũ khi ticket đổi chi phí, bản đồ, điểm và hồi sinh. Chạy bộ v1.0 độc lập tại tag `phase-1`.
- Ước tính khoảng 60.000–100.000 token tính cả nội dung công cụ, suy luận và mã trong phiên. Phiên này không có số liệu phí thực tế. Dùng cùng mô hình cho web và CLI, cùng script kiểm chứng và fixture ngắn cho các luật mới để giảm phần chạy thử lặp lại.
