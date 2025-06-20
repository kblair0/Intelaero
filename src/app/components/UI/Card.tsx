// components/Card.tsx
import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string; 
}

const Card: React.FC<CardProps> = ({ children }) => {
  return (
    <div className="flex-1 bg-white shadow-lg p-4 rounded-lg border border-gray-200 m-1">
      {children}
    </div>
  );
};

export default Card;
