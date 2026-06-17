import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Edit3,
  BarChart3,
  Target,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '总览', icon: LayoutDashboard },
  { path: '/input', label: '录入', icon: Edit3 },
  { path: '/compare', label: '比对', icon: BarChart3 },
  { path: '/target', label: '目标', icon: Target },
  { path: '/detail', label: '小分', icon: Search },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      className={cn(
        'relative flex h-screen flex-col border-r border-white/10 bg-slate-900/80 backdrop-blur-xl',
        collapsed ? 'w-16' : 'w-52'
      )}
      animate={{ width: collapsed ? 64 : 208 }}
      transition={{ duration: 0.2 }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-white/5">
        <span
          className={cn(
            'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text font-bold text-transparent',
            collapsed ? 'text-lg' : 'text-xl'
          )}
        >
          {collapsed ? '分' : '成绩分析'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path}>
              <motion.div
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                )}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-white/60 hover:text-white"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}
