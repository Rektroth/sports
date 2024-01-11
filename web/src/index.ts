import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
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
const PORT = process.env.PORT ?? 3080;
const SSL_PORT = process.env.SSL_PORT ?? 3443;
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

	if (PRIVATE_KEY !== null && CERTIFICATE !== null) {
		const httpApp = express();
		httpApp.all('*', (req, res) => res.redirect(300, 'https://' + HOST))
		const httpServer = http.createServer(httpApp);
		httpServer.listen({ port: PORT }, () => {
			console.log(`HTTP service listening on port ${PORT}!`);
		});

		const httpsServer = https.createServer({ key: PRIVATE_KEY, cert: CERTIFICATE }, app);
		httpsServer.listen({ port: SSL_PORT }, () => {
			console.log(`HTTPS service listening on port ${SSL_PORT}!`);
		});
	} else {
		const httpServer = http.createServer(app);
		httpServer.listen({ port: PORT }, () => {
		console.log(`HTTP service listening on port ${PORT}!`);
	});
	}
}).catch((e: string) => {
	console.log(e);
});
