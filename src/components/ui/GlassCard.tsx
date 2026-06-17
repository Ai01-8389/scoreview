import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className, glow = false, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl',
        glow && 'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
