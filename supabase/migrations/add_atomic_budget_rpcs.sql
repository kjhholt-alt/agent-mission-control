-- Atomic increment for budget spend (prevents read-modify-write race)
CREATE OR REPLACE FUNCTION increment_budget_spend(row_id uuid, cents_to_add int)
RETURNS void AS $$
BEGIN
  UPDATE swarm_budgets
  SET api_spent_cents = api_spent_cents + cents_to_add,
      updated_at = now()
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment for budget task counters
CREATE OR REPLACE FUNCTION increment_budget_field(row_id uuid, field_name text)
RETURNS void AS $$
BEGIN
  IF field_name = 'tasks_completed' THEN
    UPDATE swarm_budgets SET tasks_completed = tasks_completed + 1, updated_at = now() WHERE id = row_id;
  ELSIF field_name = 'tasks_failed' THEN
    UPDATE swarm_budgets SET tasks_failed = tasks_failed + 1, updated_at = now() WHERE id = row_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
