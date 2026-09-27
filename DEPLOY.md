# Triển khai lên VPS

Ứng dụng gồm 2 phần chạy trong Docker Compose:

- **app**: 1 container Node chạy Express, vừa phục vụ API (`/api/...`) vừa phục vụ luôn frontend đã
  build (React) — chỉ 1 process, 1 port.
- **db**: MariaDB, dữ liệu lưu trong 1 Docker volume để không mất khi container restart.

Không có form tự đăng ký — tài khoản admin đầu tiên được tạo tự động từ biến môi trường khi container
khởi động lần đầu (xem bước 2), sau đó admin tạo tài khoản cho từng nhân viên trong trang "Quản lý người
dùng".

## Yêu cầu

- VPS đã cài **Docker** và **Docker Compose plugin** (`docker compose version` chạy được).
- Mở port bạn định dùng (mặc định `4000`) trên firewall, hoặc đặt Nginx/Caddy phía trước (xem mục
  "Reverse proxy + HTTPS" bên dưới) và chỉ mở port 80/443.

## Bước 1 — Lấy code lên VPS

```bash
git clone <repo-url> topic-cluster-organizer
cd topic-cluster-organizer
```

## Bước 2 — Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền:

- `DB_ROOT_PASSWORD`, `DB_PASSWORD` — tự đặt mật khẩu MariaDB (chỉ dùng nội bộ giữa 2 container, không
  cần nhớ, chỉ cần khác giá trị mặc định).
- `JWT_SECRET` — chuỗi ngẫu nhiên dài, tạo bằng lệnh `openssl rand -hex 32`. **Đổi giá trị này sẽ đăng
  xuất toàn bộ người dùng đang đăng nhập.**
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — tài khoản admin đầu tiên, chỉ dùng đúng 1 lần lúc
  database còn trống. Sau khi đăng nhập lần đầu, nên vào "Quản lý người dùng" → sửa chính tài khoản này
  để đặt mật khẩu mạnh hơn (các giá trị trong `.env` không tự đổi mật khẩu đã lưu trong database).

## Bước 3 — Build và chạy

```bash
docker compose up -d --build
```

Lần chạy đầu tiên sẽ: build image, khởi tạo MariaDB, tự động áp dụng migration (tạo bảng), và tạo tài
khoản admin từ `.env`. Theo dõi log:

```bash
docker compose logs -f app
```

Thấy dòng `Server listening on port 4000` là xong. Vào `http://<ip-vps>:4000` (hoặc domain nếu đã trỏ
DNS), đăng nhập bằng `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Bước 4 — Tạo tài khoản cho nhân viên

Vào **Quản lý người dùng** (chỉ admin thấy mục này) → điền email/tên/mật khẩu ban đầu → **Tạo tài
khoản**. Gửi thông tin đăng nhập cho từng nhân viên qua kênh nội bộ (Slack/email công ty) — không có
form tự đăng ký nên chỉ cách này mới tạo được tài khoản.

## Reverse proxy + HTTPS (khuyến nghị)

Container `app` chỉ chạy HTTP thuần trên port nội bộ. Để có HTTPS cho domain thật, đặt Nginx (hoặc
Caddy) phía trước, chỉ mở port 80/443 ra ngoài, và cho `app` nghe trên `127.0.0.1:4000` thay vì `0.0.0.0`
— sửa `APP_PORT` trong `.env` thành `127.0.0.1:4000:4000` nếu muốn chắc chắn nó không lộ ra ngoài trực
tiếp (mặc định `docker-compose.yml` map `${APP_PORT:-4000}:4000` trên mọi interface).

Ví dụ cấu hình Nginx (dùng `certbot --nginx` để tự động xin chứng chỉ Let's Encrypt sau khi có block
này):

```nginx
server {
    listen 80;
    server_name topic-cluster.ziven.vn;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Sau khi có HTTPS thật, không cần đổi gì trong app — cookie đăng nhập tự nhận diện qua header
`X-Forwarded-Proto` không cần thiết vì Express không tự kiểm tra `secure` cookie dựa vào đó; cookie chỉ
gắn cờ `secure` khi `NODE_ENV=production` (đã set sẵn trong Dockerfile), nghĩa là **cookie chỉ được
trình duyệt gửi qua HTTPS** — nếu bạn chưa có HTTPS thật (chỉ test bằng IP + HTTP), đăng nhập sẽ không
giữ được phiên. Test nhanh không cần HTTPS thì có thể tạm thời không quan tâm — chỉ cần dùng domain thật
+ chứng chỉ TLS trước khi đưa nhân viên vào dùng thật.

## Sao lưu dữ liệu

Toàn bộ dữ liệu (user + sơ đồ) nằm trong volume `db_data` của MariaDB. Sao lưu định kỳ bằng
`mysqldump`:

```bash
docker compose exec db sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" topic_cluster_organizer' > backup-$(date +%F).sql
```

Khôi phục (VPS mới hoặc sau sự cố):

```bash
cat backup-2026-xx-xx.sql | docker compose exec -T db mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" topic_cluster_organizer
```

Ngoài ra mỗi nhân viên vẫn có thể tự "Xuất JSON" từng sơ đồ riêng từ trong app — không thay thế backup
database, nhưng tiện khi cần chuyển 1 sơ đồ cụ thể sang nơi khác.

## Cập nhật lên bản mới

```bash
git pull
docker compose up -d --build
```

Migration (nếu có thay đổi schema) tự áp dụng mỗi lần container `app` khởi động lại — không cần chạy gì
thêm thủ công.

## Khắc phục sự cố

- **`docker compose logs -f app` báo lỗi kết nối database** — chờ thêm vài giây, `db` cần thời gian
  khởi tạo lần đầu; `app` sẽ tự chờ (`depends_on` + healthcheck) nhưng nếu vẫn lỗi, kiểm tra
  `DB_PASSWORD` trong `.env` khớp với giá trị `db` container đang dùng (đổi `.env` sau khi `db` đã tạo
  volume sẽ KHÔNG áp dụng — phải `docker compose down -v` để xóa volume nếu muốn đổi mật khẩu MariaDB
  gốc, mất hết dữ liệu, chỉ làm khi thực sự cần).
- **Quên mật khẩu admin duy nhất, không đăng nhập được** — không có "quên mật khẩu" qua email ở bản
  này; vào thẳng database sửa tay, hoặc đơn giản hơn: `docker compose down`, xóa toàn bộ dữ liệu (mất hết
  sơ đồ, chỉ làm nếu chấp nhận được) bằng `docker compose down -v` rồi `docker compose up -d --build`
  để bootstrap lại admin từ `.env`.
