import { DataSource } from 'typeorm';
import Conference from './entities/conference';
import Division from './entities/division';
import Game from './entities/game';
import Team from './entities/team';
import TeamChances from './entities/teamchances';
import TeamChancesByGame from './entities/teamchancesbygame';
import TeamElo from './entities/teamelo';

export function SportsDataSource (
	schema: string,
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
		schema,
		entities: [
			Conference,
			Division,
			Team,
			Game,
			TeamChancesByGame,
			TeamElo,
			TeamChances
		],
		synchronize: false,
		logging: false
	});
};

export { default as Conference } from './entities/conference';
export { default as Division } from './entities/division';
export { default as Game, SeasonType } from './entities/game';
export { default as Team } from './entities/team';
export { default as TeamChances } from './entities/teamchances';
export { default as TeamChancesByGame } from './entities/teamchancesbygame';
export { default as TeamElo } from './entities/teamelo';
