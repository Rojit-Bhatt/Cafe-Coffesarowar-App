import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  isDark: boolean;
  colors: {
    bg: string;
    primaryText: string;
    accentText: string;
    border: string;
    mutedText: string;
  };
  activeLink: string;
  setActiveLink: (link: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setCurrentView: (view: "home" | "ritual") => void;
}

export function Navbar({
  isDark,
  colors,
  activeLink,
  setActiveLink,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  toggleTheme,
  setCurrentView,
}: NavbarProps) {
  const navigate = useNavigate();
  const navLinks = ["Home", "Sanctuary", "About", "Contact"];

  return (
    <nav
      id="navbar"
      className="relative z-50 w-full max-w-7xl mx-auto px-8 py-6 flex items-center justify-between"
    >
      {/* Logo */}
      <a
        id="nav-logo"
        href="#"
        className="select-none hover:opacity-90 transition-all duration-500 flex flex-col items-center justify-center text-center"
        onClick={(e) => {
          e.preventDefault();
          setCurrentView("home");
        }}
      >
        {/* Cafe SVG Logo */}
        <svg
          className={`w-12 h-12 transition-colors duration-500 ${isDark ? "text-white" : "text-black"}`}
          viewBox="0 0 200 130"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M 92 35 Q 86 24, 94 14 T 88 4" strokeWidth="1.2" />
          <path d="M 100 37 Q 106 26, 98 16 T 104 6" strokeWidth="1.2" />
          <path d="M 108 35 Q 114 24, 106 14 T 112 4" strokeWidth="1.2" />

          <path
            d="M 65 52 C 65 72, 72 82, 100 82 C 128 82, 135 72, 135 52 Z"
            fill={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"}
          />
          <ellipse cx="100" cy="52" rx="35" ry="6" fill={isDark ? "#080808" : "#FAF8F2"} />
          <ellipse cx="100" cy="52" rx="35" ry="6" />

          <path d="M 134 56 C 148 56, 146 74, 132 74" strokeWidth="2" />

          <path
            d="M 94 67 C 91 64, 91 60, 95 57 C 99 54, 103 54, 106 57 C 109 60, 109 64, 105 67 C 101 70, 97 70, 94 67 Z"
            fill="currentColor"
          />
          <path
            d="M 93 68 C 96 66, 101 62, 103 58"
            stroke={isDark ? "#080808" : "#FAF8F2"}
            strokeWidth="1"
          />

          <path d="M 50 82 C 60 76, 140 76, 150 82" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
          <path d="M 40 88 C 55 80, 145 80, 160 88" strokeWidth="1" opacity="0.4" />
          <path d="M 32 94 C 50 84, 150 84, 168 94" strokeWidth="1.2" />
          <path d="M 25 101 C 45 88, 155 88, 175 101" strokeWidth="1" strokeDasharray="5 3" opacity="0.6" />
          <path d="M 38 108 C 55 96, 145 96, 162 108" strokeWidth="1" opacity="0.3" />
        </svg>

        <div className="flex flex-col items-center select-none">
          <span
            className="text-[8px] tracking-[0.25em] font-serif uppercase"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Cafe
          </span>
          <span
            className="text-xs tracking-widest font-serif font-bold uppercase -mt-0.5"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Coffesarowar
          </span>
          <span className="text-[5px] tracking-[0.3em] font-sans uppercase text-[#6F6F6F] mt-0.5">
            Drink, Eat, Repeat
          </span>
        </div>
      </a>

      {/* Desktop Nav Links */}
      <div id="nav-desktop-links" className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => (
          <a
            key={link}
            href={link === "Sanctuary" ? "#" : `#${link.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-sm transition-all relative py-1 font-sans duration-300"
            style={{
              color: activeLink === link ? colors.primaryText : "rgba(225, 224, 204, 0.8)",
              fontWeight: activeLink === link ? "500" : "400",
            }}
            onClick={(e) => {
              e.preventDefault();
              setActiveLink(link);
              if (link === "Sanctuary") {
                setCurrentView("ritual");
              } else {
                setCurrentView("home");
                setTimeout(() => {
                  const element = document.getElementById(link.toLowerCase());
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }, 100);
              }
            }}
          >
            {link}
            {activeLink === link && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-0 right-0 h-px"
                style={{ backgroundColor: colors.primaryText }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </a>
        ))}
      </div>

      {/* Right Control Actions */}
      <div id="nav-right-controls" className="flex items-center gap-4">
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          className="p-2.5 rounded-full border transition-all duration-300 cursor-pointer"
          style={{
            borderColor: colors.border,
            color: colors.primaryText,
          }}
          aria-label="Toggle visual theme"
        >
          {isDark ? <Sun size={16} className="animate-pulse text-[#DEDBC8]" /> : <Moon size={16} />}
        </button>

        <div id="nav-desktop-cta" className="hidden md:block">
          <motion.button
            className="liquid-glass rounded-full px-6 py-2.5 text-sm font-sans font-medium cursor-pointer transition-all duration-500 hover:shadow-[0_0_15px_rgba(222,219,200,0.3)] border border-[#DEDBC8]/30 hover:border-[#DEDBC8]/60 bg-[#DEDBC8]/10 text-[#DEDBC8] hover:bg-[#DEDBC8]/20"
            style={{ color: colors.primaryText }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/login")}
          >
            Enter Sanctuary
          </motion.button>
        </div>

        <button
          id="mobile-menu-toggle"
          className="md:hidden p-2 rounded-full transition-colors cursor-pointer"
          style={{ color: colors.primaryText }}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 w-[320px] max-w-[calc(100vw-48px)] z-40 px-8 py-6 rounded-2xl md:hidden flex flex-col gap-6 liquid-glass"
            style={{ color: colors.primaryText }}
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={link === "Sanctuary" ? "#" : `#${link.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-base transition-colors py-1 font-sans"
                  style={{
                    color: activeLink === link ? colors.primaryText : colors.mutedText,
                    fontWeight: activeLink === link ? "500" : "400",
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveLink(link);
                    setIsMobileMenuOpen(false);
                    if (link === "Sanctuary") {
                      setCurrentView("ritual");
                    } else {
                      setCurrentView("home");
                      setTimeout(() => {
                        const element = document.getElementById(link.toLowerCase());
                        if (element) {
                          element.scrollIntoView({ behavior: "smooth" });
                        }
                      }, 100);
                    }
                  }}
                >
                  {link}
                </a>
              ))}
            </div>

            <div className="h-px w-full" style={{ backgroundColor: colors.border }} />

            <button
              className="w-full text-center py-3 px-6 rounded-full font-sans font-medium transition-all duration-300 shadow-md"
              style={{
                backgroundColor: colors.primaryText,
                color: isDark ? "#000000" : "#FFFFFF",
              }}
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/login");
              }}
            >
              Enter Sanctuary
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
