import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Game from './game';
import Team from './team';

@Entity({ name: 'sim_playoff_chance' })
export default class SimPlayoffChance {
	@PrimaryColumn({ name: 'game_id', type: 'int' })
		gameId: number;

	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@Column({ name: 'playoff_chance_with_away_win', type: 'numeric' })
		playoffChanceWithAwayWin: number;

	@Column({ name: 'playoff_chance_with_home_win', type: 'numeric' })
		playoffChanceWithHomeWin: number;

	@Column({ name: 'div_leader_chance_with_away_win', type: 'numeric' })
		divLeaderChanceWithAwayWin: number;

	@Column({ name: 'div_leader_chance_with_home_win', type: 'numeric' })
		divLeaderChanceWithHomeWin: number;

	@Column({ name: 'conf_leader_chance_with_away_win', type: 'numeric' })
		confLeaderChanceWithAwayWin: number;

	@Column({ name: 'conf_leader_chance_with_home_win', type: 'numeric' })
		confLeaderChanceWithHomeWin: number;

	@Column({ name: 'make_div_chance_with_home_win', type: 'numeric' })
		makeDivChanceWithHomeWin: number;

	@Column({ name: 'make_div_chance_with_away_win', type: 'numeric' })
		makeDivChanceWithAwayWin: number;

	@Column({ name: 'host_div_chance_with_home_win', type: 'numeric' })
		hostDivChanceWithHomeWin: number;

	@Column({ name: 'host_div_chance_with_away_win', type: 'numeric' })
		hostDivChanceWithAwayWin: number;

	@Column({ name: 'div_winner_chance_with_home_win', type: 'numeric' })
		divWinnerChanceWithHomeWin: number;

	@Column({ name: 'div_winner_chance_with_away_win', type: 'numeric' })
		divWinnerChanceWithAwayWin: number;

	@Column({ name: 'host_conf_chance_with_home_win', type: 'numeric' })
		hostConfChanceWithHomeWin: number;

	@Column({ name: 'host_conf_chance_with_away_win', type: 'numeric' })
		hostConfChanceWithAwayWin: number;

	@Column({ name: 'conf_winner_chance_with_home_win', type: 'numeric' })
		confWinnerChanceWithHomeWin: number;

	@Column({ name: 'conf_winner_chance_with_away_win', type: 'numeric' })
		confWinnerChanceWithAwayWin: number;

	@Column({ name: 'super_bowl_winner_chance_with_home_win', type: 'numeric' })
		superBowlWinnerChanceWithHomeWin: number;

	@Column({ name: 'super_bowl_winner_chance_with_away_win', type: 'numeric' })
		superBowlWinnerChanceWithAwayWin: number;

	@ManyToOne(() => Game)
	@JoinColumn({ name: 'game_id' })
		game?: Game;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
