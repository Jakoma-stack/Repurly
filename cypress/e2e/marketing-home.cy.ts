const legacyPricing = /Solo|Team|Agency|£19|£49|£59|£199|£297\/mo|£697\/mo|£499/;

describe('marketing home', () => {
  it('shows Growth OS positioning and current commercial pricing', () => {
    cy.visit('/');
    cy.contains('LinkedIn-led revenue workflow · human-in-the-loop').should('be.visible');
    cy.contains('Turn expertise into LinkedIn-led campaigns, lead conversations, and booked-call workflows.').should('be.visible');
    cy.contains('Campaign and approval control').should('be.visible');
    cy.contains('Pricing for operators who need a revenue workflow, not another cheap scheduler').should('be.visible');

    cy.contains('Starter').should('be.visible');
    cy.contains('£79/mo').should('be.visible');
    cy.contains('Operator').should('be.visible');
    cy.contains('£249/mo').should('be.visible');
    cy.contains('Studio').should('be.visible');
    cy.contains('From £699/mo').should('be.visible');

    cy.get('body').invoke('text').should('not.match', legacyPricing);
    cy.contains('a', 'Start Starter').should('have.attr', 'href', '/sign-up?plan=core');
    cy.contains('a', 'Start Operator').should('have.attr', 'href', '/sign-up?plan=growth');
  });
});
