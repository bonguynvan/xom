# Đưa Xóm Peti lên máy chủ

Một container Node nhỏ (không có thư viện ngoài) phục vụ game, đếm người đang xem (`/api/live`) và trả số liệu
cho admin.peti.vn (`/api/ops/*`, cần `OPS_TOKEN`) trên `127.0.0.1:3500`. Caddy dùng chung của máy chủ lo HTTPS,
header bảo mật và chặn `/api/ops/*` từ ngoài (`deploy/xom.caddy`).

## Lần đầu

1. **DNS**: bản ghi A `xom` → IP máy chủ (chỉ DNS, không proxy).
2. **Mã nguồn** trên máy chủ, ví dụ `/srv/xom`:
   ```bash
   git init /srv/xom && git -C /srv/xom config receive.denyCurrentBranch updateInstead
   ```
   Trên máy mình: `git push <user>@<máy chủ>:/srv/xom main`.
3. **Cấu hình**: `cp .env.example .env`, điền `OPS_TOKEN` giống hệt trong `.env` của peti.vn.
   `mkdir -p data && chown 10013:10013 data && chmod 700 data` **trước** lần chạy đầu (nếu để Docker tự tạo
   thì thư mục thuộc root, thống kê không lưu được). `chmod 600 .env`. Tạo token: `openssl rand -hex 32`.
   Chỉ trỏ DNS thẳng (không qua CDN): giới hạn kết nối mỗi IP dựa vào địa chỉ thật của người xem.
4. **Chạy**:
   ```bash
   docker compose -f deploy/compose.yml up -d
   curl -s http://127.0.0.1:3500/healthz   # {"ok":true}
   ```
5. **Caddy dùng chung**: chép `deploy/xom.caddy` vào thư mục sites, `caddy validate` rồi mới `reload`.
6. **Admin**: thêm `xom|Xóm Peti|http://127.0.0.1:3500|https://xom.peti.vn` vào `GAMES` trong `.env` của
   peti.vn (các game cách nhau bằng dấu phẩy) rồi khởi động lại container admin.

## Cập nhật

`git push` là xong nếu chỉ đổi `public/` (thư mục được gắn chỉ đọc). Đổi `scripts/` (máy chủ) thì
`docker compose -f deploy/compose.yml restart`. Đổi `deploy/xom.caddy` thì chép lại và reload Caddy dùng chung.
