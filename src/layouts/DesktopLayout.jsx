import "../styles/main.css";

export default function DesktopLayout({
  title,
  subtitle,
  children,
  actions,
  hideHeader = false,
  hideSidebar = false,
  className = "",
  contentClassName = "",
}) {
  const rootClassName = [
    "app-layout",
    "app-layout-desktop",
    hideHeader ? "hide-desktop-header" : "",
    hideSidebar ? "hide-desktop-sidebar" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {!hideHeader ? (
        <header className="app-layout-desktop-header">
          <div className="app-layout-desktop-header-copy">
            <div className="app-layout-desktop-eyebrow">ระบบงานจองรถ</div>
            <h1 className="app-layout-desktop-title">{title}</h1>
            {subtitle ? <p className="app-layout-desktop-subtitle">{subtitle}</p> : null}
          </div>

          {actions ? <div className="app-layout-desktop-actions">{actions}</div> : null}
        </header>
      ) : null}

      <div className={`app-layout-desktop-shell ${hideSidebar ? "app-layout-desktop-shell--no-sidebar" : ""}`.trim()}>
        {!hideSidebar ? (
          <aside className="app-layout-desktop-sidebar" aria-label="ข้อมูลด้านข้าง">
            <div className="app-layout-desktop-sidebar-card">
              <h2 className="app-layout-desktop-sidebar-title">เมนูหลัก</h2>
              <p className="app-layout-desktop-sidebar-text">
                ใช้เมนูหลักของระบบเพื่อสลับหน้า และดูสรุปข้อมูลของหน้านี้ได้จากพื้นที่เนื้อหาหลัก
              </p>
            </div>
          </aside>
        ) : null}

        <main className={`app-layout-desktop-main ${contentClassName}`.trim()} role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
