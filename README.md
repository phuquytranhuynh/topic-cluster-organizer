# Topic Cluster Organizer

Công cụ sắp xếp danh sách bài viết của website thành sơ đồ **Topic Cluster** (mô hình Pillar – Supporting) trực quan, giúp xây dựng cấu trúc liên kết nội dung chặt chẽ cho SEO.

## Tính năng (MVP)

- **Nhập từ CSV**: tải lên file CSV danh sách bài viết đã có sẵn logic cụm (cột `Title`, `URL`, `TopicCluster`, `Role`, `PillarOf`).
- **Nhập tay**: thêm từng bài viết, chọn/gán vào một cụm Topic Cluster có sẵn hoặc tạo cụm mới, đánh dấu vai trò Pillar (trụ cột) hoặc Supporting (vệ tinh) và liên kết tới bài Pillar tương ứng.
- **Danh sách bài viết**: xem, sửa, xóa bài viết theo từng cụm.
- **Sơ đồ Topic Cluster**: mỗi cụm hiển thị dạng bong bóng tỏa tròn — bài Pillar ở trung tâm, các bài Supporting xoay quanh. Bán kính vòng và cỡ bong bóng tự giãn/co theo số lượng bài trong cụm để không bị chồng lấn dù một cụm có vài chục bài.
- **Màu theo cấp bậc (level)**: cụm gốc (không nối vào cụm nào khác) có tông màu riêng, sinh tự động không trùng với cụm gốc khác. Khi một cụm được nối chuỗi (PillarOf trỏ vào cụm khác), bong bóng Pillar của nó tự động lấy đúng màu Supporting của cụm cha — các cụm cùng nối vào 1 cụm cha sẽ cùng chung màu đó, còn các bài Supporting riêng của từng cụm con vẫn có màu riêng biệt, không trùng nhau.
- **Kích thước theo cấp bậc**: bong bóng Pillar gốc lớn nhất; mỗi cấp nối chuỗi tiếp theo (Pillar của cụm con, và các bài Supporting của cụm đó) nhỏ hơn khoảng 5% so với cấp liền trước, giúp phân biệt trực quan cụm nào ở tầng sâu hơn trong sơ đồ.
- **Nối nhiều cụm thành nhiều level**: một cụm có thể khai báo là "nhánh con" của một bài viết ở cụm khác (cột `PillarOf` trên chính dòng Pillar) — sơ đồ tự vẽ đường nối rõ ràng giữa 2 cụm. Lặp lại để nối bao nhiêu level tùy ý (không giới hạn 2 cấp), phù hợp cho cấu trúc content phân cấp sâu.
- **Kéo thả để tự sắp xếp**: kéo bong bóng Pillar để di chuyển cả cụm (mọi bài Supporting đi theo); kéo bong bóng Supporting để chỉnh riêng nó. Đường nối luôn bám theo vị trí mới. Vị trí được lưu tự động (localStorage), có nút "Đặt lại vị trí" để quay về bố cục tự động, và PDF xuất ra sẽ theo đúng bố cục đã sắp xếp.
- **Zoom / pan**: cuộn chuột hoặc chụm 2 ngón để zoom, kéo vùng nền trống để di chuyển khung nhìn; có nút phóng to/thu nhỏ/vừa màn hình ở góc sơ đồ.
- **Xuất PDF dạng vector**: vẽ trực tiếp bằng jsPDF (không qua ảnh raster) nên zoom sâu trong PDF chữ vẫn sắc nét. Font Roboto được nhúng sẵn để hiển thị đúng dấu tiếng Việt. Hai chế độ:
  - **Một trang duy nhất**: toàn bộ sơ đồ nằm gọn 1 trang PDF, đúng kích thước gốc. Nếu sơ đồ quá lớn vượt khổ trang tối đa mà trình đọc PDF hỗ trợ, hệ thống tự thu nhỏ tỉ lệ để vừa 1 trang (vẫn là vector, zoom trên máy tính vẫn nét — chỉ in giấy sẽ khó đọc hơn).
  - **Chia nhiều trang theo khổ giấy** (A4/A3/A2/A1/A0 ngang): phù hợp khi cần in giấy khổ lớn (poster) cho sơ đồ có hàng nghìn bài viết — các trang có viền chồng lấn để không cắt đứt bong bóng ở mép, kèm trang bìa dạng bản đồ lưới để biết trang nào ghép ở đâu.
- **Xuất / Nhập dữ liệu**: xuất CSV hoặc JSON (sao lưu đầy đủ), nhập lại từ file JSON đã sao lưu. Dữ liệu được lưu tự động trong `localStorage` của trình duyệt.

## Định dạng CSV

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `Title` | Có | Tiêu đề bài viết |
| `URL` | Không | Đường dẫn bài viết |
| `TopicCluster` | Có | Tên cụm chủ đề bài viết thuộc về |
| `Role` | Không | `Pillar` (trụ cột) hoặc `Supporting` (vệ tinh, mặc định) |
| `PillarOf` | Không | Bài viết mà dòng này liên kết tới (tìm theo Title, trên toàn bộ dữ liệu chứ không giới hạn trong cụm) |

**Cách nối nhiều level:** `PillarOf` không chỉ dùng cho bài Supporting — khai báo nó ngay trên dòng `Role = Pillar` để trỏ tới 1 bài viết ở **cụm khác**, biến cả cụm đó thành nhánh con của bài viết được trỏ tới. Hai tiêu đề không cần trùng nhau. Lặp lại qua nhiều cụm để tạo chuỗi 3, 4, 5... level. Nếu bỏ trống ở dòng Pillar, cụm đó là gốc (level cao nhất).

Có thể tải file CSV mẫu ngay trong tab "Nhập từ CSV" của ứng dụng (file mẫu có sẵn ví dụ nối 3 level).

## Định hướng tiếp theo

Trong tương lai, ứng dụng sẽ hỗ trợ gợi ý logic sắp xếp Topic Cluster tự động bằng cách **gọi Claude API** (thay vì tự xây dựng một mô hình AI riêng): chỉ cần gửi danh sách bài viết, Claude sẽ đề xuất cách gom cụm và cấu trúc Pillar/Supporting phù hợp. Vì gọi thẳng Claude API từ trình duyệt sẽ lộ API key, tính năng này sẽ cần một backend/serverless function nhỏ đứng giữa để giữ key an toàn.

## Phát triển

```bash
npm install
npm run dev      # chạy dev server
npm run build    # build production
```

Stack: React + TypeScript + Vite, D3 (vẽ sơ đồ), PapaParse (đọc CSV).
