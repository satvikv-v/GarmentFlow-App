import { Construction } from 'lucide-react';

interface StubPageProps {
  title: string;
  description: string;
}

export function StubPage({ title, description }: StubPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <Construction size={24} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>
      <span
        className="text-xs px-2.5 py-1 rounded-full border"
        style={{
          color: 'var(--color-warning)',
          borderColor: 'rgba(245,158,11,0.3)',
          backgroundColor: 'rgba(245,158,11,0.08)',
        }}
      >
        Coming in next iteration
      </span>
    </div>
  );
}
