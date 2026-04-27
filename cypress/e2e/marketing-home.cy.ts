describe('marketing home', () => {
  it('shows the premium LinkedIn workflow positioning', () => {
    cy.visit('/');
    cy.contains('Premium LinkedIn content operations').should('be.visible');
    cy.contains('Run LinkedIn publishing with one premium system for drafting, approvals, scheduling, and recovery.').should('be.visible');
    cy.contains('Approval and routing control').should('be.visible');
    cy.contains('Pricing for focused teams that need a premium workflow, not a bloated suite').should('be.visible');
  });
});
