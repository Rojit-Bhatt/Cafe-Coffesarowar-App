interface AboutProps {
  isDark?: boolean;
  colors?: {
    bg: string;
    primaryText: string;
    accentText: string;
    aboutCard: string;
    featureCard: string;
    border: string;
    mutedText: string;
  };
}

export function About({ isDark = true, colors }: AboutProps) {
  // Access theme colors or fall back safely to design presets
  const activeColors = colors || {
    bg: isDark ? "#141414" : "#FDFBF7",
    primaryText: isDark ? "#E8E6D9" : "#1A1A1A",
    accentText: "#DEDBC8",
    aboutCard: isDark ? "#1A1A1A" : "#F3EFE0",
    featureCard: isDark ? "#212121" : "#E9E4CE",
    border: isDark ? "rgba(232, 230, 217, 0.12)" : "rgba(26, 26, 26, 0.12)",
    mutedText: isDark ? "#767676" : "#6F6F6F",
  };

  return (
    <section
      id="about"
      className="relative w-full px-4 sm:px-8 md:px-16 py-24 md:py-32 flex flex-col items-center justify-center overflow-hidden z-10 transition-colors duration-500"
      style={{ backgroundColor: activeColors.bg }}
    >
      {/* Torn Paper Divider - matches the charcoal background color */}
      <div className="absolute top-0 left-0 right-0 w-full overflow-hidden leading-[0] z-20 pointer-events-none select-none -translate-y-[99%]">
        <svg
          viewBox="0 0 1440 100"
          className="relative block w-full h-[45px] md:h-[60px]"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 100 L 0 45 L 22 52 L 41 33 L 62 48 L 85 28 L 108 55 L 132 38 L 151 46 L 178 30 L 198 52 L 220 41 L 244 58 L 268 35 L 291 48 L 315 32 L 338 54 L 358 41 L 382 50 L 405 32 L 428 55 L 452 39 L 472 48 L 498 30 L 522 52 L 541 41 L 565 58 L 588 35 L 611 48 L 635 32 L 658 54 L 678 41 L 702 50 L 725 32 L 748 55 L 772 39 L 792 48 L 818 30 L 842 52 L 861 41 L 885 58 L 908 35 L 931 48 L 955 32 L 978 54 L 998 41 L 1022 50 L 1045 32 L 1068 55 L 1092 39 L 1112 48 L 1138 30 L 1162 52 L 1181 41 L 1205 58 L 1228 35 L 1251 48 L 1275 32 L 1298 54 L 1318 41 L 1342 50 L 1365 32 L 1388 55 L 1412 39 L 1432 48 L 1440 42 L 1440 100 Z"
            fill={activeColors.bg}
          />
        </svg>
      </div>

      {/* Background Image Layer (sandwiched between background and content) */}
      <img
        src="https://asset.imagine.art/processed/f8f73f38-9cc6-4d33-be5b-2ae86cf0dfda"
        alt="Coffee Beans Background Texture"
        className={`absolute bottom-0 left-0 w-96 h-96 object-cover pointer-events-none select-none z-0 transition-opacity duration-700 ${
          isDark ? "opacity-12 mix-blend-luminosity" : "opacity-50"
        }`}
        referrerPolicy="no-referrer"
      />

      {/* Soft radial fade to bleed the image edges perfectly into the solid background */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(20, 20, 20, 0) 50%, ${activeColors.bg} 100%)`,
        }}
      />

      <div className="relative z-20 w-full max-w-5xl px-4 py-8 md:py-16 flex flex-col items-center text-center pt-24 sm:pt-16 md:pt-8">
        {/* Eyebrow Label */}
        <span className="text-[11px] font-bold tracking-[0.25em] uppercase mb-6 font-sans text-xs" style={{ color: activeColors.mutedText }}>
          THE PHILOSOPHY
        </span>

        {/* Mixed Normal and Italic Serif Heading */}
        <h2
          className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl leading-tight font-normal mb-8"
          style={{ letterSpacing: "-1.5px", color: activeColors.primaryText }}
        >
          Beyond <span className="font-serif italic" style={{ color: activeColors.mutedText }}>caffeine,</span> we anchor routines that spark{" "}
          <span className="font-serif italic" style={{ color: activeColors.mutedText }}>vibrant communities.</span>
        </h2>

        {/* Body Paragraph */}
        <p className="font-sans text-base sm:text-lg max-w-2xl leading-relaxed" style={{ color: activeColors.mutedText }}>
          A truly great café is defined by the community created within its walls. We aim to be your definitive third
          place—the space between home and work where you are always recognized. We obsess over the atmosphere, the
          music, and the service so you can seamlessly obsess over what matters most to you.
        </p>

        <div className="mt-10 flex gap-8 items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="font-serif text-4xl font-normal italic" style={{ color: activeColors.primaryText }}>99%</span>
            <span className="text-[10px] uppercase tracking-widest mt-1 font-sans font-semibold" style={{ color: activeColors.mutedText }}>Healthy</span>
          </div>
          <div className="w-px h-10" style={{ backgroundColor: activeColors.border }} />
          <div className="flex flex-col items-center">
            <span className="font-serif text-4xl font-normal italic" style={{ color: activeColors.primaryText }}>30K+</span>
            <span className="text-[10px] uppercase tracking-widest mt-1 font-sans font-semibold" style={{ color: activeColors.mutedText }}>Customer Served</span>
          </div>
        </div>
      </div>
    </section>
  );
}
