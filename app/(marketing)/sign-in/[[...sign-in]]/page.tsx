import { SignIn } from '@clerk/nextjs';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BillingPlan = 'core' | 'growth' | 'scale';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePlan(value: string | undefined): BillingPlan | null {
  switch (value) {
    case 'solo':
    case 'core':
      return 'core';
    case 'team':
    case 'growth':
      return 'growth';
    case 'agency':
    case 'scale':
      return 'scale';
    default:
      return null;
  }
}

export default async function Page({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const plan = normalizePlan(firstParam(params.plan));
  const redirectUrl = plan
    ? `/app/billing?billing=payment-required&plan=${plan}`
    : '/app/billing?billing=payment-required';
  const signUpUrl = plan ? `/sign-up?plan=${plan}` : '/sign-up';

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl={signUpUrl}
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}
