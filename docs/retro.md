# Retro · Đảo Đèn Lồng v1.0.0

## Kết quả qua bốn phase

| Phase | Quyết định và kết quả | Điều rút ra |
|---|---|---|
| 1 · PRD-0 | Chốt cách chơi và tách mô phỏng 60 Hz khỏi Three.js. Chạy kịch bản đầu đến khi thắp đủ năm đèn. Kiểm tra CLI, cảnh 3D, thua và chơi lại | Chốt định dạng và ví dụ đầu vào sớm giúp giảm sửa lại. Khi AI nối camera, hướng trái/phải của bản web cần đối chiếu với công thức XZ của CLI bằng phép thử thực |
| 2 · Ba hòn đảo | Chuẩn hóa tuning và bổ sung cầu, dốc, bục nhảy, dash, Bùa Gió và Gió Lạc. Chạy hai đêm từ bản đồ mặc định đến khi thắng và dùng tình huống cô lập để kiểm tra phần cuối Đêm 3 | Ticket dán vào chat thiếu bảng tuning và màu. Đọc lab board tránh dùng số tự đoán. Test biên bắt được sai số ở Y = −10 và trường hợp chọn hướng đẩy khi hai điểm cách đều |
| 3 · Đèn cạn dầu | Lưu dầu bằng đơn vị nguyên 1/60, thay thắng sớm bằng giữ đủ đèn đến bình minh. Chạy lại các tag cũ và thử cài đặt màu trên trình duyệt | Test đúng 30 dầu phát hiện việc đẩy Bóng Mực dừng ngay khi dầu hao ở tick kế. Giữ đích đẩy đến hết lượt, đồng thời tách giá trị thật khỏi giá trị hiển thị đã làm tròn |
| 4 · Phát hành | Đo cảnh chuẩn 200 Bóng Mực, chạy soak 10 đêm, lưu bảng điểm trên đĩa, kiểm chứng bàn phím và chữ lớn. Đóng gói bản web đã build | So kết quả test ở cấp CLI với giao diện chạy thật. Số FPS phải đi cùng độ phân giải, renderer, thiết lập VSync và trạng thái chạy, còn RSS phải được đo ở các điểm tương đương |

## Làm việc với AI

Hiệu quả nhất là đưa cho agent phần contract vừa thay đổi, viết tiêu chí nghiệm thu và chạy ví dụ nhỏ ngay sau thay đổi. Mô phỏng dùng chung giúp sửa một lần cho CLI và trình duyệt. Các tag cũ làm mốc phân biệt hồi quy với yêu cầu vừa thay thế. Kết quả tích lũy đáng tin nhất là JSONL, log test, ảnh và video tạo từ các lệnh thật.

Phần tốn thời gian là thay đổi nhiều luật cùng lúc, nhất là khi các bản phát lại cũ dựa vào lộ trình Bóng Mực hoặc thắng sớm. Một cửa sổ chơi thử có thể xuất hiện đúng giao diện trong khi môi trường nhận sai phím, bảng điểm chưa lưu lâu dài hoặc không mở được từ bản giải nén. Kiểm tra hành vi qua reload, khởi động lại máy chủ và bản clone sạch phát hiện những vấn đề đó sớm hơn đọc mã riêng lẻ.

`AGENTS.md` giữ lệnh chạy, ranh giới mô phỏng và các điểm phải kiểm trong mỗi lần sửa. Skill `verify-game-phase` giúp tái tạo bằng chứng theo tag. Bộ test và script kiểm chứng phát hiện lỗi tốt hơn chỉ dẫn bằng lời, nhất là ở điểm tiếp giáp tick, bán kính và ngưỡng dầu. Lịch sử git giữ thay đổi quy tắc cùng test tương ứng.

## Token và lần làm sau

Ước tính Phases 1–4 lần lượt khoảng **25.000–40.000**, **60.000–100.000**, **30.000–55.000** và **45.000–80.000** token, tổng khoảng **160.000–275.000**. Khoảng này tính cả ngữ cảnh công cụ, suy luận và mã sinh ra. Phiên làm việc không cung cấp số tiền đã tính. Tái sử dụng mô phỏng, fixtures và bảng checklist giúp giảm đọc lại toàn bộ repo. Khi cần xác nhận, agent đọc mục tiêu cần thiết trong đặc tả và đầu ra đã lọc.

Nếu làm lại, sẽ xây kịch bản kiểm tra trình duyệt từ Phase 1, ghi trace theo tick cho phần bị test ẩn chấm và chạy benchmark có môi trường cố định ngay khi thêm nhiều thực thể. Việc chuẩn bị gói chạy và đường xuất bằng chứng từ sớm sẽ giảm thời gian ở lượt phát hành cuối.
