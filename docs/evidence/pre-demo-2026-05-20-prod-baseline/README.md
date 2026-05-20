# Pre-demo prod baseline — captured 2026-05-19 ~20:11 ET

Probed `https://dashboards.jeffcoy.net` ~13 hours before the
2026-05-20 09:00 ET stakeholder demo to verify two things:

1. **Demo path is green.** `freshsales_pipeline_value` returns
   `value: 30540` with the honest "no comparison available" pill
   (`previous_value: null`, transparent reason). This is the §2g
   demo source and the value the audience will see.

2. **This session's work is NOT yet on prod.** `platform_user_count`
   returns HTTP 403 with `"Data source 'platform_user_count' is not
   recognized."` — confirms the feature/data/quarantine work
   committed locally tonight has not been deployed. Demo is safe
   from any regression I might have introduced this evening.

The deploy of this session's commits (`415d1ad..f626043`) will
happen AFTER tomorrow's demo.
