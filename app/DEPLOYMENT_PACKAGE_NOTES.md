# Deployment package notes

This archive was cleaned for deployment review and handoff.

Removed from the bundle:
- local environment file
- runtime database file
- logs and generated output
- Python bytecode and pytest cache
- internal strategy and phase planning documents
- duplicate Procfile variant

Keep secrets out of version control and set them only in your hosting environment.
