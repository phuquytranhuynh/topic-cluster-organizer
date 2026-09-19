# Topic Cluster Organizer

Công cụ sắp xếp danh sách bài viết của website thành sơ đồ **Topic Cluster** (mô hình Pillar – Supporting) trực quan, giúp xây dựng cấu trúc liên kết nội dung chặt chẽ cho SEO.

## Tính năng (MVP)

- **Nhập từ CSV**: 2 định dạng —
  - **Cột chuẩn**: `Title`, `URL`, `TopicCluster`, `Role`, `PillarOf`, `VolumeSearch`.
  - **Mã vị trí phân cấp**: chỉ cần `Topic` và `Vị trí trong sơ đồ` (mã số dạng cây, ví dụ `0`, `0.1`, `0.1.2`) — hệ thống tự suy ra Pillar/Supporting và liên kết cụm từ cấu trúc vị trí, không cần khai báo Role/PillarOf thủ công.
- **Nhập tay**: thêm từng bài viết, chọn/gán vào một cụm Topic Cluster có sẵn hoặc tạo cụm mới, đánh dấu vai trò Pillar (trụ cột) hoặc Supporting (vệ tinh) và liên kết tới bài Pillar tương ứng.
- **Danh sách bài viết**: xem, sửa, xóa bài viết theo từng cụm.
- **Sơ đồ Topic Cluster**: mỗi cụm hiển thị dạng bong bóng tỏa tròn — bài Pillar ở trung tâm, các bài Supporting xoay quanh. Bán kính vòng và cỡ bong bóng tự giãn/co theo số lượng bài trong cụm để không bị chồng lấn dù một cụm có vài chục bài.
- **Màu theo cấp bậc (level)**: cụm gốc (không nối vào cụm nào khác) có tông màu riêng, sinh tự động không trùng với cụm gốc khác. Khi một cụm được nối chuỗi (PillarOf trỏ vào cụm khác), bong bóng Pillar của nó tự động lấy đúng màu Supporting của cụm cha — các cụm cùng nối vào 1 cụm cha sẽ cùng chung màu đó, còn các bài Supporting riêng của từng cụm con vẫn có màu riêng biệt, không trùng nhau.
- **Kích thước theo cấp bậc**: kích thước một bong bóng chỉ phụ thuộc vào **độ sâu tính từ Pillar gốc**, không phụ thuộc vai trò Pillar hay Supporting. Pillar gốc (level 1) có kích thước x; mọi bong bóng cách nó 1 bước — dù là Supporting ngay trong cụm gốc, hay Pillar của một cụm được nối chuỗi vào — đều có cùng kích thước 0.93x; cách 2 bước là 0.86x; cách 3 bước là 0.79x... giảm đều 7% mỗi bước, tính trên kích thước gốc (không cộng dồn theo cấp số nhân). Nhờ vậy 2 bong bóng "xa gốc như nhau" luôn to bằng nhau, bất kể một cái là Supporting còn cái kia là Pillar của cụm khác.
- **Nối nhiều cụm thành nhiều level**: một cụm có thể khai báo là "nhánh con" của một bài viết ở cụm khác (cột `PillarOf` trên chính dòng Pillar) — sơ đồ tự vẽ đường nối rõ ràng giữa 2 cụm. Lặp lại để nối bao nhiêu level tùy ý (không giới hạn 2 cấp), phù hợp cho cấu trúc content phân cấp sâu.
- **Kéo thả để tự sắp xếp**: kéo bong bóng Pillar để di chuyển cả cụm (mọi bài Supporting đi theo); kéo bong bóng Supporting để chỉnh riêng nó. Giữ `Ctrl` (hoặc `Cmd`) trong lúc kéo để di chuyển **cả chuỗi** — cụm đang kéo cùng mọi cụm nối chuỗi bên dưới nó — theo trỏ chuột như một khối liền, các cụm ở nhánh khác (không nằm bên dưới cụm đang kéo) không bị ảnh hưởng. Đường nối luôn bám theo vị trí mới. Vị trí được lưu tự động (localStorage), có nút "Đặt lại vị trí" để quay về bố cục tự động, và PDF xuất ra sẽ theo đúng bố cục đã sắp xếp.
- **Đổi màu cụm thủ công**: chuột phải vào bất kỳ bong bóng nào trong 1 cụm Topic Cluster → "Đổi màu cụm…" → chọn màu qua bảng màu có sẵn hoặc nhập mã HEX/RGB → Xác nhận. Toàn bộ bong bóng (Pillar lẫn Supporting) trong cụm đó đổi sang đúng màu vừa chọn; nếu cụm đó là Pillar của một cụm nối chuỗi ở level cao hơn, cụm cha vẫn giữ màu tự động/màu tùy chỉnh riêng — không bị đổi theo. Có thể bấm "Đặt lại màu tự động" trong bảng chọn màu để quay về màu sinh tự động.
- **Điều chỉnh khoảng cách**: chuột phải vào bất kỳ bong bóng nào trong 1 cụm Topic Cluster → "Điều chỉnh khoảng cách…" → nhập % chính xác hoặc kéo thanh trượt (100% = khoảng cách mặc định) → Xác nhận. Mọi bong bóng Supporting trong cụm đó dịch ra xa/lại gần bong bóng Pillar theo đúng tỉ lệ đã chọn; cụm nào nối chuỗi vào một bong bóng Supporting vừa dịch chuyển (kể cả nối nhiều tầng bên dưới) cũng tự dịch chuyển theo cho đúng vị trí tương đối.
- **Hoàn tác / Làm lại**: khi đang xem sơ đồ, nhấn `Ctrl+Z` (hoặc `Cmd+Z` trên Mac) để hoàn tác lần kéo thả, điều chỉnh khoảng cách, hoặc đổi màu cụm gần nhất — hữu ích khi lỡ tay chạm nhầm bong bóng làm đổi vị trí. Nhấn `Ctrl+Shift+Z` (hoặc `Cmd+Shift+Z`) để làm lại thao tác vừa hoàn tác.
- **Zoom / pan**: cuộn chuột hoặc chụm 2 ngón để zoom, kéo vùng nền trống để di chuyển khung nhìn; có nút phóng to/thu nhỏ/vừa màn hình ở góc sơ đồ.
- **Xuất PDF dạng vector**: vẽ trực tiếp bằng jsPDF (không qua ảnh raster) nên zoom sâu trong PDF chữ vẫn sắc nét. Font Roboto được nhúng sẵn để hiển thị đúng dấu tiếng Việt. Hai chế độ:
  - **Một trang duy nhất**: toàn bộ sơ đồ nằm gọn 1 trang PDF, đúng kích thước gốc. Nếu sơ đồ quá lớn vượt khổ trang tối đa mà trình đọc PDF hỗ trợ, hệ thống tự thu nhỏ tỉ lệ để vừa 1 trang (vẫn là vector, zoom trên máy tính vẫn nét — chỉ in giấy sẽ khó đọc hơn).
  - **Chia nhiều trang theo khổ giấy** (A4/A3/A2/A1/A0 ngang): phù hợp khi cần in giấy khổ lớn (poster) cho sơ đồ có hàng nghìn bài viết — các trang có viền chồng lấn để không cắt đứt bong bóng ở mép, kèm trang bìa dạng bản đồ lưới để biết trang nào ghép ở đâu.
- **Volume Search**: nhập lượt tìm kiếm/tháng cho mỗi bài viết (qua CSV, form nhập tay, hoặc sửa trong Danh sách bài viết) — hiển thị thành 1 dòng số nhỏ ngay bên dưới tiêu đề trong bong bóng, cả trên màn hình lẫn khi xuất PDF.
- **Xuất / Nhập dữ liệu**: xuất CSV hoặc JSON (sao lưu đầy đủ), nhập lại từ file JSON đã sao lưu. Dữ liệu được lưu tự động trong `localStorage` của trình duyệt.

## Định dạng CSV

### Cột chuẩn

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `Title` | Có | Tiêu đề bài viết |
| `URL` | Không | Đường dẫn bài viết |
| `TopicCluster` | Có | Tên cụm chủ đề bài viết thuộc về |
| `Role` | Không | `Pillar` (trụ cột) hoặc `Supporting` (vệ tinh, mặc định) |
| `PillarOf` | Không | Bài viết mà dòng này liên kết tới (tìm theo Title, trên toàn bộ dữ liệu chứ không giới hạn trong cụm) |
| `VolumeSearch` | Không | Lượt tìm kiếm/tháng, hiển thị dưới tiêu đề trong bong bóng |

**Cách nối nhiều level:** `PillarOf` không chỉ dùng cho bài Supporting — khai báo nó ngay trên dòng `Role = Pillar` để trỏ tới 1 bài viết ở **cụm khác**, biến cả cụm đó thành nhánh con của bài viết được trỏ tới. Hai tiêu đề không cần trùng nhau. Lặp lại qua nhiều cụm để tạo chuỗi 3, 4, 5... level. Nếu bỏ trống ở dòng Pillar, cụm đó là gốc (level cao nhất).

### Mã vị trí phân cấp

| Cột | Bắt buộc | Mô tả |
|---|---|---|
| `Topic` | Có | Tiêu đề bài viết |
| `Vị trí trong sơ đồ` | Có | Mã vị trí dạng cây, phân cấp bằng dấu chấm: `0`, `0.1`, `0.1.2`... |
| `URL` | Không | Đường dẫn bài viết |
| `Volume Search` | Không | Lượt tìm kiếm/tháng |

Bài nào **có bài con** (tồn tại dòng khác với vị trí bắt đầu bằng `vị_trí_của_nó + "."`) tự trở thành **Pillar** của một cụm mới, nối vào bài cha. Bài **không có con** là **Supporting** trong cụm của bài cha. Không cần khai báo Role hay PillarOf thủ công.

Có thể tải file CSV mẫu cho từng định dạng ngay trong tab "Nhập từ CSV" của ứng dụng.

## Định hướng tiếp theo

Trong tương lai, ứng dụng sẽ hỗ trợ gợi ý logic sắp xếp Topic Cluster tự động bằng cách **gọi Claude API** (thay vì tự xây dựng một mô hình AI riêng): chỉ cần gửi danh sách bài viết, Claude sẽ đề xuất cách gom cụm và cấu trúc Pillar/Supporting phù hợp. Vì gọi thẳng Claude API từ trình duyệt sẽ lộ API key, tính năng này sẽ cần một backend/serverless function nhỏ đứng giữa để giữ key an toàn.

## Phát triển

```bash
npm install
npm run dev      # chạy dev server
npm run build    # build production
```

Stack: React + TypeScript + Vite, D3 (vẽ sơ đồ), PapaParse (đọc CSV).
