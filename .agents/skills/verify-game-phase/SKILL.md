---
name: verify-game-phase
description: Verify Đảo Đèn Lồng gameplay, headless JSONL, regression tests, and performance evidence against the ticket for the phase being tagged.
---

# Kiểm chứng Đảo Đèn Lồng

1. Đọc ticket của phase và `game.contract.json`. Xác nhận schema, trường hợp biên và quy tắc nào đã thay đổi.
2. Chạy `npm ci`, `npm run build` và script kiểm chứng của phase trong `scripts/`. Chạy contract cũ từ một bản checkout sạch của tag tương ứng.
3. Dùng CLI để đo thời gian headless và so output cùng seed theo byte. Với v1.3, chạy lệnh benchmark và soak trong `game.contract.json`, sau đó chạy `node scripts/check-browser.js` để kiểm tra bàn phím, HUD và bảng điểm. Các phase trước dùng Chrome 1280×720 và `?seed=12&fps=1` để đo FPS bản chơi.
4. Lưu input, output thực và phép đo vào `docs/proof/phase-N/`. Ghi rõ môi trường, phần kiểm tra còn thiếu và cách tái tạo. Chạy lại test trước khi gắn tag.
