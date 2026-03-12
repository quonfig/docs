import React from "react";

const Section = ({ classes, children }) => {
  return (
    <div
      className={
        "p-6 md:p-12 lg:p-24 flex flex-col justify-start items-center gap-6 md:gap-12 lg:gap-20 [&_h2]:text-2xl md:[&_h2]:text-5xl [&_h2]:font-extrabold [&_h2]:m-0 [&_h3]:m-0 " +
        classes
      }
    >
      {children}
    </div>
  );
};

export default Section;
