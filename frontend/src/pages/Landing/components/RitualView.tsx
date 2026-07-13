import { motion } from "motion/react";
import { Coffee, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RitualViewProps {
  setCurrentView: (view: "home" | "ritual") => void;
}

export function RitualView({ setCurrentView }: RitualViewProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      key="ritual-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-40 bg-black flex flex-col justify-between overflow-y-auto"
    >
      {/* Page 2 Nav Header */}
      <div className="w-full max-w-7xl mx-auto px-8 py-6 flex justify-between items-center z-50">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => setCurrentView("home")}
          className="text-xs uppercase tracking-[0.2em] text-[#6B6B6B] hover:text-[#E8E6D9] transition-colors flex items-center gap-2 cursor-pointer font-sans bg-transparent border-none"
        >
          ← Back to Sanctuary
        </motion.button>

        <span className="text-[11px] font-bold tracking-tighter font-serif text-[#6B6B6B]">
          ARCHETYPE.
        </span>
      </div>

      {/* Centered Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 text-center py-12 md:py-16 gap-8 z-10">
        {/* Centered Coffee Icon Iconography */}
        <div className="relative z-20 flex justify-center items-center">
          <motion.div
            layoutId="coffee-cup"
            className="w-20 h-20 rounded-full border border-[#E8E6D9]/10 bg-white/5 flex items-center justify-center text-[#E8E6D9]/80 shadow-lg"
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <Coffee size={32} strokeWidth={1.5} className="animate-pulse" />
          </motion.div>
        </div>

        {/* Staggered Content Container */}
        <motion.div
          className="flex flex-col items-center gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.5,
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {/* Headline */}
          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="font-serif font-normal text-4xl sm:text-6xl md:text-7xl leading-tight tracking-tight text-white"
          >
            Your Daily Ritual,<br />
            <span className="italic font-serif text-[#6B6B6B]">Beautifully Rewarded.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="font-sans text-sm sm:text-base text-gray-500 max-w-xl leading-relaxed"
          >
            Unlock mindful achievements, earn bespoke micro-lots, and sync your focus flow.
          </motion.p>

          {/* Actions: Sanctuary Active Pill & Login CTA */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4"
          >
            <span className="px-5 py-2.5 rounded-full text-xs font-mono tracking-wider border border-[#E8E6D9]/15 text-[#E8E6D9]/70 bg-white/5 select-none">
              Sanctuary Portal Active
            </span>
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-3.5 rounded-full bg-[#E8E6D9] text-black text-sm font-medium hover:bg-white transition-colors cursor-pointer flex items-center gap-2 font-sans shadow-md border-none"
            >
              Enter Sanctuary
              <ArrowRight size={14} />
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Page 2 Footer row */}
      <div className="w-full px-8 py-6 flex justify-between items-center text-xs uppercase tracking-widest text-[#6B6B6B] font-sans border-t border-white/5">
        <span>EST. MMXXIV</span>
        <span className="hidden sm:inline">DESIGNED FOR INTROSPECTION</span>
        <span>V1.0.2</span>
      </div>
    </motion.div>
  );
}
