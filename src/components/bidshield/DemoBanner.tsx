export function DemoBanner() {
  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
      Demo / sandbox environment — fictional data, no real verification performed
    </div>
  );
}

export function AdvisoryNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      Automated signals and AI summaries are advisory only. Every qualification outcome is recorded
      against a named human reviewer.
    </p>
  );
}
