export function VinylLoader({ label = "Tuning the strings..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="relative h-32 w-32">
        <div className="absolute inset-0 rounded-full bg-gradient-primary blur-2xl opacity-40 animate-pulse-glow" />
        <div className="relative h-full w-full rounded-full bg-[radial-gradient(circle_at_50%_50%,oklch(0.2_0.03_295)_0%,oklch(0.08_0.02_295)_45%,oklch(0.05_0.02_295)_100%)] animate-spin-slow shadow-glow">
          {/* grooves */}
          {[0.85, 0.7, 0.55, 0.4].map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/5"
              style={{ inset: `${(1 - s) * 50}%` }}
            />
          ))}
          <div className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-gradient-primary shadow-glow" />
          <div className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-background" />
        </div>
      </div>
      <p className="font-display text-xl text-gradient italic">{label}</p>
    </div>
  );
}
