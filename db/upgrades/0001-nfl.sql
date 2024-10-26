DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM v.upgrades WHERE id = 1) THEN
	INSERT INTO v.upgrades (id) VALUES (1);

	CREATE SCHEMA nfl;

	CREATE TYPE nfl.SEASONTYPE AS ENUM ('pre', 'regular', 'post');

	CREATE TABLE nfl.conference (
		id SMALLINT PRIMARY KEY,
		name VARCHAR(28) UNIQUE NOT NULL
	);

	CREATE TABLE nfl.division (
		id SMALLINT PRIMARY KEY,
		conference_id SMALLINT NOT NULL REFERENCES conference(id) ON DELETE CASCADE,
		name VARCHAR(9) UNIQUE NOT NULL
	);

	CREATE TABLE nfl.team (
		id SMALLINT PRIMARY KEY,
		abbreviation VARCHAR(3) UNIQUE NOT NULL CHECK (abbreviation ~* '^[A-Z]{2,3}$'),
		name VARCHAR(21) UNIQUE NOT NULL,
		division_id SMALLINT NOT NULL REFERENCES division(id) ON DELETE CASCADE,
		color1 VARCHAR(7) NOT NULL CHECK (color1 ~* '^#[A-F0-9]{6}$'),
		color2 VARCHAR(7) NOT NULL CHECK (color2 ~* '^#[A-F0-9]{6}$')
	);

	CREATE TABLE nfl.team_elo (
        team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
        date TIMESTAMP WITH TIME ZONE NOT NULL,
        elo_score DOUBLE PRECISION NOT NULL,
        PRIMARY KEY (team_id, date)
    );

	CREATE TABLE nfl.game (
		id INT PRIMARY KEY,
		season SMALLINT NOT NULL,
		week SMALLINT NOT NULL CHECK (week >= 1),
		start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
		home_team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE CHECK (home_team_id != away_team_id),
		away_team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE CHECK (away_team_id != home_team_id),
		home_score SMALLINT CHECK (home_score IS NULL OR (home_score >= 0 AND home_score != 1)),
		away_score SMALLINT CHECK (away_score IS NULL OR (away_score >= 0 AND away_score != 1)),
		season_type SEASONTYPE NOT NULL DEFAULT 'regular',
		neutral_site BOOLEAN NOT NULL DEFAULT FALSE
	);

	CREATE TABLE nfl.team_chances (
		team_id SMALLINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
		season SMALLINT NOT NULL,
		week SMALLINT NOT NULL CHECK (week >= 1),
		season_type SEASONTYPE NOT NULL DEFAULT 'regular',
		seed7 DOUBLE PRECISION CHECK (seed7 IS NULL OR (seed7 >= 0 AND seed7 <= 1)),
		seed6 DOUBLE PRECISION CHECK (seed6 IS NULL OR (seed6 >= 0 AND seed6 <= 1)),
		seed5 DOUBLE PRECISION CHECK (seed5 IS NULL OR (seed5 >= 0 AND seed5 <= 1)),
		seed4 DOUBLE PRECISION CHECK (seed4 IS NULL OR (seed4 >= 0 AND seed4 <= 1)),
		seed3 DOUBLE PRECISION CHECK (seed3 IS NULL OR (seed3 >= 0 AND seed3 <= 1)),
		seed2 DOUBLE PRECISION CHECK (seed2 IS NULL OR (seed2 >= 0 AND seed2 <= 1)),
		seed1 DOUBLE PRECISION CHECK (seed1 IS NULL OR (seed1 >= 0 AND seed1 <= 1)),
		host_wc DOUBLE PRECISION CHECK (host_wc IS NULL OR (host_wc >= 0 AND host_wc <= 1)),
		host_div DOUBLE PRECISION CHECK (host_div IS NULL OR (host_div >= 0 AND host_div <= 1)),
		host_conf DOUBLE PRECISION CHECK (host_conf IS NULL OR (host_conf >= 0 AND host_conf <= 1)),
		make_div DOUBLE PRECISION CHECK (make_div IS NULL OR (make_div >= 0 AND make_div <= 1)),
		make_conf DOUBLE PRECISION CHECK (make_conf IS NULL OR (make_conf >= 0 AND make_conf <= 1)),
		make_sb DOUBLE PRECISION CHECK (make_sb IS NULL OR (make_sb >= 0 AND make_sb <= 1)),
		win_sb DOUBLE PRECISION CHECK (win_sb IS NULL OR (win_sb >= 0 AND win_sb <= 1)),
		PRIMARY KEY (team_id, season, week, season_type)
	);

	CREATE TABLE nfl.team_chances_by_game (
		game_id INT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
		team_id SMALLINT NOT NULL REFERENCES team(id),
		away_seed7 DOUBLE PRECISION CHECK (away_seed7 IS NULL OR (away_seed7 >= 0 AND away_seed7 <= 1)),
		away_seed6 DOUBLE PRECISION CHECK (away_seed6 IS NULL OR (away_seed6 >= 0 AND away_seed6 <= 1)),
		away_seed5 DOUBLE PRECISION CHECK (away_seed5 IS NULL OR (away_seed5 >= 0 AND away_seed5 <= 1)),
		away_seed4 DOUBLE PRECISION CHECK (away_seed4 IS NULL OR (away_seed4 >= 0 AND away_seed4 <= 1)),
		away_seed3 DOUBLE PRECISION CHECK (away_seed3 IS NULL OR (away_seed3 >= 0 AND away_seed3 <= 1)),
		away_seed2 DOUBLE PRECISION CHECK (away_seed2 IS NULL OR (away_seed2 >= 0 AND away_seed2 <= 1)),
		away_seed1 DOUBLE PRECISION CHECK (away_seed1 IS NULL OR (away_seed1 >= 0 AND away_seed1 <= 1)),
		away_host_wc DOUBLE PRECISION CHECK (away_host_wc IS NULL OR (away_host_wc >= 0 AND away_host_wc <= 1)),
		away_host_div DOUBLE PRECISION CHECK (away_host_div IS NULL OR (away_host_div >= 0 AND away_host_div <= 1)),
		away_host_conf DOUBLE PRECISION CHECK (away_host_conf IS NULL OR (away_host_conf >= 0 AND away_host_conf <= 1)),
		away_make_div DOUBLE PRECISION CHECK (away_make_div IS NULL OR (away_make_div >= 0 AND away_make_div <= 1)),
		away_make_conf DOUBLE PRECISION CHECK (away_make_conf IS NULL OR (away_make_conf >= 0 AND away_make_conf <= 1)),
		away_make_sb DOUBLE PRECISION CHECK (away_make_sb IS NULL OR (away_make_sb >= 0 AND away_make_sb <= 1)),
		away_win_sb DOUBLE PRECISION CHECK (away_win_sb IS NULL OR (away_win_sb >= 0 AND away_win_sb <= 1)),
		home_seed7 DOUBLE PRECISION CHECK (home_seed7 IS NULL OR (home_seed7 >= 0 AND home_seed7 <= 1)),
		home_seed6 DOUBLE PRECISION CHECK (home_seed6 IS NULL OR (home_seed6 >= 0 AND home_seed6 <= 1)),
		home_seed5 DOUBLE PRECISION CHECK (home_seed5 IS NULL OR (home_seed5 >= 0 AND home_seed5 <= 1)),
		home_seed4 DOUBLE PRECISION CHECK (home_seed4 IS NULL OR (home_seed4 >= 0 AND home_seed4 <= 1)),
		home_seed3 DOUBLE PRECISION CHECK (home_seed3 IS NULL OR (home_seed3 >= 0 AND shome_eed3 <= 1)),
		home_seed2 DOUBLE PRECISION CHECK (home_seed2 IS NULL OR (home_seed2 >= 0 AND home_seed2 <= 1)),
		home_seed1 DOUBLE PRECISION CHECK (home_seed1 IS NULL OR (home_seed1 >= 0 AND home_seed1 <= 1)),
		home_host_wc DOUBLE PRECISION CHECK (home_host_wc IS NULL OR (home_host_wc >= 0 AND home_host_wc <= 1)),
		home_host_div DOUBLE PRECISION CHECK (home_host_div IS NULL OR (home_host_div >= 0 AND home_host_div <= 1)),
		home_host_conf DOUBLE PRECISION CHECK (home_host_conf IS NULL OR (home_host_conf >= 0 AND home_host_conf <= 1)),
		home_make_div DOUBLE PRECISION CHECK (home_make_div IS NULL OR (home_make_div >= 0 AND home_make_div <= 1)),
		home_make_conf DOUBLE PRECISION CHECK (home_make_conf IS NULL OR (home_make_conf >= 0 AND home_make_conf <= 1)),
		home_make_sb DOUBLE PRECISION CHECK (home_make_sb IS NULL OR (home_make_sb >= 0 AND home_make_sb <= 1)),
		home_win_sb DOUBLE PRECISION CHECK (home_win_sb IS NULL OR (home_win_sb >= 0 AND home_win_sb <= 1)),
		PRIMARY KEY (game_id, team_id)
	);

	INSERT INTO nfl.conference (id, name) VALUES
		(7, 'National Football Conference'),
		(8, 'American Football Conference');

	INSERT INTO nfl.division (id, conference_id, name) VALUES
		(1, 7, 'NFC East'),
		(3, 7, 'NFC West'),
		(4, 8, 'AFC East'),
		(6, 8, 'AFC West'),
		(10, 7, 'NFC North'),
		(11, 7, 'NFC South'),
		(12, 8, 'AFC North'),
		(13, 8, 'AFC South');
	
	INSERT INTO nfl.team (id, name, color1, color2, abbreviation, division_id) VALUES
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
		(14, 'Los Angeles Rams', '#003594', '#FFD100', 'LAR', 3),
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
		(28, 'Washington Commanders', '#5A1414', '#FFB612', 'WSH', 1),
		(29, 'Carolina Panthers', '#000000', '#0085CA', 'CAR', 11),
		(30, 'Jacksonville Jaguars', '#006778', '#000000', 'JAX', 13),
		(33, 'Baltimore Ravens', '#24135F', '#000000', 'BAL', 12),
		(34, 'Houston Texans', '#03202F', '#A71930', 'HOU', 13);
END IF;
END; $$
