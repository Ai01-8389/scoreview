import { motion } from 'framer-motion';
import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="rounded-full bg-white/5 p-4 mb-4">
        {icon || <FileQuestion className="h-10 w-10 text-white/30" />}
      </div>
      <h3 className="text-lg font-medium text-white/70">{title}</h3>
      {description && <p className="mt-1 text-sm text-white/40">{description}</p>}
    </motion.div>
  );
}
