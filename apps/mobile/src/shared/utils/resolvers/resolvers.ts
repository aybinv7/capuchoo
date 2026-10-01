import type { ComponentResolver } from "unplugin-vue-components/types";

export function Framework7VueResolver(): ComponentResolver {
  const framework7Components = [
    "f7-app",
    "f7-view",
    "f7-views",
    "f7-page",
    "f7-page-content",

    "f7-navbar",
    "f7-nav-left",
    "f7-nav-right",
    "f7-nav-title",
    "f7-nav-title-large",
    "f7-toolbar",
    "f7-toolbar-pane",
    "f7-subnavbar",
    "f7-searchbar",

    "f7-row",
    "f7-col",

    "f7-list",
    "f7-list-group",
    "f7-list-item",
    "f7-list-item-row",
    "f7-list-item-cell",
    "f7-list-item-content",
    "f7-list-button",
    "f7-list-input",

    "f7-checkbox",
    "f7-toggle",
    "f7-stepper",

    "f7-button",
    "f7-segmented",
    "f7-fab",
    "f7-fab-button",
    "f7-fab-buttons",

    "f7-card",
    "f7-card-header",
    "f7-card-content",
    "f7-card-footer",

    "f7-popup",
    "f7-popover",
    "f7-actions",
    "f7-actions-group",
    "f7-actions-button",
    "f7-actions-label",
    "f7-sheet",

    "f7-login-screen",
    "f7-login-screen-title",

    "f7-panel",
    "f7-tabs",
    "f7-tab",
    "f7-link",

    "f7-photo-browser",

    "f7-swipeout",
    "f7-swipeout-actions",
    "f7-swipeout-button",
    "f7-swipeout-content",

    "f7-accordion",
    "f7-accordion-item",
    "f7-accordion-toggle",
    "f7-accordion-content",
    "f7-contacts-list",
    "f7-virtual-list",
    "f7-list-index",

    "f7-chip",
    "f7-badge",

    "f7-preloader",
    "f7-progressbar",
    "f7-skeleton-block",
    "f7-skeleton-text",

    "f7-messages",
    "f7-messages-title",
    "f7-message",
    "f7-messagebar",
    "f7-messagebar-attachment",
    "f7-messagebar-attachments",

    "f7-icon",

    "f7-block",
    "f7-block-title",
    "f7-block-header",
    "f7-block-footer",
  ];

  const toCamelCase = (str: string) => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  };

  return {
    type: "component",
    resolve: (name: string) => {
      if (name.startsWith("F7") && name.length > 2) {
        const kebabName = name
          .replace(/^F7/, "f7-")
          .replace(/([a-z])([A-Z])/g, "$1-$2")
          .toLowerCase();

        if (framework7Components.includes(kebabName)) {
          return {
            name: toCamelCase(kebabName),
            from: "framework7-vue",
          };
        }
      }

      if (name.startsWith("f7-") && framework7Components.includes(name)) {
        return {
          name: toCamelCase(name),
          from: "framework7-vue",
        };
      }

      if (name.match(/^f7[A-Z]/)) {
        const kebabName = name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

        if (framework7Components.includes(kebabName)) {
          return {
            name: toCamelCase(kebabName),
            from: "framework7-vue",
          };
        }
      }
    },
  };
}

export function getFramework7AutoImports() {
  return {
    "framework7/lite": ["utils", "getDevice", "createStore", "Dom7", "request"],
    // Only what framework7-vue actually exports. `f7route` and `f7router` are passed to a
    // route component as props - see FeatureDetailView - and importing them fails at runtime.
    "framework7-vue": ["f7ready", "f7", "theme"],
  };
}
