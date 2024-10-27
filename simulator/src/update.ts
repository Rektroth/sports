import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { IsNull, Not } from 'typeorm';
import { AVG_SCORE, equalize, Outcome, newElo } from '@rektroth/elo';
import {
	Game,
	SportsDataSource,
	Team,
	TeamElo,
	SeasonType
} from '@rektroth/sports-entities';

dotenv.config();

const SCOREBOARD_ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const SUMMARY_ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary';
const FIRST_SEASON = 2002;
const LAST_SEASON = isNaN(Number(process.env.CURRENT_SEASON)) ? 2023 : Number(process.env.CURRENT_SEASON);
const PRE_SEASON = 1;
const REGULAR_SEASON = 2;
const POST_SEASON = 3;
const HOME = 'home';
const AWAY = 'away';
const SCHEMA = 'nfl';
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = isNaN(Number(process.env.DB_PORT)) ? 5432 : Number(process.env.DB_PORT);
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';

const dataSource = SportsDataSource(SCHEMA, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);
const eloRepo = dataSource.getRepository(TeamElo);
const gameRepo = dataSource.getRepository(Game);
const teamRepo = dataSource.getRepository(Team);

async function main (): Promise<void> {
	try {
		await dataSource.initialize();
		console.log('Connection to database established...');
	} catch (e) {
		console.log(e);
	}

	await updateGames();
	await updateEloScores();
	process.exit();
}

async function updateGames (): Promise<void> {
	console.log(`Updating regular/post-season NFL game data for seasons ${FIRST_SEASON} to ${LAST_SEASON}...`);
	console.log();

	const games = [];

	for (let i = FIRST_SEASON; i <= LAST_SEASON + 1; i++) {
		console.log(`Getting ${i} games...`);
		const scoreboard = await (await fetch(SCOREBOARD_ENDPOINT + '?limit=500&dates=' + i))
			.json() as EspnScoreboard;
		const events = scoreboard.events;

		for (let j = 0; j < events.length; j++) {
			games.push(events[j]);
		}
	}

	const teamIds = (await teamRepo.find()).map(t => t.id);
	const existingGameIds = (await gameRepo.find()).map(g => Number(g.id));
	const existingUnplayedGameIds = (await gameRepo.findBy({ homeScore: IsNull() })).map((g) => Number(g.id));

	const completedGames = games.filter(g =>
		(g.season.type === PRE_SEASON || g.season.type === REGULAR_SEASON || g.season.type === POST_SEASON) &&
        g.season.year >= FIRST_SEASON && g.season.year <= LAST_SEASON && g.status.type.completed &&
        !!teamIds.includes(Number(g.competitions[0].competitors[0].id)) &&
        !!teamIds.includes(Number(g.competitions[0].competitors[1].id)));
	const unplayedGames = games.filter(g =>
		(g.season.type === PRE_SEASON || g.season.type === REGULAR_SEASON || g.season.type === POST_SEASON) &&
        g.season.year >= FIRST_SEASON && g.season.year <= LAST_SEASON && !g.status.type.completed &&
        !!teamIds.includes(Number(g.competitions[0].competitors[0].id)) &&
        !!teamIds.includes(Number(g.competitions[0].competitors[1].id)) &&
        (g.status.type.id === '1' || g.status.type.id === '2'));
	const gamesToDelete = games.filter(g =>
		g.status.type.id !== '1' && g.status.type.id !== '2' && g.status.type.id !== '3' && g.season.year !== LAST_SEASON);

	const completedGamesNeedUpdate = completedGames.filter((g) => existingUnplayedGameIds.includes(Number(g.id)));
	const completedGamesNeedInsert = completedGames.filter((g) => !existingGameIds.includes(Number(g.id)));
	const unplayedGamesNeedUpdate = unplayedGames.filter((g) => existingGameIds.includes(Number(g.id)));
	const unplayedGamesNeedInsert = unplayedGames.filter((g) => !existingGameIds.includes(Number(g.id)));

	for (let i = 0; i < completedGamesNeedUpdate.length; i++) {
		console.log(`Updating completed game ${i + 1} of ${completedGamesNeedUpdate.length}...`);

		const game = completedGamesNeedUpdate[i].competitions[0];

		const id = Number(game.id);
		const startDateTime = new Date(game.date);
		const homeTeamScore = Number(game.competitors.find((c) => c.homeAway === HOME)?.score);
		const awayTeamScore = Number(game.competitors.find((c) => c.homeAway === AWAY)?.score);

		if (isNaN(homeTeamScore) || isNaN(awayTeamScore)) {
			await gameRepo.save({
				id,
				startDateTime
			});
		} else {
			await gameRepo.save({
				id,
				homeTeamScore,
				awayTeamScore,
				startDateTime
			});
		}
	}

	for (let i = 0; i < completedGamesNeedInsert.length; i++) {
		console.log(`Inserting completed game ${i + 1} of ${completedGamesNeedInsert.length}...`);
		const game = completedGamesNeedInsert[i];
		const id = Number(game.id);
		const startDateTime = new Date(game.competitions[0].date);
		const neutralSite = game.competitions[0].neutralSite;
		const season = game.season.year;
		const week = game.week.number;
		const seasonType = game.season.type === PRE_SEASON
			? SeasonType.PRE
			: game.season.type === POST_SEASON
				? SeasonType.POST
				: SeasonType.REGULAR;
		const homeTeamId = Number(game.competitions[0].competitors.find(c => c.homeAway === HOME)?.id);
		const awayTeamId = Number(game.competitions[0].competitors.find(c => c.homeAway === AWAY)?.id);
		const homeScore = Number(game.competitions[0].competitors
			.find(c => c.homeAway === HOME)?.score);
		const awayScore = Number(game.competitions[0].competitors
			.find(c => c.homeAway === AWAY)?.score);

		await gameRepo.insert({
			id,
			season,
			startDateTime,
			homeTeamId,
			awayTeamId,
			homeScore,
			awayScore,
			seasonType,
			neutralSite,
			week
		});
	}

	for (let i = 0; i < unplayedGamesNeedUpdate.length; i++) {
		console.log(`Updating unplayed game ${i + 1} of ${unplayedGamesNeedUpdate.length}...`);
		const game = await (await fetch(SUMMARY_ENDPOINT + '?event=' + unplayedGamesNeedUpdate[i].id))
			.json() as EspnSummary;
		const id = Number(game.header.id);
		const startDateTime = new Date(game.header.competitions[0].date);
		const homePredictorChance = Number(game.predictor?.homeTeam.gameProjection) / 100;
		const awayPredictorChance = Number(game.predictor?.awayTeam.gameProjection) / 100;
		await gameRepo.save({ id, homePredictorChance, awayPredictorChance, startDateTime });
	}

	for (let i = 0; i < unplayedGamesNeedInsert.length; i++) {
		console.log(`Inserting unplayed game ${i + 1} of ${unplayedGamesNeedInsert.length}...`);
		const game = await (await fetch(SUMMARY_ENDPOINT + '?event=' + unplayedGamesNeedInsert[i].id))
			.json() as EspnSummary;
		const id = Number(game.header.id);
		const startDateTime = new Date(game.header.competitions[0].date);
		const neutralSite = game.header.competitions[0].neutralSite;
		const season = game.header.season.year;
		const week = game.header.week.number;
		const seasonType = game.header.season.type === PRE_SEASON
			? SeasonType.PRE
			: game.header.season.type === POST_SEASON
				? SeasonType.POST
				: SeasonType.REGULAR;
		const homeTeamId = Number(game.header.competitions[0].competitors.find((c) => c.homeAway === HOME)?.id);
		const awayTeamId = Number(game.header.competitions[0].competitors.find((c) => c.homeAway === AWAY)?.id);

		await gameRepo.insert({
			id,
			season,
			startDateTime,
			homeTeamId,
			awayTeamId,
			seasonType,
			neutralSite,
			week
		});
	}

	for (let i = 0; i < gamesToDelete.length; i++) {
		console.log(`Deleting game ${i + 1} of ${gamesToDelete.length}...`);
		await gameRepo.delete({ id: Number(gamesToDelete[i].id) });
	}

	console.log('Game data update completed!');
}

async function updateEloScores (): Promise<void> {
	const games = await gameRepo.find({
		where: {
			homeScore: Not(IsNull()),
			awayScore: Not(IsNull())
		},
		order: {
			startDateTime: 'ASC'
		}
	});

	console.log('Updating elo scores...');
	console.log();

	for (let i = 0; i < games.length; i++) {
		const game = games[i];
		const homeTeamElos = (await eloRepo.find({
			where: {
				teamId: game.homeTeamId
			},
			order: {
				date: 'DESC'
			},
			take: 1
		}));
		const awayTeamElos = (await eloRepo.find({
			where: {
				teamId: game.awayTeamId
			},
			order: {
				date: 'DESC'
			},
			take: 1
		}));

		let homeElo = AVG_SCORE;
		let awayElo = AVG_SCORE;
		let homeDaysSinceLastGame = 7;
		let awayDaysSinceLastGame = 7;

		if (homeTeamElos.length > 0) {
			if (homeTeamElos[0].date.getTime() >= game.startDateTime.getTime()) {
				continue;
			}

			homeElo = Number(homeTeamElos[0].eloScore);
			homeDaysSinceLastGame =
				(game.startDateTime.getTime() - homeTeamElos[0].date.getTime()) / 1000 / 60 / 60 / 24;

			if (homeDaysSinceLastGame > 90) {
				homeElo = equalize(homeElo);

				await eloRepo.insert({
					teamId: game.homeTeamId,
					date: new Date(game.startDateTime.getFullYear() + '-05-01T12:00:00'),
					eloScore: homeElo
				});
			}
		} else {
			await eloRepo.insert({
				teamId: game.homeTeamId,
				date: new Date(game.startDateTime.getFullYear() + '-05-01T12:00:00'),
				eloScore: AVG_SCORE
			});
		}

		if (awayTeamElos.length > 0) {
			if (awayTeamElos[0].date.getTime() >= game.startDateTime.getTime()) {
				continue;
			}

			awayElo = Number(awayTeamElos[0].eloScore);
			awayDaysSinceLastGame =
				(game.startDateTime.getTime() - awayTeamElos[0].date.getTime()) / 1000 / 60 / 60 / 24;

			if (awayDaysSinceLastGame > 90) {
				awayElo = equalize(awayElo);

				await eloRepo.insert({
					teamId: game.awayTeamId,
					date: new Date(game.startDateTime.getFullYear() + '-05-01T12:00:00'),
					eloScore: awayElo
				});
			}
		} else {
			await eloRepo.insert({
				teamId: game.awayTeamId,
				date: new Date(game.startDateTime.getFullYear() + '-05-01T12:00:00'),
				eloScore: AVG_SCORE
			});
		}

		const homeTeamOutcome = game.homeScore > game.awayScore
			? Outcome.WIN
			: game.homeScore < game.awayScore
				? Outcome.LOSS
				: Outcome.TIE;
		const awayTeamOutcome = game.homeScore < game.awayScore
			? Outcome.WIN
			: game.homeScore > game.awayScore
				? Outcome.LOSS
				: Outcome.TIE;

		const newHomeElo = newElo(
			homeElo,
			awayElo,
			!game.neutralSite,
			false,
			game.seasonType,
			homeDaysSinceLastGame,
			awayDaysSinceLastGame,
			homeTeamOutcome);
		const newAwayElo = newElo(
			awayElo,
			homeElo,
			false,
			!game.neutralSite,
			game.seasonType,
			awayDaysSinceLastGame,
			homeDaysSinceLastGame,
			awayTeamOutcome);

		await eloRepo.insert([{
			teamId: game.homeTeamId,
			date: game.startDateTime,
			eloScore: newHomeElo
		}, {
			teamId: game.awayTeamId,
			date: game.startDateTime,
			eloScore: newAwayElo
		}]);

		printProgress(String(((i + 1) / games.length) * 100));
	}
}

function printProgress (progress: string): void {
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);
	process.stdout.write(progress.substring(0, 5) + '%');
}

main();

class EspnScoreboard {
	events: EspnEvent[];
}

class EspnSummary {
	header: {
		id: string
		competitions: EspnCompetition[]
		season: EspnSeason,
		week: EspnWeek
	};

	predictor?: {
		homeTeam: {
			id: string
			gameProjection: string
		}
		awayTeam: {
			id: string
			gameProjection: string
		}
	};
}

class EspnEvent {
	id: string;
	date: string;
	season: EspnSeason;
	week: EspnWeek;
	competitions: EspnCompetition[];
	status: {
		type: {
			id: string
			completed: boolean
		}
	};
}

class EspnWeek {
	number: number;
}

class EspnSeason {
	year: number;
	type: number;
}

class EspnCompetition {
	id: string;
	competitors: EspnCompetitor[];
	date: string;
	neutralSite: boolean;
}

class EspnCompetitor {
	id: string;
	homeAway: string;
	score: string;
}
