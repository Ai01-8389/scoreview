import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  text?: string;
}

export function Loading({ text = '加载中...' }: LoadingProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      <span className="mt-3 text-sm text-white/50">{text}</span>
    </motion.div>
  );
}
