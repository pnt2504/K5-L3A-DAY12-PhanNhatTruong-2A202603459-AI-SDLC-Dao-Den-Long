# Phase 1 · PRD-0

Yêu cầu gốc và Test Contract v1.0 nằm trên [lab board Đảo Đèn Lồng](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW).

## Tiêu chí nghiệm thu

| Yêu cầu | Cách kiểm tra | Kết quả mong đợi |
|---|---|---|
| Camera góc nhìn thứ ba, di chuyển và nhảy | Mở game và chạy test di chuyển | Thấy Mây và đảo 3D, hướng di chuyển theo camera, nhảy một lần mỗi lần nhấn |
| Đom đóm và năm đèn lớn | Chạy kịch bản nhặt và nạp nhiều lần | Túi không vượt sức chứa, đèn ghi nhớ số đã nạp, thắp khi đủ năm |
| Bóng Mực, máu, vùng an toàn | Đặt Bóng Mực gần Mây hoặc đèn đã sáng | Bóng đuổi Mây, chạm thì mất lửa, dừng ở rìa vùng sáng |
| Tỏa Sáng | Đặt Bóng Mực trong phạm vi và thử lúc đủ đom đóm, hồi chiêu và thiếu đom đóm | Tốn ba đom đóm, đẩy và làm choáng mục tiêu, không kích hoạt sai điều kiện |
| Kết thúc và chơi lại | Chạy kịch bản thắng/thua và thử màn kết quả trên trình duyệt | Có điểm đúng và lý do kết thúc, Chơi lại đưa game về trạng thái đầu |
| Hợp đồng headless | Chạy lệnh CLI với input, scenario hợp lệ và sai cấu trúc, so hai lần cùng seed | JSONL đúng loại bản ghi và thứ tự tick, đầu vào sai báo stderr và mã 2, hai kết quả khớp từng byte |

## Giả định và thiết kế

- Đảo bán kính 36 m, các đèn trên vòng bán kính 22 m. Mây chạy 6 m/s, nhảy với vận tốc đầu 7 m/s và trọng lực 20 m/s². Tất cả khoảng cách gameplay dùng XZ theo contract.
- Có 32 đom đóm lúc đầu. Thêm một con mỗi 3 giây nếu trên đảo còn dưới 40. Bóng Mực bắt đầu xuất hiện sau 12 giây, thêm một con mỗi 14 giây, tối đa năm con. Bóng đuổi thẳng về Mây và dừng ở mép vùng sáng.
- Khi nạp, ưu tiên đèn chưa sáng gần nhất. Nếu khoảng cách bằng nhau, ưu tiên ID nhỏ hơn. Đèn nhớ số đã nhận. Khi đèn vừa sáng, Bóng Mực bên trong được đẩy ra rìa ngay.
- Tỏa Sáng làm choáng và đẩy ngay ở tick kích hoạt. Bị Bóng Mực chạm làm rơi một nửa túi (làm tròn xuống), có thể nhặt lại. Rơi khỏi đảo khi Y < −10 làm mất một lửa và toàn bộ túi, sau đó Mây trở về điểm xuất phát.
- Thứ tự kết thúc trong cùng một tick là hết lửa, đủ đèn, rồi hết giờ. Có thể đổi các giá trị tuning qua `game.contract.json` và chạy lại test. Phase 1 không có Lướt.
- Dùng JavaScript, Vite và Three.js để có bản web chạy trên laptop. Cảnh 3D và CLI chạy cùng mô phỏng, có seed riêng cho phần trang trí.

## Nhật ký AI và retro

- Codex đọc PRD-0 và contract trên lab board, triển khai mô phỏng, CLI và giao diện 3D, rồi chạy test. Một điểm đã rà lại là ảnh hưởng của góc camera tới hướng phím trái/phải trên màn hình. Hướng CLI tiếp tục dùng công thức trong contract và đã có test độc lập.
- Harness dùng `AGENTS.md` cho các quy ước và `scripts/verify-phase1.js` để tái tạo bằng chứng. Dùng một bộ scenario nhỏ và chạy lại test để kiểm tra nhiều yêu cầu, không cần gửi toàn bộ log cho agent sau mỗi lần sửa.
- Ước tính khoảng 25.000–40.000 token cho phiên triển khai và kiểm chứng, gồm ngữ cảnh công cụ, suy luận và mã sinh ra. Số liệu tính phí thực tế không được báo trong phiên này.
- Nếu làm lại, đưa kịch bản hoàn thành một màn từ trạng thái mặc định vào kiểm tra sớm hơn, song song với các kịch bản cô lập cho từng luật.
