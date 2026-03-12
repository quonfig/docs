import React, { useEffect } from "react";
import Footer from "@theme-original/Footer";

function setGUIDCookie() {
  if (document.cookie.indexOf("tid=") === -1) {
    const guid = crypto.randomUUID();
    const expirationDate = new Date(
      new Date().setFullYear(new Date().getFullYear() + 1)
    ).toUTCString();
    document.cookie = `tid=${guid}; expires=${expirationDate}; domain=.quonfig.com; SameSite=Lax; path=/`;
  }
}

export default function FooterWrapper(props) {
  useEffect(() => {
    setGUIDCookie();

    const tid = document.cookie
      .split("; ")
      .find((row) => row.startsWith("tid="))
      ?.split("=")[1];

    window.posthog?.identify(tid);
  });

  return (
    <>
      <Footer {...props} />
    </>
  );
}
