import { ExternalLink, Facebook, Instagram, ArrowRight } from "lucide-react";

interface FindUsProps {
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

export function FindUs({ isDark = true, colors }: FindUsProps) {
  const address = "Ghat Bazar Rd, near Sarda River Bridge, Dharchula, Uttarakhand 262545";
  const mapUrl = "https://www.google.com/maps/place/?q=place_id:ChIJuTDdFgC1pjkRhjJ4vtKcFeM";

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

  const handleMapClick = () => {
    window.open(mapUrl, "_blank", "noopener,noreferrer");
  };



  return (
    <section
      id="contact"
      className="w-full px-6 md:px-10 py-16 md:py-24 flex flex-col items-center justify-center overflow-hidden z-10 transition-colors duration-500"
      style={{ backgroundColor: activeColors.bg, color: activeColors.primaryText }}
    >
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-10 md:gap-14">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-8" style={{ borderColor: activeColors.border }}>
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-[0.3em] font-sans text-[#7CB342] font-semibold block mb-2">
              Our Sanctuary
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight uppercase font-sans" style={{ color: activeColors.primaryText }}>
              How to find us
            </h2>
          </div>
          <div className="text-left md:text-right max-w-xs md:max-w-md">
            <p className="font-sans text-sm" style={{ color: activeColors.mutedText }}>
              Step into our calm, quiet space for handcrafted beverages, local treats, and productive sessions.
            </p>
          </div>
        </div>

        {/* Contact Info Block */}
        <div className="flex flex-col space-y-6 text-left max-w-3xl" id="contact-info-block">
          {/* Short Intro Line */}
          <p className="text-sm sm:text-base font-sans max-w-2xl leading-relaxed" style={{ color: activeColors.mutedText }}>
            Nestled along the scenic India–Nepal border near the tranquil Sarda River, Cafe Coffesarowar is easily accessible via Ghat Bazar Road. We welcome you to our peaceful sanctuary for quiet work, creative sessions, and exquisite coffee.
          </p>

          {/* Contact Details Stack */}
          <div className="flex flex-col space-y-5">
            {/* Address Line with Arrow Icon */}
            <div className="flex flex-col gap-1.5">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-80 transition-all w-fit"
                style={{ color: activeColors.primaryText }}
              >
                <span>{address}</span>
                <ArrowRight className="h-5 w-5 text-[#7CB342] transition-transform duration-300 group-hover/link:translate-x-1.5 flex-shrink-0" strokeWidth={2.5} />
              </a>
              {/* Opening Hours directly below Address */}
              <p className="text-xs sm:text-sm font-sans uppercase tracking-wider" style={{ color: activeColors.mutedText }}>
                Monday – Sunday | 8:00 am – 8:00 pm
              </p>
            </div>

            {/* Phone Number with Arrow Icon */}
            <a
              href="tel:+9779743535614"
              className="group/link flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-80 transition-all w-fit"
              style={{ color: activeColors.primaryText }}
            >
              <span>+977 97435 35614</span>
              <ArrowRight className="h-5 w-5 text-[#7CB342] transition-transform duration-300 group-hover/link:translate-x-1.5 flex-shrink-0" strokeWidth={2.5} />
            </a>
            <a
              href="tel:+918679435542"
              className="group/link flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-80 transition-all w-fit"
              style={{ color: activeColors.primaryText }}
            >
              <span>+91 86794 35542</span>
              <ArrowRight className="h-5 w-5 text-[#7CB342] transition-transform duration-300 group-hover/link:translate-x-1.5 flex-shrink-0" strokeWidth={2.5} />
            </a>

            {/* Email Address with Arrow Icon */}
            <a
              href="cafecoffesarowar@gmail.com"
              className="group/link flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight hover:opacity-80 transition-all w-fit"
              style={{ color: activeColors.primaryText }}
            >
              <span>cafecoffesarowar@gmail.com</span>
              <ArrowRight className="h-5 w-5 text-[#7CB342] transition-transform duration-300 group-hover/link:translate-x-1.5 flex-shrink-0" strokeWidth={2.5} />
            </a>
          </div>

          {/* Social Profiles Button Row */}
          <div className="flex items-center gap-3 pt-2">
            <a
              href="https://www.facebook.com/drgnenterprises"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#111111] text-[#E8E6D9] border hover:bg-[#7CB342] hover:text-black hover:border-[#7CB342] transition-all duration-300 active:scale-95 shadow-sm"
              style={{ borderColor: activeColors.border }}
              aria-label="Facebook Profile"
            >
              <Facebook className="h-4.5 w-4.5" strokeWidth={2} />
            </a>
            <a
              href="https://instagram.com/cafecoffeesarowar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#111111] text-[#E8E6D9] border hover:bg-[#7CB342] hover:text-black hover:border-[#7CB342] transition-all duration-300 active:scale-95 shadow-sm"
              style={{ borderColor: activeColors.border }}
              aria-label="Instagram Profile"
            >
              <Instagram className="h-4.5 w-4.5" strokeWidth={2} />
            </a>
            <a
              href="https://tiktok.com/cafecoffeesarowar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#111111] text-[#E8E6D9] border hover:bg-[#7CB342] hover:text-black hover:border-[#7CB342] transition-all duration-300 active:scale-95 shadow-sm"
              style={{ borderColor: activeColors.border }}
              aria-label="Tiktok Profile"
            >
              <Instagram className="h-4.5 w-4.5" strokeWidth={2} />
            </a>
          </div>
        </div>

        {/* Map and Reviews Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Map Preview Wrapper with aspect ratio 16:9 */}
          <div
            onClick={handleMapClick}
            className="group relative lg:col-span-2 w-full aspect-[16/9] min-h-[300px] sm:min-h-[400px] bg-[#1e1e1e] border rounded-2xl overflow-hidden cursor-pointer shadow-sm transition-all duration-500 hover:shadow-md"
            style={{ borderColor: activeColors.border }}
            id="map-preview-container"
          >
            {/* Real Google Maps Embed centered on Cafe Coffesarowar */}
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3434.622543881335!2d80.5365511!3d29.8454222!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39a0b50016dd34b9%3A0xe3159cd2be783286!2sCafe%20Coffesarowar!5e0!3m2!1sen!2sin!4v1720892000000!5m2!1sen!2sin"
              className="absolute inset-0 w-full h-full border-0 grayscale-[5%] contrast-[102%] saturate-[98%]"
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Cafe Coffesarowar Location Map"
            />

            {/* Interactive Hover Vignette & Transparent Click Overlay to prevent zoom/scroll hijacking */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors duration-300 z-10" />

            {/* Bottom Left Button: Open in Google Maps */}
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMapClick();
                }}
                className="flex items-center gap-2 bg-[#7CB342] text-black font-semibold text-xs sm:text-sm uppercase tracking-wider px-5 py-3 rounded-full hover:bg-black hover:text-[#FAF8EC] hover:border-[#7CB342] border border-transparent shadow-lg transition-all duration-300 transform active:scale-95"
                id="open-google-maps-btn"
              >
                <span>Open in Google Maps</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* "Reviews currently unavailable" Card */}
          <div
            className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-md"
            style={{
              backgroundColor: "#242424", // lighter charcoal as requested
              borderColor: activeColors.border,
            }}
            id="reviews-unavailable-card"
          >
            <div className="flex flex-col gap-4">
              {/* Star rating icons */}
              <div className="flex gap-1 text-[#7CB342]" id="star-rating">
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight font-sans" style={{ color: activeColors.primaryText }}>
                Reviews currently unavailable
              </h3>
              <p className="text-sm font-sans leading-relaxed" style={{ color: activeColors.mutedText }}>
                The reviews are currently not available. You can read past reviews or share your own experience directly on Google Maps.
              </p>
            </div>

            <div className="mt-8 pt-4 border-t" style={{ borderColor: "rgba(232,230,217,0.08)" }}>
              <button
                onClick={handleMapClick}
                className="w-full flex items-center justify-center gap-2 bg-transparent text-[#7CB342] border border-[#7CB342] font-semibold text-xs sm:text-sm uppercase tracking-wider px-5 py-3.5 rounded-full hover:bg-[#7CB342] hover:text-black shadow-sm transition-all duration-300 transform active:scale-95"
                id="read-reviews-btn"
              >
                <span>Read Reviews on Google Maps</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
