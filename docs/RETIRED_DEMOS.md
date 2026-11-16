# Retired fictional demonstrations

The owner requested retiring old demonstrations in favor of real, role-scoped demonstration accounts containing fictional data.

Removed entry links from employee sign-in, internal client CRM and the public business application page. The public footer contained no demonstration entry.

Route layouts now deny the complete admin-preview, client-preview, operations-preview, collections-preview, workflow-preview, application-preview and crm-preview trees in both languages, including old report and contract URLs. The demo tree also fails closed at layout level; its existing proxy redirects to external sign-in. Archived components remain in source history for reference and do not provide a navigable demonstration.

Keep /api/demo/logout and existing legacy-cookie checks: old demo cookies must be explicitly cleared before real API access. Demo login remains retired (410). Do not disable real test accounts or remove fictional acceptance data. Client A and client B remain dedicated isolation acceptance accounts; prospective-customer/agent demonstrations should use separately provisioned accounts, fictional records and the normal role-scoped portals. This change does not create accounts or modify database permissions.
