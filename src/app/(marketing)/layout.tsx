import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#f5f7fb,#ffffff_22%,#f8fafc)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">Repurly</Link>
        <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
          <a href="#features">Platform</a>
          <a href="#pricing">Pricing</a>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">{children}</main>
    </div>
  );
}
