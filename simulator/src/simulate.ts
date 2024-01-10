import 'reflect-metadata';
import dotenv from 'dotenv';
import { IsNull, MoreThan } from 'typeorm';
import { chance, newElo, Outcome } from '@rektroth/elo';
import {
	SportsDataSource,
	Conference,
	Division,
	Team,
	Game,
	SimPlayoffChance,
	SeasonType
} from '@rektroth/sports-entities';
import SimTeam from './util/simteam';
import nflSort from './util/nflsort';

dotenv.config();

const CURRENT_SEASON = isNaN(Number(process.env.CURRENT_SEASON)) ? 2023 : Number(process.env.CURRENT_SEASON);
const SIMS = isNaN(Number(process.env.TOTAL_SIMS)) ? 32768 : Number(process.env.TOTAL_SIMS);
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = isNaN(Number(process.env.DB_PORT)) ? 5432 : Number(process.env.DB_PORT);
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
const SUPER_BOWL_HOST = process.env.SUPER_BOWL_HOST ?? 1;

const simDataSource = SportsDataSource(DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD);
const conferenceRepo = simDataSource.getRepository(Conference);
const divisionRepo = simDataSource.getRepository(Division);
const teamRepo = simDataSource.getRepository(Team);
const gameRepo = simDataSource.getRepository(Game);
const simChanceRepo = simDataSource.getRepository(SimPlayoffChance);
const simGames: GameObj[] = [];
const simAppearances: AppearanceObj[] = [];
const simDivLeaders: AppearanceObj[] = [];
const simConfLeaders: AppearanceObj[] = [];
const simDivQualifiers: AppearanceObj[] = [];
const simDivWinners: AppearanceObj[] = [];
const simConfWinners: AppearanceObj[] = [];
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
	const games = await gameRepo.findBy([{
		season: CURRENT_SEASON,
		seasonType: SeasonType.REGULAR
	}, {
		season: CURRENT_SEASON,
		seasonType: SeasonType.POST
	}]);
	console.log(`Simulating ${SIMS} seasons...`);
	const teams = await teamRepo.find({
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
	const divisions = await divisionRepo.find();
	const conferences = await conferenceRepo.find();

	for (let i = 0; i < SIMS; i++) {
		await simulate(games, teams, divisions, conferences, i);
		printProgress(String(((i + 1) / SIMS) * 100));
	}

	console.log();
	console.log('Analyzing games...');

	const soonGames = await gameRepo.find({
		where: {
			homeTeamScore: IsNull()
		},
		order: {
			startDateTime: 'ASC'
		},
		take: 16
	});

	for (let i = 0; i < soonGames.length; i++) {
		await analyzeGame(teams, soonGames[i]);
		printProgress(String(((i + 1) / soonGames.length) * 100));
	}

	console.log();
	console.log('Analyzing teams...');

	for (let i = 0; i < teams.length; i++) {
		await analyzeTeam(teams[i]);
		printProgress(String(((i + 1) / teams.length) * 100));
	}

	console.log();
}

async function simulate (
	games: Game[],
	teamEntities: Team[],
	divisions: Division[],
	conferences: Conference[],
	sim: number
): Promise<void> {
	games = games.sort((a, b) => a.startDateTime > b.startDateTime ? 1 : a.startDateTime < b.startDateTime ? -1 : 0);
	const regSeasonGames = games.filter(g => g.seasonType === SeasonType.REGULAR);
	const postSeasonGames = games.filter(g => g.seasonType === SeasonType.POST);
	const teams = teamEntities.map(t => new SimTeam(t));

	for (let i = 0; i < regSeasonGames.length; i++) {
		const game = regSeasonGames[i];
		let winnerId = null;

		if (game.homeTeamScore != null) {
			if (game.homeTeamScore > game.awayTeamScore) {
				winnerId = game.homeTeamId;
				teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
				teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
			} else if (game.homeTeamScore < game.awayTeamScore) {
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

		simConfLeaders.push({
			simSeasonId: sim,
			teamId: confTeams[0].id
		});

		simDivLeaders.push({
			simSeasonId: sim,
			teamId: confTeams[0].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[1].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[2].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[3].id
		});

		simAppearances.push({
			simSeasonId: sim,
			teamId: confTeams[0].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[1].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[2].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[3].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[4].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[5].id
		}, {
			simSeasonId: sim,
			teamId: confTeams[6].id
		});
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
			if (game.homeTeamScore != null) {
				if (game.homeTeamScore > game.awayTeamScore) {
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
			if (game.homeTeamScore != null) {
				if (game.homeTeamScore > game.awayTeamScore) {
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
			if (game.homeTeamScore != null) {
				if (game.homeTeamScore > game.awayTeamScore) {
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
			if (game.homeTeamScore != null) {
				if (game.homeTeamScore > game.awayTeamScore) {
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
		let confTeams = teams.filter(t => t.conferenceId === conferences[i].id);
		confTeams = nflSort(confTeams, divisions.filter(d => d.conferenceId === conferences[i].id).map(d => d.id));

		if (wcWinners.length < 6) {
			const wcGame1Winner = await simulatePlayoffGame(confTeams[1], confTeams[6], false, false);
			const wcGame2Winner = await simulatePlayoffGame(confTeams[2], confTeams[5], false, false);
			const wcGame3Winner = await simulatePlayoffGame(confTeams[3], confTeams[4], false, false);
			wcWinners = wcWinners.concat([wcGame1Winner, wcGame2Winner, wcGame3Winner]);
		}

		const confWcWinners = nflSort(
			wcWinners.filter(t => t.conferenceId === conferences[i].id),
			divisions.filter(d => d.conferenceId === conferences[i].id).map(d => d.id));

		simDivQualifiers.push({
			simSeasonId: sim,
			teamId: confTeams[0].id
		}, {
			simSeasonId: sim,
			teamId: confWcWinners[0].id
		}, {
			simSeasonId: sim,
			teamId: confWcWinners[1].id
		}, {
			simSeasonId: sim,
			teamId: confWcWinners[2].id
		});

		if (divWinners.length < 4) {
			const divGame1Winner = await simulatePlayoffGame(confTeams[0], confWcWinners[2], false, true);
			const divGame2Winner = await simulatePlayoffGame(confWcWinners[0], confWcWinners[1], false, false);
			divWinners = divWinners.concat([divGame1Winner, divGame2Winner]);
		}

		const confDivWinners = nflSort(
			divWinners.filter(t => t.conferenceId === conferences[i].id),
			divisions.filter(d => d.conferenceId === conferences[i].id).map(d => d.id)
		);

		simDivWinners.push({
			simSeasonId: sim,
			teamId: confDivWinners[0].id
		}, {
			simSeasonId: sim,
			teamId: confDivWinners[1].id
		});

		if (confWinners.length < 2) {
			confWinners = confWinners.concat(await simulatePlayoffGame(confDivWinners[0], confDivWinners[1], false, false));
		}

		const confWinner = confWinners.find(t => t.conferenceId === conferences[i].id);

		if (confWinner !== undefined) {
			simConfWinners.push({
				simSeasonId: sim,
				teamId: confWinner.id
			});
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

	simSuperBowlWinners.push({
		simSeasonId: sim,
		teamId: superBowlWinner.id
	});
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
		const numAppearancesWithHomeWins = simAppearances
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numAppearancesWithAwayWins = simAppearances
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const playoffChanceIfHomeWins = numAppearancesWithHomeWins / numHomeWins;
		const playoffChanceIfAwayWins = numAppearancesWithAwayWins / numAwayWins;

		const numDivLeaderWithHomeWins = simDivLeaders
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numDivLeaderWithAwayWins = simDivLeaders
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const divLeaderChanceIfHomeWins = numDivLeaderWithHomeWins / numHomeWins;
		const divLeaderChanceIfAwayWins = numDivLeaderWithAwayWins / numAwayWins;

		const numConfLeaderWithHomeWins = simConfLeaders
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numConfLeaderWithAwayWins = simConfLeaders
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const confLeaderChanceIfHomeWins = numConfLeaderWithHomeWins / numHomeWins;
		const confLeaderChanceIfAwayWins = numConfLeaderWithAwayWins / numAwayWins;

		const numMakeDivWithHomeWins = simDivQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numMakeDivWithAwayWins = simDivQualifiers
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const makeDivChanceIfHomeWins = numMakeDivWithHomeWins / numHomeWins;
		const makeDivChanceIfAwayWins = numMakeDivWithAwayWins / numAwayWins;

		const numDivWinnerWithHomeWins = simDivWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numDivWinnerWithAwayWins = simDivWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const divWinnerChanceIfHomeWins = numDivWinnerWithHomeWins / numHomeWins;
		const divWinnerChanceIfAwayWins = numDivWinnerWithAwayWins / numAwayWins;

		const numConfWinnerWithHomeWins = simConfWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numConfWinnerWithAwayWins = simConfWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const confWinnerChanceIfHomeWins = numConfWinnerWithHomeWins / numHomeWins;
		const confWinnerChanceIfAwayWins = numConfWinnerWithAwayWins / numAwayWins;

		const numSuperBowlWinnerWithHomeWins = simSuperBowlWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => homeWinSeasonIds.has(s.simSeasonId))
			.length;
		const numSuperBowlWinnerWithAwayWins = simSuperBowlWinners
			.filter(s => s.teamId === teams[i].id)
			.filter(s => awayWinSeasonIds.has(s.simSeasonId))
			.length;
		const superBowlWinnerChanceIfHomeWins = numSuperBowlWinnerWithHomeWins / numHomeWins;
		const superBowlWinnerChanceIfAwayWins = numSuperBowlWinnerWithAwayWins / numAwayWins;

		await simChanceRepo.save({
			gameId,
			teamId: teams[i].id,
			playoffChanceWithHomeWin: playoffChanceIfHomeWins,
			playoffChanceWithAwayWin: playoffChanceIfAwayWins,
			divLeaderChanceWithHomeWin: divLeaderChanceIfHomeWins,
			divLeaderChanceWithAwayWin: divLeaderChanceIfAwayWins,
			confLeaderChanceWithHomeWin: confLeaderChanceIfHomeWins,
			confLeaderChanceWithAwayWin: confLeaderChanceIfAwayWins,
			makeDivChanceWithHomeWin: makeDivChanceIfHomeWins,
			makeDivChanceWithAwayWin: makeDivChanceIfAwayWins,
			divWinnerChanceWithHomeWin: divWinnerChanceIfHomeWins,
			divWinnerChanceWithAwayWin: divWinnerChanceIfAwayWins,
			confWinnerChanceWithHomeWin: confWinnerChanceIfHomeWins,
			confWinnerChanceWithAwayWin: confWinnerChanceIfAwayWins,
			superBowlWinnerChanceWithHomeWin: superBowlWinnerChanceIfHomeWins,
			superBowlWinnerChanceWithAwayWin: superBowlWinnerChanceIfAwayWins
		});
	}
}

async function analyzeTeam (team: Team): Promise<void> {
	const totalAppearances = simAppearances.filter(s => s.teamId === team.id).length;
	const divLeaderAppearances = simDivLeaders.filter(s => s.teamId === team.id).length;
	const confLeaderAppearances = simConfLeaders.filter(s => s.teamId === team.id).length;
	const makeDivAppearances = simDivQualifiers.filter(s => s.teamId === team.id).length;
	const divWinnerAppearances = simDivWinners.filter(s => s.teamId === team.id).length;
	const confWinnerAppearances = simConfWinners.filter(s => s.teamId === team.id).length;
	const superBowlWinnerAppearances = simSuperBowlWinners.filter(s => s.teamId === team.id).length;
	const playoffChance = totalAppearances / SIMS;
	const divLeaderChance = divLeaderAppearances / SIMS;
	const confLeaderChance = confLeaderAppearances / SIMS;
	const makeDivChance = makeDivAppearances / SIMS;
	const divWinnerChance = divWinnerAppearances / SIMS;
	const confWinnerChance = confWinnerAppearances / SIMS;
	const superBowlWinnerChance = superBowlWinnerAppearances / SIMS;

	await teamRepo.update({ id: team.id }, {
		simPlayoffChance: playoffChance,
		simDivLeaderChance: divLeaderChance,
		simConfLeaderChance: confLeaderChance,
		simMakeDivChance: makeDivChance,
		simWinDivChance: divWinnerChance,
		simWinConfChance: confWinnerChance,
		simWinSuperBowlChance: superBowlWinnerChance
	});
}

class GameObj {
	gameId: number;
	simSeasonId: number;
	winningTeamId: number | undefined;
}

class AppearanceObj {
	simSeasonId: number;
	teamId: number;
}

function printProgress (progress: string): void {
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);
	process.stdout.write(progress.substring(0, 5) + '%');
}
