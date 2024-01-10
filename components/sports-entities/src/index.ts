import { DataSource } from 'typeorm';
import Conference from './entities/conference';
import Division from './entities/division';
import Game from './entities/game';
import SimPlayoffChance from './entities/simchance';
import Team from './entities/team';
import TeamElo from './entities/teamelo';

export function SportsDataSource (
	host: string,
	port: number,
	username: string,
	password: string
): DataSource {
	return new DataSource({
		type: 'postgres',
		host,
		port,
		username,
		password,
		database: 'sports',
		entities: [
			Conference,
			Division,
			Team,
			Game,
			SimPlayoffChance,
			TeamElo
		],
		synchronize: false,
		logging: false
	});
};

export { default as Conference } from './entities/conference';
export { default as Division } from './entities/division';
export { default as Game, SeasonType } from './entities/game';
export { default as SimPlayoffChance } from './entities/simchance';
export { default as Team } from './entities/team';
export { default as TeamElo } from './entities/teamelo';
