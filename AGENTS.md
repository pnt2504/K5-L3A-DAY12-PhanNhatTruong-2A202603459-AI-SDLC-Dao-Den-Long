# Đảo Đèn Lồng

- Cài và build bằng `npm ci` rồi `npm run build`. Mở game bằng `npm run preview -- --open`.
- Chạy kiểm chứng bằng `npm test`. Dùng `node scripts/verify-phase1.js` để chạy và lưu bằng chứng v1.0.
- Phase 1 dùng PRD-0 và Test Contract v1.0 trên lab board. `game.contract.json` là nguồn duy nhất cho tuning đã khai báo.
- Giữ logic ở `src/game.js` độc lập với trình duyệt, GPU và thời gian hệ thống. CLI và game 3D dùng cùng hàm bước 60 Hz.
- Khi sửa contract, kiểm tra input theo cạnh lên, snapshot tick 0, sự kiện tick k+1, và output hai lần chạy cùng seed.
- Ghi bằng chứng từ lệnh thật và nêu rõ các mục còn thiếu. Ghi giả định, thay đổi yêu cầu và chi phí AI ước tính theo phase.
