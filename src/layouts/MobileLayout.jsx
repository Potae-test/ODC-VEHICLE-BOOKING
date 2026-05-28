import MobilePageLayout from "./MobilePageLayout";

export default function MobileLayout({
  title,
  subtitle,
  children,
  actions,
  hideMobileHeader = false,
  className = "",
  contentClassName = "",
  mobileTopOffset = 57,
}) {
  return (
    <MobilePageLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      hideHeader={hideMobileHeader}
      className={className}
      contentClassName={contentClassName}
      topOffset={mobileTopOffset}
    >
      {children}
    </MobilePageLayout>
  );
}
