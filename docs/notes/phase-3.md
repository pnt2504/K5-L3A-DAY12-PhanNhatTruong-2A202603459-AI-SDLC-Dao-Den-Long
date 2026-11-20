# Phase 3 · Đèn cạn dầu

## ADR · Trạng thái đèn và điều kiện bình minh

**Bối cảnh.** Ticket-03 đổi mục tiêu từ thắp tất cả đèn sang giữ đủ ánh sáng khi hết giờ. Đèn phải tắt, được châm và được thắp lại theo các quy tắc có thể tái lập.

**Quyết định.** Mỗi đèn giữ cờ đang sáng, cờ đã từng sáng, số đom đóm đã nạp, bộ đếm thắp lại và lượng dầu tính theo số nguyên đơn vị 1/60. Mỗi tick áp dụng lượng hút cộng dồn và hao tự nhiên trước khi nhận tương tác. Đèn mất dầu được tắt và reset tiến độ nhưng giữ lịch sử. Mỗi Bóng Mực giữ đèn mục tiêu và số tick nó đã hút liên tục. Nhờ vậy, thay đổi seed, nhịp hiển thị hoặc thời gian tạm dừng không làm sai ngưỡng dầu.

**Hệ quả.** Vùng sáng dùng lượng dầu thật, trong khi snapshot làm tròn 1 chữ số. Khi dầu được châm tới đúng 30, lần đẩy Bóng Mực đã bắt đầu sẽ hoàn tất dù dầu xuống dưới 30 ở tick tiếp theo. Đèn đủ 100 tại thời điểm chọn bị loại. Nếu lượng dầu vừa hao một tick và snapshot vẫn làm tròn thành 100, tương tác vẫn có thể châm dầu theo lượng thực. Đèn đặt sẵn trong scenario không tính vào sức chứa hoặc điểm thưởng thắp.

**Bình minh.** Sau khi mọi thao tác trong tick kết thúc, kiểm tra hết Ngọn Lửa trước. Chỉ khi đồng hồ hết và Mây còn sống mới xét 3/5, 4/6 hoặc 5/7 đèn và thưởng dầu còn lại. Việc thắp đủ đèn chỉ thay đổi trạng thái đèn và điểm, để người chơi có thể tiếp tục duy trì ánh sáng.

## Hồi quy

- Test thắp đèn cuối chuyển sang kiểm tra ván vẫn tiếp tục. Test điểm chuỗi đêm dùng thưởng nhiên liệu và lượt thắng ở tick bình minh. Test bục Đảo Chuông vẫn kiểm tra đáp tầng 2 và thắp đèn, với hạn bình minh đặt đúng tick tương tác.
- Test Tỏa Sáng kiểm tra `wander` ở tick hết choáng trước khi Bóng Mực có thể đuổi lại. Test thời lượng đổi sang 240/270/300 giây.
- Hai bản phát lại thắng từ Phase 2 lệ thuộc đèn sáng vĩnh viễn, hành vi cũ của Bóng Mực và thắng sớm. Chúng được giữ để chạy tại tag `phase-2`. Bộ test hiện tại dùng kiểm tra riêng ngưỡng thắng cả ba đêm và scenario duy trì đèn đến bình minh.
- Các test về camera, đầu vào, bùa, gió, Gió Lạc, địa hình, tạm dừng, sự kiện và tính tất định tiếp tục chạy.

## Nhật ký AI

Codex triển khai dầu theo đơn vị nguyên, cập nhật các test bị thay thế và kiểm tra thiết lập màu trên bản web. Test ở đúng 30 dầu phát hiện việc đẩy Bóng Mực bị hủy nếu đèn hao một tick ngay sau khi châm. Sửa bằng cách giữ đích đẩy đến hết lượt. Tái sử dụng mô phỏng và fixtures cũ để giảm ngữ cảnh và lượt chạy. Ước tính 30.000–55.000 token cho ngữ cảnh công cụ, suy luận và mã. Phiên này không có số liệu phí thực tế.
