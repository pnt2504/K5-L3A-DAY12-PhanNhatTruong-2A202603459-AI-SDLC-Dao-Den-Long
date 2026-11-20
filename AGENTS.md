# Đảo Đèn Lồng

- Cài và build bằng `npm ci` rồi `npm run build`. Mở game bằng `npm run preview -- --open`.
- Chạy `npm test` và `node scripts/verify-phase2.js`. Dùng skill [verify-game-phase](.agents/skills/verify-game-phase/SKILL.md) để tái tạo bằng chứng. Kiểm chứng v1.0 từ checkout của tag `phase-1`.
- Ticket-02 và Test Contract v1.1 áp dụng cho cả ba Đêm. `game.contract.json` là nguồn tuning, `src/world.js` là dữ liệu bản đồ dùng chung.
- Giữ mô phỏng độc lập với trình duyệt, GPU và thời gian hệ thống. CLI và bản web dùng cùng hàm bước 60 Hz.
- Kiểm tra input theo cạnh lên, snapshot tick 0, thứ tự xử lý trong tick, hai output cùng seed và bộ đếm `sim_tick` khi tạm dừng.
- Ghi bằng chứng từ lệnh thật và nêu rõ các mục còn thiếu. Ghi giả định, thay đổi yêu cầu và chi phí AI ước tính theo phase.
