# Public advertising and commerce release — November 20, 2026

Owner explicitly approved publishing the reviewed Preview frontend to www.kbjmcorp.com. Production base: 60f6787. Reviewed Preview source: dd86eb1.

Isolated release contains only public homepage/service components, bilingual content and six supplied WebP illustrations. Commerce FAQ is absent; advertising FAQ remains at its Production baseline. Comparison is always visible. Advertising and commerce are both named as current service priorities.

No API, Auth, internal/external workspaces, database, SQL, dependencies, configuration, domain or DNS changes. Production database upgrade remains paused. Production rollback is a normal revert of this isolated frontend commit.

Validation: optimized Production-baseline build and TypeScript passed; 12 bilingual service browser scenarios across six viewport widths passed, including actual clickable hero links, comparison visibility, no overlap/overflow and commerce routing. Source diff checked against Production baseline. Hosted verification is restricted by the environment network allowlist, which currently excludes www.kbjmcorp.com and api.github.com; a successful push alone is not confirmation of a ready Vercel deployment.
