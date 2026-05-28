import "../styles/main.css";

export default function MobilePageSection({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`mobile-page-section ${className}`.trim()}>
      {(title || subtitle || actions) ? (
        <div className="mobile-page-section-header">
          <div className="mobile-page-section-copy">
            {title ? <h3 className="mobile-page-section-title">{title}</h3> : null}
            {subtitle ? <p className="mobile-page-section-subtitle">{subtitle}</p> : null}
          </div>

          {actions ? <div className="mobile-page-section-actions">{actions}</div> : null}
        </div>
      ) : null}

      <div className={`mobile-page-section-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
