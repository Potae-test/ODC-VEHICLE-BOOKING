import DesktopLayout from "./DesktopLayout";
import MobilePageLayout from "./MobilePageLayout";
import useIsMobile from "../hooks/useIsMobile";
import "../styles/main.css";

export default function AppLayout({
  title,
  subtitle,
  children,
  actions,
  hideMobileHeader = false,
  hideDesktopHeader = false,
  hideDesktopSidebar = false,
  mobileTopOffset = 57,
  className = "",
  contentClassName = "",
}) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <MobilePageLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      hideHeader={hideMobileHeader}
      topOffset={mobileTopOffset}
      className={className}
      contentClassName={contentClassName}
    >
      {children}
    </MobilePageLayout>
  ) : (
    <DesktopLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      hideHeader={hideDesktopHeader}
      hideSidebar={hideDesktopSidebar}
      className={className}
      contentClassName={contentClassName}
    >
      {children}
    </DesktopLayout>
  );
}
