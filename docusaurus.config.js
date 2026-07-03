// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Quonfig Documentation",
  tagline: "API Docs for Quonfig",
  url: "https://docs.quonfig.com",
  baseUrl: "/",
  organizationName: "quonfig",
  projectName: "docs",
  trailingSlash: false,
  onBrokenLinks: "throw",
  favicon: "img/favicon.png",
  plugins: [
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
    // Expose the resolved docs sidebar tree as global data so the mobile
    // hamburger drawer can render the full table of contents on non-docs pages
    // (home, 404, search), where the docs plugin's sidebar context is absent.
    function homepageSidebarPlugin() {
      return {
        name: "quonfig-homepage-sidebar",
        allContentLoaded({ allContent, actions }) {
          // eslint-disable-next-line global-require
          // Deep import needs the explicit .js extension: the package's
          // "exports" map exposes "./lib/*" verbatim (no extension resolution).
          const { toSidebarsProp } = require("@docusaurus/plugin-content-docs/lib/props.js");
          const docsContent = allContent["docusaurus-plugin-content-docs"]?.default;
          const versions = docsContent?.loadedVersions ?? [];
          const version = versions.find((v) => v.isLast) ?? versions[0];
          // toSidebarsProp() yields the same prop shape that <DocSidebarItems>
          // consumes on real docs pages (doc links resolved to hrefs).
          const docsSidebars = version ? toSidebarsProp(version) : {};
          actions.setGlobalData({ docsSidebars });
        },
      };
    },
    // PostHog analytics, sharing the same project (us.posthog.com 434893) as
    // app-quonfig and www so all three Quonfig web properties feed one project.
    // Options beyond apiKey/appUrl/enableInDevelopment are passed straight into
    // posthog.init() by the plugin (JSON-serialized, so no functions).
    //
    // `cross_subdomain_cookie: true` writes the anonymous distinct_id cookie to
    // `.quonfig.com`, so a docs reader is the same PostHog person on www and
    // app.quonfig.com. When they sign up, app-quonfig's identify(userId)
    // promotes that shared anon id and stitches their docs activity to the real
    // user — which is why we no longer identify() docs visitors ourselves (that
    // hack, keyed on a random `tid` cookie, used to live in the Footer swizzle
    // and actively broke this stitch).
    //
    // The apiKey is a public `phc_` client key that ships in the browser
    // regardless, so it's a literal here (matching the public project id already
    // hardcoded in app-quonfig's next.config).
    //
    // `capture_pageview: false` because the plugin's own client module
    // (posthog-docusaurus/src/posthog.js) already fires `$pageview` on every
    // Docusaurus route change; leaving posthog-js's automatic pageview on would
    // double-count. Note: only active in a production build (NODE_ENV=production
    // / `docusaurus build`), not `docusaurus start`.
    [
      "posthog-docusaurus",
      {
        apiKey: "phc_vGeR6TXjXAXZnkPcYEKdyp86dy7Np4fjRBEWWhKFJDWk",
        appUrl: "https://us.i.posthog.com",
        enableInDevelopment: false,
        ui_host: "https://us.posthog.com",
        defaults: "2026-01-30",
        cross_subdomain_cookie: true,
        capture_exceptions: true,
        capture_pageview: false,
        session_recording: { maskAllInputs: false },
      },
    ],
  ],
  themes: ["@docusaurus/theme-mermaid"],
  // In order for Mermaid code blocks in Markdown to work,
  // you also need to enable the Remark plugin with this option
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "quonfig", // Usually your GitHub org/user name.
  projectName: "docs", // Usually your repo name.

  trailingSlash: false,

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'algolia-site-verification',
        content: 'EFBF915913050FB9',
      },
    },
  ],

  scripts: [],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/quonfig/docs/tree/main/",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        gtag: {
          trackingID: "G-CB91P8FVG3",
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "",
        logo: {
          alt: "Quonfig Logo",
          src: "img/logo.svg",
          href: "https://www.quonfig.com/",
        },
        items: [
          {
            to: "/",
            position: "right",
            label: "Quonfig Docs Home",
            className: "text-white", // workaround for the fact that docusuarus wants to always treat this link as active
          },
          {
            type: "custom-NavbarCta",
            position: "right",
          },
        ],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Tutorial",
                to: "/docs/tutorials/get-started/",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "Stack Overflow",
                href: "https://stackoverflow.com/questions/tagged/quonfig",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/quonfighq",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/quonfig",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Quonfig Inc. Built with Docusaurus.`,
      },
      mermaid: {
        theme: { light: "base", dark: "base" },
        options: {
          theme: "base",
          themeVariables: {
            primaryColor: "#B9CBFB",
            lineColor: "#2962F5",
            tertiaryColor: "#E8EEFF",
          },
        },
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ["java", "ruby", "python"],
      },
      algolia: {
        // The application ID provided by Algolia
        appId: "LSBZI7B3YC",

        // Public API key: it is safe to commit it
        apiKey: "caa1592d833e68e465d3bcb96eab9207",

        indexName: "Documentation website",

        // Optional: see doc section below
        contextualSearch: true,
        askAi: "xv1BasYt7SJh",

        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        // externalUrlRegex: "external\\.com|domain\\.com",

        // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
        // replaceSearchResultPathname: {
        //   from: "/docs/", // or as RegExp: /\/docs\//
        //   to: "/",
        // },

        // Optional: Algolia search parameters
        searchParameters: {},

        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: "search",

        //... other Algolia params

        // insights: true, // Optional, automatically send insights when user interacts with search results

        // container: '### REPLACE ME WITH A CONTAINER (e.g. div) ###'

        // debug: false // Set debug to true if you want to inspect the modal
      },
    }),
};

module.exports = config;
