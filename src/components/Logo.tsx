import logoMark from "@/assets/firecrawl-mark.png";

export const Logo = ({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) => {
  // Mark is portrait (≈0.7 ratio). Preserve it instead of squashing to a square.
  const markHeight = size;
  const markWidth = Math.round(size * 0.72);
  const wordSize = Math.round(size * 0.58);
  const proSize = Math.max(9, Math.round(size * 0.3));

  return (
    <div className="flex items-center gap-2.5 select-none">
      <img
        src={logoMark}
        alt="Firecrawl"
        height={markHeight}
        width={markWidth}
        style={{ height: markHeight, width: markWidth }}
        className="object-contain"
      />
      {withWordmark && (
        <div className="flex items-center gap-2 leading-none">
          <span
            className="font-semibold tracking-tight text-foreground"
            style={{ fontSize: wordSize, letterSpacing: "-0.01em" }}
          >
            Firecrawl
          </span>
          <span
            className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-primary ring-1 ring-inset ring-primary/20"
            style={{ fontSize: proSize, lineHeight: 1 }}
          >
            Pro
          </span>
        </div>
      )}
    </div>
  );
};