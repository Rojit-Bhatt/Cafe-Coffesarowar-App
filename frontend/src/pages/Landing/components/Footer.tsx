interface FooterProps {
  colors: {
    border: string;
    mutedText: string;
  };
}

export function Footer({ colors }: FooterProps) {
  return (
    <footer
      className="w-full max-w-7xl mx-auto px-8 py-8 flex flex-col sm:flex-row justify-between items-center text-[11px] uppercase tracking-widest font-sans gap-4 border-t"
      style={{
        borderColor: colors.border,
        color: colors.mutedText,
      }}
    >
      <span>© 2026 CAFE COFFESAROWAR.</span>
      <div className="flex gap-6 font-mono tracking-widest">
        <a href="#" className="hover:text-primary transition-colors">Privacy</a>
        <a href="#" className="hover:text-primary transition-colors">Terms</a>
        <a href="#" className="hover:text-primary transition-colors">Acoustics</a>
      </div>
    </footer>
  );
}
