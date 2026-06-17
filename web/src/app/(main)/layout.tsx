import { AppNav } from '@/components/layout/AppNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-muted">
      <AppNav />
      <main className="pb-16 md:pb-0">{children}</main>
    </div>
  );
}
