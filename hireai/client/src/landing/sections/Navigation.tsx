import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-white/[0.08]'
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="/landing" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">H</span>
            </div>
            <span className="font-sora font-bold text-lg text-foreground">HireAI</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Product
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </button>
          </div>

          {/* CTA Button */}
          <div className="hidden lg:block">
            <a href="/register" className="btn-primary text-sm">Start free</a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-card border-t border-white/[0.08] px-6 py-4">
          <div className="flex flex-col gap-4">
            <button
              onClick={() => scrollToSection('features')}
              className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Product
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </button>
            <a href="/register" className="btn-primary text-sm w-full mt-2 text-center">Start free</a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
