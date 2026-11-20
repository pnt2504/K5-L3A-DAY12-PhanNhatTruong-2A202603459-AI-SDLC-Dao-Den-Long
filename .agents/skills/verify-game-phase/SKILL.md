---
name: verify-game-phase
description: Verify Đảo Đèn Lồng gameplay, headless JSONL, regression tests, and performance evidence against the ticket for the phase being tagged.
---

# Kiểm chứng Đảo Đèn Lồng

1. Đọc ticket của phase và `game.contract.json`. Xác nhận schema, trường hợp biên và quy tắc nào đã thay đổi.
2. Chạy `npm ci`, `npm run build` và script kiểm chứng của phase trong `scripts/`. Chạy contract cũ từ một bản checkout sạch của tag tương ứng.
3. Dùng CLI để đo thời gian headless và so output cùng seed theo byte. Dùng Chrome với viewport 1280×720 và tham số `?seed=12&fps=1` để đo FPS bản web. Mở menu, kiểm tra chơi, tạm dừng, tiếp tục và cài đặt bằng UI.
4. Lưu input, output thực và phép đo vào `docs/proof/phase-N/`. Ghi rõ môi trường, phần kiểm tra còn thiếu và cách tái tạo. Chạy lại test trước khi gắn tag.
