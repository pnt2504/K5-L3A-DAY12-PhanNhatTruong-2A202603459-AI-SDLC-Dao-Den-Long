# Phase 4 · Đưa game vào bản phát hành

- Benchmark dùng renderer của game, giữ cảnh và hiệu ứng cơ bản. Đường đá trang trí của Phase 1 được tắt. Camera trình bày theo góc XZ của lab. Khoảng đo dùng các khoảng thời gian khung nằm trọn giữa mốc kết thúc khởi động và mốc kết thúc phép đo.
- Nhân bản mô hình, mắt và quầng Bóng Mực trên GPU để giữ đúng 200 con mà không tạo hàng trăm lượt vẽ riêng. Soak chỉ chạy mô phỏng, dùng chỉ số đêm bắt đầu từ 0 cho công thức cộng seed. Thu gom rác ở cả hai mốc RSS.
- Trình chạy cục bộ mở một cổng loopback và dùng cùng tệp bảng điểm với CLI xuất JSON. Khi chạy trên hosting tĩnh, lưu bảng điểm vào hồ sơ trình duyệt.
- Test trình duyệt đầu tiên giả định giữ W sẽ làm thua trong 48 giây. Video và log cho thấy giả định này phụ thuộc nhịp khung hình và trạng thái đầu vào. Kiểm tra sau đó đợi những mốc hiển thị đã quan sát như nhặt đom đóm, nạp đèn và sự xuất hiện của màn kết quả. Phần thử phím và chữ lớn cũng được chạy sau tải lại trang.
- Lần đóng gói đầu, `tar.exe` làm sai ký tự tiếng Việt trong đường dẫn tuyệt đối. Tạo archive bằng tên tương đối trong thư mục tạm, rồi dùng Node để chép sang thư mục phát hành.
- Soak với V8 mặc định tăng RSS khoảng 40% trên Linux. Thử giới hạn bộ nhớ thế hệ trẻ vẫn vượt 20%. Chế độ `--jitless` giảm mức tăng còn khoảng 7% trong các lượt thử Linux và giữ nguyên cách đo RSS, mô phỏng và bộ seed.
- Giữ tuning và giao thức headless của Phase 3. Số liệu đo, ảnh, kết quả hồi quy và cách tái tạo nằm ở `docs/proof/phase-4/`.
