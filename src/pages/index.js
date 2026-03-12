import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import Button from "../components/Button";
import Section from "../components/Section";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <div
      className={`bg-brand-slate text-white w-full flex items-center justify-between p-6 md:p-12 lg:p-24 relative`}
    >
      <div className="flex flex-col items-start gap-8">
        <h1 className="text-4xl md:text-6xl font-extrabold">
          {siteConfig.title}
        </h1>
        <h2 className="text-xl md:text-4xl font-medium">
          {siteConfig.tagline}
        </h2>
        <Button
          label="Get Started in 5 min"
          href="/docs/tutorials/get-started"
          type="secondary"
        />
      </div>
      <div className="w-1/2 -my-6 md:-my-12 lg:-my-24">
        <img src="/img/orbits.svg" className="w-full h-auto" />
      </div>
    </div>
  );
}

const linkClasses =
  "flex flex-col items-center bg-brand-purple-light dark:bg-slate-700 text-lg font-bold rounded-xl p-4 lg:p-8 border-4 border-solid border-brand-purple-light dark:border-brand-slate hover:border-brand-purple dark:hover:border-brand-coral hover:no-underline";

const imgStyles = { maxWidth: "200px", width: "100%", padding: "1rem" };

function Langs() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Section>
      <h2>Select Your Language</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">
        <Link className={linkClasses} to="/docs/sdks/ruby">
          <img
            src="/img/langs/ruby.png"
            style={imgStyles}
            className=""
            alt="Ruby"
          />
          <span>Ruby</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/java">
          <img
            src="/img/langs/java.png"
            style={imgStyles}
            className=""
            alt="Java"
          />
          <span>Java</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/node">
          <img
            src="/img/langs/node.png"
            style={imgStyles}
            className=""
            alt="Node"
          />
          <span>Node</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/python">
          <img
            src="/img/langs/python.png"
            style={imgStyles}
            className=""
            alt="Python"
          />
          <span>Python</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/go">
          <img
            src="/img/langs/go.png"
            style={imgStyles}
            className=""
            alt="Go"
          />
          <span>Go</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/javascript">
          <img
            src="/img/langs/js.png"
            style={imgStyles}
            className=""
            alt="JS"
          />
          <span>Javascript</span>
        </Link>
        <Link className={linkClasses} to="/docs/sdks/react">
          <img
            src="/img/langs/react.png"
            style={imgStyles}
            className=""
            alt="React"
          />
          <span>React</span>
        </Link>
      </div>
      <div className="flex flex-col gap-4 md:gap-8 items-center">
        <div className="text-lg md:text-2xl font-bold text-center">
          Don't see the language you're looking for?
        </div>
        <Button
          label="Request a language"
          href="https://share.hsforms.com/1BKgbsgReSl2bP351bfdJDg9z48"
        />
      </div>
    </Section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <HomepageHeader />
      <main>
        <Langs />
      </main>
    </Layout>
  );
}
