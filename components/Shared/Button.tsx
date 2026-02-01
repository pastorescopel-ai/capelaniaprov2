
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'dark';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-[#005a9c] text-white shadow-xl shadow-blue-100 hover:brightness-110",
    secondary: "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100",
    danger: "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white",
    success: "bg-emerald-600 text-white shadow-xl shadow-emerald-100 hover:brightness-110",
    ghost: "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600",
    dark: "bg-slate-900 text-white shadow-xl hover:bg-black"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <>
          {icon && <span className="text-xs">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
