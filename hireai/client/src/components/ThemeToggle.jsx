import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`group flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 transition-all hover:border-gray-200 hover:bg-gray-100 hover:text-gray-700 ${className}`}
    >
      <div
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
          isDark ? 'bg-accent/10' : 'bg-white shadow-xs'
        }`}
      >
        {isDark
          ? <Sun  className="h-3 w-3 text-accent" />
          : <Moon className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />}
      </div>
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
