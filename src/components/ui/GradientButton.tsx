import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GradientButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function GradientButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: GradientButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    danger:
      'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    ghost:
      'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type}
    >
      {children}
    </motion.button>
  );
}
