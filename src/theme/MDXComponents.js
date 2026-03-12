// Import the original mapper
import MDXComponents from "@theme-original/MDXComponents";

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

import Button from "../components/Button";
import Section from "../components/Section";

export default {
  // Re-use the default mapping
  ...MDXComponents,
  // Map tags to our custom components
  Button,
  Section,
  Tabs,
  TabItem,
};
