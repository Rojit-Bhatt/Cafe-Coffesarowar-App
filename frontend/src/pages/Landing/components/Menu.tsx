import { Sandwich, Pizza, UtensilsCrossed, CupSoda, Coffee } from "lucide-react";

interface MenuProps {
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

export function Menu({ isDark = true, colors }: MenuProps) {
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

  const iconColorClass = isDark ? "text-[#D4B28C]" : "text-[#C19A6B]";

  return (
    <section
      id="menu"
      className="relative w-full py-24 px-6 z-30 transition-colors duration-500"
      style={{ backgroundColor: activeColors.bg, color: activeColors.primaryText }}
    >
      {/* Torn Paper Divider (top of section) */}
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

      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 items-center justify-center">
          {/* Left Label Column (order-2 on mobile, order-1 on desktop) */}
          <div className="order-2 md:order-1 flex flex-col gap-12 md:gap-16 justify-center">
            {/* Grilled Sandwich */}
            <div className="flex flex-row items-center justify-center md:justify-end gap-4 text-center md:text-right w-full">
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  Grilled Sandwich
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Artisanal sourdough pressed with aged cheddar, vine-ripened tomatoes, and wild basil pesto.
                </p>
              </div>
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <Sandwich size={40} strokeWidth={1} className="w-10 sm:w-12 h-10 sm:h-12" />
              </div>
            </div>

            {/* French Fries */}
            <div className="flex flex-row items-center justify-center md:justify-end gap-4 text-center md:text-right w-full">
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  French Fries
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Thick-cut russet potatoes dusted with sea salt, smoked paprika, and fresh rosemary.
                </p>
              </div>
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <Pizza size={40} strokeWidth={1} className="w-10 sm:w-12 h-10 sm:h-12" />
              </div>
            </div>

            {/* Burger */}
            <div className="flex flex-row items-center justify-center md:justify-end gap-4 text-center md:text-right w-full">
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  Burger
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Flame-grilled signature beef patty, melt-in-your-mouth brioche bun, house-made truffle aioli.
                </p>
              </div>
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <UtensilsCrossed size={40} strokeWidth={1} className="w-10 sm:w-12 h-10 sm:h-12" />
              </div>
            </div>
          </div>

          {/* Center column: product image slot (order-1 on mobile, order-2 on desktop) */}
          <div className="order-1 md:order-2 flex items-center justify-center">
            <img
              src="https://asset.imagine.art/processed/e7fc0a6f-8f2a-4ae8-beeb-99ca3246336f"
              alt="Featured Coffee Cup"
              className="w-[220px] sm:w-[280px] md:w-[320px] aspect-square object-contain relative z-10 select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Right Label Column (order-3 on mobile, order-3 on desktop) */}
          <div className="order-3 md:order-3 flex flex-col gap-12 md:gap-16 justify-center">
            {/* Cold Coffee */}
            <div className="flex flex-row items-center justify-center md:justify-start gap-4 text-center md:text-left w-full">
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <CupSoda size={40} strokeWidth={1} className="w-10 sm:w-12 h-10 sm:h-12" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  Cold Coffee
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Slow-steeped organic cold brew poured over ice, lightly sweetened with madagascar vanilla.
                </p>
              </div>
            </div>

            {/* Cappuccino */}
            <div className="flex flex-row items-center justify-center md:justify-start gap-4 text-center md:text-left w-full">
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <Coffee size={40} strokeWidth={1} className="w-10 sm:w-12 h-10 sm:h-12" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  Cappuccino
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Perfect double shot of rich espresso topped with velvety, micro-foamed milk.
                </p>
              </div>
            </div>

            {/* Espresso */}
            <div className="flex flex-row items-center justify-center md:justify-start gap-4 text-center md:text-left w-full">
              <div className={`${iconColorClass} shrink-0 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center`}>
                <Coffee size={32} strokeWidth={1} className="w-8 sm:w-10 h-8 sm:h-10 rotate-12" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-serif font-bold text-base sm:text-lg" style={{ color: activeColors.primaryText }}>
                  Espresso
                </h3>
                <p className="text-xs sm:text-sm mt-1 leading-relaxed max-w-xs" style={{ color: activeColors.mutedText }}>
                  Intense, complex double shot featuring a golden crema, roasted from single-origin beans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
