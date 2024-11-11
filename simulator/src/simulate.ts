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

class TeamAppearances {
	teamId: number;
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
	gameAppearances: GameAppearances[] = [];

	constructor (id: number, gameIds: number[]) {
		this.teamId = id;
		this.gameAppearances = gameIds.map(gi => new GameAppearances(gi));
	}
}

class GameAppearances {
	gameId: number;
	numSeed7Home: number = 0;
	numSeed6Home: number = 0;
	numSeed5Home: number = 0;
	numSeed4Home: number = 0;
	numSeed3Home: number = 0;
	numSeed2Home: number = 0;
	numSeed1Home: number = 0;
	numHostWcHome: number = 0;
	numHostDivHome: number = 0;
	numHostConfHome: number = 0;
	numMakeDivHome: number = 0;
	numMakeConfHome: number = 0;
	numMakeSbHome: number = 0;
	numWinSbHome: number = 0;
	numSeed7Away: number = 0;
	numSeed6Away: number = 0;
	numSeed5Away: number = 0;
	numSeed4Away: number = 0;
	numSeed3Away: number = 0;
	numSeed2Away: number = 0;
	numSeed1Away: number = 0;
	numHostWcAway: number = 0;
	numHostDivAway: number = 0;
	numHostConfAway: number = 0;
	numMakeDivAway: number = 0;
	numMakeConfAway: number = 0;
	numMakeSbAway: number = 0;
	numWinSbAway: number = 0;
	homeWins: number = 0;
	awayWins: number = 0;

	constructor (id: number) {
		this.gameId = id;
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

	const appearances = teams.map(t => new TeamAppearances(t.id, soonGameIds));
	const conferences = await conferenceRepo.find();
	const simTeams = await complete(completedGames, teams);

	for (let i = 0; i < SIMS; i++) {
		await simulate(
			uncompletedGames,
			simTeams,
			conferences,
			soonGameIds,
			appearances);
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
	
	await analysis(appearances, lastGameWeek);
	console.log();
	process.exit();
}

async function complete(games: Game[], teamEntities: Team[]): Promise<SimTeam[]> {
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
			teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
			teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
		} else if (game.homeScore < game.awayScore) {
			teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
			teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
		} else {
			teams.find(t => t.id === game.homeTeamId)?.tieGame(game.awayTeamId);
			teams.find(t => t.id === game.awayTeamId)?.tieGame(game.homeTeamId);
		}
	}

	return teams;
}

async function simulate (
	games: Game[],
	preTeams: SimTeam[],
	conferences: Conference[],
	soonGameIds: number[],
	appearances: TeamAppearances[]
): Promise<void> {
	const preSeasonGames = games.filter(g => g.seasonType === SeasonType.PRE);
	const regSeasonGames = games.filter(g => g.seasonType === SeasonType.REGULAR);
	const postSeasonGames = games.filter(g => g.seasonType === SeasonType.POST);
	const teams = preTeams.map(t => new SimTeam(
		t.id,
		t.divisionId,
		t.conferenceId,
		t.elo,
		t.winOpponents,
		t.lossOpponents,
		t.tieOpponents,
		t.seed,
		t.divisionRank,
		t.lastGame
	));
	const soonGames: SimGame[] = [];

	for (let i = 0; i < preSeasonGames.length; i++) {
		const game = preSeasonGames[i];
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

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

				if (isSoonGame) {
					soonGames.push(new SimGame(game.id, GameOutcome.HOME));
				}
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

				if (isSoonGame) {
					soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
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

				if (isSoonGame) {
					soonGames.push(new SimGame(game.id, GameOutcome.TIE));
				}
			}

			if (homeTeam !== undefined) {
				homeTeam.lastGame = game.startDateTime;
			}

			if (awayTeam !== undefined) {
				awayTeam.lastGame = game.startDateTime;
			}
		}
	}

	for (let i = 0; i < regSeasonGames.length; i++) {
		const game = regSeasonGames[i];
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

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

			if (isSoonGame) {
				soonGames.push(new SimGame(game.id, GameOutcome.HOME));
			}
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

			if (isSoonGame) {
				soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
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

			if (isSoonGame) {
				soonGames.push(new SimGame(game.id, GameOutcome.TIE));
			}
		}

		if (homeTeam !== undefined) {
			homeTeam.lastGame = game.startDateTime;
		}

		if (awayTeam !== undefined) {
			awayTeam.lastGame = game.startDateTime;
		}
	}

	for (let i = 0; i < conferences.length; i++) {
		let confTeams = teams.filter(t => t.conferenceId === conferences[i].id);
		confTeams = nflSort(confTeams);
		
		for (let j = 0; j <= 6; j++) {
			const appearance = appearances.find(ta => ta.teamId === confTeams[j].id);

			if (appearance === undefined) {
				continue;
			}

			if (j < 1) {
				appearance.numSeed1++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed1Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed1Away++;
						}
					}
				}
			}

			if (j < 2) {
				appearance.numSeed2++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed2Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed2Away++;
						}
					}
				}
			}

			if (j < 3) {
				appearance.numSeed3++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed3Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed3Away++;
						}
					}
				}
			}

			if (j < 4) {
				appearance.numSeed4++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed4Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed4Away++;
						}
					}
				}
			}

			if (j < 5) {
				appearance.numSeed5++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed5Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed5Away++;
						}
					}
				}
			}

			if (j < 6) {
				appearance.numSeed6++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed6Home++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numSeed6Away++;
						}
					}
				}
			}

			appearance.numSeed7++;

			for (let k = 0; k < soonGames.length; k++) {
				if (soonGames[k].gameOutcome === GameOutcome.HOME) {
					const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

					if (gameAppearance !== undefined) {
						gameAppearance.numSeed7Home++;
					}
				} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
					const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

					if (gameAppearance !== undefined) {
						gameAppearance.numSeed7Away++;
					}
				}
			}
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
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

		if (i < 6 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
					wcWinners = wcWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
					wcWinners = wcWinners.concat(awayTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			}
		} else if (i < 10 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
					divWinners = divWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
					divWinners = divWinners.concat(awayTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			}
		} else if (i < 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);
					confWinners = confWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);
					confWinners = confWinners.concat(awayTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			}
		} else if (i === 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					superBowlWinner = homeTeam;
					teams.find(t => t.id === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.loseGame(game.homeTeamId);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					superBowlWinner = awayTeam;
					teams.find(t => t.id === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.id === game.awayTeamId)?.winGame(game.homeTeamId);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			} else {
				superBowlWinner = await simulatePlayoffGame(homeTeam, awayTeam, false, false);
			}
		}
	}

	for (let i = 0; i < conferences.length; i++) {
		const confTeams = teams
			.filter(t => t.conferenceId === conferences[i].id)
			.sort((a, b) => a.seed > b.seed ? 1 : -1);
		
		for (let j = 1; j <= 3; j++) {
			const appearance = appearances.find(ta => ta.teamId === confTeams[j].id);
	
			if (appearance !== undefined) {
				appearance.numHostWc++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numHostWcHome++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numHostWcAway++;
						}
					}
				}
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
			const appearance = appearances.find(ta => ta.teamId === confWcWinners[j].id);
		
			if (appearance !== undefined) {
				appearance.numMakeDiv++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeDivHome++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeDivAway++;
						}
					}
				}

				if (j === 0) {
					appearance.numHostDiv++;

					for (let k = 0; k < soonGames.length; k++) {
						if (soonGames[k].gameOutcome === GameOutcome.HOME) {
							const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);
	
							if (gameAppearance !== undefined) {
								gameAppearance.numHostDivHome++;
							}
						} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
							const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);
	
							if (gameAppearance !== undefined) {
								gameAppearance.numHostDivAway++;
							}
						}
					}
				}
			}
		}

		const appearance = appearances.find(ta => ta.teamId === confTeams[0].id);

		if (appearance !== undefined) {
			appearance.numMakeDiv++;
			appearance.numHostDiv++;

			for (let k = 0; k < soonGames.length; k++) {
				if (soonGames[k].gameOutcome === GameOutcome.HOME) {
					const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

					if (gameAppearance !== undefined) {
						gameAppearance.numMakeDivHome++;
						gameAppearance.numHostDivHome++;
					}
				} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
					const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

					if (gameAppearance !== undefined) {
						gameAppearance.numMakeDivAway++;
						gameAppearance.numHostDivAway++;
					}
				}
			}
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
			const appearance = appearances.find(ta => ta.teamId === confDivWinners[j].id);

			if (appearance !== undefined) {
				appearance.numMakeConf++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeConfHome++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeConfAway++;
						}
					}
				}

				if (j === 0) {
					appearance.numHostConf++;

					for (let k = 0; k < soonGames.length; k++) {
						if (soonGames[k].gameOutcome === GameOutcome.HOME) {
							const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);
	
							if (gameAppearance !== undefined) {
								gameAppearance.numHostConfHome++;
							}
						} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
							const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);
	
							if (gameAppearance !== undefined) {
								gameAppearance.numHostConfAway++;
							}
						}
					}
				}
			}
		}

		const confGame = postSeasonGames.find(g =>
			g.homeTeamId === confDivWinners[0].id && g.awayTeamId === confDivWinners[1].id);

		if (confGame === undefined) {
			const winner = await simulatePlayoffGame(confDivWinners[0], confDivWinners[1], false, false);
			confWinners = confWinners.concat(winner);

			const appearance = appearances.find(ta => ta.teamId === winner.id);

			if (appearance !== undefined) {
				appearance.numMakeSb++;

				for (let k = 0; k < soonGames.length; k++) {
					if (soonGames[k].gameOutcome === GameOutcome.HOME) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeSbHome++;
						}
					} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
						const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

						if (gameAppearance !== undefined) {
							gameAppearance.numMakeSbAway++;
						}
					}
				}
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

	const appearance = appearances.find(ta => ta.teamId === superBowlWinner.id);

	if (appearance !== undefined) {
		appearance.numWinSb++;

		for (let k = 0; k < soonGames.length; k++) {
			if (soonGames[k].gameOutcome === GameOutcome.HOME) {
				const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

				if (gameAppearance !== undefined) {
					gameAppearance.numWinSbHome++;
				}
			} else if (soonGames[k].gameOutcome === GameOutcome.AWAY) {
				const gameAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGames[k].gameId);

				if (gameAppearance !== undefined) {
					gameAppearance.numWinSbAway++;
				}
			}
		}
	}

	for (let i = 0; i < soonGames.length; i++) {
		const soonGame = soonGames[i];

		for (let j = 0; j < appearances.length; j++) {
			const appearance = appearances[j];
			const soonAppearance = appearance.gameAppearances.find(ga => ga.gameId === soonGame.gameId);

			if (soonAppearance === undefined) {
				continue;
			}

			if (soonGame.gameOutcome === GameOutcome.HOME) {
				soonAppearance.homeWins++;
			} else if (soonGame.gameOutcome === GameOutcome.AWAY) {
				soonAppearance.awayWins++;
			}
		}
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

async function analysis(appearances: TeamAppearances[], week: number): Promise<void> {
	for (let i = 0; i < appearances.length; i++) {
		const seed7Chance = appearances[i].numSeed7 / SIMS;
		const seed6Chance = appearances[i].numSeed6 / SIMS;
		const seed5Chance = appearances[i].numSeed5 / SIMS;
		const seed4Chance = appearances[i].numSeed4 / SIMS;
		const seed3Chance = appearances[i].numSeed3 / SIMS;
		const seed2Chance = appearances[i].numSeed2 / SIMS;
		const seed1Chance = appearances[i].numSeed1 / SIMS;
		const hostWcChance = appearances[i].numHostWc / SIMS;
		const hostDivChance = appearances[i].numHostDiv / SIMS;
		const hostConfChance = appearances[i].numHostConf / SIMS;
		let makeDivChance = appearances[i].numMakeDiv / SIMS;
		let makeConfChance = appearances[i].numMakeConf / SIMS;
		let makeSbChance = appearances[i].numMakeSb / SIMS;
		let winSbChance = appearances[i].numWinSb / SIMS;

		if (makeDivChance === 0 && seed7Chance > 0 && seed7Chance < 1) {
			makeDivChance = 0.000001;
		}

		if (makeConfChance === 0 && makeDivChance > 0 && makeDivChance < 1) {
			makeConfChance = 0.000001;
		}

		if (makeSbChance === 0 && makeConfChance > 0 && makeConfChance < 1) {
			makeSbChance = 0.000001;
		}

		if (winSbChance === 0 && makeSbChance > 0 && makeSbChance < 1) {
			winSbChance = 0.000001;
		}

		await teamChancesRepo.save({
			teamId: appearances[i].teamId,
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

		const gameAppearances = appearances[i].gameAppearances;

		for (let j = 0; j < gameAppearances.length; j++) {
			const numHomeWins = gameAppearances[j].homeWins;
			const numAwayWins = gameAppearances[j].awayWins;

			const homeSeed7Chance = gameAppearances[j].numSeed7Home / numHomeWins;
			const homeSeed6Chance = gameAppearances[j].numSeed6Home / numHomeWins;
			const homeSeed5Chance = gameAppearances[j].numSeed5Home / numHomeWins;
			const homeSeed4Chance = gameAppearances[j].numSeed4Home / numHomeWins;
			const homeSeed3Chance = gameAppearances[j].numSeed3Home / numHomeWins;
			const homeSeed2Chance = gameAppearances[j].numSeed2Home / numHomeWins;
			const homeSeed1Chance = gameAppearances[j].numSeed1Home / numHomeWins;
			let homeMakeDivChance = gameAppearances[j].numMakeDivHome / numHomeWins;
			let homeMakeConfChance = gameAppearances[j].numMakeConfHome / numHomeWins;
			let homeMakeSbChance = gameAppearances[j].numMakeSbHome / numHomeWins;
			let homeWinSbChance = gameAppearances[j].numWinSbHome / numHomeWins;
			const homeHostWcChance = gameAppearances[j].numHostWcHome / numHomeWins;
			const homeHostDivChance = gameAppearances[j].numHostDivHome / numHomeWins;
			const homeHostConfChance = gameAppearances[j].numHostConfHome / numHomeWins;
			const awaySeed7Chance = gameAppearances[j].numSeed7Away / numAwayWins;
			const awaySeed6Chance = gameAppearances[j].numSeed6Away / numAwayWins;
			const awaySeed5Chance = gameAppearances[j].numSeed5Away / numAwayWins;
			const awaySeed4Chance = gameAppearances[j].numSeed4Away / numAwayWins;
			const awaySeed3Chance = gameAppearances[j].numSeed3Away / numAwayWins;
			const awaySeed2Chance = gameAppearances[j].numSeed2Away / numAwayWins;
			const awaySeed1Chance = gameAppearances[j].numSeed1Away / numAwayWins;
			let awayMakeDivChance = gameAppearances[j].numMakeDivAway / numAwayWins;
			let awayMakeConfChance = gameAppearances[j].numMakeConfAway / numAwayWins;
			let awayMakeSbChance = gameAppearances[j].numMakeSbAway / numAwayWins;
			let awayWinSbChance = gameAppearances[j].numWinSbAway / numAwayWins;
			const awayHostWcChance = gameAppearances[j].numHostWcAway / numAwayWins;
			const awayHostDivChance = gameAppearances[j].numHostDivAway / numAwayWins;
			const awayHostConfChance = gameAppearances[j].numHostConfAway / numAwayWins;

			if (homeMakeDivChance === 0 && homeSeed7Chance > 0 && homeSeed7Chance < 1) {
				homeMakeDivChance = 0.000001;
			}
	
			if (homeMakeConfChance === 0 && homeMakeDivChance > 0 && homeMakeDivChance < 1) {
				homeMakeConfChance = 0.000001;
			}
	
			if (homeMakeSbChance === 0 && homeMakeConfChance > 0 && homeMakeConfChance < 1) {
				homeMakeSbChance = 0.000001;
			}
	
			if (homeWinSbChance === 0 && homeMakeSbChance > 0 && homeMakeSbChance < 1) {
				homeWinSbChance = 0.000001;
			}

			if (awayMakeDivChance === 0 && awaySeed7Chance > 0 && awaySeed7Chance < 1) {
				awayMakeDivChance = 0.000001;
			}
	
			if (awayMakeConfChance === 0 && awayMakeDivChance > 0 && awayMakeDivChance < 1) {
				awayMakeConfChance = 0.000001;
			}
	
			if (awayMakeSbChance === 0 && awayMakeConfChance > 0 && awayMakeConfChance < 1) {
				awayMakeSbChance = 0.000001;
			}
	
			if (awayWinSbChance === 0 && awayMakeSbChance > 0 && awayMakeSbChance < 1) {
				awayWinSbChance = 0.000001;
			}

			await teamChancesByGameRepo.save({
				gameId: gameAppearances[j].gameId,
				teamId: appearances[i].teamId,
				homeSeed7: (Math.abs(homeSeed7Chance - seed7Chance) > marginOfError(homeSeed7Chance, numHomeWins)) ? homeSeed7Chance : seed7Chance,
				homeSeed6: (Math.abs(homeSeed6Chance - seed6Chance) > marginOfError(homeSeed6Chance, numHomeWins)) ? homeSeed6Chance : seed6Chance,
				homeSeed5: (Math.abs(homeSeed5Chance - seed5Chance) > marginOfError(homeSeed5Chance, numHomeWins)) ? homeSeed5Chance : seed5Chance,
				homeSeed4: (Math.abs(homeSeed4Chance - seed4Chance) > marginOfError(homeSeed4Chance, numHomeWins)) ? homeSeed4Chance : seed4Chance,
				homeSeed3: (Math.abs(homeSeed3Chance - seed3Chance) > marginOfError(homeSeed3Chance, numHomeWins)) ? homeSeed3Chance : seed3Chance,
				homeSeed2: (Math.abs(homeSeed2Chance - seed2Chance) > marginOfError(homeSeed2Chance, numHomeWins)) ? homeSeed2Chance : seed2Chance,
				homeSeed1: (Math.abs(homeSeed1Chance - seed1Chance) > marginOfError(homeSeed1Chance, numHomeWins)) ? homeSeed1Chance : seed1Chance,
				homeHostWildCard: (Math.abs(homeHostWcChance - hostWcChance) > marginOfError(homeHostWcChance, numHomeWins)) ? homeHostWcChance : hostWcChance,
				homeHostDivision: (Math.abs(homeHostDivChance - hostDivChance) > marginOfError(homeHostDivChance, numHomeWins)) ? homeHostDivChance : hostDivChance,
				homeHostConference: (Math.abs(homeHostConfChance - hostConfChance) > marginOfError(homeHostConfChance, numHomeWins)) ? homeHostConfChance : hostConfChance,
				homeMakeDivision: (Math.abs(homeMakeDivChance - makeDivChance) > marginOfError(homeMakeDivChance, numHomeWins)) ? homeMakeDivChance : makeDivChance,
				homeMakeConference: (Math.abs(homeMakeConfChance - makeConfChance) > marginOfError(homeMakeConfChance, numHomeWins)) ? homeMakeConfChance : makeConfChance,
				homeMakeSuperBowl: (Math.abs(homeMakeSbChance - makeSbChance) > marginOfError(homeMakeSbChance, numHomeWins)) ? homeMakeSbChance : makeSbChance,
				homeWinSuperBowl: (Math.abs(homeWinSbChance - winSbChance) > marginOfError(homeWinSbChance, numHomeWins)) ? homeWinSbChance : winSbChance,
				awaySeed7: (Math.abs(awaySeed7Chance - seed7Chance) > marginOfError(awaySeed7Chance, numAwayWins)) ? awaySeed7Chance : seed7Chance,
				awaySeed6: (Math.abs(awaySeed6Chance - seed6Chance) > marginOfError(awaySeed6Chance, numAwayWins)) ? awaySeed6Chance : seed6Chance,
				awaySeed5: (Math.abs(awaySeed5Chance - seed5Chance) > marginOfError(awaySeed5Chance, numAwayWins)) ? awaySeed5Chance : seed5Chance,
				awaySeed4: (Math.abs(awaySeed4Chance - seed4Chance) > marginOfError(awaySeed4Chance, numAwayWins)) ? awaySeed4Chance : seed4Chance,
				awaySeed3: (Math.abs(awaySeed3Chance - seed3Chance) > marginOfError(awaySeed3Chance, numAwayWins)) ? awaySeed3Chance : seed3Chance,
				awaySeed2: (Math.abs(awaySeed2Chance - seed2Chance) > marginOfError(awaySeed2Chance, numAwayWins)) ? awaySeed2Chance : seed2Chance,
				awaySeed1: (Math.abs(awaySeed1Chance - seed1Chance) > marginOfError(awaySeed1Chance, numAwayWins)) ? awaySeed1Chance : seed1Chance,
				awayHostWildCard: (Math.abs(awayHostWcChance - hostWcChance) > marginOfError(awayHostWcChance, numAwayWins)) ? awayHostWcChance : hostWcChance,
				awayHostDivision: (Math.abs(awayHostDivChance - hostDivChance) > marginOfError(awayHostDivChance, numAwayWins)) ? awayHostDivChance : hostDivChance,
				awayHostConference: (Math.abs(awayHostConfChance - hostConfChance) > marginOfError(awayHostConfChance, numAwayWins)) ? awayHostConfChance : hostConfChance,
				awayMakeDivision: (Math.abs(awayMakeDivChance - makeDivChance) > marginOfError(awayMakeDivChance, numAwayWins)) ? awayMakeDivChance : makeDivChance,
				awayMakeConference: (Math.abs(awayMakeConfChance - makeConfChance) > marginOfError(awayMakeConfChance, numAwayWins)) ? awayMakeConfChance : makeConfChance,
				awayMakeSuperBowl: (Math.abs(awayMakeSbChance - makeSbChance) > marginOfError(awayMakeSbChance, numAwayWins)) ? awayMakeSbChance : makeSbChance,
				awayWinSuperBowl: (Math.abs(awayWinSbChance - winSbChance) > marginOfError(awayWinSbChance, numAwayWins)) ? awayWinSbChance : winSbChance,
			});
		}
	}
}

function marginOfError (p: number, n: number): number {
	return CONFIDENCE_INTERVAL * Math.sqrt((p * (1 - p)) / n);
}
