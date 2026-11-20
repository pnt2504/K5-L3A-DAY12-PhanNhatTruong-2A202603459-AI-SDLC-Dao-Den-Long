# Bằng chứng Phase 4

| Yêu cầu | Chạy lại | Kết quả đã lưu |
|---|---|---|
| Benchmark 1280×720, 200 Bóng Mực, 100 đom đóm | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` | [bench.json](../../../bench.json) |
| Soak 10 đêm, một tiến trình | `node --jitless --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` | [Windows](../../../soak.json) · [Linux](linux-verification.txt) |
| Test v1.3 và hồi quy | `npm test` ở bản hiện tại và `node --test` trong checkout sạch của từng tag | [Bộ hiện tại](tests.tap) · [Phase 1](phase-1-regression.tap) · [Phase 2](phase-2-regression.tap) · [Phase 3](phase-3-regression.tap) |
| Giữ hành vi v1.2 | Phát lại scenario dầu trong README với `--snapshot-every 30` | [JSONL](headless-dawn.jsonl) · [So sánh byte](headless-comparison.txt) |
| Đổi phím, trùng phím, lưu cài đặt, cỡ chữ, phụ đề và mũi tên | `node scripts/check-browser.js` | [Browser](browser.json) · [Đổi phím](bindings.jpg) · [Cài đặt](accessibility.jpg) · [Chỉ hướng](gameplay.jpg) |
| Bảng điểm từ lượt chơi, qua khởi động lại và xuất bằng CLI | `node scripts/check-browser.js` | [Ảnh](leaderboard.jpg) · [JSON xuất](leaderboard-export.json) |
| Gói chạy và kiểm tra trên bản giải nén | `npm run build` rồi `node scripts/package-release.js` | [Kiểm tra gói](package-check.txt) · [Clone sạch trên Linux](linux-verification.txt) · [GitHub Release v1.0.0](https://github.com/pnt2504/K5-L3A-DAY12-PhanNhatTruong-2A202603459-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) |

Benchmark ghi trên Windows 11, Node.js 24.16.0, Intel Core i5-12500H và 16 GB RAM. Trường `renderer` ghi GPU thực tế do Chromium công bố. Đây là phép đo trên máy thực hiện bài, máy chấm có thể cho số khác. Bản WebGL không ghi được RSS tiến trình trong benchmark. Soak chạy headless và ghi RSS trực tiếp của Node.

Video trong Release dùng lượt chơi và bảng xếp hạng từ trình duyệt, kèm các giá trị trích từ báo cáo test, headless, benchmark và soak. Tên `Demo_May` là dữ liệu thử trong hồ sơ cục bộ cô lập. [Thông tin tệp video](demo-check.txt)
