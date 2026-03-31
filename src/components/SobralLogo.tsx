
import React from 'react';

const SobralLogo: React.FC<{ className?: string; size?: number }> = ({ className, size = 40 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M50 5L15 25V75L50 95L85 75V25L50 5Z" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinejoin="round"
      />
      <path 
        d="M30 40C30 40 40 30 50 30C60 30 70 40 70 40V70C70 70 60 80 50 80C40 80 30 70 30 70V40Z" 
        fill="currentColor" 
        fillOpacity="0.2"
      />
      <rect x="45" y="45" width="10" height="20" fill="currentColor" />
      <circle cx="50" cy="40" r="5" fill="currentColor" />
    </svg>
  );
};

export default SobralLogo;
