import atheropsLogo from '../assets/atherops-logo.png';

interface AtherOpsLogoProps {
  className?: string;
  size?: number | string;
}

export function AtherOpsLogo({ className = '', size = 32 }: AtherOpsLogoProps) {
  return (
    <img 
      src={atheropsLogo} 
      alt="AtherOps" 
      width={size} 
      height={size} 
      className={`object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
    />
  );
}
