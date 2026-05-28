import "../styles/main.css";

export default function MobilePageHeader({ title, subtitle, actions, icon, className = "" }) {
  return (
    <header className={`mobile-page-header-card ${className}`.trim()}>
      <div className="mobile-page-header-copy">
        {icon ? <div className="mobile-page-header-icon">{icon}</div> : null}
        <div className="mobile-page-header-text">
          <h2 className="mobile-page-header-title">{title}</h2>
          {subtitle ? <p className="mobile-page-header-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      {actions ? <div className="mobile-page-header-actions">{actions}</div> : null}
    </header>
  );
}
