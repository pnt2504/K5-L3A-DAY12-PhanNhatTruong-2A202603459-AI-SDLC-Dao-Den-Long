# Đảo Đèn Lồng

- Cài và build bằng `npm ci` rồi `npm run build`. Mở game và API bảng điểm bằng `node scripts/run.js`.
- Chạy `npm test` và dùng skill [verify-game-phase](.agents/skills/verify-game-phase/SKILL.md) để tái tạo bằng chứng. Chạy hợp đồng cũ ở tag tương ứng.
- Contract v1.3 giữ mô phỏng của v1.2 và thêm lệnh benchmark, soak. `game.contract.json` là nguồn tuning. `src/lanterns.js` lưu dầu theo đơn vị 1/60 và chỉ làm tròn khi xuất ra.
- Giữ mô phỏng độc lập với trình duyệt, GPU và thời gian hệ thống. CLI và bản web dùng cùng hàm bước 60 Hz.
- Kiểm tra input theo cạnh lên, snapshot tick 0, dầu cạn trước khi tương tác, thắng ở tick bình minh và thứ tự ưu tiên `no_flames`.
- Ghi bằng chứng từ lệnh thật và nêu rõ các mục còn thiếu. Ghi giả định, thay đổi yêu cầu và chi phí AI ước tính theo phase.
- Chạy lại phép đo trước khi gắn tag phát hành. Thử bảng điểm qua khởi động lại máy chủ và giải nén gói bằng thư mục sạch.
