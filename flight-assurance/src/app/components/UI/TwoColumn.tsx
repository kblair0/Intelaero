// components/TwoColumn.tsx
import React, { ReactNode } from "react";

interface TwoColumnProps {
  children: ReactNode;
}

const TwoColumn: React.FC<TwoColumnProps> = ({ children }) => {
  return (
    <div className="flex flex-col md:flex-row gap-2 p-2 mt-1">
      {children}
    </div>
  );
};

export default TwoColumn;
