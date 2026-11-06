# Công cụ cào danh bạ doanh nghiệp (Trang Vàng)

Luồng chạy giống hệt thao tác tay:

```
Trang tổng lĩnh vực ──► Lĩnh vực (Hóa chất, Bảo hộ lao động, ...)
                          └─► Phân ngành 1 ──► trang 1, 2, 3... ──► Công ty A, B, C (vào từng trang chi tiết)
                          └─► Phân ngành 2 ──► ...
                       ──► Lĩnh vực tiếp theo ...
```

Mỗi công ty lấy: **Tên, Địa chỉ, Điện thoại, Email, Website** + Lĩnh vực, Phân ngành, Link nguồn.

## 1. Cài đặt (1 lần)

```bash
pip install -r requirements.txt
```

## 2. Chạy

**Chạy thử 20 công ty trước** để kiểm tra dữ liệu ra đúng:

```bash
python scraper.py crawl --start-url "<link trang tổng lĩnh vực>" --max-companies 20 --out thu.xlsx
```

**Chỉ cào 1 lĩnh vực** (vd. Bảo hộ lao động — khách/đối thủ trực tiếp của D&T):

```bash
python scraper.py crawl --start-url "<link trang tổng lĩnh vực>" --only-sector "Bảo hộ" --out bao_ho.xlsx
```

**Cào thẳng 1 phân ngành** (dán link trang danh sách công ty như hình 4):

```bash
python scraper.py crawl --start-url "https://trangvangvietnam.com/categories/484645/hoa-chat-....html" --out hoa_chat.xlsx
```

`--start-url` nhận được 3 loại link: trang tổng các lĩnh vực, trang 1 lĩnh vực, hoặc link phân ngành. Dùng nhiều lần `--start-url` để chạy nhiều link.

**Xem tiến độ / xuất file bất kỳ lúc nào:**

```bash
python scraper.py status
python scraper.py export --out cong_ty.xlsx
```

## 3. Bị ngắt giữa chừng?

Nhấn `Ctrl+C` hoặc mất mạng đều không sao. Chạy lại **đúng lệnh cũ**: công cụ làm tiếp từ phân ngành/trang đang dở, không cào lại công ty đã có (tiến độ lưu trong `trangvang.db`).
Muốn quét lại danh sách phân ngành (khi website thêm ngành mới) thì thêm `--rediscover`.

## 4. Tùy chọn

| Tham số | Ý nghĩa |
|---|---|
| `--delay 2` | Nghỉ ~2 giây giữa 2 lần tải trang. Đừng để dưới 1.5 giây để tránh bị chặn IP. |
| `--max-pages 500` | Giới hạn số trang mỗi phân ngành |
| `--max-companies N` | Dừng sau N công ty (chạy thử) |
| `--only-sector "Hóa chất"` | Chỉ lấy lĩnh vực có tên chứa chuỗi này (dùng nhiều lần được) |
| `--playwright` | Dùng trình duyệt thật khi web chặn bot (cần `pip install playwright && playwright install chromium`) |
| `--sector-pattern "/nganh/"` | Regex URL trang lĩnh vực nếu công ty không tự nhận diện đúng |

## 5. Cách nhận diện dữ liệu

Không phụ thuộc tên class CSS (web đổi giao diện vẫn chạy):

- Phân ngành = link có `/categories/<số>`; công ty = link có `/listings/<số>`; phân trang bằng `?page=N`, dừng khi trang không còn công ty mới.
- Điện thoại = link `tel:` (bỏ số Fax); email = `mailto:` hoặc email bị Cloudflare ẩn (tự giải mã); website = link ra ngoài, loại Facebook/Zalo/Google...; địa chỉ = dòng cạnh icon định vị.
- Một công ty nằm ở nhiều phân ngành chỉ cào 1 lần; cột "Tất cả phân ngành" ghi đủ.

Nếu website đổi mẫu link, sửa `CATEGORY_RE` / `LISTING_RE` ở đầu `scraper.py`.

## 6. Thời gian ước tính

Mỗi công ty ~1 request. Với delay 2s: ~1.800 công ty/giờ. Lĩnh vực Bảo hộ lao động (~7.900 DN) mất khoảng 4–5 giờ; toàn bộ danh bạ (hàng trăm nghìn DN) mất nhiều ngày, nên **cào theo lĩnh vực ưu tiên**.

## 7. Lưu ý pháp lý khi dùng dữ liệu

- Đọc Điều khoản sử dụng của website nguồn; chỉ dùng cho nghiên cứu thị trường / tìm khách hàng B2B nội bộ, không bán lại dữ liệu.
- Email/SĐT đứng tên cá nhân là dữ liệu cá nhân theo **Nghị định 13/2023/NĐ-CP**; gửi email/SMS quảng cáo phải tuân thủ **Nghị định 91/2020/NĐ-CP** về chống tin nhắn, thư điện tử rác (có cách từ chối nhận, không gửi hàng loạt khi chưa đồng ý).

## Test

```bash
pip install pytest && python -m pytest tests -q
```
