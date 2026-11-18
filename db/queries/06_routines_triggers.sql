-- =====================================================================
--  Stored functions, stored procedures and triggers in action
-- =====================================================================
USE campus_lostfound;

-- [R-1] Calling the stored functions
-- concept: user-defined functions inside a SELECT
-- mode: read
SELECT fn_rule_match_score(7, 7)                 AS charger_vs_charger,
       fn_rule_match_score(7, 1)                 AS charger_vs_phone,
       fn_has_permission(4, 'CLAIM_VERIFY')      AS student_can_verify,
       fn_has_permission(3, 'CLAIM_VERIFY')      AS staff_can_verify,
       fn_category_root(5)                       AS root_of_wireless_earbuds,
       fn_category_relation_score(5, 4)          AS earbuds_vs_headphones,
       fn_recovery_rate(1)                       AS electronics_recovery_pct;

-- [R-2] Rule-score breakdown for every candidate of lost report 7 (HP charger)
-- concept: a function evaluated per row + CASE expressions explaining each component
-- mode: read
SELECT f.found_id, f.title,
       fn_category_relation_score(l.category_id, f.category_id) AS category_relation,
       CASE WHEN f.location_id = l.location_id THEN 'same spot'
            WHEN fl.building_id = ll.building_id THEN 'same building' ELSE 'elsewhere' END AS location,
       DATEDIFF(f.found_date, l.lost_date) AS day_gap,
       f.color = l.color AS same_colour,
       fn_rule_match_score(l.lost_id, f.found_id) AS rule_score
FROM lost_items l
JOIN locations ll ON ll.location_id = l.location_id
JOIN found_items f ON f.status IN ('AVAILABLE', 'CLAIM_PENDING')
JOIN locations fl ON fl.location_id = f.location_id
WHERE l.lost_id = 7
ORDER BY rule_score DESC
LIMIT 10;

-- [R-3] Procedure with a result set: candidate found items for lost report 7
-- concept: CALL a stored procedure that returns rows (run in Workbench)
-- mode: script
CALL sp_match_candidates_for_lost(7, 10);

-- [R-4] Submit a claim with an OUT parameter
-- concept: stored procedure + transaction + SELECT ... FOR UPDATE + OUT parameter
-- mode: script
CALL sp_submit_claim(7, 10, 7, 'HP 65W charger with yellow tape near the plug.', @new_claim_id);
SELECT @new_claim_id;

-- [R-5] Approve the genuine wallet claim (claim 6); the fake one (claim 7) is auto-rejected
-- concept: procedure -> INSERT verifications -> triggers update claims, found_items, notifications
-- mode: script
CALL sp_verify_claim(6, 3, 'APPROVED', 'Family photo and amount matched');
SELECT claim_id, claim_status FROM claims WHERE found_id = 6;

-- [R-6] Hand over an approved item
-- concept: procedure + BEFORE trigger (ID proof rule) + AFTER trigger (closes the case)
-- mode: script
CALL sp_record_return(3, 2, TRUE, 'ID card handed back at the security cabin', @return_id);
SELECT @return_id;

-- [R-7] Housekeeping procedures (cursor and bulk update)
-- concept: CURSOR loop with a NOT FOUND handler; ROW_COUNT() into an OUT parameter
-- mode: script
CALL sp_remind_stale_reports(30, @reminded);
CALL sp_dispose_unclaimed(1, 45, @disposed);
SELECT @reminded AS reminders_sent, @disposed AS items_disposed;

-- [R-8] Trigger: a new claim changes the item status and notifies staff
-- concept: AFTER INSERT trigger trg_claims_after_insert (status update + INSERT ... SELECT notifications)
-- mode: rollback
SELECT found_id, title, status FROM found_items WHERE found_id = 7;
INSERT INTO claims (found_id, claimant_id, lost_id, proof_details)
VALUES (7, 10, 7, 'HP 65W charger, yellow tape near the plug.');
SELECT found_id, title, status FROM found_items WHERE found_id = 7;
SELECT user_id, notif_type, message FROM notifications ORDER BY notification_id DESC LIMIT 3;

-- [R-9] Trigger cascade: approving one claim rejects the competing claim
-- concept: verifications trigger -> claims trigger -> found_items + notifications (all rolled back afterwards)
-- mode: rollback
SET @app_user_id = 3;
SELECT claim_id, claimant_id, claim_status FROM claims WHERE found_id = 6;
INSERT INTO verifications (claim_id, verifier_id, decision, remarks) VALUES (6, 3, 'APPROVED', 'Photo matched');
SELECT claim_id, claimant_id, claim_status FROM claims WHERE found_id = 6;
SELECT found_id, status FROM found_items WHERE found_id = 6;
SELECT table_name, record_id, old_value, new_value, changed_by FROM audit_log ORDER BY log_id DESC LIMIT 4;

-- [R-10] Trigger: nobody can claim an item they reported as found
-- concept: BEFORE INSERT trigger raising SIGNAL (finder 4 tries to claim found item 7)
-- mode: rollback
INSERT INTO claims (found_id, claimant_id, proof_details) VALUES (7, 4, 'This is definitely my charger, trust me.');

-- [R-11] Trigger: database-level RBAC - a student cannot record a verification
-- concept: trg_verifications_before_insert calls fn_has_permission (student 5 lacks CLAIM_VERIFY)
-- mode: rollback
INSERT INTO verifications (claim_id, verifier_id, decision) VALUES (4, 5, 'APPROVED');

-- [R-12] Trigger: high-value items need an ID check at hand-over
-- concept: BEFORE INSERT on item_returns (claim 3 = ID card, a high-value category)
-- mode: rollback
INSERT INTO item_returns (claim_id, handled_by, id_proof_checked) VALUES (3, 2, FALSE);
