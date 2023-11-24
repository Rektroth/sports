DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM v.upgrades WHERE id = 2) THEN
	INSERT INTO v.upgrades (id) VALUES (2);
	
	CREATE TABLE sim_season (
		id BIGSERIAL PRIMARY KEY
	);

	CREATE TABLE sim_game (
		game_id INT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
		sim_season_id BIGINT NOT NULL REFERENCES sim_season(id) ON DELETE CASCADE,
		winning_team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
		PRIMARY KEY (game_id, sim_season_id)
	);

	CREATE TABLE sim_playoff_appearance (
		sim_season_id BIGINT REFERENCES sim_season(id) ON DELETE CASCADE,
		team_id SMALLINT REFERENCES team(id) ON DELETE CASCADE,
		PRIMARY KEY (sim_season_id, team_id)
	);

	CREATE TABLE sim_playoff_chance (
		game_id INT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
		team_id SMALLINT NOT NULL REFERENCES team(id),
		chance_with_away_win NUMERIC(7,6) NOT NULL CHECK (chance_with_away_win >= 0 AND chance_with_away_win <= 1),
		chance_with_home_win NUMERIC(7,6) NOT NULL CHECK (chance_with_home_win >= 0 AND chance_with_home_win <= 1),
		PRIMARY KEY (game_id, team_id)
	);
END; $$
