import assert from 'node:assert/strict';
import test from 'node:test';
import { matchPortfolioBrand, portfolioBrandKnowledge, portfolioMarketingFields } from '../../src/lib/marketing/portfolio-brand-knowledge';
import { directorContext, directorBrandEligibility, type DirectorBrand } from '../../src/lib/marketing/director';

test('seven identities are unique, proposed, and do not replace stable identifiers', () => {
  assert.equal(portfolioBrandKnowledge.length, 7);
  assert.equal(new Set(portfolioBrandKnowledge.map(p => p.slug)).size, 7);
  assert.ok(portfolioBrandKnowledge.every(p => p.clearance === 'pending'));
  assert.equal(matchPortfolioBrand({slug:'repurly',name:'Repurly'})?.name,'Janeomi');
  assert.equal(matchPortfolioBrand({slug:'period-close-workbench',name:'JP Bookkeeping'})?.name,'JP Workbench');
  assert.equal(matchPortfolioBrand({slug:'repurly',name:'My unrelated custom brand'}),null);
  assert.equal(matchPortfolioBrand({slug:'unrelated',name:'Repurly'}),null);
});
test('marketing context gets claim boundaries but no unverified rebrand or domain', () => {
  const profile = matchPortfolioBrand({slug:'repurly',name:'Repurly'});
  assert.ok(profile);
  const fields = portfolioMarketingFields(profile);
  assert.doesNotMatch(JSON.stringify(fields), /Janeomi|janeomi\.com/);
  const brand: DirectorBrand = {id:'brand',name:'Repurly',slug:'repurly',status:'active',audience:'Founders',defaultTone:'Clear',primaryCta:'Give feedback',secondaryCta:null,website:null,metadata:{portfolioMarketingKnowledge:fields}};
  const context = directorContext(brand);
  assert.equal(context.brandName,'Repurly');
  assert.match(context.portfolioGuardrails,/Private testing/);
  assert.match(directorBrandEligibility({...brand,slug:'jakoma-risk-intelligence'},true) ?? '',/Research only/);
  assert.match(directorBrandEligibility({...brand,slug:'averyquant-one'},true) ?? '',/Research only/);
});
