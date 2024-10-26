import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Game from './game';
import Team from './team';

@Entity({ name: 'team_chances_by_game' })
export default class TeamChancesByGame {
	@PrimaryColumn({ name: 'game_id', type: 'int' })
		gameId: number;

	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@Column({ name: 'away_seed7', type: 'double precision' })
		awaySeed7: number;

	@Column({ name: 'away_seed6', type: 'double precision' })
		awaySeed6: number;

	@Column({ name: 'away_seed5', type: 'double precision' })
		awaySeed5: number;

	@Column({ name: 'away_seed4', type: 'double precision' })
		awaySeed4: number;

	@Column({ name: 'away_seed3', type: 'double precision' })
		awaySeed3: number;

	@Column({ name: 'away_seed2', type: 'double precision' })
		awaySeed2: number;

	@Column({ name: 'away_seed1', type: 'double precision' })
		awaySeed1: number;

	@Column({ name: 'away_host_wc', type: 'double precision' })
		awayHostWildCard: number;

	@Column({ name: 'away_host_div', type: 'double precision' })
		awayHostDivision: number;

	@Column({ name: 'away_host_conf', type: 'double precision' })
		awayHostConference: number;

	@Column({ name: 'away_make_div', type: 'double precision' })
		awayMakeDivision: number;

	@Column({ name: 'away_make_conf', type: 'double precision' })
		awayMakeConference: number;

	@Column({ name: 'away_make_sb', type: 'double precision' })
		awayMakeSuperBowl: number;

	@Column({ name: 'away_win_sb', type: 'double precision' })
		awayWinSuperBowl: number;

	@Column({ name: 'home_seed7', type: 'double precision' })
		homeSeed7: number;

	@Column({ name: 'home_seed6', type: 'double precision' })
		homeSeed6: number;

	@Column({ name: 'home_seed5', type: 'double precision' })
		homeSeed5: number;

	@Column({ name: 'home_seed4', type: 'double precision' })
		homeSeed4: number;

	@Column({ name: 'home_seed3', type: 'double precision' })
		homeSeed3: number;

	@Column({ name: 'home_seed2', type: 'double precision' })
		homeSeed2: number;

	@Column({ name: 'home_seed1', type: 'double precision' })
		homeSeed1: number;

	@Column({ name: 'home_host_wc', type: 'double precision' })
		homeHostWildCard: number;

	@Column({ name: 'home_host_div', type: 'double precision' })
		homeHostDivision: number;

	@Column({ name: 'home_host_conf', type: 'double precision' })
		homeHostConference: number;

	@Column({ name: 'home_make_div', type: 'double precision' })
		homeMakeDivision: number;

	@Column({ name: 'home_make_conf', type: 'double precision' })
		homeMakeConference: number;

	@Column({ name: 'home_make_sb', type: 'double precision' })
		homeMakeSuperBowl: number;

	@Column({ name: 'home_win_sb', type: 'double precision' })
		homeWinSuperBowl: number;

	@ManyToOne(() => Game)
	@JoinColumn({ name: 'game_id' })
		game?: Game;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
