import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  isDark: boolean;
  colors: {
    bg: string;
    primaryText: string;
    accentText: string;
    border: string;
    mutedText: string;
  };
  navbar: React.ReactNode;
  setCurrentView: (view: "home" | "ritual") => void;
}

export function Hero({ isDark, colors, navbar, setCurrentView }: HeroProps) {
  return (
    <section id="home" className="min-h-screen flex flex-col justify-between">
      <div
        id="hero-frame"
        className="relative min-h-screen w-full flex flex-col justify-between transition-all duration-700 overflow-hidden"
      >
        {/* Blur Overlays for the top and bottom edge transitions */}
        <div className="blur-overlay blur-overlay-top" />
        <div className="blur-overlay blur-overlay-bottom" />

        {/* Background Image Layer for Hero Section */}
        <img
          src="https://asset.imagine.art/processed/dde736f0-b139-42c0-9c33-6212a0b67ad1"
          alt="Hero Background"
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0 transition-all duration-700 ${
            isDark ? "opacity-35 mix-blend-luminosity" : "opacity-25 mix-blend-multiply"
          }`}
          referrerPolicy="no-referrer"
        />

        {/* Subtle vignette/radial gradient overlay to guarantee flawless text readability */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-700"
          style={{
            background: isDark
              ? "radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)"
              : "radial-gradient(circle at center, rgba(253,243,219,0) 0%, rgba(253,243,219,0.4) 100%)",
          }}
        />

        {/* Decorative Geometric Dots - Top Left */}
        <div
          id="geometric-top-left"
          className="absolute top-28 left-8 md:left-12 flex gap-3 pointer-events-none select-none z-10"
        >
          <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${isDark ? "bg-white" : "bg-black"}`}></div>
          <div className={`w-2 h-2 rounded-full border transition-colors duration-500 ${isDark ? "border-white/20" : "border-black/20"}`}></div>
          <div className={`w-2 h-2 rounded-full border transition-colors duration-500 ${isDark ? "border-white/20" : "border-black/20"}`}></div>
        </div>

        {/* Decorative Brand Text - Top Right */}
        <div
          id="geometric-top-right"
          className="absolute top-28 right-8 md:right-12 pointer-events-none select-none z-10 hidden sm:block"
        >
          <span
            className="text-[11px] font-bold tracking-tighter font-serif transition-colors duration-500"
            style={{ color: colors.mutedText }}
          >
          </span>
        </div>

        {/* Navigation Bar (at the top of the Hero frame) */}
        {navbar}

        {/* Bottom-Aligned Hero Typography & Description */}
        <main
          id="hero-content"
          className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 md:px-12 pt-16 pb-24 sm:pb-32 lg:pt-24 lg:pb-24 w-full text-center"
        >
          {/* Centered content column */}
          <div className="flex-1 flex flex-col items-center text-center max-w-3xl">
            <motion.h1
              id="hero-headline"
              className="font-serif font-normal text-5xl sm:text-7xl md:text-8xl lg:text-[90px] leading-[0.95]"
              style={{
                letterSpacing: "-2.46px",
                color: colors.primaryText,
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1 }}
            >
              Your <span id="headline-italic-ritual" className="italic font-serif text-[#6F6F6F]">Daily Ritual,</span><br className="hidden sm:inline" /> Beautifully <span id="headline-italic-rewarded" className="italic font-serif text-[#6F6F6F]">Rewarded.</span>
            </motion.h1>

            <motion.p
              id="hero-description"
              className="font-sans text-base sm:text-lg md:text-xl mt-8 leading-relaxed max-w-2xl"
              style={{ color: colors.mutedText }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.4 }}
            >
              A distraction-free loyalty canvas designed for the relentless, the consistent, and the driven. From precise micro-lots to effortless digital stamps, we craft the ultimate catalyst for your next breakthrough.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-10"
            >
              <motion.button
                id="hero-cta-button"
                className="font-sans rounded-full px-14 py-5 text-base sm:text-lg font-medium cursor-pointer transition-all duration-500 shadow-sm flex items-center gap-3 bg-[#DEDBC8] text-black hover:bg-[#CECAB6]"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentView("ritual")}
              >
                Join Sanctuary
                <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          </div>
        </main>

        {/* Mini elegant footer at bottom of hero frame */}
        <div
          className="relative z-10 w-full px-8 py-6 flex justify-between items-center text-[10px] uppercase tracking-widest text-[#6F6F6F] font-sans border-t pb-16 md:pb-20"
          style={{ borderColor: colors.border }}
        >
          <span>Est. MMXXIV</span>
          <span className="hidden sm:inline">Designed for Introspection</span>
          <span>v1.0.2</span>
        </div>
      </div>
    </section>
  );
}
