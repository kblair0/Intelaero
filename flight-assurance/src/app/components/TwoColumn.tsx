// components/TwoColumn.tsx
import React, { ReactNode } from "react";

interface TwoColumnProps {
  children: ReactNode;
}

const TwoColumn: React.FC<TwoColumnProps> = ({ children }) => {
  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 mt-6 ">
      {children}
    </div>
  );
};

export default TwoColumn;
