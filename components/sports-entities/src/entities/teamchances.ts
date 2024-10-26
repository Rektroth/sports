import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Team from './team';

@Entity({ name: 'team_chances' })
export default class TeamChances {
	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@PrimaryColumn({ name: 'season', type: 'smallint' })
		season: number;

	@PrimaryColumn({ name: 'week', type: 'smallint' })
		week: number;

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

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
