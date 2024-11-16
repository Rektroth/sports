import 'reflect-metadata';
import dotenv from 'dotenv';
import { MoreThan } from 'typeorm';
import { chance, newElo, Outcome } from '@rektroth/elo';
import {
	Conference,
	Game,
	SeasonType,
	SportsDataSource,
	Team,
	TeamChances,
	TeamChancesByGame
} from '@rektroth/sports-entities';
import nflSort from './util/nflsort';
import printProgress from './util/printprogress';
import SimTeam from './util/simteam';

class TeamSimulation {
	private teamId: number;
	private seeds: number[] = [];
	hostWildCardRound: number = 0;
	hostDivisionRound: number = 0;
	hostConferenceRound: number = 0;
	makeDivisionRound: number = 0;
	makeConferenceRound: number = 0;
	makeSuperBowl: number = 0;
	winSuperBowl: number = 0;
	gameSimulations: GameSimulation[] = [];

	constructor (id: number, gameIds: number[]) {
		this.teamId = id;
		this.gameSimulations = gameIds.map(gi => new GameSimulation(gi));
		for (let i = 0; i < 16; i++) this.seeds.push(0);
	}

	getTeamId() {
		return this.teamId;
	}

	getNumberOfSeed(seed: number) {
		if (this.seeds.length > seed) return this.seeds[seed];
		return 0;
	}

	getMinimumNumberOfSeed(seed: number) {
		let sum = 0;
		let max = this.seeds.length > seed ? seed : this.seeds.length - 1;
		for (let i = 0; i <= max; i++) sum += this.seeds[i];
		return sum;
	}

	addToSeed(seed: number) {
		if (this.seeds.length > seed) this.seeds[seed]++;
	}
}

class GameSimulation {
	private gameId: number;
	private seedsIfHomeWins: number[] = [];
	hostWildCardRoundIfHomeWins: number = 0;
	hostDivisionRoundIfHomeWins: number = 0;
	hostConferenceRoundIfHomeWins: number = 0;
	makeDivisionRoundIfHomeWins: number = 0;
	makeConferenceRoundIfHomeWins: number = 0;
	makeSuperBowlIfHomeWins: number = 0;
	winSuperBowlIfHomeWins: number = 0;
	private seedsIfAwayWins: number[] = [];
	hostWildCardRoundIfAwayWins: number = 0;
	hostDivisionRoundIfAwayWins: number = 0;
	hostConferenceRoundIfAwayWins: number = 0;
	makeDivisionRoundIfAwayWins: number = 0;
	makeConferenceRoundIfAwayWins: number = 0;
	makeSuperBowlIfAwayWins: number = 0;
	winSuperBowlIfAwayWins: number = 0;
	private homeWins: number = 0;
	private awayWins: number = 0;

	constructor (id: number) {
		this.gameId = id;

		for (let i = 0; i < 16; i++) {
			this.seedsIfHomeWins.push(0);
			this.seedsIfAwayWins.push(0);
		}
	}

	getGameId() {
		return this.gameId;
	}

	getNumberOfSeedIfHomeWins(seed: number) {
		if (this.seedsIfHomeWins.length > seed) return this.seedsIfHomeWins[seed];
		return 0;
	}

	getMinimumNumberOfSeedIfHomeWins(seed: number) {
		let sum = 0;
		let max = this.seedsIfHomeWins.length > seed ? seed : this.seedsIfHomeWins.length - 1;
		for (let i = 0; i <= max; i++) sum += this.seedsIfHomeWins[i];
		return sum;
	}

	addToSeedIfHomeWins(seed: number) {
		if (this.seedsIfHomeWins.length > seed) this.seedsIfHomeWins[seed]++;
		this.homeWins++;
	}

	getHomeWins() {
		return this.homeWins;
	}

	getNumberOfSeedIfAwayWins(seed: number) {
		if (this.seedsIfAwayWins.length > seed) return this.seedsIfAwayWins[seed];
		return 0;
	}

	getMinimumNumberOfSeedIfAwayWins(seed: number) {
		let sum = 0;
		let max = this.seedsIfAwayWins.length > seed ? seed : this.seedsIfAwayWins.length - 1;
		for (let i = 0; i <= max; i++) sum += this.seedsIfAwayWins[i];
		return sum;
	}

	addToSeedIfAwayWins(seed: number) {
		if (this.seedsIfAwayWins.length > seed) this.seedsIfAwayWins[seed]++;
		this.awayWins++;
	}

	getAwayWins() {
		return this.awayWins;
	}
}

class SimGame {
	gameId: number;
	gameOutcome: GameOutcome;

	constructor (id: number, outcome: GameOutcome) {
		this.gameId = id;
		this.gameOutcome = outcome;
	}
}

enum GameOutcome {
	HOME,
	AWAY,
	TIE
}

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

// This number is currently true for seasons 2021
// and forward, but older seasons have fewer games,
// and this number may change for future seasons.
// This number will need to be made dynamic.
const GAMES_PER_SEASON = 17;

const simDataSource = SportsDataSource(SCHEMA, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);
const conferenceRepo = simDataSource.getRepository(Conference);
const teamRepo = simDataSource.getRepository(Team);
const gameRepo = simDataSource.getRepository(Game);
const teamChancesRepo = simDataSource.getRepository(TeamChances);
const teamChancesByGameRepo = simDataSource.getRepository(TeamChancesByGame);

main();

export default async function main (): Promise<void> {
	try {
		await simDataSource.initialize();
		console.log('Connection to database established...');
	} catch (e) {
		console.log(e);
	}

	const games = await gameRepo.find({
		where: {
			season: CURRENT_SEASON
		},
		order: {
			startDateTime: 'ASC'
		}
	});

	const completedGames = games.filter(g => g.homeScore !== null && g.awayScore !== null);
	const uncompletedGames = games.filter(g => g.homeScore === null && g.awayScore === null);
	const currentWeek = uncompletedGames[0].week;
	const soonGameIds = games.filter(g => g.week === currentWeek).map(sg => sg.id);

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

	const simulations = teams.map(t => new TeamSimulation(t.id, soonGameIds));
	const conferences = await conferenceRepo.find();
	const simTeams = complete(completedGames, teams);

	for (let i = 0; i < SIMS; i++) {
		simulate(
			uncompletedGames,
			simTeams,
			conferences,
			soonGameIds,
			simulations);
		printProgress(String(((i + 1) / SIMS) * 100));
	}

	console.log();
	console.log('Analyzing...');

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
	
	await analysis(simulations, lastGameWeek, simTeams);
	console.log();
	process.exit();
}

function complete(games: Game[], teamEntities: Team[]): SimTeam[] {
	const regSeasonGames = games.filter(g => g.seasonType === SeasonType.REGULAR);
	const teams = teamEntities.map(t => new SimTeam(
		t.id,
		t.divisionId,
		t.division?.conferenceId ?? 0,
		t.eloScores !== undefined ? t.eloScores[0].eloScore : 1500
	));

	for (let i = 0; i < regSeasonGames.length; i++) {
		const game = regSeasonGames[i];

		if (game.homeScore > game.awayScore) {
			teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
			teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
		} else if (game.homeScore < game.awayScore) {
			teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
			teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
		} else {
			teams.find(t => t.getId() === game.homeTeamId)?.tieGame(game.awayTeamId);
			teams.find(t => t.getId() === game.awayTeamId)?.tieGame(game.homeTeamId);
		}
	}

	return teams;
}

function simulate (
	games: Game[],
	preTeams: SimTeam[],
	conferences: Conference[],
	soonGameIds: number[],
	teamSimulations: TeamSimulation[]
) {
	const preSeasonGames = games.filter(g => g.seasonType === SeasonType.PRE);
	const regSeasonGames = games.filter(g => g.seasonType === SeasonType.REGULAR);
	const postSeasonGames = games.filter(g => g.seasonType === SeasonType.POST);
	const teams = preTeams.map(t => new SimTeam(
		t.getId(),
		t.getDivisionId(),
		t.getConferenceId(),
		t.elo,
		t.getWinOpponents(),
		t.getLossOpponents(),
		t.getTieOpponents(),
		t.seed,
		t.divisionRank,
		t.lastGame
	));
	const soonGames: SimGame[] = [];

	for (let i = 0; i < preSeasonGames.length; i++) {
		const game = preSeasonGames[i];
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

		if (game.homeScore == null) {
			const homeTeam = teams.find(t => t.getId() === game.homeTeamId);
			const awayTeam = teams.find(t => t.getId() === game.awayTeamId);
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

				if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
			} else if (r < added) {
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

				if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
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

				if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.TIE));
			}

			if (homeTeam !== undefined) homeTeam.lastGame = game.startDateTime;
			if (awayTeam !== undefined) awayTeam.lastGame = game.startDateTime;
		}
	}

	for (let i = 0; i < regSeasonGames.length; i++) {
		const game = regSeasonGames[i];
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

		const homeTeam = teams.find(t => t.getId() === game.homeTeamId);
		const awayTeam = teams.find(t => t.getId() === game.awayTeamId);
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

			if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
		} else if (r < added) {
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

			if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
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

			if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.TIE));
		}

		if (homeTeam !== undefined) homeTeam.lastGame = game.startDateTime;
		if (awayTeam !== undefined) awayTeam.lastGame = game.startDateTime;
	}

	for (let i = 0; i < conferences.length; i++) {
		let confTeams = teams.filter(t => t.getConferenceId() === conferences[i].id);
		confTeams = nflSort(confTeams);
		
		for (let j = 0; j < confTeams.length; j++) {
			confTeams[j].seed = j + 1;
			const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === confTeams[j].getId());
			if (teamSimulation === undefined) continue;
			teamSimulation.addToSeed(j);

			for (let k = 0; k < soonGames.length; k++) {
				const gameAppearance = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameAppearance === undefined) continue;
				if (soonGames[k].gameOutcome === GameOutcome.HOME) gameAppearance.addToSeedIfHomeWins(j);
				else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameAppearance.addToSeedIfAwayWins(j);
			}
		}
	}

	let wcWinners: SimTeam[] = [];
	let divWinners: SimTeam[] = [];
	let confWinners: SimTeam[] = [];
	let superBowlWinner: SimTeam | undefined;

	for (let i = 0; i < postSeasonGames.length; i++) {
		const game = postSeasonGames[i];
		const homeTeam = teams.find(t => t.getId() === game.homeTeamId);
		const awayTeam = teams.find(t => t.getId() === game.awayTeamId);
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

		if (i < 6 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					wcWinners = wcWinners.concat(homeTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					wcWinners = wcWinners.concat(awayTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
				}
			}
		} else if (i < 10 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					divWinners = divWinners.concat(homeTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					divWinners = divWinners.concat(awayTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
				}
			}
		} else if (i < 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					confWinners = confWinners.concat(homeTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					confWinners = confWinners.concat(awayTeam);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
				}
			}
		} else if (i === 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					superBowlWinner = homeTeam;
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.HOME));
				} else {
					superBowlWinner = awayTeam;
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					if (isSoonGame) soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
				}
			} else {
				superBowlWinner = simulatePlayoffGame(homeTeam, awayTeam, false, false);
			}
		}
	}

	for (let i = 0; i < conferences.length; i++) {
		const confTeams = teams
			.filter(t => t.getConferenceId() === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);
		
		for (let j = 1; j <= 3; j++) {
			const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === confTeams[j].getId());
			if (teamSimulation === undefined) continue;
			teamSimulation.hostWildCardRound++;

			for (let k = 0; k < soonGames.length; k++) {
				const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameSimulation === undefined) continue;
				if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.hostWildCardRoundIfHomeWins++;
				else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.hostWildCardRoundIfAwayWins++;
			}
		}

		const wcGame1 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[1].getId() && g.awayTeamId === confTeams[6].getId());
		const wcGame2 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[2].getId() && g.awayTeamId === confTeams[5].getId());
		const wcGame3 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[3].getId() && g.awayTeamId === confTeams[4].getId());

		if (wcGame1 === undefined) {
			const winner = simulatePlayoffGame(confTeams[1], confTeams[6], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		if (wcGame2 === undefined) {
			const winner = simulatePlayoffGame(confTeams[2], confTeams[5], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		if (wcGame3 === undefined) {
			const winner = simulatePlayoffGame(confTeams[3], confTeams[4], false, false);
			wcWinners = wcWinners.concat(winner);
		}

		const confWcWinners = wcWinners
			.filter(t => t.getConferenceId() === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);

		for (let j = 0; j <= 2; j++) {
			const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === confWcWinners[j].getId());
			if (teamSimulation === undefined) continue;
			teamSimulation.makeDivisionRound++;

			for (let k = 0; k < soonGames.length; k++) {
				const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameSimulation === undefined) continue;
				if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.makeDivisionRoundIfHomeWins++;
				else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.makeDivisionRoundIfAwayWins++;

				if (j === 0) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.hostDivisionRoundIfHomeWins++;
					else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.hostDivisionRoundIfAwayWins++;
				}
			}
		}

		const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === confTeams[0].getId());

		if (teamSimulation !== undefined) {
			teamSimulation.makeDivisionRound++;
			teamSimulation.hostDivisionRound++;

			for (let k = 0; k < soonGames.length; k++) {
				const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameSimulation === undefined) continue;

				if (soonGames[k].gameOutcome === GameOutcome.HOME) {
					gameSimulation.makeDivisionRoundIfHomeWins++;
					gameSimulation.hostDivisionRoundIfHomeWins++;
				} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
					gameSimulation.makeDivisionRoundIfAwayWins++;
					gameSimulation.hostDivisionRoundIfAwayWins++;
				}
			}
		}

		const divGame1 = postSeasonGames.find(g =>
			g.homeTeamId === confTeams[0].getId() && g.awayTeamId === confWcWinners[2].getId());
		const divGame2 = postSeasonGames.find(g =>
			g.homeTeamId === confWcWinners[0].getId() && g.awayTeamId === confWcWinners[1].getId());

		if (divGame1 === undefined) {
			const winner = simulatePlayoffGame(confTeams[0], confWcWinners[2], false, false);
			divWinners = divWinners.concat(winner);
		}

		if (divGame2 === undefined) {
			const winner = simulatePlayoffGame(confWcWinners[0], confWcWinners[1], false, false);
			divWinners = divWinners.concat(winner);
		}

		const confDivWinners = divWinners
			.filter(t => t.getConferenceId() === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);

		for (let j = 0; j <= 1; j++) {
			const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === confDivWinners[j].getId());
			if (teamSimulation === undefined) continue;
			teamSimulation.makeConferenceRound++;

			for (let k = 0; k < soonGames.length; k++) {
				const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameSimulation === undefined) continue;
				if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.makeConferenceRoundIfHomeWins++;
				else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.makeConferenceRoundIfAwayWins++;

				if (j === 0) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.hostConferenceRoundIfHomeWins++;
					else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.hostConferenceRoundIfAwayWins++;
				}
			}
		}

		const confGame = postSeasonGames.find(g =>
			g.homeTeamId === confDivWinners[0].getId() && g.awayTeamId === confDivWinners[1].getId());

		if (confGame === undefined) {
			const winner = simulatePlayoffGame(confDivWinners[0], confDivWinners[1], false, false);
			confWinners = confWinners.concat(winner);

			const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === winner.getId());
			if (teamSimulation === undefined) continue;
			teamSimulation.makeSuperBowl++;

			for (let k = 0; k < soonGames.length; k++) {
				const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
				if (gameSimulation === undefined) continue;
				if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.makeSuperBowlIfHomeWins++;
				else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.makeSuperBowlIfAwayWins++;
			}
		}
	}

	if (superBowlWinner === undefined || superBowlWinner === null) {
		if (confWinners[0].getId() === SUPER_BOWL_HOST) {
			superBowlWinner = simulatePlayoffGame(confWinners[1], confWinners[0], false, false);
		} else if (confWinners[1].getId() === SUPER_BOWL_HOST) {
			superBowlWinner = simulatePlayoffGame(confWinners[0], confWinners[1], false, false);
		} else {
			superBowlWinner = simulatePlayoffGame(confWinners[0], confWinners[1], true, false);
		}
	}

	const teamSimulation = teamSimulations.find(ta => ta.getTeamId() === superBowlWinner.getId());

	if (teamSimulation !== undefined) {
		teamSimulation.winSuperBowl++;

		for (let k = 0; k < soonGames.length; k++) {
			const gameSimulation = teamSimulation.gameSimulations.find(ga => ga.getGameId() === soonGames[k].gameId);
			if (gameSimulation === undefined) continue;
			if (soonGames[k].gameOutcome === GameOutcome.HOME) gameSimulation.winSuperBowlIfHomeWins++;
			else if (soonGames[k].gameOutcome === GameOutcome.AWAY) gameSimulation.winSuperBowlIfAwayWins++;
		}
	}
}

function simulatePlayoffGame (
	homeTeam: SimTeam,
	awayTeam: SimTeam,
	neutralSite: boolean,
	homeHadBye: boolean
): SimTeam {
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

async function analysis(teamSimulations: TeamSimulation[], week: number, teams: SimTeam[]): Promise<void> {
	let conferences: SimTeam[][] = [];
	const conferenceIds = removeDuplicates(teams.map(t => t.getConferenceId()));

	for (let i = 0; i < conferenceIds.length; i++) {
		const conferenceId = conferenceIds[i];
		const conferenceTeams = teams.filter(t => t.getConferenceId() === conferenceId);
		conferences = conferences.concat([ nflSort(conferenceTeams) ]);
	}

	for (let i = 0; i < teamSimulations.length; i++) {
		const teamSimulation = teamSimulations[i];
		const team = teams.find(t => t.getId() === teamSimulation.getTeamId());
		if (team === undefined) continue;
		const conference = conferences.find(c => c.some(t => t.getConferenceId() === team.getConferenceId()));
		if (conference === undefined) continue;
		const division = conference.filter(t => t.getDivisionId() === team.getDivisionId());

		const seed7Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(6) / SIMS, GAMES_PER_SEASON, team, conference[6]);
		const seed6Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(5) / SIMS, GAMES_PER_SEASON, team, conference[5]);
		const seed5Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(4) / SIMS, GAMES_PER_SEASON, team, conference[4]);
		const seed4Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(3) / SIMS, GAMES_PER_SEASON, team, conference[3], division[0]);
		const seed3Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(2) / SIMS, GAMES_PER_SEASON, team, conference[2], division[0]);
		const seed2Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(1) / SIMS, GAMES_PER_SEASON, team, conference[1], division[0]);
		const seed1Chance = correctForEliminatedOrClinched(teamSimulation.getMinimumNumberOfSeed(0) / SIMS, GAMES_PER_SEASON, team, conference[0], division[0]);
		const makeDivChance = correctForEliminated(teamSimulation.makeDivisionRound / SIMS, seed7Chance);
		const makeConfChance = correctForEliminated(teamSimulation.makeConferenceRound / SIMS, makeDivChance);
		const makeSbChance = correctForEliminated(teamSimulation.makeSuperBowl / SIMS, makeConfChance);
		const winSbChance = correctForEliminated(teamSimulation.winSuperBowl / SIMS, makeSbChance);
		const hostWcChance = seed1Chance === 1 ? 0 : correctForEliminated(teamSimulation.hostWildCardRound / SIMS, seed4Chance);
		const hostDivChance = seed6Chance === 0 ? 0 : correctForEliminated(teamSimulation.hostDivisionRound / SIMS, makeDivChance);
		const hostConfChance = seed6Chance === 0 ? 0 : correctForEliminated(teamSimulation.hostConferenceRound / SIMS, makeConfChance);

		await teamChancesRepo.save({
			teamId: teamSimulation.getTeamId(),
			season: CURRENT_SEASON,
			week,
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

		const gameSimulations = teamSimulation.gameSimulations;

		for (let j = 0; j < gameSimulations.length; j++) {
			const gameSimulation = gameSimulations[j];
			const numHomeWins = gameSimulation.getHomeWins();
			const numAwayWins = gameSimulation.getAwayWins();

			await teamChancesByGameRepo.save({
				gameId: gameSimulation.getGameId(),
				teamId: teamSimulation.getTeamId(),
				homeSeed7: adjustForMarginOfError(seed7Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(6) / numHomeWins, numHomeWins),
				homeSeed6: adjustForMarginOfError(seed6Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(5) / numHomeWins, numHomeWins),
				homeSeed5: adjustForMarginOfError(seed5Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(4) / numHomeWins, numHomeWins),
				homeSeed4: adjustForMarginOfError(seed4Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(3) / numHomeWins, numHomeWins),
				homeSeed3: adjustForMarginOfError(seed3Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(2) / numHomeWins, numHomeWins),
				homeSeed2: adjustForMarginOfError(seed2Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(1) / numHomeWins, numHomeWins),
				homeSeed1: adjustForMarginOfError(seed1Chance, gameSimulation.getMinimumNumberOfSeedIfHomeWins(0) / numHomeWins, numHomeWins),
				homeHostWildCard: adjustForMarginOfError(hostWcChance, gameSimulation.hostWildCardRoundIfHomeWins / numHomeWins, numHomeWins),
				homeHostDivision: adjustForMarginOfError(hostDivChance, gameSimulation.hostDivisionRoundIfHomeWins / numHomeWins, numHomeWins),
				homeHostConference: adjustForMarginOfError(hostConfChance, gameSimulation.hostConferenceRoundIfHomeWins / numHomeWins, numHomeWins),
				homeMakeDivision: adjustForMarginOfError(makeDivChance, gameSimulation.makeDivisionRoundIfHomeWins / numHomeWins, numHomeWins),
				homeMakeConference: adjustForMarginOfError(makeConfChance, gameSimulation.makeConferenceRoundIfHomeWins / numHomeWins, numHomeWins),
				homeMakeSuperBowl: adjustForMarginOfError(makeSbChance, gameSimulation.makeSuperBowlIfHomeWins / numHomeWins, numHomeWins),
				homeWinSuperBowl: adjustForMarginOfError(winSbChance, gameSimulation.winSuperBowlIfHomeWins / numHomeWins, numHomeWins),
				awaySeed7: adjustForMarginOfError(seed7Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(6) / numAwayWins, numAwayWins),
				awaySeed6: adjustForMarginOfError(seed6Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(5) / numAwayWins, numAwayWins),
				awaySeed5: adjustForMarginOfError(seed5Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(4) / numAwayWins, numAwayWins),
				awaySeed4: adjustForMarginOfError(seed4Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(3) / numAwayWins, numAwayWins),
				awaySeed3: adjustForMarginOfError(seed3Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(2) / numAwayWins, numAwayWins),
				awaySeed2: adjustForMarginOfError(seed2Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(1) / numAwayWins, numAwayWins),
				awaySeed1: adjustForMarginOfError(seed1Chance, gameSimulation.getMinimumNumberOfSeedIfAwayWins(0) / numAwayWins, numAwayWins),
				awayHostWildCard: adjustForMarginOfError(hostWcChance, gameSimulation.hostWildCardRoundIfHomeWins / numAwayWins, numAwayWins),
				awayHostDivision: adjustForMarginOfError(hostDivChance, gameSimulation.hostDivisionRoundIfHomeWins / numAwayWins, numAwayWins),
				awayHostConference: adjustForMarginOfError(hostConfChance, gameSimulation.hostConferenceRoundIfHomeWins / numAwayWins, numAwayWins),
				awayMakeDivision: adjustForMarginOfError(makeDivChance, gameSimulation.makeDivisionRoundIfAwayWins / numAwayWins, numAwayWins),
				awayMakeConference: adjustForMarginOfError(makeConfChance, gameSimulation.makeConferenceRoundIfAwayWins / numAwayWins, numAwayWins),
				awayMakeSuperBowl: adjustForMarginOfError(makeSbChance, gameSimulation.makeSuperBowlIfAwayWins / numAwayWins, numAwayWins),
				awayWinSuperBowl: adjustForMarginOfError(winSbChance, gameSimulation.winSuperBowlIfAwayWins / numAwayWins, numAwayWins),
			});
		}
	}
}

/**
 * Adjusts a simulated playoff chance 
 * @param original The original simulated playoff chance.
 * @param next     The new simulated playoff chance for specific conditions.
 * @param total    The total number of relevant simulations.
 * @returns The value of {@link next} if its outside the estimated margin of error; @{link original} otherwise.
 */
function adjustForMarginOfError(original: number, next: number, total: number): number {
	const moe = CONFIDENCE_INTERVAL * Math.sqrt((next * (1 - next)) / total);
	return Math.abs(next - original) > moe ? next : original;
}

/**
 * Corrects a playoff chance to be a value close to but between 0 and/or 1 when incorrectly simulated to be 0 or 1.
 * @param original      The simulated chance to be checked.
 * @param gamesInSeason Total number of games the teams play in the season.
 * @param team          The team whose chance is being checked.
 * @param opponent      The opponent team being checked against.
 * @param opponent2     The second opponent team being checked against, if applicable.
 * @returns 0.5 / SIMS if the simulated chance was 0 but mathematically shouldn't be; 1 - (0.5 / SIMS) if the simulated chance was 1 but mathematically shouldn't be; {@link original} otherwise.
 */
function correctForEliminatedOrClinched (
	original: number,
	gamesInSeason: number,
	team: SimTeam,
	opponent:SimTeam,
	opponent2: SimTeam = opponent
): number {
	if (original === 0 && team.getMagicNumber(opponent, gamesInSeason) > 0 && team.getMagicNumber(opponent2, gamesInSeason)) return 0.5 / SIMS;
	if (original === 1 && team.getMagicNumber(opponent, gamesInSeason) > 0 && team.getMagicNumber(opponent2, gamesInSeason)) return 1 - (0.5 / SIMS);
	return original;
}

/**
 * Corrects a playoff chance to be non-0 when incorrectly simulated to be 0.
 * @param original    The simulated chance to be checked.
 * @param floorChance The relevant chance that, if between 0 and 1 (non-inclusive), indicates that {@link original} should not be 0.
 * @returns 0.5 / SIMS if the simulated chance was 0 but mathematically shouldn't be; {@link original} otherwise.
 */
function correctForEliminated (original: number, floorChance: number): number {
	if (original === 0 && floorChance > 0 && floorChance < 1) return 0.5 / SIMS;
	return original;
}

/**
 * Removes duplicate values from an array.
 * @param array The array to have duplicate values removed from.
 * @returns The array with duplicate values removed.
 */
function removeDuplicates (array: number[]) {
	// it's lazy, but it works
	return [...new Set(array)];
}
