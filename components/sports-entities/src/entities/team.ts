import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import Division from './division';
import Game from './game';
import TeamChances from './teamchances';
import TeamChancesByGame from './teamchancesbygame';
import TeamElo from './teamelo';

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

	@OneToMany(() => TeamChancesByGame, (chance) => chance.team)
		chancesByGame?: TeamChancesByGame[];

	@OneToMany(() => TeamElo, (teamElo) => teamElo.team)
		eloScores?: TeamElo[];
	
	@OneToMany(() => TeamChances, (teamChances) => teamChances.team)
		chances?: TeamChances[];
}
