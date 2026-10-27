# D&T Competitive Intelligence

Web app phân tích chiến lược đối thủ cho D&T (trangthietbi.vn), đọc trực tiếp file mẫu `Phan_tich_doi_thu_DT.xlsx`.

## Tháp phân tích 4 tầng
| Tầng | Câu hỏi | Nội dung |
|---|---|---|
| 1. Mô tả | Chuyện gì đang xảy ra? | Bản đồ 18 đối thủ, ma trận 15 nhóm hàng, benchmark giá, hiện diện số, AI Share of Voice, kết quả Win-Loss |
| 2. Chẩn đoán | Vì sao thắng/thua? | Gap CPM × trọng số, radar so găng, bản đồ định vị, Pareto lý do thua, khoảng trống danh mục, ma trận giá–biên |
| 3. Dự đoán | Điều gì sẽ xảy ra? | Monte Carlo doanh thu năm (xác suất đạt 25 tỷ), xác suất thắng từng deal, kịch bản nâng điểm CPM, xu hướng AI SoV |
| 4. Đề xuất | Nên làm gì? | Hành động sinh từ dữ liệu, ICE, lộ trình 30-60-90, battle card, SWOT/TOWS, trợ lý AI |

Mục **Nhập liệu**: sửa trực tiếp Win-Loss, CPM, giá, AI Citation, SEO, ma trận, đối thủ, insight, nhật ký; nhập/xuất Excel, sao lưu JSON.

## Cấu trúc
- `src/page.html`, `src/styles.css`, `src/app.js`, `src/parser.js` – mã nguồn
- `build.py` – ghép thành `index.html` một file: `python3 build.py`
- Thư viện: Chart.js 4.4.1, SheetJS 0.18.5 (CDN cdnjs)

Khi chạy trong Artifact claude.ai, dữ liệu lưu ở database dùng chung của artifact (collection `ds`, mỗi mục một document `{v, at}`); mở file trực tiếp thì lưu `localStorage`.

Mô hình dự báo và hệ số xác suất thắng là giả định kinh nghiệm, tự hiệu chỉnh khi Win-Loss có thêm deal thật.
