import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import Team from './team';
import TeamChancesByGame from './teamchancesbygame';

export enum SeasonType {
	PRE = 'pre',
	REGULAR = 'regular',
	POST = 'post'
}

@Entity({ name: 'game' })
export default class Game {
	@PrimaryColumn({ name: 'id', type: 'int' })
		id: number;

	@Column({ name: 'season', type: 'smallint' })
		season: number;

	@Column({ name: 'start_date_time', type: 'timestamp' })
		startDateTime: Date;
	
	@Column({ name: 'week', type: 'smallint' })
		week: number;

	@Column({ name: 'home_team_id', type: 'smallint' })
		homeTeamId: number;

	@Column({ name: 'away_team_id', type: 'smallint' })
		awayTeamId: number;

	@Column({ name: 'home_score', type: 'smallint', nullable: true })
		homeScore: number;

	@Column({ name: 'away_score', type: 'smallint', nullable: true })
		awayScore: number;

	@Column({ name: 'season_type', type: 'enum', enum: SeasonType, default: SeasonType.REGULAR })
		seasonType: SeasonType;

	@Column({ name: 'neutral_site', type: 'boolean', default: false })
		neutralSite: boolean;

	@ManyToOne(() => Team, (team) => team.homeGames)
	@JoinColumn({ name: 'home_team_id' })
		homeTeam?: Team;

	@ManyToOne(() => Team, (team) => team.awayGames)
	@JoinColumn({ name: 'away_team_id' })
		awayTeam?: Team;

	@OneToMany(() => TeamChancesByGame, (chance) => chance.game)
		teamChances?: TeamChancesByGame[];
}
