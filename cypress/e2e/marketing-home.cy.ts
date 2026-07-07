const legacyPricing = /Solo|Team|Agency|£19|£49|£59|£199|£499/;

describe('marketing home', () => {
  it('shows the premium LinkedIn workflow positioning and commercial pricing', () => {
    cy.visit('/');
    cy.contains('Premium LinkedIn content operations').should('be.visible');
    cy.contains('Run LinkedIn publishing with one premium system for drafting, approvals, scheduling, and recovery.').should('be.visible');
    cy.contains('Approval and routing control').should('be.visible');
    cy.contains('Pricing for focused teams that need a premium workflow, not a bloated suite').should('be.visible');

    cy.contains('Core').should('be.visible');
    cy.contains('£297/mo').should('be.visible');
    cy.contains('Growth').should('be.visible');
    cy.contains('£697/mo').should('be.visible');
    cy.contains('Scale').should('be.visible');
    cy.contains('Custom').should('be.visible');

    cy.get('body').invoke('text').should('not.match', legacyPricing);
    cy.contains('a', 'Start Core').should('have.attr', 'href', '/sign-up?plan=core');
    cy.contains('a', 'Start Growth').should('have.attr', 'href', '/sign-up?plan=growth');
  });
});
