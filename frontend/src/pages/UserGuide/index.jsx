import { useState, useEffect, useRef } from 'react'
import useAuthStore from '../../store/auth.store'
import './UserGuide.css'

// ── TOC definition ─────────────────────────────────────────────────────────────
const TOC = [
  { id: 'intro',       label: 'Giới thiệu hệ thống' },
  { id: 'roles',       label: 'Phân quyền người dùng' },
  { id: 'login',       label: 'Đăng nhập & Bảo mật' },
  { id: 'layout',      label: 'Giao diện tổng quan' },
  { id: 'records',     label: 'Quản lý Records' },
  { id: 'ocr',         label: 'AI OCR & Trích xuất' },
  { id: 'doctypes',    label: 'Phân loại tài liệu' },
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'reports',     label: 'Báo cáo' },
  { id: 'notifications', label: 'Thông báo realtime' },
  { id: 'settings',    label: 'Cài đặt hệ thống', adminOnly: true },
  { id: 'backup',      label: 'Backup Database',   adminOnly: true },
  { id: 'activitylog', label: 'Nhật ký hệ thống',  adminOnly: true },
  { id: 'tips',        label: 'Mẹo & Phím tắt' },
]

// ── Role badge ─────────────────────────────────────────────────────────────────
function Role({ type }) {
  const map = {
    admin:   ['guide-role--admin',   'Admin'],
    manager: ['guide-role--manager', 'Manager'],
    staff:   ['guide-role--staff',   'Staff'],
    all:     ['guide-role--all',     'Tất cả'],
  }
  const [cls, label] = map[type] ?? ['guide-role--staff', type]
  return <span className={`guide-role ${cls}`}>{label}</span>
}

function Note({ type = 'info', icon, children }) {
  const iconMap = { info: 'ℹ️', warn: '⚠️', tip: '✅' }
  return (
    <div className={`guide-note guide-note--${type === 'warn' ? 'warn' : 'info'}`}>
      <span className="guide-note-icon">{icon ?? iconMap[type]}</span>
      <div className="guide-note-text">{children}</div>
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className="guide-step">
      <div className="guide-step-num">{n}</div>
      <div className="guide-step-body">{children}</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UserGuidePage() {
  const [activeId, setActiveId] = useState('intro')
  const contentRef = useRef(null)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  // Highlight active TOC item based on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-20px 0px -70% 0px', threshold: 0 }
    )
    document.querySelectorAll('.guide-section[id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const visibleTOC = TOC.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="guide-page">

      {/* TOC */}
      <nav className="guide-toc">
        <div className="guide-toc-title">Nội dung</div>
        <ul className="guide-toc-list">
          {visibleTOC.map(t => (
            <li key={t.id}>
              <a
                className={`guide-toc-item${activeId === t.id ? ' active' : ''}`}
                onClick={() => scrollTo(t.id)}
                href={`#${t.id}`}
                onClick={e => { e.preventDefault(); scrollTo(t.id) }}
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="guide-content" ref={contentRef}>

        {/* Banner */}
        <div className="guide-banner">
          <div className="guide-banner-title">Hướng dẫn sử dụng — BBO Records</div>
          <p className="guide-banner-sub">
            Tài liệu hướng dẫn đầy đủ dành cho người dùng hệ thống quản lý ghi chép nội bộ.<br />
            Bao gồm thao tác cơ bản, tính năng AI/OCR, báo cáo và quản trị hệ thống.
          </p>
          <span className="guide-banner-version">Version 1.0.3 · Cập nhật 04/2026</span>
        </div>

        {/* ── 1. Giới thiệu ── */}
        <section id="intro" className="guide-section">
          <h1 className="guide-h1">Giới thiệu hệ thống</h1>
          <div className="guide-lead">
            <strong>BBO Records</strong> là hệ thống nội bộ giúp doanh nghiệp <strong>thu thập, phân loại và quản lý
            chứng từ, ghi chép</strong> gửi về từ nhiều kênh (Telegram, Zalo, upload thủ công).
            AI tích hợp sẵn tự động đọc ảnh và trích xuất dữ liệu có cấu trúc theo từng loại tài liệu được cấu hình.
          </div>

          <div className="guide-feature-grid">
            <div className="guide-feature-card">
              <div className="guide-feature-card-icon">📥</div>
              <div className="guide-feature-card-title">Thu thập đa kênh</div>
              <div className="guide-feature-card-desc">Nhận ảnh chứng từ từ Telegram Bot, Zalo OA và upload trực tiếp trên web.</div>
            </div>
            <div className="guide-feature-card">
              <div className="guide-feature-card-icon">🤖</div>
              <div className="guide-feature-card-title">AI OCR tự động</div>
              <div className="guide-feature-card-desc">Gemini AI đọc và trích xuất dữ liệu theo schema tài liệu động, không cần nhập tay.</div>
            </div>
            <div className="guide-feature-card">
              <div className="guide-feature-card-icon">📊</div>
              <div className="guide-feature-card-title">Báo cáo & Thống kê</div>
              <div className="guide-feature-card-desc">Dashboard realtime, báo cáo tài chính, nhân sự, chất lượng. Xuất Excel.</div>
            </div>
            <div className="guide-feature-card">
              <div className="guide-feature-card-icon">🔔</div>
              <div className="guide-feature-card-title">Thông báo tức thì</div>
              <div className="guide-feature-card-desc">Socket realtime — record mới hiển thị ngay trên chuông thông báo mà không cần refresh.</div>
            </div>
          </div>
        </section>

        <hr className="guide-divider" />

        {/* ── 2. Phân quyền ── */}
        <section id="roles" className="guide-section">
          <h1 className="guide-h1">Phân quyền người dùng</h1>
          <p className="guide-p">Hệ thống có 3 cấp vai trò. Mỗi tài khoản được Admin gán một vai trò khi tạo hoặc thay đổi sau.</p>

          <table className="guide-table">
            <thead>
              <tr>
                <th>Vai trò</th>
                <th>Quyền truy cập</th>
                <th>Không có quyền</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Role type="staff" /></td>
                <td>Xem Records, Dashboard, Phân loại tài liệu, Báo cáo (giới hạn tab), Quản lý người dùng (không tạo Admin)</td>
                <td>Cài đặt API, Backup DB, Nhật ký, thay đổi vai trò thành Admin</td>
              </tr>
              <tr>
                <td><Role type="manager" /></td>
                <td>Tất cả quyền Staff + Cài đặt hệ thống (không có API key, Backup), tạo và chỉnh sửa danh mục/loại tài liệu</td>
                <td>API Key, Backup DB, Nhật ký hệ thống</td>
              </tr>
              <tr>
                <td><Role type="admin" /></td>
                <td>Toàn quyền — bao gồm API Key, Backup DB, Nhật ký hệ thống, Cài đặt chung, tất cả cài đặt người dùng</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>

          <Note type="info">
            <strong>Lưu ý:</strong> Vai trò hiện tại của bạn là <Role type={user?.role || 'staff'} />. Để thay đổi vai trò, liên hệ Admin hệ thống.
          </Note>
        </section>

        <hr className="guide-divider" />

        {/* ── 3. Đăng nhập ── */}
        <section id="login" className="guide-section">
          <h1 className="guide-h1">Đăng nhập & Bảo mật</h1>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eff6ff'}}>🔐</span>Đăng nhập</h2>
          <div className="guide-steps">
            <Step n={1}>Truy cập địa chỉ hệ thống (VD: <span className="guide-code">http://localhost:5173</span>) bằng trình duyệt Chrome hoặc Edge.</Step>
            <Step n={2}>Nhập <strong>Tên đăng nhập</strong> và <strong>Mật khẩu</strong> được Admin cấp.</Step>
            <Step n={3}>Nhấn <strong>Đăng nhập</strong> hoặc bấm <span className="guide-kbd">Enter</span>.</Step>
            <Step n={4}>Hệ thống chuyển tới trang Dashboard sau khi xác thực thành công.</Step>
          </div>

          <Note type="warn">
            <strong>Mật khẩu tạm thời:</strong> Nếu Admin vừa tạo tài khoản hoặc đặt lại mật khẩu, bạn sẽ nhận mật khẩu tạm thời. Hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên (tính năng đổi mật khẩu ở hồ sơ cá nhân — sắp ra mắt).
          </Note>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fef2f2'}}>🚪</span>Đăng xuất</h2>
          <div className="guide-steps">
            <Step n={1}>Nhấn vào <strong>tên tài khoản</strong> góc trên bên phải header.</Step>
            <Step n={2}>Chọn <strong>Đăng xuất</strong> từ dropdown hiện ra.</Step>
          </div>

          <Note type="tip" icon="✅">
            Session tự động hết hạn sau một thời gian không hoạt động. Hệ thống sẽ tự chuyển về trang đăng nhập — dữ liệu chưa lưu sẽ không bị mất vì các thao tác đều lưu ngay khi thực hiện.
          </Note>
        </section>

        <hr className="guide-divider" />

        {/* ── 4. Giao diện ── */}
        <section id="layout" className="guide-section">
          <h1 className="guide-h1">Giao diện tổng quan</h1>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>🗂️</span>Sidebar điều hướng</h2>
          <p className="guide-p">Sidebar trái chứa toàn bộ menu điều hướng, chia 2 nhóm:</p>
          <ul className="guide-ul">
            <li><strong>Điều hướng:</strong> Dashboard, Danh sách Record, Phân loại, Báo cáo — dành cho mọi vai trò.</li>
            <li><strong>Quản trị hệ thống:</strong> Nhật ký hệ thống, Cài đặt, Hướng dẫn sử dụng — hiển thị theo vai trò.</li>
          </ul>
          <p className="guide-p">Nhấn nút <strong>mũi tên thu gọn</strong> (góc trên sidebar) để ẩn nhãn chữ, chỉ hiển thị icon — phù hợp khi cần thêm không gian làm việc.</p>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fefce8'}}>🔝</span>Header</h2>
          <ul className="guide-ul">
            <li><strong>Thanh tìm kiếm:</strong> Nhập từ khóa rồi bấm <span className="guide-kbd">Enter</span> — chuyển thẳng đến trang Records đã lọc sẵn.</li>
            <li><strong>Chuông thông báo 🔔:</strong> Hiển thị badge số record mới. Click để xem danh sách record chưa xử lý gần nhất.</li>
            <li><strong>Pill người dùng:</strong> Hiển thị tên và vai trò. Click để mở dropdown đăng xuất.</li>
          </ul>
        </section>

        <hr className="guide-divider" />

        {/* ── 5. Records ── */}
        <section id="records" className="guide-section">
          <h1 className="guide-h1">Quản lý Records</h1>
          <p className="guide-p">
            Records là đơn vị dữ liệu trung tâm — mỗi record tương ứng một ảnh chứng từ gửi về từ Telegram/Zalo hoặc upload thủ công.
          </p>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eff6ff'}}>📋</span>Xem danh sách</h2>
          <p className="guide-p">Vào menu <strong>Danh sách Record</strong>. Mặc định hiển thị theo thời gian mới nhất. Mỗi dòng gồm: ảnh thumbnail, người gửi, nền tảng, trạng thái, thời gian nhận.</p>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>🔍</span>Tìm kiếm & Lọc</h2>
          <ul className="guide-ul">
            <li><strong>Tìm kiếm:</strong> Nhập từ khóa vào ô search (tên người gửi, nội dung OCR) — lọc realtime.</li>
            <li><strong>Trạng thái:</strong> new / approved / rejected / flagged / pending.</li>
            <li><strong>Nền tảng:</strong> telegram / zalo / web.</li>
            <li><strong>Danh mục & Loại tài liệu:</strong> lọc theo schema đã cấu hình.</li>
            <li><strong>Khoảng thời gian:</strong> chọn ngày bắt đầu – kết thúc.</li>
            <li><strong>Số tiền:</strong> lọc &gt;= / &lt;= một mức tiền cụ thể.</li>
          </ul>

          <Note type="tip" icon="💡">
            Bạn có thể kết hợp nhiều bộ lọc cùng lúc. Nhấn <strong>Xóa bộ lọc</strong> để reset tất cả về mặc định.
          </Note>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fefce8'}}>🗃️</span>Xem chi tiết & Xử lý</h2>
          <div className="guide-steps">
            <Step n={1}>Click vào bất kỳ record nào trong danh sách để mở <strong>modal chi tiết</strong>.</Step>
            <Step n={2}>Xem ảnh gốc (có thể phóng to), nội dung OCR text, thông tin trích xuất AI theo từng field.</Step>
            <Step n={3}>Thực hiện hành động: <strong>Duyệt</strong>, <strong>Từ chối</strong> hoặc <strong>Gắn cờ</strong> (flag).</Step>
            <Step n={4}>Khi Từ chối hoặc Gắn cờ: điền lý do vào ô text bắt buộc rồi xác nhận.</Step>
          </div>

          <table className="guide-table">
            <thead>
              <tr><th>Trạng thái</th><th>Ý nghĩa</th><th>Ai thực hiện</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>🆕 new</strong></td><td>Record vừa nhận, chưa xử lý</td><td>Hệ thống tự gán</td></tr>
              <tr><td><strong>✅ approved</strong></td><td>Đã duyệt, dữ liệu hợp lệ</td><td><Role type="manager" /> <Role type="admin" /></td></tr>
              <tr><td><strong>❌ rejected</strong></td><td>Đã từ chối, ảnh không hợp lệ</td><td><Role type="manager" /> <Role type="admin" /></td></tr>
              <tr><td><strong>🚩 flagged</strong></td><td>Gắn cờ cần xem xét thêm</td><td><Role type="all" /></td></tr>
              <tr><td><strong>⏳ pending</strong></td><td>Đang chờ OCR xử lý</td><td>Hệ thống</td></tr>
            </tbody>
          </table>
        </section>

        <hr className="guide-divider" />

        {/* ── 6. AI OCR ── */}
        <section id="ocr" className="guide-section">
          <h1 className="guide-h1">AI OCR & Trích xuất dữ liệu</h1>
          <p className="guide-p">
            Mỗi record được gửi về sẽ tự động qua pipeline OCR — Gemini AI đọc ảnh, nhận dạng loại tài liệu và trích xuất các trường dữ liệu theo schema đã cấu hình.
          </p>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>⚙️</span>Quy trình xử lý</h2>
          <div className="guide-steps">
            <Step n={1}><strong>Upload ảnh:</strong> Record nhận từ Telegram/Zalo hoặc upload thủ công trên web.</Step>
            <Step n={2}><strong>OCR pending:</strong> Ảnh đẩy vào hàng xử lý, trạng thái OCR chuyển sang "đang xử lý".</Step>
            <Step n={3}><strong>AI phân tích:</strong> Gemini đọc ảnh, nhận dạng loại tài liệu (VD: hóa đơn nhà hàng, phiếu kiểm kho…) và trích xuất field theo schema.</Step>
            <Step n={4}><strong>Lưu kết quả:</strong> Dữ liệu trích xuất (fields JSON) lưu vào DB, hiển thị trong modal chi tiết record.</Step>
          </div>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eff6ff'}}>📊</span>Đọc kết quả trích xuất</h2>
          <p className="guide-p">Trong modal chi tiết record, phần <strong>"Dữ liệu trích xuất"</strong> hiển thị:</p>
          <ul className="guide-ul">
            <li><strong>Loại tài liệu được nhận dạng</strong> và độ tự tin (confidence: 0.0–1.0).</li>
            <li><strong>Các field trích xuất</strong>: tên field, giá trị đọc được từ ảnh (hoặc <em>null</em> nếu không rõ).</li>
            <li><strong>Raw text</strong>: toàn bộ chữ đọc được từ ảnh (accordion mở rộng).</li>
          </ul>

          <Note type="warn">
            AI đọc ảnh chụp với chất lượng thấp, mờ hoặc chụp nghiêng sẽ cho confidence thấp (&lt; 0.5). Hệ thống không bịa số liệu — field không đọc được sẽ trả <em>null</em>.
          </Note>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fef2f2'}}>🔁</span>Chạy lại OCR</h2>
          <p className="guide-p">Nếu kết quả OCR sai hoặc thất bại, Admin/Manager có thể nhấn <strong>"Chạy lại OCR"</strong> trong modal chi tiết để xử lý lại với prompt mới nhất.</p>
        </section>

        <hr className="guide-divider" />

        {/* ── 7. Doc Types ── */}
        <section id="doctypes" className="guide-section">
          <h1 className="guide-h1">Phân loại tài liệu</h1>
          <p className="guide-p">
            Trang <strong>Phân loại</strong> (menu sidebar) cho phép xem toàn bộ loại tài liệu đang active và lọc records theo từng loại — hữu ích khi muốn xem riêng hóa đơn, phiếu kiểm kho, hoặc bất kỳ loại nào khác.
          </p>
          <ul className="guide-ul">
            <li>Click vào một loại tài liệu để xem chi tiết schema (các field được cấu hình).</li>
            <li>Dữ liệu trích xuất AI sẽ khớp chính xác với schema từng loại.</li>
          </ul>
          <Note type="info">
            Để thêm/sửa loại tài liệu và field, vào <strong>Cài đặt → Loại tài liệu</strong> (cần quyền Manager trở lên).
          </Note>
        </section>

        <hr className="guide-divider" />

        {/* ── 8. Dashboard ── */}
        <section id="dashboard" className="guide-section">
          <h1 className="guide-h1">Dashboard</h1>
          <p className="guide-p">Trang chủ sau khi đăng nhập. Cập nhật số liệu realtime mỗi khi có record mới.</p>

          <table className="guide-table">
            <thead><tr><th>Widget</th><th>Nội dung</th></tr></thead>
            <tbody>
              <tr><td><strong>KPI Cards</strong></td><td>Tổng records hôm nay, chờ xử lý, đã duyệt, tỷ lệ duyệt</td></tr>
              <tr><td><strong>Biểu đồ xu hướng</strong></td><td>Số records theo ngày/tuần/tháng (7 hoặc 30 ngày)</td></tr>
              <tr><td><strong>Thống kê nền tảng</strong></td><td>Tỷ lệ Telegram vs Zalo vs Web</td></tr>
              <tr><td><strong>Hoạt động gần đây</strong></td><td>10 record mới nhất với trạng thái</td></tr>
              <tr><td><strong>Top người gửi</strong></td><td>Người gửi nhiều record nhất trong kỳ</td></tr>
            </tbody>
          </table>
        </section>

        <hr className="guide-divider" />

        {/* ── 9. Báo cáo ── */}
        <section id="reports" className="guide-section">
          <h1 className="guide-h1">Báo cáo</h1>
          <p className="guide-p">Menu <strong>Báo cáo</strong> cung cấp nhiều tab phân tích khác nhau. Dùng bộ lọc ngày ở đầu trang để chọn kỳ báo cáo.</p>

          <table className="guide-table">
            <thead><tr><th>Tab</th><th>Nội dung</th><th>Vai trò</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>Tổng quan</strong></td>
                <td>KPI tổng hợp: records mới, duyệt, từ chối, tỷ lệ, confidence trung bình</td>
                <td><Role type="all" /></td>
              </tr>
              <tr>
                <td><strong>Tài chính</strong></td>
                <td>Tổng tiền trích xuất theo loại tài liệu, biểu đồ phân bổ</td>
                <td><Role type="all" /></td>
              </tr>
              <tr>
                <td><strong>Nhân sự</strong></td>
                <td>Records theo người gửi, hiệu suất nhân viên</td>
                <td><Role type="manager" /> <Role type="admin" /></td>
              </tr>
              <tr>
                <td><strong>Chất lượng</strong></td>
                <td>Tỷ lệ duyệt/từ chối, phân bố confidence AI, lý do từ chối phổ biến</td>
                <td><Role type="all" /></td>
              </tr>
              <tr>
                <td><strong>Tuân thủ & Audit</strong></td>
                <td>Ma trận hành động theo loại tài liệu & danh mục</td>
                <td><Role type="manager" /> <Role type="admin" /></td>
              </tr>
            </tbody>
          </table>

          <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>📥</span>Xuất báo cáo Excel</h2>
          <div className="guide-steps">
            <Step n={1}>Chọn tab báo cáo muốn xuất và đặt bộ lọc ngày phù hợp.</Step>
            <Step n={2}>Nhấn nút <strong>Xuất Excel</strong> ở góc trên phải.</Step>
            <Step n={3}>File <span className="guide-code">.xlsx</span> tải về tự động — mở bằng Excel hoặc Google Sheets.</Step>
          </div>
        </section>

        <hr className="guide-divider" />

        {/* ── 10. Thông báo ── */}
        <section id="notifications" className="guide-section">
          <h1 className="guide-h1">Thông báo realtime</h1>
          <p className="guide-p">
            Hệ thống dùng WebSocket (Socket.IO) để đẩy thông báo tức thì — không cần refresh trang.
          </p>
          <ul className="guide-ul">
            <li><strong>Badge chuông 🔔:</strong> Hiển thị tổng số record trạng thái "new" chưa xử lý.</li>
            <li><strong>Dropdown thông báo:</strong> Click chuông để xem 8 record mới nhất. Click vào item → chuyển đến trang Records.</li>
            <li><strong>Toast popup:</strong> Mỗi record mới được đẩy về sẽ hiển thị toast góc màn hình trong vài giây.</li>
          </ul>
          <Note type="info">
            Badge cập nhật realtime ngay khi có record mới hoặc khi một record được duyệt/từ chối. Không cần refresh trang.
          </Note>
        </section>

        <hr className="guide-divider" />

        {/* ── 11. Cài đặt (Admin only) ── */}
        {isAdmin && (
          <section id="settings" className="guide-section">
            <h1 className="guide-h1">Cài đặt hệ thống <Role type="admin" /></h1>
            <p className="guide-p">Vào <strong>Cài đặt</strong> từ sidebar. Gồm 6 tab:</p>

            <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>🕐</span>Cài đặt chung</h2>
            <p className="guide-p">Cấu hình <strong>múi giờ hệ thống</strong> — ảnh hưởng đến bộ lọc ngày, báo cáo và hiển thị thời gian toàn bộ hệ thống. Mặc định: <span className="guide-code">Asia/Ho_Chi_Minh</span>.</p>

            <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eaf2ff'}}>👥</span>Người dùng</h2>
            <div className="guide-steps">
              <Step n={1}><strong>Tạo tài khoản:</strong> Nhấn "+ Thêm tài khoản" → điền tên đăng nhập, họ tên, vai trò. Mật khẩu tạm thời tự sinh nếu để trống.</Step>
              <Step n={2}><strong>Đổi vai trò:</strong> Chọn vai trò mới từ dropdown trong hàng người dùng hoặc modal chi tiết.</Step>
              <Step n={3}><strong>Tạm dừng:</strong> Nhấn "Tạm dừng" — tài khoản không thể đăng nhập nhưng dữ liệu vẫn giữ nguyên.</Step>
              <Step n={4}><strong>Đặt lại mật khẩu:</strong> Tạo mật khẩu tạm thời mới và chia sẻ riêng tư cho người dùng.</Step>
            </div>

            <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fefce8'}}>🗂️</span>Loại tài liệu</h2>
            <p className="guide-p">Quản lý schema tài liệu mà AI dùng để phân loại và trích xuất:</p>
            <ul className="guide-ul">
              <li><strong>Thêm loại mới:</strong> Nhấn "+ Thêm loại" → điền mã code (snake_case), tên hiển thị, mô tả.</li>
              <li><strong>Thêm field:</strong> Mở rộng một loại → điền field_key, nhãn, kiểu dữ liệu (text/number/money/date…).</li>
              <li><strong>Bật/Tắt:</strong> Loại tắt không xuất hiện trong schema gửi cho AI.</li>
            </ul>
            <Note type="warn">
              Thay đổi schema loại tài liệu ảnh hưởng đến <strong>kết quả OCR từ lần xử lý tiếp theo</strong>. Record cũ vẫn giữ dữ liệu cũ.
            </Note>

            <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#fdf4ff'}}>🏷️</span>Danh mục</h2>
            <p className="guide-p">Danh mục là cách phân nhóm thứ cấp (VD: Chi phí, Doanh thu, Kho…). Có thể thêm màu sắc để phân biệt trực quan.</p>

            <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>🔑</span>Setup API Key</h2>
            <table className="guide-table">
              <thead><tr><th>Cài đặt</th><th>Mục đích</th></tr></thead>
              <tbody>
                <tr><td><strong>Telegram Bot Token</strong></td><td>Kết nối bot nhận ảnh từ Telegram</td></tr>
                <tr><td><strong>Telegram Webhook Secret</strong></td><td>Xác thực request webhook từ Telegram</td></tr>
                <tr><td><strong>Zalo OA Token</strong></td><td>Kết nối OA nhận ảnh từ Zalo</td></tr>
                <tr><td><strong>Gemini API Key (chính/phụ)</strong></td><td>Key gọi AI để OCR ảnh</td></tr>
                <tr><td><strong>Tên Model Gemini</strong></td><td>Model dùng cho OCR (mặc định: gemini-2.5-flash)</td></tr>
                <tr><td><strong>Prompt AI Extraction</strong></td><td>Hướng dẫn nghiệp vụ tùy chỉnh cho AI — backend tự gắn schema và output contract</td></tr>
              </tbody>
            </table>
            <Note type="info">
              API Key được mã hóa AES-256-GCM trước khi lưu vào DB. Giao diện chỉ hiển thị dấu ●●●●●, không bao giờ trả về key thực.
            </Note>
          </section>
        )}

        {/* ── 12. Backup (Admin only) ── */}
        {isAdmin && (
          <>
            <hr className="guide-divider" />
            <section id="backup" className="guide-section">
              <h1 className="guide-h1">Backup Database <Role type="admin" /></h1>
              <p className="guide-p">Vào <strong>Cài đặt → Backup DB</strong> để quản lý bản sao lưu cơ sở dữ liệu PostgreSQL.</p>

              <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>💾</span>Tạo backup</h2>
              <div className="guide-steps">
                <Step n={1}>Nhấn nút <strong>"+ Tạo Backup"</strong>.</Step>
                <Step n={2}>Hệ thống chạy <span className="guide-code">pg_dump</span> — thời gian từ 5–60 giây tùy kích thước DB.</Step>
                <Step n={3}>File SQL xuất hiện trong danh sách với tên, kích thước và thời gian tạo.</Step>
              </div>

              <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eff6ff'}}>📥</span>Download & Khôi phục</h2>
              <p className="guide-p">Nhấn <strong>Download</strong> để tải file <span className="guide-code">.sql</span> về máy. Để khôi phục:</p>
              <div className="guide-steps">
                <Step n={1}>Tạo database mới (nếu cần): <span className="guide-code">createdb ten_db</span></Step>
                <Step n={2}>Chạy lệnh restore: <span className="guide-code">psql -U postgres -d ten_db -f backup_2026-01-01_10-00-00.sql</span></Step>
              </div>

              <Note type="warn">
                <strong>Giới hạn:</strong> Hệ thống giữ tối đa <strong>10 bản backup</strong>. Khi tạo bản thứ 11, bản cũ nhất tự động xóa. Hãy download bản quan trọng về lưu trữ riêng.
              </Note>
            </section>
          </>
        )}

        {/* ── 13. Nhật ký (Admin only) ── */}
        {isAdmin && (
          <>
            <hr className="guide-divider" />
            <section id="activitylog" className="guide-section">
              <h1 className="guide-h1">Nhật ký hệ thống <Role type="admin" /></h1>
              <p className="guide-p">
                Vào menu <strong>Nhật ký hệ thống</strong> (sidebar). Ghi lại mọi hành động quan trọng: đăng nhập, tạo/sửa record, thay đổi cài đặt, backup…
              </p>

              <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#f0fdf4'}}>🔍</span>Tìm kiếm & Lọc</h2>
              <ul className="guide-ul">
                <li><strong>Khoảng ngày:</strong> Lọc log trong khoảng thời gian.</li>
                <li><strong>Hành động:</strong> Nhóm theo loại (đăng nhập, record, cài đặt, backup…).</li>
                <li><strong>Tài nguyên:</strong> records / users / settings / database…</li>
                <li><strong>Tìm kiếm:</strong> Theo tên người thực hiện hoặc ID tài nguyên.</li>
              </ul>

              <h2 className="guide-h2"><span className="guide-h2-icon" style={{background:'#eff6ff'}}>📄</span>Xem chi tiết</h2>
              <p className="guide-p">Click vào bất kỳ dòng log nào để mở modal chi tiết — hiển thị <strong>diff trước/sau</strong> (nếu có) và metadata đầy đủ (IP, User Agent, thời gian chính xác).</p>
            </section>
          </>
        )}

        <hr className="guide-divider" />

        {/* ── 14. Tips ── */}
        <section id="tips" className="guide-section">
          <h1 className="guide-h1">Mẹo & Phím tắt</h1>

          <table className="guide-table">
            <thead><tr><th>Thao tác</th><th>Cách thực hiện</th></tr></thead>
            <tbody>
              <tr>
                <td>Tìm kiếm nhanh từ bất kỳ trang nào</td>
                <td>Nhập từ khóa vào ô search trên header → <span className="guide-kbd">Enter</span></td>
              </tr>
              <tr>
                <td>Đóng modal / dropdown</td>
                <td>Bấm <span className="guide-kbd">Esc</span> hoặc click ra ngoài vùng modal</td>
              </tr>
              <tr>
                <td>Lọc record theo từ khóa URL</td>
                <td>Thêm <span className="guide-code">?q=từ_khóa</span> vào URL trang Records</td>
              </tr>
              <tr>
                <td>Thu gọn sidebar</td>
                <td>Click icon mũi tên ở góc trên sidebar để có thêm không gian</td>
              </tr>
              <tr>
                <td>Làm mới số liệu dashboard</td>
                <td>Reload trang hoặc thay đổi bộ lọc ngày</td>
              </tr>
              <tr>
                <td>Xem record mới nhất nhanh</td>
                <td>Click chuông 🔔 → danh sách 8 record mới nhất</td>
              </tr>
            </tbody>
          </table>

          <Note type="tip" icon="💡">
            <strong>Tốc độ tối ưu:</strong> Hệ thống cache kết quả API 60 giây. Nếu vừa thực hiện thao tác mà số liệu chưa cập nhật, đợi dưới 1 phút hoặc hard-refresh (<span className="guide-kbd">Ctrl</span>+<span className="guide-kbd">Shift</span>+<span className="guide-kbd">R</span>).
          </Note>

          <div style={{ marginTop: 32, padding: '18px 22px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--ink)' }}>Cần hỗ trợ thêm?</strong><br />
              Liên hệ Admin hệ thống hoặc nhóm kỹ thuật BBO Technology.<br />
              Tài liệu này được cập nhật cùng với các phiên bản phần mềm mới.
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
