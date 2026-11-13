// Explicit business projections; security and account administration are excluded.
export const investorCatalog=[
  {
    "key": "organizations",
    "zh": "客户企业",
    "en": "Companies",
    "columns": [
      "id",
      "name",
      "created_at"
    ]
  },
  {
    "key": "client_profiles",
    "zh": "企业资料",
    "en": "Company profiles",
    "columns": [
      "organization_id",
      "legal_name",
      "registration_number",
      "country",
      "website",
      "industry",
      "status",
      "internal_notes",
      "revision",
      "created_at",
      "updated_at"
    ]
  },
  {
    "key": "crm_contacts",
    "zh": "客户联系人",
    "en": "Contacts",
    "columns": [
      "id",
      "inquiry_id",
      "organization_id",
      "name",
      "email",
      "notes",
      "created_at",
      "phone_e164",
      "title",
      "contact_kind",
      "archived"
    ]
  },
  {
    "key": "crm_opportunities",
    "zh": "销售机会",
    "en": "Opportunities",
    "columns": [
      "id",
      "contact_id",
      "stage",
      "estimated_value",
      "currency",
      "created_at"
    ]
  },
  {
    "key": "inquiries",
    "zh": "客户咨询",
    "en": "Inquiries",
    "columns": [
      "id",
      "company",
      "email",
      "message",
      "locale",
      "status",
      "consent_at",
      "consent_version",
      "created_at",
      "phone_e164",
      "target_market",
      "converted_organization_id"
    ]
  },
  {
    "key": "inquiry_notes",
    "zh": "咨询跟进",
    "en": "Inquiry notes",
    "columns": [
      "id",
      "inquiry_id",
      "author_id",
      "body",
      "created_at"
    ]
  },
  {
    "key": "customer_applications",
    "zh": "企业申请",
    "en": "Applications",
    "columns": [
      "id",
      "applicant_id",
      "legal_name",
      "contact_name",
      "phone_e164",
      "email",
      "website",
      "industry",
      "target_market",
      "goals",
      "locale",
      "consent_at",
      "consent_version",
      "status",
      "revision",
      "feedback",
      "organization_id",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at"
    ]
  },
  {
    "key": "customer_application_history",
    "zh": "申请进度",
    "en": "Application history",
    "columns": [
      "id",
      "application_id",
      "revision",
      "event",
      "actor_id",
      "created_at"
    ]
  },
  {
    "key": "client_contracts",
    "zh": "合同",
    "en": "Contracts",
    "columns": [
      "id",
      "organization_id",
      "template_version",
      "template_body",
      "title",
      "client_legal_name",
      "provider_legal_name",
      "service_scope",
      "pricing_terms",
      "refund_terms",
      "starts_on",
      "ends_on",
      "status",
      "client_visible",
      "signature_reference",
      "signed_on",
      "created_by",
      "created_at",
      "updated_at"
    ]
  },
  {
    "key": "projects",
    "zh": "广告项目",
    "en": "Projects",
    "columns": [
      "id",
      "organization_id",
      "ad_account_id",
      "name",
      "target_market",
      "status",
      "budget_amount",
      "currency",
      "created_by",
      "created_at",
      "updated_at"
    ]
  },
  {
    "key": "project_submissions",
    "zh": "项目交付",
    "en": "Submissions",
    "columns": [
      "id",
      "project_id",
      "kind",
      "version",
      "title",
      "body",
      "reference_url",
      "author_id",
      "author_role",
      "created_at"
    ]
  },
  {
    "key": "project_reviews",
    "zh": "项目审核记录",
    "en": "Project reviews",
    "columns": [
      "id",
      "submission_id",
      "decision",
      "feedback",
      "reviewer_id",
      "reviewer_role",
      "created_at"
    ]
  },
  {
    "key": "project_activity",
    "zh": "项目进度",
    "en": "Project activity",
    "columns": [
      "id",
      "project_id",
      "event_type",
      "detail",
      "actor_id",
      "actor_role",
      "created_at"
    ]
  },
  {
    "key": "ad_accounts",
    "zh": "广告账户",
    "en": "Ad accounts",
    "columns": [
      "id",
      "organization_id",
      "platform",
      "external_id",
      "label",
      "connection_status",
      "source_type",
      "last_synced_at"
    ]
  },
  {
    "key": "campaigns",
    "zh": "广告活动",
    "en": "Campaigns",
    "columns": [
      "id",
      "organization_id",
      "ad_account_id",
      "external_id",
      "name"
    ]
  },
  {
    "key": "campaign_metrics_daily",
    "zh": "每日广告指标",
    "en": "Daily metrics",
    "columns": [
      "organization_id",
      "campaign_id",
      "day",
      "currency",
      "impressions",
      "clicks",
      "spend",
      "conversions"
    ]
  },
  {
    "key": "ad_sync_runs",
    "zh": "数据同步记录",
    "en": "Sync history",
    "columns": [
      "id",
      "ad_account_id",
      "source_type",
      "status",
      "started_at",
      "finished_at",
      "imported_records",
      "error_code"
    ]
  },
  {
    "key": "ads_reporting_snapshots",
    "zh": "广告来源汇总",
    "en": "Source summaries",
    "columns": [
      "id",
      "account_id",
      "account_name",
      "currency",
      "timezone",
      "since",
      "until",
      "check_status",
      "daily_spend_micros",
      "period_spend_micros",
      "created_by",
      "created_at",
      "daily_ad_data"
    ]
  },
  {
    "key": "ads_reporting_bindings",
    "zh": "广告账户归属",
    "en": "Account ownership",
    "columns": [
      "id",
      "account_id",
      "ad_account_id",
      "organization_id",
      "ownership_reference",
      "active",
      "revision",
      "created_by",
      "created_at",
      "updated_by",
      "updated_at"
    ]
  },
  {
    "key": "ads_source_handoffs",
    "zh": "来源交接",
    "en": "Source handoffs",
    "columns": [
      "id",
      "snapshot_id",
      "binding_id",
      "note",
      "shared_by",
      "shared_at"
    ]
  },
  {
    "key": "ads_monthly_coverage_checks",
    "zh": "整月覆盖核实",
    "en": "Monthly coverage",
    "columns": [
      "id",
      "snapshot_id",
      "prepared_by",
      "prepared_at",
      "kind",
      "amount_micros",
      "impressions",
      "clicks",
      "evidence_reference",
      "active_from",
      "note"
    ]
  },
  {
    "key": "ads_monthly_coverage_reviews",
    "zh": "覆盖复核",
    "en": "Coverage reviews",
    "columns": [
      "check_id",
      "snapshot_id",
      "decision",
      "reviewed_by",
      "reviewed_at",
      "note"
    ]
  },
  {
    "key": "agency_fee_rule_drafts",
    "zh": "收费规则",
    "en": "Fee rules",
    "columns": [
      "id",
      "organization_id",
      "unit_code",
      "currency",
      "revision",
      "effective_month",
      "mode",
      "basis",
      "basis_points",
      "fixed_minor",
      "minimum_minor",
      "waive_when_zero",
      "note",
      "created_by",
      "created_at"
    ]
  },
  {
    "key": "agency_quote_snapshots",
    "zh": "报价版本",
    "en": "Quote revisions",
    "columns": [
      "id",
      "organization_id",
      "period",
      "revision",
      "created_by",
      "created_at",
      "sourceCadMinor",
      "rate",
      "upstreamCnyMinor",
      "totalCnyMinor",
      "finalMinor",
      "customerCostMinor",
      "costUnit",
      "note"
    ]
  },
  {
    "key": "agency_quote_lifecycle",
    "zh": "报价归档状态",
    "en": "Quote lifecycle",
    "columns": [
      "quote_id",
      "archived",
      "revision",
      "updated_by",
      "updated_at"
    ]
  },
  {
    "key": "agency_quote_derivations",
    "zh": "报价修订关系",
    "en": "Quote derivations",
    "columns": [
      "quote_id",
      "parent_id"
    ]
  },
  {
    "key": "billing_fx_quotes",
    "zh": "结算汇率",
    "en": "Settlement rates",
    "columns": [
      "id",
      "cad_cny_rate",
      "value_date",
      "quoted_at",
      "source_name",
      "is_demo"
    ]
  },
  {
    "key": "client_wallets",
    "zh": "资金账户",
    "en": "Wallets",
    "columns": [
      "id",
      "organization_id",
      "currency",
      "created_at"
    ]
  },
  {
    "key": "wallet_entries",
    "zh": "资金流水",
    "en": "Ledger entries",
    "columns": [
      "id",
      "wallet_id",
      "organization_id",
      "currency",
      "kind",
      "amount_minor",
      "description",
      "source_reference",
      "posted_at"
    ]
  },
  {
    "key": "client_topups",
    "zh": "付款通知",
    "en": "Payment notices",
    "columns": [
      "id",
      "wallet_id",
      "organization_id",
      "currency",
      "amount_minor",
      "reference",
      "status",
      "requested_by",
      "created_at"
    ]
  },
  {
    "key": "bank_receipts",
    "zh": "到账核对",
    "en": "Bank receipts",
    "columns": [
      "id",
      "wallet_id",
      "organization_id",
      "currency",
      "collection_account_id",
      "topup_id",
      "amount_minor",
      "payer_name",
      "bank_reference",
      "booked_date",
      "evidence_reference",
      "status",
      "prepared_by",
      "prepared_at",
      "reviewed_by",
      "reviewed_at",
      "review_note"
    ]
  },
  {
    "key": "monthly_ad_reports",
    "zh": "广告月报",
    "en": "Monthly reports",
    "columns": [
      "id",
      "wallet_id",
      "organization_id",
      "currency",
      "ad_account_id",
      "source_account_name",
      "month",
      "version",
      "ad_spend_minor",
      "service_fee_minor",
      "source_language",
      "translation_status",
      "source_filename",
      "source_timezone",
      "summary_zh",
      "summary_en",
      "reviewed_by",
      "published_at",
      "source_currency",
      "source_ad_spend_minor",
      "fx_quote_id",
      "settlement_date",
      "fee_basis_points",
      "fee_agreement_reference"
    ]
  },
  {
    "key": "monthly_ad_report_lines",
    "zh": "月报明细",
    "en": "Report lines",
    "columns": [
      "id",
      "report_id",
      "campaign",
      "market",
      "impressions",
      "clicks",
      "spend_minor",
      "source_cad_minor"
    ]
  },
  {
    "key": "monthly_settlement_drafts",
    "zh": "月度结算草稿",
    "en": "Settlement drafts",
    "columns": [
      "id",
      "organization_id",
      "binding_id",
      "snapshot_id",
      "quote_id",
      "month",
      "source_cad_minor",
      "total_cny_minor",
      "agreement_reference",
      "note",
      "prepared_by",
      "prepared_at",
      "coverage_kind",
      "coverage_check_id"
    ]
  },
  {
    "key": "monthly_settlement_reviews",
    "zh": "结算复核",
    "en": "Settlement reviews",
    "columns": [
      "draft_id",
      "decision",
      "note",
      "reviewed_by",
      "reviewed_at"
    ]
  },
  {
    "key": "monthly_client_statements",
    "zh": "正式账单",
    "en": "Published statements",
    "columns": [
      "id",
      "draft_id",
      "organization_id",
      "binding_id",
      "wallet_id",
      "month",
      "currency",
      "upstream_cny_minor",
      "service_cny_minor",
      "total_cny_minor",
      "summary_zh",
      "published_by",
      "published_at"
    ]
  },
  {
    "key": "client_statement_read_receipts",
    "zh": "账单查阅记录",
    "en": "Statement receipts",
    "columns": [
      "statement_id",
      "user_id",
      "confirmed_at"
    ]
  },
  {
    "key": "ops_source_packets",
    "zh": "原始报表登记",
    "en": "Source packets",
    "columns": [
      "id",
      "organization_id",
      "ad_account_id",
      "period",
      "version",
      "source_currency",
      "source_timezone",
      "source_language",
      "source_amount_minor",
      "source_reference",
      "status",
      "source_feedback",
      "submitted_by",
      "submitted_at"
    ]
  },
  {
    "key": "ops_reconciliations",
    "zh": "报表核对",
    "en": "Reconciliations",
    "columns": [
      "id",
      "packet_id",
      "revision",
      "fx_quote_id",
      "settlement_date",
      "ad_spend_cny_minor",
      "fee_minor",
      "fee_basis_points",
      "fee_agreement_reference",
      "status",
      "prepared_by",
      "prepared_at",
      "reviewed_by",
      "reviewed_at",
      "review_note"
    ]
  },
  {
    "key": "upstream_payment_records",
    "zh": "公司间到账",
    "en": "Intercompany receipts",
    "columns": [
      "id",
      "organization_id",
      "revision",
      "bank_reference",
      "received_on",
      "received_cad_minor",
      "evidence_reference",
      "note",
      "prepared_by",
      "prepared_at"
    ]
  },
  {
    "key": "upstream_payment_allocations",
    "zh": "公司间核销",
    "en": "Intercompany allocations",
    "columns": [
      "payment_id",
      "statement_id",
      "amount_cad_minor"
    ]
  },
  {
    "key": "upstream_payment_reviews",
    "zh": "公司间复核",
    "en": "Intercompany reviews",
    "columns": [
      "payment_id",
      "decision",
      "reviewed_by",
      "note",
      "reviewed_at"
    ]
  },
  {
    "key": "upstream_payment_reversals",
    "zh": "核销撤销",
    "en": "Allocation reversals",
    "columns": [
      "id",
      "payment_id",
      "revision",
      "reason",
      "evidence_reference",
      "prepared_by",
      "prepared_at"
    ]
  },
  {
    "key": "upstream_reversal_reviews",
    "zh": "撤销复核",
    "en": "Reversal reviews",
    "columns": [
      "reversal_id",
      "payment_id",
      "decision",
      "reviewed_by",
      "note",
      "reviewed_at"
    ]
  },
  {
    "key": "service_requests",
    "zh": "客户服务事项",
    "en": "Service requests",
    "columns": [
      "id",
      "organization_id",
      "category",
      "subject",
      "status",
      "created_by",
      "created_at",
      "updated_at",
      "statement_id",
      "statement_month"
    ]
  },
  {
    "key": "service_request_messages",
    "zh": "服务回复",
    "en": "Service replies",
    "columns": [
      "id",
      "body",
      "author_id",
      "author_role",
      "created_at",
      "reply_result_status"
    ]
  },
  {
    "key": "live_sales_updates",
    "zh": "销售跟进记录",
    "en": "Sales followups",
    "columns": [
      "id",
      "user_id",
      "organization_id",
      "note",
      "created_at"
    ]
  },
  {
    "key": "operating_units",
    "zh": "运营单位",
    "en": "Operating units",
    "columns": [
      "code",
      "label",
      "country",
      "kind",
      "active"
    ]
  },
  {
    "key": "client_operating_links",
    "zh": "运营归属",
    "en": "Operating assignments",
    "columns": [
      "organization_id",
      "fulfilment_unit",
      "market_unit"
    ]
  }
] as const;
