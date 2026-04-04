import { SignUp } from '@clerk/nextjs';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSelectedPlan(value: string | undefined) {
  return value === 'core' ? 'core' : 'growth';
}

export default async function Page({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const selectedPlan = normalizeSelectedPlan(firstParam(params.plan));
  const redirectUrl = `/app/billing?plan=${selectedPlan}`;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-950">Create your account, then activate {selectedPlan === 'core' ? 'Core' : 'Growth'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Repurly requires a paid Core or Growth workspace before product access unlocks.
        </p>
      </div>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}
