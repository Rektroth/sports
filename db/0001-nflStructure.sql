DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM v.upgrades WHERE id = 1) THEN
	INSERT INTO v.upgrades (id) VALUES (1);

	CREATE TABLE conference (
		id SMALLINT PRIMARY KEY,
		name VARCHAR(28) UNIQUE NOT NULL
	);

	CREATE TABLE division (
		id SMALLINT PRIMARY KEY,
		conference_id SMALLINT NOT NULL REFERENCES conference(id) ON DELETE CASCADE,
		name VARCHAR(9) UNIQUE NOT NULL
	);

	CREATE TABLE team (
		id SMALLINT PRIMARY KEY,
		abbreviation VARCHAR(3) UNIQUE NOT NULL CHECK (abbreviation ~* '^[A-Z]{2,3}$'),
		name VARCHAR(21) UNIQUE NOT NULL,
		division_id SMALLINT NOT NULL REFERENCES division(id) ON DELETE CASCADE,
		sim_playoff_chance NUMERIC(7,6) CHECK (
			sim_playoff_chance IS NULL OR (sim_playoff_chance >= 0 AND sim_playoff_chance <= 1)
		),
		color1 VARCHAR(7) NOT NULL CHECK (color ~* '^#[A-F0-9]{6}$'),
		color2 VARCHAR(7) NOT NULL CHECK (color ~* '^#[A-F0-9]{6}$')
	);

	CREATE TABLE game (
		id INT PRIMARY KEY,
		season SMALLINT NOT NULL,
		start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
		home_team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE CHECK (home_team_id != away_team_id),
		away_team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE CHECK (away_team_id != home_team_id),
		home_predictor_chance NUMERIC(7,6) CHECK (
			home_predictor_chance IS NULL
			OR (home_predictor_chance >= 0 AND home_predictor_chance + away_predictor_chance <= 1)
		),
		away_predictor_chance NUMERIC(7,6) CHECK (
			away_predictor_chance IS NULL
			OR (away_predictor_chance >= 0 AND home_predictor_chance + away_predictor_chance <= 1)
		),
		home_team_score SMALLINT CHECK (home_team_score IS NULL OR (home_team_score >= 0 AND home_team_score != 1)),
		away_team_score SMALLINT CHECK (away_team_score IS NULL OR (away_team_score >= 0 AND away_team_score != 1)),
		post_season BOOLEAN NOT NULL DEFAULT FALSE
	);

	INSERT INTO conference (id, name) VALUES (7, 'National Football Conference'), (8, 'American Football Conference');

	INSERT INTO division (id, conference_id, name) VALUES
		(1, 7, 'NFC East'),
		(3, 7, 'NFC West'),
		(4, 8, 'AFC East'),
		(6, 8, 'AFC West'),
		(10, 7, 'NFC North'),
		(11, 7, 'NFC South'),
		(12, 8, 'AFC North'),
		(13, 8, 'AFC South');
	
	INSERT INTO team (id, name, color1, color2, abbreviation, division_id) VALUES
		(1, 'Atlanta Falcons', '#A71930', '#000000', 'ATL', 11),
		(2, 'Buffalo Bills', '#00338D', '#C60C30', 'BUF', 4),
		(3, 'Chicago Bears', '#0B162A', '#E64100', 'CHI', 10),
		(4, 'Cincinnati Bengals', '#000000', '#FB4F14', 'CIN', 12),
		(5, 'Cleveland Browns', '#311D00', '#FF3300', 'CLE', 12),
		(6, 'Dallas Cowboys', '#002244', '#B0B7BC', 'DAL', 1),
		(7, 'Denver Broncos', '#FC4C02', '#0A2343', 'DEN', 6),
		(8, 'Detroit Lions', '#0076B6', '#B0B7BC', 'DET', 10),
		(9, 'Green Bay Packers', '#203731', '#FFB612', 'GB', 10),
		(10, 'Tennessee Titans', '#002244', '#4B92DB', 'TEN', 13),
		(11, 'Indianapolis Colts', '#013369', '#FFFFFF', 'IND', 13),
		(12, 'Kansas City Chiefs', '#E31837', '#FFB612', 'KC', 6),
		(13, 'Las Vegas Raiders', '#A5ACAF', '#000000', 'LV', 6),
		(14, 'Los Angeles Rams', '#003594', '#FFD100', 'LAR', 6),
		(15, 'Miami Dolphins', '#008E97', '#FC4C02', 'MIA', 4),
		(16, 'Minnesota Vikings', '#4F2683', '#FFC62F', 'MIN', 10),
		(17, 'New England Patriots', '#002244', '#C60C30', 'NE', 4),
		(18, 'New Orleans Saints', '#D3BC8D', '#000000', 'NO', 11),
		(19, 'New York Giants', '#0B2265', '#A71930', 'NYG', 1),
		(20, 'New York Jets', '#115740', '#FFFFFF', 'NYJ', 4),
		(21, 'Philadelphia Eagles', '#004851', '#A2AAAD', 'PHI', 1),
		(22, 'Arizona Cardinals', '#97233F', '#FFFFFF', 'ARI', 3),
		(23, 'Pittsburgh Steelers', '#000000', '#FFB612', 'PIT', 12),
		(24, 'Los Angeles Chargers', '#0080C6', '#FFC20E', 'LAC', 6),
		(25, 'San Francisco 49ers', '#AA0000', '#B3995D', 'SF', 3),
		(26, 'Seattle Seahawks', '#002244', '#69BE28', 'SEA', 3),
		(27, 'Tampa Bay Buccaneers', '#A71930', '#322F2B', 'TB', 11),
		(28, 'Washington Commanders', '#5A1414', '#FFB612', 'WAS', 1),
		(29, 'Carolina Panthers', '#000000', '#0085CA', 'CAR', 11),
		(30, 'Jacksonville Jaguars', '#006778', '#000000', 'JAX', 13),
		(33, 'Baltimore Ravens', '#24135F', '#000000', 'BAL', 12),
		(34, 'Houston Texans', '#03202F', '#A71930', 'HOU', 13);
END; $$