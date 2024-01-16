DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM v.upgrades WHERE id = 2) THEN
	INSERT INTO v.upgrades (id) VALUES (2);

	ALTER TABLE team ADD COLUMN sim_host_div_chance NUMERIC(13,12) CHECK (
		sim_host_div_chance IS NULL OR (sim_host_div_chance >= 0 AND sim_host_div_chance <= 1)
	);

	ALTER TABLE team ADD COLUMN sim_host_conf_chance NUMERIC(13,12) CHECK (
		sim_host_conf_chance IS NULL OR (sim_host_conf_chance >= 0 AND sim_host_conf_chance <= 1)
	);

	ALTER TABLE sim_playoff_chance ADD COLUMN host_div_chance_with_home_win NUMERIC(13,12) CHECK (
		host_div_chance_with_home_win >= 0 AND host_div_chance_with_home_win >= 0
	);

	ALTER TABLE sim_playoff_chance ADD COLUMN host_div_chance_with_away_win NUMERIC(13,12) CHECK (
		host_div_chance_with_away_win >= 0 AND host_div_chance_with_away_win >= 0
	);

	ALTER TABLE sim_playoff_chance ADD COLUMN host_conf_chance_with_home_win NUMERIC(13,12) CHECK (
		host_conf_chance_with_home_win >= 0 AND host_conf_chance_with_home_win >= 0
	);

	ALTER TABLE sim_playoff_chance ADD COLUMN host_conf_chance_with_away_win NUMERIC(13,12) CHECK (
		host_conf_chance_with_away_win >= 0 AND host_conf_chance_with_away_win >= 0
	);
END IF;
END; $$
