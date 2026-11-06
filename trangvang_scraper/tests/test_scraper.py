"""Test offline với HTML mô phỏng cấu trúc trang danh bạ. Chạy: python -m pytest tests -q"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import scraper as S  # noqa: E402

BASE = "https://trangvangvietnam.com"

OVERVIEW = """
<html><body><h1>Danh mục lĩnh vực</h1>
<div class="grid">
  <div class="card"><div class="head"><h3>Hóa chất</h3><a href="/linh-vuc/hoa-chat">↗</a></div>
    <div>9,294</div><div>nhà cung cấp · 46 phân ngành</div>
    <a href="/categories/484645/hoa-chat-san-xuat.html">Hóa Chất - Sản Xuất</a>
    <a href="/linh-vuc/hoa-chat">Xem tất cả 46 phân ngành →</a></div>
  <div class="card"><div class="head"><h3>Bảo hộ lao động</h3><a href="/linh-vuc/bao-ho">↗</a></div>
    <div>7,923</div><div>nhà cung cấp · 16 phân ngành</div>
    <a href="/categories/100/bao-ho-lao-dong.html">Bảo Hộ Lao Động</a>
    <a href="/linh-vuc/bao-ho">Xem tất cả 16 phân ngành →</a></div>
</div><footer><a href="/gioi-thieu">Giới thiệu</a></footer></body></html>
"""

SECTOR_HOA_CHAT = """
<html><body><h1>Hóa Chất</h1>
<a href="/categories/484645/hoa-chat-san-xuat.html">Hóa Chất - Sản Xuất, Nhập Khẩu Và Phân Phối Hóa Chất (1640)</a>
<a href="/categories/484645/hoa-chat-san-xuat.html?page=2">dup</a>
<a href="/categories/200/hoa-chat-cong-nghiep.html">Hóa Chất Công Nghiệp (816)</a>
</body></html>
"""
SECTOR_BAO_HO = """<html><body><h1>Bảo hộ lao động</h1>
<a href="/categories/100/bao-ho-lao-dong.html">Bảo Hộ Lao Động (1389)</a></body></html>"""


def listing_page(ids):
    items = "".join(
        f'<div class="item"><h2><a href="/listings/{i}/cong-ty-{i}.html">Công ty {i}</a></h2></div>' for i in ids)
    return f"<html><body><h1>Phân ngành</h1>{items}</body></html>"


DETAIL_KEMIC = """
<html><body>
<header><a href="tel:19001234">Hotline Trang Vàng</a></header>
<div class="detail">
  <div class="logo"><img src="logo.png"></div>
  <div class="info">
    <h1>Hóa Chất Kemic - Công Ty Cổ Phần Kemic</h1>
    <span>Tài trợ</span><span>Xác thực</span>
    <p><i class="fa-solid fa-location-dot"></i> Phòng 1904, Tòa Nhà 24T1, Đường Hoàng Đạo Thúy, Phường Yên Hòa, Hà Nội, Việt Nam</p>
    <p><i class="fa fa-phone"></i> <a href="tel:02462672266">(024) 62672266</a></p>
    <p><i class="fa fa-fax"></i> (024) 62672255 (số Fax)</p>
    <p><b>VP Hồ Chí Minh:</b> Phòng 408, Tầng 4, Tòa nhà Hải Âu, Quận Tân Bình, TP. Hồ Chí Minh</p>
    <a href="mailto:info@kemic.vn">info@kemic.vn</a>
    <a href="https://www.facebook.com/kemic">Facebook</a>
    <a href="http://www.kemic.vn" target="_blank">www.kemic.vn</a>
  </div>
</div>
<div class="related"><a href="mailto:other@x.vn">other</a><a href="https://khac.vn">www.khac.vn</a></div>
</body></html>
"""

DETAIL_CF = """
<html><body><div class="box"><h1>Công ty Điền Hưng</h1>
<p>Số 23F/8, KP. Đông Nhì, P. Lái Thiêu, TP. Thuận An, Bình Dương, Việt Nam</p>
<p>Hotline: 0909 729 100</p>
<a href="/cdn-cgi/l/email-protection#%s">[email&#160;protected]</a>
<a href="https://www.hoachatdienhung.com">www.hoachatdienhung.com</a>
</div></body></html>
"""


def cf_encode(email, key=0x42):
    return f"{key:02x}" + "".join(f"{ord(ch) ^ key:02x}" for ch in email)


def test_overview_detects_sectors():
    sectors = S.extract_sector_links(OVERVIEW, BASE + "/")
    assert [s.text for s in sectors] == ["Hóa chất", "Bảo hộ lao động"]
    assert sectors[0].url == BASE + "/linh-vuc/hoa-chat"


def test_sector_page_is_not_overview():
    assert S.extract_sector_links(SECTOR_HOA_CHAT, BASE + "/linh-vuc/hoa-chat") == []


def test_category_links_dedup_and_clean_name():
    cats = S.extract_category_links(SECTOR_HOA_CHAT, BASE + "/linh-vuc/hoa-chat")
    assert len(cats) == 2
    assert cats[0].text == "Hóa Chất - Sản Xuất, Nhập Khẩu Và Phân Phối Hóa Chất"


def test_parse_company_kemic():
    c = S.parse_company(DETAIL_KEMIC, BASE + "/listings/1/kemic.html")
    assert c.name == "Hóa Chất Kemic - Công Ty Cổ Phần Kemic"
    assert c.address.startswith("Phòng 1904") and "Việt Nam" in c.address
    assert c.phones == ["(024) 62672266"] or c.phones == ["02462672266"]
    assert c.emails == ["info@kemic.vn"]
    assert "kemic.vn" in c.website


def test_parse_company_cloudflare_and_regex_phone():
    html = DETAIL_CF % cf_encode("sales@hoachatdienhung.com")
    c = S.parse_company(html, BASE + "/listings/2/dh.html")
    assert c.emails == ["sales@hoachatdienhung.com"]
    assert c.phones == ["0909 729 100"]
    assert "hoachatdienhung.com" in c.website
    assert c.address.startswith("Số 23F/8")


def test_full_flow(tmp_path):
    pages = {
        BASE + "/": OVERVIEW,
        BASE + "/linh-vuc/hoa-chat": SECTOR_HOA_CHAT,
        BASE + "/linh-vuc/bao-ho": SECTOR_BAO_HO,
        BASE + "/categories/484645/hoa-chat-san-xuat.html": listing_page([1, 2]),
        BASE + "/categories/484645/hoa-chat-san-xuat.html?page=2": listing_page([3]),
        BASE + "/categories/484645/hoa-chat-san-xuat.html?page=3": listing_page([]),
        BASE + "/categories/200/hoa-chat-cong-nghiep.html": listing_page([2, 4]),
        BASE + "/categories/200/hoa-chat-cong-nghiep.html?page=2": listing_page([2, 4]),  # site lặp trang cuối
        BASE + "/categories/100/bao-ho-lao-dong.html": listing_page([5]),
        BASE + "/categories/100/bao-ho-lao-dong.html?page=2": listing_page([]),
    }
    for i in range(1, 6):
        pages[f"{BASE}/listings/{i}/cong-ty-{i}.html"] = DETAIL_KEMIC.replace("Kemic -", f"Số {i} -")

    calls = []

    class FakeFetcher:
        def get(self, url):
            calls.append(url)
            return pages.get(url)

        def close(self):
            pass

    store = S.Store(str(tmp_path / "t.db"))
    S.discover(FakeFetcher(), store, [BASE + "/"], None, [])
    S.crawl_categories(FakeFetcher(), store, max_pages=50, max_companies=None)

    rows = store.db.execute("SELECT listing_id, sector, category, all_categories FROM companies ORDER BY listing_id").fetchall()
    assert [r[0] for r in rows] == ["1", "2", "3", "4", "5"]
    assert rows[1][3] == "Hóa Chất - Sản Xuất, Nhập Khẩu Và Phân Phối Hóa Chất | Hóa Chất Công Nghiệp"
    assert rows[4][1] == "Bảo hộ lao động"
    # Thứ tự: hết phân ngành 1 mới sang phân ngành 2, hết lĩnh vực 1 mới sang lĩnh vực 2
    detail_order = [u for u in calls if "/listings/" in u]
    assert [S.listing_id(u) for u in detail_order] == ["1", "2", "3", "4", "5"]
    assert store.pending_categories() == []

    out = tmp_path / "out.xlsx"
    S.export(store, str(out))
    assert out.exists()
    S.export(store, str(tmp_path / "out.csv"))
    assert "Tên công ty" in (tmp_path / "out.csv").read_text(encoding="utf-8-sig")
