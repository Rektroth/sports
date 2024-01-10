import 'reflect-metadata';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import {
	Game,
	SimPlayoffChance,
	SportsDataSource,
	Team,
	TeamElo
} from '@rektroth/sports-entities';
import GameRoutes from './routes/games';
import TeamRoutes from './routes/teams';

dotenv.config();

const HOST = process.env.HOST ?? 'localhost';
const PORT = process.env.PORT ?? 3000;
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = isNaN(Number(process.env.DB_PORT)) ? 5432 : Number(process.env.db_port);
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';

const app = express();
app.use(helmet({
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			defaultSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'", "'unsafe-inline'"]
		}
	}
}));
app.use(compression());
app.use(cors({ origin: HOST, credentials: true }));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

const webDataSource = SportsDataSource(DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);

webDataSource.initialize().then(() => {
	console.log('Data source initialized!');

	const teamRepo = webDataSource.getRepository(Team);
	const gameRepo = webDataSource.getRepository(Game);
	const chanceRepo = webDataSource.getRepository(SimPlayoffChance);
	const eloRepo = webDataSource.getRepository(TeamElo);

	app.get('/', (req: Request, res: Response) => {
		res.redirect('/teams');
	});

	app.use('/games', GameRoutes(gameRepo, chanceRepo));
	app.use('/teams', TeamRoutes(teamRepo, chanceRepo, gameRepo, eloRepo));

	app.listen(PORT, () => {
		console.log(`Service listening on port ${PORT}`);
	});
}).catch((e) => {
	console.log(e);
});
