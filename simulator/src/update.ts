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
import printProgress from './util/printprogress';

class EspnScoreboard {
	events: EspnEvent[];
}

class EspnEvent {
	id: string;
	date: string;
	season: EspnSeason;
	week: {
		number: number;
	};
	competitions: EspnCompetition[];
	shortName: string;
	status: {
		type: {
			id: string;
			completed: boolean;
		};
	};
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

dotenv.config();

const SCOREBOARD_ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
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

	console.log(`Updating regular/post-season NFL game data for seasons ${FIRST_SEASON} to ${LAST_SEASON}...`);

	let events: EspnEvent[] = [];
	const teamIds = (await teamRepo.find()).map(t => t.id);
	const existingGameIds = (await gameRepo.find()).map(g => Number(g.id));
	const existingUnplayedGameIds = (await gameRepo.findBy({ homeScore: IsNull() })).map((g) => Number(g.id));

	for (let i = FIRST_SEASON; i <= LAST_SEASON + 1; i++) {
		console.log(`Getting games from ${i} season...`);

		const scoreboard = await (await fetch(SCOREBOARD_ENDPOINT + '?limit=500&dates=' + i)).json() as EspnScoreboard;
		events = events.concat(scoreboard.events);
	}

	const completedGames = events.filter(e =>
		(e.season.type === PRE_SEASON || e.season.type === REGULAR_SEASON || e.season.type === POST_SEASON) &&
        e.season.year >= FIRST_SEASON && e.season.year <= LAST_SEASON && e.status.type.completed &&
        !!teamIds.includes(Number(e.competitions[0].competitors[0].id)) &&
        !!teamIds.includes(Number(e.competitions[0].competitors[1].id)));
	const unplayedGames = events.filter(e =>
		(e.season.type === PRE_SEASON || e.season.type === REGULAR_SEASON || e.season.type === POST_SEASON) &&
        e.season.year >= FIRST_SEASON && e.season.year <= LAST_SEASON && !e.status.type.completed &&
        !!teamIds.includes(Number(e.competitions[0].competitors[0].id)) &&
        !!teamIds.includes(Number(e.competitions[0].competitors[1].id)) &&
        (e.status.type.id === '1' || e.status.type.id === '2'));
	const invalidGames = events.filter(e =>
		e.status.type.id !== '1' && e.status.type.id !== '2' && e.status.type.id !== '3' && e.season.year !== LAST_SEASON);
	
	const recentlyCompletedGames = completedGames.filter((g) => existingUnplayedGameIds.includes(Number(g.id)));
	const newCompletedGames = completedGames.filter((g) => !existingGameIds.includes(Number(g.id)));
	const unfinishedGames = unplayedGames.filter((g) => existingGameIds.includes(Number(g.id)));
	const newUnfinishedGames = unplayedGames.filter((g) => !existingGameIds.includes(Number(g.id)));

	// update games that recently completed
	for (let i = 0; i < recentlyCompletedGames.length; i++) {
		const game = recentlyCompletedGames[i];
		const shortName = game.shortName;

		const competition = game.competitions[0];
		const id = Number(competition.id);
		const startDateTime = new Date(competition.date);
		const homeScore = Number(competition.competitors.find((c) => c.homeAway === HOME)?.score);
		const awayScore = Number(competition.competitors.find((c) => c.homeAway === AWAY)?.score);

		console.log(`Updating ${shortName}, ${startDateTime.getFullYear()} (COMPLETED)...`);

		if (isNaN(homeScore) || isNaN(awayScore)) {
			await gameRepo.save({
				id,
				startDateTime
			});
		} else {
			await gameRepo.save({
				id,
				homeScore,
				awayScore,
				startDateTime
			});
		}
	}

	// insert new completed games
	for (let i = 0; i < newCompletedGames.length; i++) {
		const game = newCompletedGames[i];
		const season = game.season.year;
		const week = game.week?.number ?? 0;
		const shortName = game.shortName;
		const seasonType = game.season.type === PRE_SEASON
			? SeasonType.PRE
			: game.season.type === POST_SEASON
				? SeasonType.POST
				: SeasonType.REGULAR;

		const competition = game.competitions[0];
		const id = Number(competition.id);
		const startDateTime = new Date(competition.date);
		const neutralSite = competition.neutralSite;
		const homeTeamId = Number(competition.competitors.find(c => c.homeAway === HOME)?.id);
		const awayTeamId = Number(competition.competitors.find(c => c.homeAway === AWAY)?.id);
		const homeScore = Number(competition.competitors.find(c => c.homeAway === HOME)?.score);
		const awayScore = Number(competition.competitors.find(c => c.homeAway === AWAY)?.score);

		console.log(`Inserting ${shortName}, ${startDateTime.getFullYear()} (COMPLETED)...`);

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

	// update unplayed games
	for (let i = 0; i < unfinishedGames.length; i++) {
		const game = unfinishedGames[i];
		const shortName = game.shortName;

		const competition = game.competitions[0];
		const id = Number(competition.id);
		const startDateTime = new Date(competition.date);

		console.log(`Updating ${shortName}, ${startDateTime.getFullYear()}...`);

		await gameRepo.save({ id, startDateTime });
	}

	// insert new unplayed games
	for (let i = 0; i < newUnfinishedGames.length; i++) {
		const game = newUnfinishedGames[i];
		const shortName = game.shortName;

		const competition = game.competitions[0];
		const id = Number(competition.id);
		const startDateTime = new Date(competition.date);
		const neutralSite = competition.neutralSite;
		const season = game.season.year;
		const week = game.week?.number ?? 0;
		const seasonType = game.season.type === PRE_SEASON
			? SeasonType.PRE
			: game.season.type === POST_SEASON
				? SeasonType.POST
				: SeasonType.REGULAR;
		const homeTeamId = Number(game.competitions[0].competitors.find((c) => c.homeAway === HOME)?.id);
		const awayTeamId = Number(game.competitions[0].competitors.find((c) => c.homeAway === AWAY)?.id);

		console.log(`Inserting ${shortName}, ${startDateTime.getFullYear()}...`);

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

	// delete invalid games
	for (let i = 0; i < invalidGames.length; i++) {
		const game = invalidGames[i];
		const id = Number(game.id);
		const shortName = game.shortName;
		const date = new Date(game.date);

		console.log(`Deleting ${shortName}, ${date.getFullYear()}...`);

		await gameRepo.delete({ id });
	}

	console.log('Game data update completed!');
	console.log('Updating elo scores...');

	const games = await gameRepo.find({
		where: {
			homeScore: Not(IsNull()),
			awayScore: Not(IsNull())
		},
		order: {
			startDateTime: 'ASC'
		}
	});

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

	process.exit();
}

main();
