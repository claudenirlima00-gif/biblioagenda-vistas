
import React from 'react';

const SobralLogo: React.FC<{ className?: string; size?: number }> = ({ className, size = 40 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img 
        src="https://i.postimg.cc/x881K4FF/Logo_emprestimo.png" 
        alt="Logo Biblioteca Municipal de Sobral" 
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default SobralLogo;
