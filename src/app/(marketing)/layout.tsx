import Image from 'next/image';
import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#eef4fb,#ffffff_18%,#f8fafc)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/assets/repurly-logo.png" alt="Repurly logo" width={40} height={40} className="rounded-xl" />
            <div>
              <div className="text-base font-semibold tracking-tight text-slate-950">Repurly</div>
              <div className="text-xs text-slate-500">Premium content operations by Jakoma</div>
            </div>
          </Link>

          <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
            <a href="#workflow">Workflow</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/sign-in">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 lg:px-8">{children}</main>

      <footer className="mx-auto mt-8 max-w-7xl border-t border-slate-200 px-4 py-8 text-sm text-slate-600 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium text-slate-950">Repurly by Jakoma</div>
            <div className="mt-1">LinkedIn-first content operations for agencies and B2B teams.</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Start workspace</Link>
            <a href="https://www.jakoma.org/policy.html" target="_blank" rel="noopener noreferrer">Privacy</a>
            <a href="https://www.jakoma.org/terms.html" target="_blank" rel="noopener noreferrer">Terms</a>
            <a href="https://www.jakoma.org/cookies.html" target="_blank" rel="noopener noreferrer">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
