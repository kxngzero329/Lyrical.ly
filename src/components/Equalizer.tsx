export function Equalizer({ bars = 5, className = "" }: { bars?: number; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-[3px] h-4 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="eq-bar h-full"
          style={{ animationDelay: `${i * 0.12}s`, animationDuration: `${0.8 + (i % 3) * 0.2}s` }}
        />
      ))}
    </span>
  );
}
