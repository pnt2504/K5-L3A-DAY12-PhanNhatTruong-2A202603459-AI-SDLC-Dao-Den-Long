# Đảo Đèn Lồng

- Cài và build bằng `npm ci` rồi `npm run build`. Mở game bằng `npm run preview -- --open`.
- Chạy `npm test` và `node scripts/verify-phase3.js`. Dùng skill [verify-game-phase](.agents/skills/verify-game-phase/SKILL.md) để tái tạo bằng chứng. Kiểm chứng hợp đồng cũ ở tag `phase-1` hoặc `phase-2`.
- Ticket-03 và Test Contract v1.2 áp dụng cho cả ba Đêm. `game.contract.json` là nguồn tuning. `src/lanterns.js` lưu dầu theo đơn vị 1/60 và chỉ làm tròn khi xuất ra.
- Giữ mô phỏng độc lập với trình duyệt, GPU và thời gian hệ thống. CLI và bản web dùng cùng hàm bước 60 Hz.
- Kiểm tra input theo cạnh lên, snapshot tick 0, dầu cạn trước khi tương tác, thắng ở tick bình minh và thứ tự ưu tiên `no_flames`.
- Ghi bằng chứng từ lệnh thật và nêu rõ các mục còn thiếu. Ghi giả định, thay đổi yêu cầu và chi phí AI ước tính theo phase.
