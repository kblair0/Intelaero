// components/Card.tsx
import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
}

const Card: React.FC<CardProps> = ({ children }) => {
  return (
    <div className="flex-1 bg-white shadow-lg p-6 rounded-lg border border-gray-200">
      {children}
    </div>
  );
};

export default Card;
