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

	@Column({ name: 'seed7', type: 'double precision' })
		seed7: number;

	@Column({ name: 'seed6', type: 'double precision' })
		seed6: number;

	@Column({ name: 'seed5', type: 'double precision' })
		seed5: number;

	@Column({ name: 'seed4', type: 'double precision' })
		seed4: number;

	@Column({ name: 'seed3', type: 'double precision' })
		seed3: number;

	@Column({ name: 'seed2', type: 'double precision' })
		seed2: number;

	@Column({ name: 'seed1', type: 'double precision' })
		seed1: number;

	@Column({ name: 'host_wc', type: 'double precision' })
		hostWildCard: number;

	@Column({ name: 'host_div', type: 'double precision' })
		hostDivision: number;

	@Column({ name: 'host_conf', type: 'double precision' })
		hostConference: number;

	@Column({ name: 'make_div', type: 'double precision' })
		makeDivision: number;

	@Column({ name: 'make_conf', type: 'double precision' })
		makeConference: number;

	@Column({ name: 'make_sb', type: 'double precision' })
		makeSuperBowl: number;

	@Column({ name: 'win_sb', type: 'double precision' })
		winSuperBowl: number;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
