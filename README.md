# Topic Cluster Organizer

Công cụ sắp xếp danh sách bài viết của website thành sơ đồ **Topic Cluster** (mô hình Pillar – Supporting) trực quan, giúp xây dựng cấu trúc liên kết nội dung chặt chẽ cho SEO.

## Tính năng (MVP)

- **Nhập từ CSV**: tải lên file CSV danh sách bài viết đã có sẵn logic cụm (cột `Title`, `URL`, `TopicCluster`, `Role`, `PillarOf`).
- **Nhập tay**: thêm từng bài viết, chọn/gán vào một cụm Topic Cluster có sẵn hoặc tạo cụm mới, đánh dấu vai trò Pillar (trụ cột) hoặc Supporting (vệ tinh) và liên kết tới bài Pillar tương ứng.
- **Danh sách bài viết**: xem, sửa, xóa bài viết theo từng cụm.
- **Sơ đồ Topic Cluster**: mỗi cụm hiển thị dạng bong bóng tỏa tròn — bài Pillar ở trung tâm, các bài Supporting xoay quanh; tự động nối nét đứt giữa các cụm khi một bài viết vừa là vệ tinh ở cụm này vừa là trụ cột ở cụm khác. Bán kính vòng và cỡ bong bóng tự giãn/co theo số lượng bài trong cụm để không bị chồng lấn dù một cụm có vài chục bài.
- **Xuất PDF dạng vector nhiều trang**: dùng cho sơ đồ lớn (hàng nghìn bài viết). Vẽ trực tiếp bằng jsPDF (không qua ảnh raster) nên zoom sâu trong PDF chữ vẫn sắc nét; sơ đồ lớn được chia lưới nhiều trang theo khổ giấy chọn (A4/A3/A2/A1/A0 ngang, có viền chồng lấn để không cắt đứt bong bóng ở mép trang), kèm trang bìa dạng bản đồ lưới để biết trang nào ghép ở đâu. Font Roboto được nhúng sẵn để hiển thị đúng dấu tiếng Việt.
- **Xuất / Nhập dữ liệu**: xuất CSV hoặc JSON (sao lưu đầy đủ), nhập lại từ file JSON đã sao lưu. Dữ liệu được lưu tự động trong `localStorage` của trình duyệt.

## Định dạng CSV

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `Title` | Có | Tiêu đề bài viết |
| `URL` | Không | Đường dẫn bài viết |
| `TopicCluster` | Có | Tên cụm chủ đề bài viết thuộc về |
| `Role` | Không | `Pillar` (trụ cột) hoặc `Supporting` (vệ tinh, mặc định) |
| `PillarOf` | Không | Tiêu đề bài Pillar mà bài Supporting này liên kết tới (nếu cụm chỉ có 1 Pillar, có thể bỏ trống — hệ thống tự liên kết) |

Có thể tải file CSV mẫu ngay trong tab "Nhập từ CSV" của ứng dụng.

## Định hướng tiếp theo

Trong tương lai, ứng dụng sẽ hỗ trợ gợi ý logic sắp xếp Topic Cluster tự động bằng cách **gọi Claude API** (thay vì tự xây dựng một mô hình AI riêng): chỉ cần gửi danh sách bài viết, Claude sẽ đề xuất cách gom cụm và cấu trúc Pillar/Supporting phù hợp. Vì gọi thẳng Claude API từ trình duyệt sẽ lộ API key, tính năng này sẽ cần một backend/serverless function nhỏ đứng giữa để giữ key an toàn.

## Phát triển

```bash
npm install
npm run dev      # chạy dev server
npm run build    # build production
```

Stack: React + TypeScript + Vite, D3 (vẽ sơ đồ), PapaParse (đọc CSV).
