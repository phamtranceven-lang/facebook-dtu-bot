# Facebook DTU → Telegram bằng GitHub Actions + Playwright

Bot chạy trên máy chủ GitHub, không cần treo máy cá nhân.

## 1. Tạo repository GitHub

1. Vào GitHub → **New repository**.
2. Đặt tên, ví dụ: `facebook-dtu-bot`.
3. Có thể chọn **Public** để dùng GitHub-hosted Actions miễn phí cho repo public.
4. Tải toàn bộ file trong thư mục này lên repository, giữ nguyên thư mục `.github/workflows`.

## 2. Thêm Telegram Secrets

Trong repository:

**Settings → Secrets and variables → Actions → New repository secret**

Tạo hai secret:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Không cần tạo `APIFY_TOKEN` và `RUN_KEY` nữa.

Nếu bot cần ghim tin, bot Telegram phải là admin của nhóm/kênh và có quyền pin message.

## 3. Chạy thử

1. Mở tab **Actions**.
2. Chọn workflow **Facebook DTU Telegram Bot**.
3. Bấm **Run workflow**.
4. Chọn `test3` để gửi thử tối đa 3 bài.
5. Xem log trong lần chạy đó.

Chọn `normal` ở lần chạy đầu để bot chỉ lưu các bài hiện tại vào `state.json`, không gửi lại bài cũ. Từ lần sau bot mới gửi bài chưa từng thấy.

## 4. Lịch tự động

Workflow hiện chạy lúc:

- 07:17
- 11:17
- 15:17
- 19:17

Theo giờ Việt Nam.

Muốn đổi giờ, sửa dòng cron trong:

`.github/workflows/facebook-bot.yml`

## 5. Nếu log báo tìm thấy 0 bài

Facebook có thể hiện màn hình đăng nhập đối với IP của GitHub. Khi đó cần thêm cookie đăng nhập một lần.

Trên máy cá nhân:

```bash
npm install
npx playwright install chromium
node save-session.js
```

Đăng nhập Facebook trong cửa sổ được mở, sau đó quay lại terminal và nhấn Enter. File `facebook-storage.json` sẽ được tạo.

Mở file đó, copy toàn bộ nội dung và tạo GitHub Secret:

- Tên: `FACEBOOK_COOKIES_JSON`
- Giá trị: toàn bộ JSON trong `facebook-storage.json`

**Không upload hoặc commit `facebook-storage.json` lên repository.** Cookie là thông tin đăng nhập nhạy cảm. Khi đăng xuất Facebook hoặc phiên hết hạn, cần tạo lại secret.

## 6. Debug

Nếu một page trả về 0 bài, workflow lưu ảnh và HTML vào artifact `facebook-debug-...` trong trang chi tiết của lần chạy. Artifact chỉ giữ 3 ngày.

## Lưu ý

Facebook thay đổi giao diện thường xuyên và có thể chặn trình duyệt tự động. Đây là phương án miễn phí nhưng không thể bảo đảm ổn định như dịch vụ scraper trả phí.
