// IconButton.tsx
// A reusable button component with icon support for map controls

import React, { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'transparent';
}

const IconButton: React.FC<IconButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium shadow transition-colors";
  
  const variantStyles = {
    primary: "bg-white hover:bg-gray-100 text-gray-800",
    secondary: "bg-blue-500 hover:bg-blue-600 text-white",
    transparent: "bg-transparent hover:bg-black/5 text-gray-800 shadow-none"
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
};

export default IconButton;