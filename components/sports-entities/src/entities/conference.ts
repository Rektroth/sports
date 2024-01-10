import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import Division from './division';

@Entity({ name: 'conference' })
export default class Conference {
	@PrimaryColumn({ name: 'id', type: 'smallint' })
		id: number;

	@Column({ name: 'name', type: 'varchar', length: 28 })
		name: string;

	@OneToMany(() => Division, (division) => division.conference)
		divisions?: Division[];
}
