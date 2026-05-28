import MobilePageHeader from "./MobilePageHeader";
import "../styles/main.css";

export default function MobilePageLayout({
  title,
  subtitle,
  actions,
  children,
  className = "",
  contentClassName = "",
  topOffset = 57,
  hideHeader = false,
}) {
  return (
    <div
      className={`mobile-page-layout${hideHeader ? " mobile-page-layout--header-hidden" : ""} ${className}`.trim()}
      style={{ "--mobile-header-offset": `${topOffset}px` }}
    >
      <div className={`mobile-page-content ${contentClassName}`.trim()}>
        {hideHeader ? null : (
          <MobilePageHeader title={title} subtitle={subtitle} actions={actions} />
        )}

        {children}
      </div>
    </div>
  );
}
