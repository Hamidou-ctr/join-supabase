import { el } from "./dom.js";

function icon(file, className) {
  return el("img", {
    className,
    attrs: { src: `assets/img/${file}`, alt: "", width: "25", height: "25" },
  });
}

// href: null = page not built yet, rendered as a disabled item instead of a dead link.
const NAV_ITEMS = [
  {
    id: "summary",
    label: "Summary",
    href: "app.html",
    icon: "icon-summary.svg",
  },
  { id: "add-task", label: "Add Task", href: "add-task.html", icon: "icon-add-task.svg" },
  { id: "board", label: "Board", href: null, icon: "icon-board.svg" },
  { id: "contacts", label: "Contacts", href: "contacts.html", icon: "icon-contacts.svg" },
];

const EXTERNAL_NAV_ITEMS = [
  { id: "login", label: "Log In", href: "index.html", icon: "icon-login.svg" },
];

function buildLogo(file, className) {
  const link = el("a", {
    className,
    attrs: { href: "app.html", "aria-label": "Join home" },
  });
  link.append(
    el("img", { attrs: { src: `assets/${file}`, alt: "", height: "48" } }),
  );
  return link;
}

function buildNav(items, active) {
  const list = el("ul", { className: "nav-list" });
  for (const item of items) {
    const content = [
      icon(item.icon, "nav-icon"),
      el("span", { text: item.label }),
    ];
    let node;
    if (item.href) {
      node = el(
        "a",
        { className: "nav-item", attrs: { href: item.href } },
        content,
      );
      if (item.id === active) node.setAttribute("aria-current", "page");
    } else {
      node = el(
        "span",
        {
          className: "nav-item nav-item--disabled",
          attrs: { "aria-disabled": "true" },
        },
        content,
      );
    }
    list.append(el("li", {}, [node]));
  }
  return el(
    "nav",
    { className: "sidebar-nav", attrs: { "aria-label": "Main" } },
    [list],
  );
}

function buildLegalLinks(className, active) {
  const links = [
    { id: "privacy", label: "Privacy Policy", href: "privacy-policy.html" },
    { id: "legal", label: "Legal notice", href: "legal-notice.html" },
  ];
  return el(
    "div",
    { className },
    links.map((link) => {
      const node = el("a", { text: link.label, attrs: { href: link.href } });
      if (link.id === active) node.setAttribute("aria-current", "page");
      return node;
    }),
  );
}

function buildUserMenu(initials, onLogout, active) {
  const toggle = el("button", {
    className: "avatar",
    text: initials,
    attrs: {
      type: "button",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      "aria-label": "User menu",
    },
  });
  const logout = el("button", {
    className: "user-menu-item",
    text: "Log out",
    attrs: { type: "button" },
  });
  const menu = el("div", { className: "user-menu", attrs: { hidden: "" } }, [
    buildLegalLinks("user-menu-links", active),
    logout,
  ]);

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(menu.hidden));
  logout.addEventListener("click", onLogout);
  document.addEventListener("click", (event) => {
    if (
      !menu.hidden &&
      !menu.contains(event.target) &&
      !toggle.contains(event.target)
    )
      setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  return el("div", { className: "user-menu-wrap" }, [toggle, menu]);
}

function buildHelpLink() {
  const link = el("a", {
    className: "help-link",
    attrs: { href: "help.html", "aria-label": "Help" },
  });
  link.append(
    el("img", {
      attrs: {
        src: "assets/img/icon-help.svg",
        alt: "",
        width: "20",
        height: "20",
      },
    }),
  );
  return link;
}

// Wraps the page's <main> (inside #shell) with sidebar + top bar, so every page shares one shell.
// external = not signed in (legal pages): only "Log In" + legal links, no avatar/help.
export function mountShell({ active, initials, onLogout, external = false }) {
  const shell = document.getElementById("shell");
  const main = shell.querySelector("main");

  const sidebar = el(
    "aside",
    { className: external ? "sidebar sidebar--external" : "sidebar" },
    [
      buildLogo("img/logo-white.svg", "sidebar-logo"),
      buildNav(external ? EXTERNAL_NAV_ITEMS : NAV_ITEMS, active),
      buildLegalLinks("sidebar-legal", active),
    ],
  );
  const topbarChildren = [
    buildLogo("logo.svg", "topbar-logo"),
    el("p", {
      className: "topbar-title",
      text: "Kanban Project Management Tool",
    }),
  ];
  if (!external) {
    topbarChildren.push(
      el("div", { className: "topbar-actions" }, [
        buildHelpLink(),
        buildUserMenu(initials, onLogout, active),
      ]),
    );
  }

  shell.replaceChildren(
    sidebar,
    el("div", { className: "shell-body" }, [
      el("header", { className: "topbar" }, topbarChildren),
      main,
    ]),
  );
}
