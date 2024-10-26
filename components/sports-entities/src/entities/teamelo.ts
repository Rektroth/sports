import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Team from './team';

@Entity({ name: 'team_elo' })
export default class TeamElo {
	@PrimaryColumn({ name: 'team_id', type: 'smallint' })
		teamId: number;

	@PrimaryColumn({ name: 'date', type: 'timestamp' })
		date: Date;

	@Column({ name: 'elo_score', type: 'double precision' })
		eloScore: number;

	@ManyToOne(() => Team, (team) => team.eloScores)
	@JoinColumn({ name: 'team_id' })
		team?: Team;
}
