import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Game from './game';
import Team from './team';

@Entity({ name: 'sim_playoff_chance' })
export default class SimPlayoffChance {
	@PrimaryColumn({ name: 'game_id', type: 'int' })
		gameId: number;

	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@Column({ name: 'playoff_chance_with_away_win', type: 'double precision' })
		playoffChanceWithAwayWin: number;

	@Column({ name: 'playoff_chance_with_home_win', type: 'double precision' })
		playoffChanceWithHomeWin: number;

	@Column({ name: 'div_leader_chance_with_away_win', type: 'double precision' })
		divLeaderChanceWithAwayWin: number;

	@Column({ name: 'div_leader_chance_with_home_win', type: 'double precision' })
		divLeaderChanceWithHomeWin: number;

	@Column({ name: 'conf_leader_chance_with_away_win', type: 'double precision' })
		confLeaderChanceWithAwayWin: number;

	@Column({ name: 'conf_leader_chance_with_home_win', type: 'double precision' })
		confLeaderChanceWithHomeWin: number;

	@Column({ name: 'make_div_chance_with_home_win', type: 'double precision' })
		makeDivChanceWithHomeWin: number;

	@Column({ name: 'make_div_chance_with_away_win', type: 'double precision' })
		makeDivChanceWithAwayWin: number;

	@Column({ name: 'host_div_chance_with_home_win', type: 'double precision' })
		hostDivChanceWithHomeWin: number;

	@Column({ name: 'host_div_chance_with_away_win', type: 'double precision' })
		hostDivChanceWithAwayWin: number;

	@Column({ name: 'div_winner_chance_with_home_win', type: 'double precision' })
		divWinnerChanceWithHomeWin: number;

	@Column({ name: 'div_winner_chance_with_away_win', type: 'double precision' })
		divWinnerChanceWithAwayWin: number;

	@Column({ name: 'host_conf_chance_with_home_win', type: 'double precision' })
		hostConfChanceWithHomeWin: number;

	@Column({ name: 'host_conf_chance_with_away_win', type: 'double precision' })
		hostConfChanceWithAwayWin: number;

	@Column({ name: 'conf_winner_chance_with_home_win', type: 'double precision' })
		confWinnerChanceWithHomeWin: number;

	@Column({ name: 'conf_winner_chance_with_away_win', type: 'double precision' })
		confWinnerChanceWithAwayWin: number;

	@Column({ name: 'super_bowl_winner_chance_with_home_win', type: 'double precision' })
		superBowlWinnerChanceWithHomeWin: number;

	@Column({ name: 'super_bowl_winner_chance_with_away_win', type: 'double precision' })
		superBowlWinnerChanceWithAwayWin: number;

	@ManyToOne(() => Game)
	@JoinColumn({ name: 'game_id' })
		game?: Game;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
