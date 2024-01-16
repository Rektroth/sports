import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import Division from './division';
import Game from './game';
import TeamElo from './teamelo';
import SimPlayoffChance from './simchance';

@Entity({ name: 'team' })
export default class Team {
	@PrimaryColumn({ name: 'id', type: 'smallint' })
		id: number;

	@Column({ name: 'abbreviation', type: 'varchar', length: 3 })
		abbreviation: string;

	@Column({ name: 'name', type: 'varchar', length: 21 })
		name: string;

	@Column({ name: 'division_id', type: 'smallint' })
		divisionId: number;

	@Column({ name: 'sim_playoff_chance', type: 'numeric', nullable: true })
		simPlayoffChance?: number;

	@Column({ name: 'sim_div_leader_chance', type: 'numeric', nullable: true })
		simDivLeaderChance?: number;

	@Column({ name: 'sim_conf_leader_chance', type: 'numeric', nullable: true })
		simConfLeaderChance?: number;

	@Column({ name: 'sim_make_div_chance', type: 'numeric', nullable: true })
		simMakeDivChance?: number;

	@Column({ name: 'sim_host_div_chance', type: 'numeric', nullable: true })
		simHostDivChance?: number;

	@Column({ name: 'sim_win_div_chance', type: 'numeric', nullable: true })
		simWinDivChance?: number;

	@Column({ name: 'sim_host_conf_chance', type: 'numeric', nullable: true })
		simHostConfChance?: number;

	@Column({ name: 'sim_win_conf_chance', type: 'numeric', nullable: true })
		simWinConfChance?: number;

	@Column({ name: 'sim_win_super_bowl_chance', type: 'numeric', nullable: true })
		simWinSuperBowlChance?: number;

	@Column({ name: 'color1', type: 'varchar', length: 7 })
		color1: string;

	@Column({ name: 'color2', type: 'varchar', length: 7 })
		color2: string;

	@ManyToOne(() => Division, (division) => division.teams)
	@JoinColumn({ name: 'division_id' })
		division?: Division;

	@OneToMany(() => Game, (game) => game.homeTeam)
		homeGames?: Game[];

	@OneToMany(() => Game, (game) => game.awayTeam)
		awayGames?: Game[];

	@OneToMany(() => SimPlayoffChance, (chance) => chance.team)
		simPlayoffChances?: SimPlayoffChance[];

	@OneToMany(() => TeamElo, (teamElo) => teamElo.team)
		eloScores?: TeamElo[];
}
