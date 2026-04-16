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
  organizationName: "QuonfigHQ", // Usually your GitHub org/user name.
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
            "https://github.com/QuonfigHQ/docs/tree/main/",
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
                href: "https://github.com/QuonfigHQ",
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
