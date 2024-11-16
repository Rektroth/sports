import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Team from './team';

@Entity({ name: 'team_chances' })
export default class TeamChances {
	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@PrimaryColumn({ name: 'season', type: 'smallint' })
		season: number;

	@Column({ name: 'min_seed7', type: 'double precision' })
		minimumSeed7: number;

	@Column({ name: 'min_seed6', type: 'double precision' })
		minimumSeed6: number;

	@Column({ name: 'min_seed5', type: 'double precision' })
		minimumSeed5: number;

	@Column({ name: 'min_seed4', type: 'double precision' })
		minimumSeed4: number;

	@Column({ name: 'min_seed3', type: 'double precision' })
		minimumSeed3: number;

	@Column({ name: 'min_seed2', type: 'double precision' })
		minimumSeed2: number;

	@Column({ name: 'min_seed1', type: 'double precision' })
		minimumSeed1: number;

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

	@Column({ name: 'host_wild_card_rnd', type: 'double precision' })
		hostWildCardRound: number;

	@Column({ name: 'host_div_rnd', type: 'double precision' })
		hostDivisionRound: number;

	@Column({ name: 'host_conf_rnd', type: 'double precision' })
		hostConferenceRound: number;

	@Column({ name: 'make_div_rnd', type: 'double precision' })
		makeDivisionRound: number;

	@Column({ name: 'make_conf_rnd', type: 'double precision' })
		makeConferenceRound: number;

	@Column({ name: 'make_super_bowl', type: 'double precision' })
		makeSuperBowl: number;

	@Column({ name: 'win_super_bowl', type: 'double precision' })
		winSuperBowl: number;

	@ManyToOne(() => Team)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
