interface SectionCardProps {
  title: string;
  description: string;
}

export function SectionCard({title, description}: SectionCardProps) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-black/70">{description}</p>
    </div>
  );
}
