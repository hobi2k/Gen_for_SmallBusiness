import Link from 'next/link';

type ModeCardProps = {
  href: string;
  title: string;
  description: string;
};

export function ModeCard({href, title, description}: ModeCardProps) {
  return (
    <Link
      className="group rounded-[24px] border border-white/10 bg-white/6 px-5 py-4 text-white transition hover:bg-white/10"
      href={href}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold tracking-[-0.03em]">{title}</p>
          <p className="mt-1 text-sm text-white/62">{description}</p>
        </div>
        <span className="text-sm font-medium text-[#ffb36b]">열기</span>
      </div>
    </Link>
  );
}
