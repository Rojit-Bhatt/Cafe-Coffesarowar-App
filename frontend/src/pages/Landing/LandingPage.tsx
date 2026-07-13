import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Menu } from "./components/Menu";
import { About } from "./components/About";
import { FindUs } from "./components/FindUs";
import { Footer } from "./components/Footer";
import { RitualView } from "./components/RitualView";

export function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("Home");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [currentView, setCurrentView] = useState<"home" | "ritual">("home");

  const isDark = theme === "dark";

  // Color variables derived from the theme
  const colors = {
    bg: isDark ? "#141414" : "#FDFBF7",
    primaryText: isDark ? "#E8E6D9" : "#1A1A1A",
    accentText: "#DEDBC8",
    aboutCard: isDark ? "#1A1A1A" : "#F3EFE0",
    featureCard: isDark ? "#212121" : "#E9E4CE",
    border: isDark ? "rgba(232, 230, 217, 0.12)" : "rgba(26, 26, 26, 0.12)",
    mutedText: isDark ? "#767676" : "#6F6F6F",
  };

  return (
    <div
      id="app-container"
      className="relative min-h-screen w-full transition-colors duration-700 overflow-x-hidden flex flex-col justify-between select-none"
      style={{
        backgroundColor: colors.bg,
        color: colors.primaryText,
      }}
    >
      {/* Cinematic Film Grain Overlay (feTurbulence) */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.14]" style={{ mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="pedantic-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.14 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pedantic-noise)" />
        </svg>
      </div>

      <AnimatePresence mode="wait">
        {currentView === "home" ? (
          <motion.div
            key="home-view"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col"
          >
            <Hero
              isDark={isDark}
              colors={colors}
              navbar={
                <Navbar
                  isDark={isDark}
                  colors={colors}
                  activeLink={activeLink}
                  setActiveLink={setActiveLink}
                  isMobileMenuOpen={isMobileMenuOpen}
                  setIsMobileMenuOpen={setIsMobileMenuOpen}
                  toggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                  setCurrentView={setCurrentView}
                />
              }
              setCurrentView={setCurrentView}
            />

            <Menu colors={colors} isDark={isDark} />

            <About colors={colors} isDark={isDark} />

            <FindUs colors={colors} isDark={isDark} />

            <Footer colors={colors} />
          </motion.div>
        ) : (
          <RitualView setCurrentView={setCurrentView} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default LandingPage;
