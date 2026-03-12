import React from "react";

interface Props {
  label: string;
  href: string;
  type: "primary" | "secondary";
}

const Button = ({ label, href, type = "primary" }) => {
  if (type === "secondary") {
    return (
      <a
        href={href}
        className="px-6 py-3 md:px-8 md:py-4 bg-white border border-solid border-brand-purple rounded-full justify-center items-center inline-flex hover:no-underline hover:bg-brand-slate hover:text-white"
      >
        <div className="text-md md:text-xl font-medium leading-tight tracking-wide font-display">
          {label}
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      className="px-6 py-3 md:px-8 md:py-4 bg-slate-900 rounded-full border border-slate-900 justify-center items-center inline-flex hover:no-underline hover:bg-brand-purple"
    >
      <div className="text-white text-md md:text-xl font-medium leading-tight tracking-wide font-display">
        {label}
      </div>
    </a>
  );
};

export default Button;
