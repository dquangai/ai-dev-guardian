# Site Recorder

Script Playwright (`record.mjs`) quay video walkthrough tự động của trang giới thiệu AI Dev
Guardian, dùng để gửi trước hoặc đính kèm khi pitch — không cần mở trình duyệt lúc thuyết trình.

Mở đầu ở trang **Login thật** của app, bấm nút "NoteBook" mới chuyển sang trang giới thiệu (cùng
component `NoteBook.tsx` với bản build GitHub Pages, nhưng chạy qua app đầy đủ nên CẦN server +
web dev đang chạy — xem mục "Chạy" bên dưới). Trang Login/NoteBook chỉ tồn tại trong app đầy đủ
(`index.html`/`App.tsx`/React Router), KHÔNG có trong bản build tĩnh `notebook.html` đứng riêng
trên GitHub Pages (không có trang Login).

Tách riêng khỏi package `ai-dev-guardian` ở gốc repo vì đó là package publish lên npm thật;
Playwright (+ Chromium ~170MB) chỉ phục vụ mục đích demo, không nên kéo vào dependency tree
của CLI sản phẩm.

## Chạy

```bash
npm install
npx playwright install chromium   # tải Chromium runtime cho Playwright (một lần)

# ở gốc repo (KHÔNG phải trong site-recorder/), chạy trước và để chạy nền suốt lúc quay:
npm run dev

# quay:
npm run record
```

Video xuất ra tại `output/ai-dev-guardian-demo-vi.webm`.

## Kịch bản

`record.mjs` mở đầu ở trang **Login** (hover tiêu đề + nút "Explore Demo Mode"), bấm nút
"NoteBook" ở góc trên bên phải form login để chuyển sang trang giới thiệu, rồi mới vào kịch bản
demo 8 phần (Hero → Pre-push Terminal → How It Works → Agent Map → CI/CD Gate → Benchmark →
What's in the Box → Footer/CTA). Mỗi phần con trỏ ghé qua đúng các điểm được liệt trong kịch bản
gốc bằng Playwright text-selector (bám nội dung hiển thị, không bám class CSS dễ vỡ khi UI đổi
style).

Phần Terminal không đoán thời gian cố định — script chờ từng mốc thật xuất hiện trên DOM
(banner BLOCK, 2 policy vi phạm, dòng Prompt-as-a-Fix, banner PASS) trước khi đi tiếp, nên
luôn đồng bộ đúng nhịp dù animation gõ phím có chạy nhanh/chậm khác nhau giữa các lần.

Trước khi quay thật (tốn ~2-3 phút), luôn chạy dry-run để xác nhận mọi selector còn khớp
với nội dung trang (hữu ích nhất sau khi trang đổi text/copy):

```bash
DRY_RUN=1 npm run record
```

In ra `OK`/`MISS` cho từng selector, exit code khác 0 nếu có selector nào không tìm thấy.

## Hiệu ứng

`overlay.mjs` inject tạm thời vào trang lúc quay (không đụng source thật của
`web/src/pages/NoteBook.tsx`, không ảnh hưởng trải nghiệm khi người xem tự mở link):

- **Con trỏ chuột giả** di chuyển mượt (easing) giữa các điểm quan tâm trong mỗi section,
  kèm **hiệu ứng ripple** khi thật sự click nút đổi ngôn ngữ / dark mode.
- **Caption góc dưới trái** fade in/out theo từng section đang xem, tự giải thích nội dung
  không cần voice-over.
- **Slate mở đầu/kết thúc** (intro: logo + tagline, outro: lệnh cài đặt + link GitHub) — cảm
  giác video hoàn chỉnh như 1 sản phẩm, không bắt đầu/kết thúc đột ngột giữa trang.

## Tuỳ chọn

| Biến môi trường | Giá trị            | Mặc định | Ý nghĩa                              |
| ---------------- | ------------------ | -------- | ------------------------------------- |
| `DASHBOARD_URL`   | URL bất kỳ          | `http://localhost:5173` | Đổi cổng/host nếu `npm run dev` không chạy ở cổng mặc định |
| `DEMO_LANG`       | `vi` \| `en`        | `vi`     | Ngôn ngữ hiển thị lúc quay (áp dụng sau khi vào trang NoteBook) |
| `DEMO_DARK`       | `0` \| `1`          | `0`      | Bật dark mode lúc quay (áp dụng sau khi vào trang NoteBook) |

```bash
DEMO_LANG=en DEMO_DARK=1 npm run record
```

## Convert sang MP4

Playwright chỉ xuất `.webm`. Để convert sang MP4 (H.264 + yuv420p, mở được trên mọi
email/app chat) mà không cần cài `ffmpeg` ở hệ thống (dùng binary tĩnh qua npm — tiện vì máy
dev không có quyền `sudo apt install` không tương tác):

```bash
npm run to-mp4
```

Convert tất cả file `.webm` đang có trong `output/` thành `.mp4` cùng tên.
