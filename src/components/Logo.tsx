import logoMark from "@/assets/firecrawl-mark.png";

export const Logo = ({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <img src={logoMark} alt="Firecrawl" width={size} height={size} className="rounded-md" />
    {withWordmark && (
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="font-semibold tracking-tight text-foreground" style={{ fontSize: size * 0.62 }}>
          Firecrawl
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Pro</span>
      </div>
    )}
  </div>
);