interface SectionCardProps {
  title: string;
  description: string;
}

export function SectionCard({title, description}: SectionCardProps) {
  return (
    // 설명성 카드가 필요한 화면에서 재사용하려고 만든 단순 카드 컴포넌트다.
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-black/70">{description}</p>
    </div>
  );
}
