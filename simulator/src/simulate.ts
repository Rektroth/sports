import 'reflect-metadata';
import dotenv from 'dotenv';
import { IsNull, LessThan, MoreThan, Or } from 'typeorm';
import { chance, newElo, Outcome } from '@rektroth/elo';
import {
	SportsDataSource,
	Conference,
	Division,
	Team,
	Game,
	TeamChances,
	TeamChancesByGame,
	SeasonType
} from '@rektroth/sports-entities';
import SimTeam from './util/simteam';
import nflSort from './util/nflsort';

dotenv.config();

const CURRENT_SEASON = isNaN(Number(process.env.CURRENT_SEASON)) ? 2023 : Number(process.env.CURRENT_SEASON);
const SIMS = isNaN(Number(process.env.TOTAL_SIMS)) ? 32768 : Number(process.env.TOTAL_SIMS);
const SCHEMA = 'nfl';
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = isNaN(Number(process.env.DB_PORT)) ? 5432 : Number(process.env.DB_PORT);
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
const SUPER_BOWL_HOST = process.env.SUPER_BOWL_HOST ?? 1;
const CONFIDENCE_INTERVAL = isNaN(Number(process.env.CONFIDENCE_INTERVAL)) ? 2.576 : Number(process.env.CONFIDENCE_INTERVAL);

const simDataSource = SportsDataSource(SCHEMA, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);
const conferenceRepo = simDataSource.getRepository(Conference);
const divisionRepo = simDataSource.getRepository(Division);
const teamRepo = simDataSource.getRepository(Team);
const gameRepo = simDataSource.getRepository(Game);
const teamChancesRepo = simDataSource.getRepository(TeamChances);
const teamChancesByGameRepo = simDataSource.getRepository(TeamChancesByGame);

var teamAppearances: TeamAppearances[];
const simGames: GameObj[] = [];
const simSeed7s: AppearanceObj[] = [];
const simSeed6s: AppearanceObj[] = [];
const simSeed5s: AppearanceObj[] = [];
const simSeed4s: AppearanceObj[] = [];
const simSeed3s: AppearanceObj[] = [];
const simSeed2s: AppearanceObj[] = [];
const simSeed1s: AppearanceObj[] = [];
const simWcHosts: AppearanceObj[] = [];
const simDivHosts: AppearanceObj[] = [];
const simConfHosts: AppearanceObj[] = [];
const simDivQualifiers: AppearanceObj[] = [];
const simConfQualifiers: AppearanceObj[] = [];
const simSuperBowlQualifiers: AppearanceObj[] = [];
const simSuperBowlWinners: AppearanceObj[] = [];

main();

export default async function main (): Promise<void> {
	try {
		await simDataSource.initialize();
		console.log('Connection to database established...');
	} catch (e) {
		console.log(e);
	}

	console.log('Deleting existing simulations...');

	const games = await gameRepo.findBy({
		season: CURRENT_SEASON
	});

	console.log(`Simulating ${SIMS} seasons...`);

	let teams = await teamRepo.find({
		relations: {
			division: true,
			eloScores: true
		},
		where: {
			eloScores: {
				date: MoreThan(new Date(CURRENT_SEASON + '-01-01'))
			}
		},
		order: {
			eloScores: {
				date: 'DESC'
			}
		}
	});

	teamAppearances = teams.map(t => new TeamAppearances(t.id));

	const divisions = await divisionRepo.find();
	const conferences = await conferenceRepo.find();

	for (let i = 0; i < SIMS; i++) {
		await simulate(games, teams, divisions, conferences, i);
		printProgress(String(((i + 1) / SIMS) * 100));
	}

	console.log();
	console.log('Analyzing teams...');

	const lastGameWeek = games
		.filter(g => g.homeScore !== null)
		.sort((a, b) => {
			if (a.startDateTime < b.startDateTime) {
				return 1;
			} else if (a.startDateTime > b.startDateTime) {
				return -1;
			}

			return 0;
		})[0]
		.week;

	for (let i = 0; i < teams.length; i++) {
		await analyzeTeam(teams[i], games, lastGameWeek);
		printProgress(String(((i + 1) / teams.length) * 100));
	}

	console.log();
	console.log('Analyzing games...');
	teams = await teamRepo.find({
		relations: {
			chances: true
		},
		where: {
			chances: {
				season: CURRENT_SEASON,
				week: lastGameWeek
			}
		}
	});

	const nextGameDate = games.filter(g => g.homeScore === null)[0].startDateTime;
	const nextGameDay = nextGameDate.getDay();
	const adj = nextGameDay > 3 ? 10 - nextGameDay : 3 - nextGameDay;
	nextGameDate.setDate(nextGameDate.getDate() + adj);
	nextGameDate.setHours(8);

	const soonGames = await gameRepo.find({
		where: {
			homeScore: IsNull(),
			startDateTime: LessThan(nextGameDate)
		},
		order: {
			startDateTime: 'ASC'
		}
	});

	for (let i = 0; i < soonGames.length; i++) {
		// await analyzeGame(teams, soonGames[i]);
		printProgress(String(((i + 1) / soonGames.length) * 100));
	}

	console.log();
	process.exit();
}

async function simulate (
	games: Game[],
	teamEntities: Team[],
	divisions: Division[],
	conferences: Conference[],
	sim: number
): Promise<void> {
	games = games.sort((a, b) => a.startDateTime > b.startDateTime ? 1 : a.startDateTime < b.startDateTime ? -1 : 0);
	const preSeasonGames = games.filter(g => g.seasonType === SeasonType.PRE);
	const regSeasonGames = games.filter(g => g.seasonType === SeasonType.REGULAR);
	const postSeasonGames = games.filter(g => g.seasonType === SeasonType.POST);
	const teams = teamEntities.map(t => new SimTeam(t));

	for (let i = 0; i < preSeasonGames.length; i++) {
		const game = preSeasonGames[i];
		let winnerId = null;

		if (game.homeScore == null) {
			const homeTeam = teams.find(t => t.id === game.homeTeamId);
			const awayTeam = teams.find(t => t.id === game.awayTeamId);
			const homeLastGame = homeTeam?.lastGame ?? null;
			const awayLastGame = awayTeam?.lastGame ?? null;
			let homeBreak = homeLastGame !== null
				? (game.startDateTime.getTime() - homeLastGame.getTime()) / 1000 / 60 / 60 / 24
				: 7;
			let awayBreak = awayLastGame !== null
				? (game.startDateTime.getTime() - awayLastGame.getTime()) / 1000 / 60 / 60 / 24
				: 7;
			homeBreak = homeBreak < 20 ? homeBreak : 7;
			awayBreak = awayBreak < 20 ? awayBreak : 7;
			const homeElo = homeTeam?.elo ?? 1500;
			const awayElo = awayTeam?.elo ?? 1500;
			const homeTeamChance = chance(
				homeElo,
				awayElo,
				!game.neutralSite,
				false,
				game.seasonType,
				homeBreak,
				awayBreak);
			const awayTeamChance = chance(
				awayElo,
				homeElo,
				false,
				!game.neutralSite,
				game.seasonType,
				awayBreak,
				homeBreak);
			const added =  Number(homeTeamChance) + Number(awayTeamChance);
			const r = Math.random();

			if (r < homeTeamChance) {
				winnerId = game.homeTeamId;
				
				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.WIN);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.LOSS);
				}
			} else if (r < added) {
				winnerId = game.awayTeamId;
				
				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.LOSS);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.WIN);
				}
			} else {
				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.TIE);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.TIE);
				}
			}

			if (homeTeam !== undefined) {
				homeTeam.lastGame = game.startDateTime;
			}

			if (awayTeam !== undefined) {
				awayTeam.lastGame = game.startDateTime;
			}
		}

		simGames.push({
			gameId: game.id,
			simSeasonId: sim,
			winningTeamId: winnerId ?? undefined
		});
	}

	for (let i = 0; i < regSeasonGames.length; i++) {
		const game = regSeasonGames[i];
		let winnerId = null;

		if (game.homeScore != null) {
			if (game.homeScore > game.awayScore) {
				winnerId = game.homeTeamId;
				teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
				teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
			} else if (game.homeScore < game.awayScore) {
				winnerId = game.awayTeamId;
				teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
				teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
			} else {
				teams.find(t => t.id === game.homeTeamId)?.tieGame(game.awayTeamId);
				teams.find(t => t.id === game.awayTeamId)?.tieGame(game.homeTeamId);
			}
		} else {
			const homeTeam = teams.find(t => t.id === game.homeTeamId);
			const awayTeam = teams.find(t => t.id === game.awayTeamId);
			const homeLastGame = homeTeam?.lastGame ?? null;
			const awayLastGame = awayTeam?.lastGame ?? null;
			let homeBreak = homeLastGame !== null
				? (game.startDateTime.getTime() - homeLastGame.getTime()) / 1000 / 60 / 60 / 24
				: 7;
			let awayBreak = awayLastGame !== null
				? (game.startDateTime.getTime() - awayLastGame.getTime()) / 1000 / 60 / 60 / 24
				: 7;
			homeBreak = homeBreak < 20 ? homeBreak : 7;
			awayBreak = awayBreak < 20 ? awayBreak : 7;
			const homeElo = homeTeam?.elo ?? 1500;
			const awayElo = awayTeam?.elo ?? 1500;
			const homeTeamChance = chance(
				homeElo,
				awayElo,
				!game.neutralSite,
				false,
				game.seasonType,
				homeBreak,
				awayBreak);
			const awayTeamChance = chance(
				awayElo,
				homeElo,
				false,
				!game.neutralSite,
				game.seasonType,
				awayBreak,
				homeBreak);
			const added: number = Number(homeTeamChance) + Number(awayTeamChance);
			const r = Math.random();

			if (r < homeTeamChance) {
				winnerId = game.homeTeamId;
				homeTeam?.winGame(game.awayTeamId);
				awayTeam?.loseGame(game.homeTeamId);

				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.WIN);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.LOSS);
				}
			} else if (r < added) {
				winnerId = game.awayTeamId;
				homeTeam?.loseGame(game.awayTeamId);
				awayTeam?.winGame(game.homeTeamId);

				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.LOSS);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.WIN);
				}
			} else {
				homeTeam?.tieGame(game.awayTeamId);
				awayTeam?.tieGame(game.homeTeamId);

				if (homeTeam !== undefined) {
					homeTeam.elo = newElo(
						homeTeam.elo,
						awayTeam?.elo ?? 1500,
						!game.neutralSite,
						false,
						game.seasonType,
						homeBreak,
						awayBreak,
						Outcome.TIE);
				}

				if (awayTeam !== undefined) {
					awayTeam.elo = newElo(
						awayTeam.elo,
						homeTeam?.elo ?? 1500,
						false,
						!game.neutralSite,
						game.seasonType,
						awayBreak,
						homeBreak,
						Outcome.TIE);
				}
			}

			if (homeTeam !== undefined) {
				homeTeam.lastGame = game.startDateTime;
			}

			if (awayTeam !== undefined) {
				awayTeam.lastGame = game.startDateTime;
			}
		}

		simGames.push({
			gameId: game.id,
			simSeasonId: sim,
			winningTeamId: winnerId ?? undefined
		});
	}

	for (let i = 0; i < conferences.length; i++) {
		let confTeams = teams.filter(t => t.conferenceId === conferences[i].id);
		confTeams = nflSort(confTeams, divisions.filter(d => d.conferenceId === conferences[i].id).map(d => d.id));
		
		for (let j = 0; j <= 6; j++) {
			const appearance = teamAppearances.find(ta => ta.id === confTeams[j].id);

			if (appearance === undefined) {
				continue;
			}

			if (j < 1) {
				appearance.numSeed1++;
			}

			if (j < 2) {
				appearance.numSeed2++;
			}

			if (j < 3) {
				appearance.numSeed3++;
			}

			if (j < 4) {
				appearance.numSeed4++;
			}

			if (j < 5) {
				appearance.numSeed5++;
			}

			if (j < 6) {
				appearance.numSeed6++;
			}

			appearance.numSeed7++;
		}

		for (let i = 0; i < confTeams.length; i++) {
			confTeams[i].seed = i + 1;
		}
	}

	let wcWinners: SimTeam[] = [];
	let divWinners: SimTeam[] = [];
	let confWinners: SimTeam[] = [];
	let superBowlWinner: SimTeam | undefined;

	for (let i = 0; i < postSeasonGames.length; i++) {
		const game = postSeasonGames[i];
		const homeTeam = teams.find(t => t.id === game.homeTeamId);
		const awayTeam = teams.find(t => t.id === game.awayTeamId);
		let winner;

		if (i < 6 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					winner = homeTeam;
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
				} else {
					winner = awayTeam;
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
				}
			} else {
				winner = await simulatePlayoffGame(homeTeam, awayTeam, false, false);
			}

			wcWinners = wcWinners.concat(winner);
		} else if (i < 10 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					winner = homeTeam;
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
				} else {
					winner = awayTeam;
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
				}
			} else {
				winner = await simulatePlayoffGame(homeTeam, awayTeam, false, false);
			}

			divWinners = divWinners.concat(winner);
		} else if (i < 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					winner = homeTeam;
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
				} else {
					winner = awayTeam;
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
				}
			} else {
				winner = await simulatePlayoffGame(homeTeam, awayTeam, false, false);
			}

			confWinners = confWinners.concat(winner);
		} else if (i === 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					superBowlWinner = homeTeam;
					winner = homeTeam;
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
				} else {
					superBowlWinner = awayTeam;
					winner = awayTeam;
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
				}
			} else {
				superBowlWinner = await simulatePlayoffGame(homeTeam, awayTeam, false, false);
				winner = superBowlWinner;
			}
		}

		simGames.push({
			gameId: game.id,
			simSeasonId: sim,
			winningTeamId: winner?.id ?? undefined
		});
	}

	for (let i = 0; i < conferences.length; i++) {
		const confTeams = teams
			.filter(t => t.conferenceId === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);
		
		for (let j = 1; j <= 3; j++) {
			const appearance = teamAppearances.find(ta => ta.id === confTeams[j].id);
	
			if (appearance !== undefined) {
				appearance.numHostWc++;
			}
		}

		const wcGame1 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[1].id && g.awayTeamId === confTeams[6].id);
		const wcGame2 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[2].id && g.awayTeamId === confTeams[5].id);
		const wcGame3 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[3].id && g.awayTeamId === confTeams[4].id);

		if (wcGame1 === undefined) {
			const winner = await simulatePlayoffGame(confTeams[1], confTeams[6], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		if (wcGame2 === undefined) {
			const winner = await simulatePlayoffGame(confTeams[2], confTeams[5], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		if (wcGame3 === undefined) {
			const winner = await simulatePlayoffGame(confTeams[3], confTeams[4], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		const confWcWinners = wcWinners
			.filter(t => t.conferenceId === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);
		
		for (let j = 0; j <= 2; j++) {
			const appearance = teamAppearances.find(ta => ta.id === confWcWinners[j].id);
		
			if (appearance !== undefined) {
				appearance.numMakeDiv++;

				if (j === 0) {
					appearance.numHostDiv++;
				}
			}
		}

		const appearance = teamAppearances.find(ta => ta.id === confTeams[0].id);

		if (appearance !== undefined) {
			appearance.numMakeDiv++;
			appearance.numHostDiv++;
		}

		const divGame1 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[0].id && g.awayTeamId === confWcWinners[2].id);
		const divGame2 = postSeasonGames.find(g =>
			g.homeTeamId === confWcWinners[0].id && g.awayTeamId === confWcWinners[1].id);

		if (divGame1 === undefined) {
			const winner = await simulatePlayoffGame(confTeams[0], confWcWinners[2], false, false);
			divWinners = divWinners.concat(winner);
		}

		if (divGame2 === undefined) {
			const winner = await simulatePlayoffGame(confWcWinners[0], confWcWinners[1], false, false);
			divWinners = divWinners.concat(winner);
		}

		const confDivWinners = divWinners
			.filter(t => t.conferenceId === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);

		for (let j = 0; j <= 1; j++) {
			const appearance = teamAppearances.find(ta => ta.id === confDivWinners[j].id);

			if (appearance !== undefined) {
				appearance.numMakeConf++;

				if (j === 0) {
					appearance.numHostConf++;
				}
			}
		}

		const confGame = postSeasonGames.find(g =>
			g.homeTeamId === confDivWinners[0].id && g.awayTeamId === confDivWinners[1].id);

		if (confGame === undefined) {
			const winner = await simulatePlayoffGame(confDivWinners[0], confDivWinners[1], false, false);
			confWinners = confWinners.concat(winner);

			const appearance = teamAppearances.find(ta => ta.id === winner.id);

			if (appearance !== undefined) {
				appearance.numMakeSb++;
			}
		}
	}

	if (superBowlWinner === undefined || superBowlWinner === null) {
		if (confWinners[0].id === SUPER_BOWL_HOST) {
			superBowlWinner = await simulatePlayoffGame(confWinners[1], confWinners[0], false, false);
		} else if (confWinners[1].id === SUPER_BOWL_HOST) {
			superBowlWinner = await simulatePlayoffGame(confWinners[0], confWinners[1], false, false);
		} else {
			superBowlWinner = await simulatePlayoffGame(confWinners[0], confWinners[1], true, false);
		}
	}

	const appearance = teamAppearances.find(ta => ta.id === superBowlWinner.id);

	if (appearance !== undefined) {
		appearance.numWinSb++;
	}
}

async function simulatePlayoffGame (
	homeTeam: SimTeam,
	awayTeam: SimTeam,
	neutralSite: boolean,
	homeHadBye: boolean
): Promise<SimTeam> {
	const homeElo = homeTeam.elo;
	const awayElo = awayTeam.elo;
	const homeTeamChance = chance(homeElo, awayElo, !neutralSite, false, SeasonType.POST, homeHadBye ? 14 : 7, 7);
	const r = Math.random();

	if (r < homeTeamChance) {
		if (homeTeam !== undefined) {
			homeTeam.elo = newElo(
				homeTeam.elo,
				awayTeam?.elo ?? 1500,
				!neutralSite,
				false,
				SeasonType.POST,
				homeHadBye ? 14 : 7,
				7,
				Outcome.WIN);
		}

		if (awayTeam !== undefined) {
			awayTeam.elo = newElo(
				awayTeam.elo,
				homeTeam?.elo ?? 1500,
				false,
				!neutralSite,
				SeasonType.POST,
				7,
				homeHadBye ? 14 : 7,
				Outcome.LOSS);
		}

		return homeTeam;
	}

	if (homeTeam !== undefined) {
		homeTeam.elo = newElo(
			homeTeam.elo,
			awayTeam?.elo ?? 1500,
			!neutralSite,
			false,
			SeasonType.POST,
			homeHadBye ? 14 : 7,
			7,
			Outcome.LOSS);
	}

	if (awayTeam !== undefined) {
		awayTeam.elo = newElo(
			awayTeam.elo,
			homeTeam?.elo ?? 1500,
			false,
			!neutralSite,
			SeasonType.POST,
			7,
			homeHadBye ? 14 : 7,
			Outcome.WIN);
	}

	return awayTeam;
}

async function analyzeGame (teams: Team[], game: Game): Promise<void> {
	const gameId = game.id;
	const homeTeamId = game.homeTeamId;
	const awayTeamId = game.awayTeamId;
	const homeWins = simGames.filter(g => g.gameId === gameId && g.winningTeamId === homeTeamId);
	const awayWins = simGames.filter(g => g.gameId === gameId && g.winningTeamId === awayTeamId);
	const homeWinSeasonIds = new Set(homeWins.map(g => g.simSeasonId));
	const awayWinSeasonIds = new Set(awayWins.map(g => g.simSeasonId));
	const numHomeWins = homeWins.length;
	const numAwayWins = awayWins.length;

	for (let i = 0; i < teams.length; i++) {
		const numHomeSeed7 = simSeed7s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed7 = simSeed7s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed7Chance = numHomeSeed7 / numHomeWins;
		let awaySeed7Chance = numAwaySeed7 / numAwayWins;

		if (Math.abs(homeSeed7Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed7Chance, numHomeWins)) {
			homeSeed7Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed7Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed7Chance, numAwayWins)) {
			awaySeed7Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed6 = simSeed6s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed6 = simSeed6s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed6Chance = numHomeSeed6 / numHomeWins;
		let awaySeed6Chance = numAwaySeed6 / numAwayWins;

		if (Math.abs(homeSeed6Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed6Chance, numHomeWins)) {
			homeSeed6Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed6Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed6Chance, numAwayWins)) {
			awaySeed6Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed5 = simSeed5s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed5 = simSeed5s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed5Chance = numHomeSeed5 / numHomeWins;
		let awaySeed5Chance = numAwaySeed5 / numAwayWins;

		if (Math.abs(homeSeed5Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed5Chance, numHomeWins)) {
			homeSeed5Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed5Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed5Chance, numAwayWins)) {
			awaySeed5Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed4 = simSeed4s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed4 = simSeed4s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed4Chance = numHomeSeed4 / numHomeWins;
		let awaySeed4Chance = numAwaySeed4 / numAwayWins;

		if (Math.abs(homeSeed4Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed4Chance, numHomeWins)) {
			homeSeed4Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed4Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed4Chance, numAwayWins)) {
			awaySeed4Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed3 = simSeed3s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed3 = simSeed3s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed3Chance = numHomeSeed3 / numHomeWins;
		let awaySeed3Chance = numAwaySeed3 / numAwayWins;

		if (Math.abs(homeSeed3Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed3Chance, numHomeWins)) {
			homeSeed3Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed3Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed3Chance, numAwayWins)) {
			awaySeed3Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed2 = simSeed2s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed2 = simSeed2s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed2Chance = numHomeSeed2 / numHomeWins;
		let awaySeed2Chance = numAwaySeed2 / numAwayWins;

		if (Math.abs(homeSeed2Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed2Chance, numHomeWins)) {
			homeSeed2Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed2Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed2Chance, numAwayWins)) {
			awaySeed2Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeSeed1 = simSeed1s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwaySeed1 = simSeed1s
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeSeed1Chance = numHomeSeed1 / numHomeWins;
		let awaySeed1Chance = numAwaySeed1 / numAwayWins;

		if (Math.abs(homeSeed1Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(homeSeed1Chance, numHomeWins)) {
			homeSeed1Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		if (Math.abs(awaySeed1Chance - (teams[i].chances?.at(0)?.seed7 ?? 1)) < marginOfError(awaySeed1Chance, numAwayWins)) {
			awaySeed1Chance = teams[i].chances?.at(0)?.seed7 ?? 0;
		}

		const numHomeMakeDiv = simDivQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayMakeDiv = simDivQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeMakeDivChance = numHomeMakeDiv / numHomeWins;
		let awayMakeDivChance = numAwayMakeDiv / numAwayWins;
		
		if (Math.abs(homeMakeDivChance - (teams[i].chances?.at(0)?.makeDivision ?? 1)) < marginOfError(homeMakeDivChance, numAwayWins)) {
			homeMakeDivChance = teams[i].chances?.at(0)?.makeDivision ?? 0;
		}
		
		if (Math.abs(awayMakeDivChance - (teams[i].chances?.at(0)?.makeDivision ?? 1)) < marginOfError(awayMakeDivChance, numHomeWins)) {
			awayMakeDivChance = teams[i].chances?.at(0)?.makeDivision ?? 0;
		}

		const numHomeMakeConf = simConfQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayMakeConf = simConfQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeMakeConfChance = numHomeMakeConf / numHomeWins;
		let awayMakeConfChance = numAwayMakeConf / numAwayWins;
		
		if (Math.abs(homeMakeConfChance - (teams[i].chances?.at(0)?.makeConference ?? 1)) < marginOfError(homeMakeConfChance, numAwayWins)) {
			homeMakeConfChance = teams[i].chances?.at(0)?.makeConference ?? 0;
		}
		
		if (Math.abs(awayMakeConfChance - (teams[i].chances?.at(0)?.makeConference ?? 1)) < marginOfError(awayMakeConfChance, numHomeWins)) {
			awayMakeConfChance = teams[i].chances?.at(0)?.makeConference ?? 0;
		}

		const numHomeMakeSb = simSuperBowlQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayMakeSb = simSuperBowlQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeMakeSbChance = numHomeMakeSb / numHomeWins;
		let awayMakeSbChance = numAwayMakeSb / numAwayWins;
		
		if (Math.abs(homeMakeSbChance - (teams[i].chances?.at(0)?.makeSuperBowl ?? 1)) < marginOfError(homeMakeSbChance, numAwayWins)) {
			homeMakeSbChance = teams[i].chances?.at(0)?.makeSuperBowl ?? 0;
		}
		
		if (Math.abs(awayMakeSbChance - (teams[i].chances?.at(0)?.makeSuperBowl ?? 1)) < marginOfError(awayMakeSbChance, numHomeWins)) {
			awayMakeSbChance = teams[i].chances?.at(0)?.makeSuperBowl ?? 0;
		}

		const numHomeWinSb = simSuperBowlWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayWinSb = simSuperBowlWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeWinSbChance = numHomeWinSb / numHomeWins;
		let awayWinSbChance = numAwayWinSb / numAwayWins;
		
		if (Math.abs(homeWinSbChance - (teams[i].chances?.at(0)?.winSuperBowl ?? 1)) < marginOfError(homeWinSbChance, numAwayWins)) {
			homeWinSbChance = teams[i].chances?.at(0)?.winSuperBowl ?? 0;
		}
		
		if (Math.abs(awayWinSbChance - (teams[i].chances?.at(0)?.winSuperBowl ?? 1)) < marginOfError(awayWinSbChance, numHomeWins)) {
			awayWinSbChance = teams[i].chances?.at(0)?.winSuperBowl ?? 0;
		}

		const numHomeHostWc = simWcHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayHostWc = simWcHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeHostWcChance = numHomeHostWc / numHomeWins;
		let awayHostWcChance = numAwayHostWc / numAwayWins;
		
		if (Math.abs(homeHostWcChance - (teams[i].chances?.at(0)?.hostWildCard ?? 1)) < marginOfError(homeHostWcChance, numAwayWins)) {
			homeHostWcChance = teams[i].chances?.at(0)?.hostWildCard ?? 0;
		}
		
		if (Math.abs(awayHostWcChance - (teams[i].chances?.at(0)?.hostWildCard ?? 1)) < marginOfError(awayHostWcChance, numHomeWins)) {
			awayHostWcChance = teams[i].chances?.at(0)?.hostWildCard ?? 0;
		}

		const numHomeHostDiv = simDivHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayHostDiv = simDivHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeHostDivChance = numHomeHostDiv / numHomeWins;
		let awayHostDivChance = numAwayHostDiv / numAwayWins;
		
		if (Math.abs(homeHostDivChance - (teams[i].chances?.at(0)?.hostDivision ?? 1)) < marginOfError(homeHostDivChance, numAwayWins)) {
			homeHostDivChance = teams[i].chances?.at(0)?.hostDivision ?? 0;
		}
		
		if (Math.abs(awayHostDivChance - (teams[i].chances?.at(0)?.hostDivision ?? 1)) < marginOfError(awayHostDivChance, numHomeWins)) {
			awayHostDivChance = teams[i].chances?.at(0)?.hostDivision ?? 0;
		}

		const numHomeHostConf = simConfHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAwayHostConf = simConfHosts
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		let homeHostConfChance = numHomeHostConf / numHomeWins;
		let awayHostConfChance = numAwayHostConf / numAwayWins;
		
		if (Math.abs(homeHostConfChance - (teams[i].chances?.at(0)?.hostConference ?? 1)) < marginOfError(homeHostConfChance, numAwayWins)) {
			homeHostConfChance = teams[i].chances?.at(0)?.hostConference ?? 0;
		}
		
		if (Math.abs(awayHostConfChance - (teams[i].chances?.at(0)?.hostConference ?? 1)) < marginOfError(awayHostConfChance, numHomeWins)) {
			awayHostConfChance = teams[i].chances?.at(0)?.hostConference ?? 0;
		}

		await teamChancesByGameRepo.save({
			gameId,
			teamId: teams[i].id,
			homeSeed7: homeSeed7Chance,
			homeSeed6: homeSeed6Chance,
			homeSeed5: homeSeed5Chance,
			homeSeed4: homeSeed4Chance,
			homeSeed3: homeSeed3Chance,
			homeSeed2: homeSeed2Chance,
			homeSeed1: homeSeed1Chance,
			homeHostWildCard: homeHostWcChance,
			homeHostDivision: homeHostDivChance,
			homeHostConference: homeHostConfChance,
			homeMakeDivision: homeMakeDivChance,
			homeMakeConference: homeMakeConfChance,
			homeMakeSuperBowl: homeMakeSbChance,
			homeWinSuperBowl: homeWinSbChance,
			awaySeed7: awaySeed7Chance,
			awaySeed6: awaySeed6Chance,
			awaySeed5: awaySeed5Chance,
			awaySeed4: awaySeed4Chance,
			awaySeed3: awaySeed3Chance,
			awaySeed2: awaySeed2Chance,
			awaySeed1: awaySeed1Chance,
			awayHostWildCard: awayHostWcChance,
			awayHostDivision: awayHostDivChance,
			awayHostConference: awayHostConfChance,
			awayMakeDivision: awayMakeDivChance,
			awayMakeConference: awayMakeConfChance,
			awayMakeSuperBowl: awayMakeSbChance,
			awayWinSuperBowl: awayWinSbChance
		});
	}
}

async function analyzeTeam (team: Team, games: Game[], week: number): Promise<void> {
	const totalSeed7 = teamAppearances.find(ta => ta.id === team.id)?.numSeed7 ?? 0;
	const totalSeed6 = teamAppearances.find(ta => ta.id === team.id)?.numSeed6 ?? 0;
	const totalSeed5 = teamAppearances.find(ta => ta.id === team.id)?.numSeed5 ?? 0;
	const totalSeed4 = teamAppearances.find(ta => ta.id === team.id)?.numSeed4 ?? 0;
	const totalSeed3 = teamAppearances.find(ta => ta.id === team.id)?.numSeed3 ?? 0;
	const totalSeed2 = teamAppearances.find(ta => ta.id === team.id)?.numSeed2 ?? 0;
	const totalSeed1 = teamAppearances.find(ta => ta.id === team.id)?.numSeed1 ?? 0;
	const totalHostWc = teamAppearances.find(ta => ta.id === team.id)?.numHostWc ?? 0;
	const totalHostDiv = teamAppearances.find(ta => ta.id === team.id)?.numHostDiv ?? 0;
	const totalHostConf = teamAppearances.find(ta => ta.id === team.id)?.numHostConf ?? 0;
	const totalMakeDiv = teamAppearances.find(ta => ta.id === team.id)?.numMakeDiv ?? 0;
	const totalMakeConf = teamAppearances.find(ta => ta.id === team.id)?.numMakeConf ?? 0;
	const totalMakeSb = teamAppearances.find(ta => ta.id === team.id)?.numMakeSb ?? 0;
	const totalWinSb = teamAppearances.find(ta => ta.id === team.id)?.numWinSb ?? 0;

	const seed7Chance = totalSeed7 / SIMS;
	const seed6Chance = totalSeed6 / SIMS;
	const seed5Chance = totalSeed5 / SIMS;
	const seed4Chance = totalSeed4 / SIMS;
	const seed3Chance = totalSeed3 / SIMS;
	const seed2Chance = totalSeed2 / SIMS;
	const seed1Chance = totalSeed1 / SIMS;
	const hostWcChance = totalHostWc / SIMS;
	const hostDivChance = totalHostDiv / SIMS;
	const hostConfChance = totalHostConf / SIMS;
	let makeDivChance = totalMakeDiv / SIMS;
	let makeConfChance = totalMakeConf / SIMS;
	let makeSbChance = totalMakeSb / SIMS;
	let winSbChance = totalWinSb / SIMS;

	await teamChancesRepo.save({
		teamId: team.id,
		season: CURRENT_SEASON,
		week: week,
		seed7: seed7Chance,
		seed6: seed6Chance,
		seed5: seed5Chance,
		seed4: seed4Chance,
		seed3: seed3Chance,
		seed2: seed2Chance,
		seed1: seed1Chance,
		hostWildCard: hostWcChance,
		hostDivision: hostDivChance,
		hostConference: hostConfChance,
		makeDivision: makeDivChance,
		makeConference: makeConfChance,
		makeSuperBowl: makeSbChance,
		winSuperBowl: winSbChance
	});
}

class GameObj {
	gameId: number;
	simSeasonId: number;
	winningTeamId: number | undefined;
}

class TeamAppearances {
	id: number;
	numSeed7: number = 0;
	numSeed6: number = 0;
	numSeed5: number = 0;
	numSeed4: number = 0;
	numSeed3: number = 0;
	numSeed2: number = 0;
	numSeed1: number = 0;
	numHostWc: number = 0;
	numHostDiv: number = 0;
	numHostConf: number = 0;
	numMakeDiv: number = 0;
	numMakeConf: number = 0;
	numMakeSb: number = 0;
	numWinSb: number = 0;

	constructor (id: number) {
		this.id = id;
	}
}

function printProgress (progress: string): void {
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);
	process.stdout.write(progress.substring(0, 5) + '%');
}

function marginOfError (p: number, n: number): number {
	return CONFIDENCE_INTERVAL * Math.sqrt((p * (1 - p)) / n);
}
