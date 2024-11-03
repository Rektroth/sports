import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import path from 'path';
import {
	Game,
	TeamChancesByGame,
	SportsDataSource,
	Team,
	TeamElo
} from '@rektroth/sports-entities';
import GameRoutes from './routes/games';
import TeamRoutes from './routes/teams';

dotenv.config();

const HOST = process.env.HOST ?? 'localhost';
const PORT = process.env.PORT ?? 3080;
const SSL_PORT = process.env.SSL_PORT ?? 3443;
const DB_SCHEMA = 'nfl';
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = isNaN(Number(process.env.DB_PORT)) ? 5432 : Number(process.env.db_port);
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
const PRIVATE_KEY = process.env.SSL_KEY !== undefined ? fs.readFileSync(process.env.SSL_KEY) : null;
const CERTIFICATE = process.env.SSL_CERT !== undefined ? fs.readFileSync(process.env.SSL_CERT) : null;

const app = express();
app.use(helmet({
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			defaultSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"]
		}
	}
}));
app.use(compression());
app.use(cors({ origin: HOST, credentials: true }));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static('public'));

const nflDataSource = SportsDataSource(DB_SCHEMA, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);
nflDataSource.initialize().then(() => {
	console.log('Data source initialized!');

	const teamRepo = nflDataSource.getRepository(Team);
	const gameRepo = nflDataSource.getRepository(Game);
	const teamChancesByGameRepo = nflDataSource.getRepository(TeamChancesByGame);
	const eloRepo = nflDataSource.getRepository(TeamElo);

	app.get('/', (req: Request, res: Response) => {
		res.redirect('/teams');
	});

	app.use('/games', GameRoutes(gameRepo, teamChancesByGameRepo, eloRepo));
	app.use('/teams', TeamRoutes(teamRepo, teamChancesByGameRepo, gameRepo, eloRepo));
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.render('404');
	});

	if (PRIVATE_KEY !== null && CERTIFICATE !== null) {
		const httpApp = express();
		httpApp.all('*', (req, res) => { res.redirect(300, 'https://' + HOST); });
		const httpsServer = https.createServer({ key: PRIVATE_KEY, cert: CERTIFICATE }, app);
		httpsServer.listen({ port: SSL_PORT }, () => {
			console.log(`HTTPS service listening on port ${SSL_PORT}!`);
		});
	}
	
	const httpServer = http.createServer(app);
	httpServer.listen({ port: PORT }, () => {
		console.log(`HTTP service listening on port ${PORT}!`);
	});
}).catch((e: string) => {
	console.log(e);
});
