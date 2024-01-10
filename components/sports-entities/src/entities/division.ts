import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import Conference from './conference';
import Team from './team';

@Entity({ name: 'division' })
export default class Division {
	@PrimaryColumn({ name: 'id', type: 'smallint' })
		id: number;

	@Column({ name: 'conference_id', type: 'smallint' })
		conferenceId: number;

	@Column({ name: 'name', type: 'varchar', length: 9 })
		name: string;

	@ManyToOne(() => Conference)
	@JoinColumn({ name: 'conference_id' })
		conference?: Conference;

	@OneToMany(() => Team, (team) => team.division)
		teams?: Team[];
}
