-- =====================================================================
--  Transactions (ACID) - claim verification and item return
-- =====================================================================
USE campus_lostfound;

-- [T-1] Claim approval as one atomic unit (what sp_verify_claim does)
-- concept: START TRANSACTION ... COMMIT; row locks with SELECT ... FOR UPDATE
-- mode: script
SET @app_user_id = 3;
START TRANSACTION;
  -- lock the claim and the item so no other session can decide them concurrently
  SELECT claim_status, found_id FROM claims WHERE claim_id = 4 FOR UPDATE;
  SELECT status FROM found_items WHERE found_id = 4 FOR UPDATE;
  INSERT INTO verifications (claim_id, verifier_id, decision, remarks)
  VALUES (4, 3, 'APPROVED', 'Pink heart sticker matched');
  -- triggers have now updated claims, found_items and notifications in the same transaction
COMMIT;

-- [T-2] Hand-over that fails half way is rolled back completely
-- concept: atomicity - an error inside the transaction followed by ROLLBACK leaves no partial changes
-- mode: script
START TRANSACTION;
  UPDATE found_items SET held_at_id = 25 WHERE found_id = 13;
  -- claim 10 is an approved smartwatch claim (high value): without the ID check the trigger raises an error
  INSERT INTO item_returns (claim_id, handled_by, id_proof_checked) VALUES (10, 2, FALSE);
ROLLBACK;   -- the held_at_id change above is undone as well
SELECT found_id, held_at_id, status FROM found_items WHERE found_id = 13;

-- [T-3] Partial undo with a SAVEPOINT
-- concept: SAVEPOINT and ROLLBACK TO SAVEPOINT inside a transaction
-- mode: rollback
UPDATE found_items SET held_at_id = 25 WHERE found_id = 20;
SAVEPOINT after_first_move;
UPDATE found_items SET held_at_id = 10 WHERE found_id = 22;
ROLLBACK TO SAVEPOINT after_first_move;
SELECT found_id, held_at_id FROM found_items WHERE found_id IN (20, 22);

-- [T-4] Two desks approving claims for the same wallet at the same time
-- concept: isolation + locking - run the two sessions side by side in Workbench
-- mode: script
-- Session A                                   -- Session B
START TRANSACTION;                             -- START TRANSACTION;
SELECT * FROM found_items                      -- SELECT * FROM found_items
 WHERE found_id = 6 FOR UPDATE;                --  WHERE found_id = 6 FOR UPDATE;   <- waits for A
CALL sp_verify_claim(6, 3, 'APPROVED', 'ok');  --
COMMIT;                                        -- (now continues and sees status CLAIM_APPROVED,
                                               --  so sp_verify_claim(7, 2, 'APPROVED', ...) fails)

-- [T-5] Isolation levels
-- concept: READ COMMITTED vs REPEATABLE READ (InnoDB default)
-- mode: script
SELECT @@transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT COUNT(*) FROM claims WHERE claim_status = 'PENDING';  -- re-run after another session commits a claim
COMMIT;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
