import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Game from './game';
import Team from './team';

@Entity({ name: 'team_chances_by_game' })
export default class TeamChancesByGame {
	@PrimaryColumn({ name: 'game_id', type: 'int' })
		gameId: number;

	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@Column({ name: 'min_seed7_if_away_win', type: 'double precision' })
		minimumSeed7IfAwayWins: number;

	@Column({ name: 'min_seed6_if_away_win', type: 'double precision' })
		minimumSeed6IfAwayWins: number;

	@Column({ name: 'min_seed5_if_away_win', type: 'double precision' })
		minimumSeed5IfAwayWins: number;

	@Column({ name: 'min_seed4_if_away_win', type: 'double precision' })
		minimumSeed4IfAwayWins: number;

	@Column({ name: 'min_seed3_if_away_win', type: 'double precision' })
		minimumSeed3IfAwayWins: number;

	@Column({ name: 'min_seed2_if_away_win', type: 'double precision' })
		minimumSeed2IfAwayWins: number;

	@Column({ name: 'min_seed1_if_away_win', type: 'double precision' })
		minimumSeed1IfAwayWins: number;

	@Column({ name: 'seed7_if_away_win', type: 'double precision' })
		seed7IfAwayWins: number;

	@Column({ name: 'seed6_if_away_win', type: 'double precision' })
		seed6IfAwayWins: number;

	@Column({ name: 'seed5_if_away_win', type: 'double precision' })
		seed5IfAwayWins: number;

	@Column({ name: 'seed4_if_away_win', type: 'double precision' })
		seed4IfAwayWins: number;

	@Column({ name: 'seed3_if_away_win', type: 'double precision' })
		seed3IfAwayWins: number;

	@Column({ name: 'seed2_if_away_win', type: 'double precision' })
		seed2IfAwayWins: number;

	@Column({ name: 'seed1_if_away_win', type: 'double precision' })
		seed1IfAwayWins: number;

	@Column({ name: 'host_wild_card_rnd_if_away_win', type: 'double precision' })
		hostWildCardRoundIfAwayWins: number;

	@Column({ name: 'host_div_rnd_if_away_win', type: 'double precision' })
		hostDivisionRoundIfAwayWins: number;

	@Column({ name: 'host_conf_rnd_if_away_win', type: 'double precision' })
		hostConferenceRoundIfAwayWins: number;

	@Column({ name: 'make_div_rnd_if_away_win', type: 'double precision' })
		makeDivisionRoundIfAwayWins: number;

	@Column({ name: 'make_conf_rnd_if_away_win', type: 'double precision' })
		makeConferenceRoundIfAwayWins: number;

	@Column({ name: 'make_super_bowl_if_away_win', type: 'double precision' })
		makeSuperBowlIfAwayWins: number;

	@Column({ name: 'win_super_bowl_if_away_win', type: 'double precision' })
		winSuperBowlIfAwayWins: number;

	@Column({ name: 'min_seed7_if_home_win', type: 'double precision' })
		minimumSeed7IfHomeWins: number;

	@Column({ name: 'min_seed6_if_home_win', type: 'double precision' })
		minimumSeed6IfHomeWins: number;

	@Column({ name: 'min_seed5_if_home_win', type: 'double precision' })
		minimumSeed5IfHomeWins: number;

	@Column({ name: 'min_seed4_if_home_win', type: 'double precision' })
		minimumSeed4IfHomeWins: number;

	@Column({ name: 'min_seed3_if_home_win', type: 'double precision' })
		minimumSeed3IfHomeWins: number;

	@Column({ name: 'min_seed2_if_home_win', type: 'double precision' })
		minimumSeed2IfHomeWins: number;

	@Column({ name: 'min_seed1_if_home_win', type: 'double precision' })
		minimumSeed1IfHomeWins: number;

	@Column({ name: 'seed7_if_home_win', type: 'double precision' })
		seed7IfHomeWins: number;

	@Column({ name: 'seed6_if_home_win', type: 'double precision' })
		seed6IfHomeWins: number;

	@Column({ name: 'seed5_if_home_win', type: 'double precision' })
		seed5IfHomeWins: number;

	@Column({ name: 'seed4_if_home_win', type: 'double precision' })
		seed4IfHomeWins: number;

	@Column({ name: 'seed3_if_home_win', type: 'double precision' })
		seed3IfHomeWins: number;

	@Column({ name: 'seed2_if_home_win', type: 'double precision' })
		seed2IfHomeWins: number;

	@Column({ name: 'seed1_if_home_win', type: 'double precision' })
		seed1IfHomeWins: number;

	@Column({ name: 'host_wild_card_rnd_if_home_win', type: 'double precision' })
		hostWildCardRoundIfHomeWins: number;

	@Column({ name: 'host_div_rnd_if_home_win', type: 'double precision' })
		hostDivisionRoundIfHomeWins: number;

	@Column({ name: 'host_conf_rnd_if_home_win', type: 'double precision' })
		hostConferenceRoundIfHomeWins: number;

	@Column({ name: 'make_div_rnd_if_home_win', type: 'double precision' })
		makeDivisionRoundIfHomeWins: number;

	@Column({ name: 'make_conf_rnd_if_home_win', type: 'double precision' })
		makeConferenceRoundIfHomeWins: number;

	@Column({ name: 'make_super_bowl_if_home_win', type: 'double precision' })
		makeSuperBowlIfHomeWins: number;

	@Column({ name: 'win_super_bowl_if_home_win', type: 'double precision' })
		winSuperBowlIfHomeWins: number;

	@ManyToOne(() => Game)
	@JoinColumn({ name: 'game_id' })
		game?: Game;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
