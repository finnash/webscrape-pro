import logoMark from "@/assets/meow-mark.png";

export const Logo = ({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) => {
  const wordSize = Math.round(size * 0.58);
  const tagSize = Math.max(9, Math.round(size * 0.3));

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/30 flex items-center justify-center overflow-hidden"
        style={{ height: size + 6, width: size + 6 }}
      >
        <img
          src={logoMark}
          alt="Meow Scraper"
          style={{ height: size, width: size }}
          className="object-contain"
        />
      </div>
      {withWordmark && (
        <div className="flex items-center gap-2 leading-none">
          <span
            className="font-semibold tracking-tight text-foreground"
            style={{ fontSize: wordSize, letterSpacing: "-0.02em" }}
          >
            Meow<span className="text-primary">Scraper</span>
          </span>
          <span
            className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-primary ring-1 ring-inset ring-primary/20"
            style={{ fontSize: tagSize, lineHeight: 1 }}
          >
            Pro
          </span>
        </div>
      )}
    </div>
  );
};