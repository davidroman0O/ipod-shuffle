
**Important**: NEVER EVER USE `sed` TO EDIT FILES


- Moleculer
	- Services and cross-package must have a upstream/downstream flows/paths to prevent high coupling and messy code and messy organization/architecture
	- No cross-package `*.service.db.js` calls - use `moleculer-db` + `knex`
		- each package owns its own tables
		- cross-package must use: a public action or a workflow owned by the package that owns the durable state
	- Services must emit events so other services can subscribe without high coupling
	- Services MUST NOT be too big, a `lib` must be in the package to organize and have testable code
- `HTMX`
	- `hyperscript` for dynamic forms https://hyperscript.org/ as readable in-page scripting
	- `alpine.js` as companion https://alpinejs.dev/ as reactive sprinkles (dropdowns, toggles, tabs)
	- `Nunjucks` for server rendering templates https://mozilla.github.io/nunjucks/


