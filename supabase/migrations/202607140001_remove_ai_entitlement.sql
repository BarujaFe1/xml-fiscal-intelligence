-- Remove AI entitlement key from plan version snapshots (AI feature removed).

update plan_versions
set entitlements_json = entitlements_json - 'hasAiExplanations'
where entitlements_json ? 'hasAiExplanations';
