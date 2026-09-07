# Portable GTM playbook release

The public skill previously documented individual API operations but omitted the recurring acquisition workflow. Added a routed reference covering external-agent research and copy, connection-gated sequences, capacity, content, attribution, and recovery. Existing user authorization persists within scope. Customer identity and policy remain explicit; no private tenant data is included.

Validation: all 41 Node tests pass, including MCP dispatch and installation tests; skill quick validation passes; npm pack dry-run includes the reference; git diff --check passes. No runtime JavaScript or backend source changed. Backend full-suite and live send tests are not applicable to this documentation release. These checks prove packaging and existing helper behavior, not production LinkedIn latency, lead enrollment, or revenue outcomes.

September 7 follow-up: document the deployed deterministic recipient preflight
REST read, exact identity requirements, bounded invitation inventories, and its
explicitly incomplete enrollment verdict. Link it from the recurring playbook.
Document partial campaign recovery after failed enrollment without importing any
private account or recipient data. This is a documentation-only update. Fresh
validation: 41 Node tests passed with zero skips, skill validator passed, npm pack
dry-run included both references, and diff checks passed. No runtime source or
dependency change. Backend/live-send tests are not applicable to this docs-only
change and are not implied by those results.
