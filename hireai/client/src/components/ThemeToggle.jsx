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
      className={`flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 ${className}`}
    >
      {isDark
        ? <Sun  className="h-4 w-4 text-accent" />
        : <Moon className="h-4 w-4 text-gray-400" />}
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
