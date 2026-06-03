import React from "react";
import { useThemeConfig } from "@docusaurus/theme-common";
import {
  useNavbarMobileSidebar,
  useNavbarSecondaryMenu,
} from "@docusaurus/theme-common/internal";
import { usePluginData } from "@docusaurus/useGlobalData";
import { useLocation } from "@docusaurus/router";
import NavbarItem from "@theme/NavbarItem";
import DocSidebarItems from "@theme/DocSidebarItems";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items;
}

// Renders the full docs table of contents inside the drawer. Mirrors the docs
// theme's DocSidebar/Mobile secondary menu, but is driven by the sidebar tree
// we expose as global data (see the homepageSidebarPlugin in
// docusaurus.config.js) so it works on pages without docs sidebar context.
function DocsSidebarSection() {
  const mobileSidebar = useNavbarMobileSidebar();
  const { pathname } = useLocation();
  const data = usePluginData("quonfig-homepage-sidebar");
  const sidebar = data?.docsSidebars?.tutorialSidebar;
  if (!sidebar?.length) {
    return null;
  }
  return (
    <DocSidebarItems
      items={sidebar}
      activePath={pathname}
      onItemClick={(item) => {
        // Close the drawer only when navigating, matching the docs theme.
        if (item.type === "category" && item.href) {
          mobileSidebar.toggle();
        }
        if (item.type === "link") {
          mobileSidebar.toggle();
        }
      }}
      level={1}
    />
  );
}

// The primary menu displays the navbar items.
export default function NavbarMobilePrimaryMenu() {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();

  // On docs pages the drawer already shows the docs sidebar via the secondary
  // menu, so only append the full table of contents here when there is no
  // secondary menu (home page, 404, search, etc.).
  const secondaryMenu = useNavbarSecondaryMenu();
  const hasDocsSidebar = Boolean(secondaryMenu.content);

  return (
    <ul className="menu__list">
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
          key={i}
        />
      ))}
      {!hasDocsSidebar && <DocsSidebarSection />}
    </ul>
  );
}
