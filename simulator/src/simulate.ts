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

	const appearances = teams.map(t => new TeamAppearances(t.id, soonGameIds));
	const conferences = await conferenceRepo.find();
	const simTeams = complete(completedGames, teams);

	for (let i = 0; i < SIMS; i++) {
		simulate(
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
	
	await analysis(appearances, lastGameWeek, simTeams);
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
	appearances: TeamAppearances[]
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
		let confTeams = teams.filter(t => t.getConferenceId() === conferences[i].id);
		confTeams = nflSort(confTeams);
		
		for (let j = 0; j <= 6; j++) {
			const appearance = appearances.find(ta => ta.teamId === confTeams[j].getId());

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
		const homeTeam = teams.find(t => t.getId() === game.homeTeamId);
		const awayTeam = teams.find(t => t.getId() === game.awayTeamId);
		const isSoonGame = soonGameIds.find(sgi => sgi === game.id) !== undefined;

		if (i < 6 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					wcWinners = wcWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					wcWinners = wcWinners.concat(awayTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			}
		} else if (i < 10 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					divWinners = divWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
					divWinners = divWinners.concat(awayTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
				}
			}
		} else if (i < 12 && homeTeam !== undefined && awayTeam !== undefined) {
			if (game.homeScore != null) {
				if (game.homeScore > game.awayScore) {
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);
					confWinners = confWinners.concat(homeTeam);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);
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
					teams.find(t => t.getId() === game.homeTeamId)?.winGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.loseGame(game.homeTeamId);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.HOME));
					}
				} else {
					superBowlWinner = awayTeam;
					teams.find(t => t.getId() === game.homeTeamId)?.loseGame(game.awayTeamId);
					teams.find(t => t.getId() === game.awayTeamId)?.winGame(game.homeTeamId);

					if (isSoonGame) {
						soonGames.push(new SimGame(game.id, GameOutcome.AWAY));
					}
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
			const appearance = appearances.find(ta => ta.teamId === confTeams[j].getId());
	
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
			const appearance = appearances.find(ta => ta.teamId === confWcWinners[j].getId());
		
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

		const appearance = appearances.find(ta => ta.teamId === confTeams[0].getId());

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
			const appearance = appearances.find(ta => ta.teamId === confDivWinners[j].getId());

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
			g.homeTeamId === confDivWinners[0].getId() && g.awayTeamId === confDivWinners[1].getId());

		if (confGame === undefined) {
			const winner = simulatePlayoffGame(confDivWinners[0], confDivWinners[1], false, false);
			confWinners = confWinners.concat(winner);

			const appearance = appearances.find(ta => ta.teamId === winner.getId());

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
		if (confWinners[0].getId() === SUPER_BOWL_HOST) {
			superBowlWinner = simulatePlayoffGame(confWinners[1], confWinners[0], false, false);
		} else if (confWinners[1].getId() === SUPER_BOWL_HOST) {
			superBowlWinner = simulatePlayoffGame(confWinners[0], confWinners[1], false, false);
		} else {
			superBowlWinner = simulatePlayoffGame(confWinners[0], confWinners[1], true, false);
		}
	}

	const appearance = appearances.find(ta => ta.teamId === superBowlWinner.getId());

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

async function analysis(appearances: TeamAppearances[], week: number, teams: SimTeam[]): Promise<void> {
	let conferences: SimTeam[][] = [];
	const conferenceIds = [...new Set(teams.map(t => t.getConferenceId()))]; // [...new Set( )] removes duplicate values

	for (let i = 0; i < conferenceIds.length; i++) {
		const conferenceId = conferenceIds[i];
		const conferenceTeams = teams.filter(t => t.getConferenceId() === conferenceId);
		conferences = conferences.concat([ nflSort(conferenceTeams) ]);
	}

	for (let i = 0; i < appearances.length; i++) {
		const appearance = appearances[i];
		const team = teams.find(t => t.getId() === appearance.teamId);
		if (team === undefined) continue;
		const conference = conferences.find(c => c.some(t => t.getConferenceId() === team.getConferenceId()));
		if (conference === undefined) continue;
		const division = conference.filter(t => t.getDivisionId() === team.getDivisionId());

		const seed7Chance = correctForEliminatedOrClinched(appearance.numSeed7 / SIMS, GAMES_PER_SEASON, team, conference[6]);
		const seed6Chance = correctForEliminatedOrClinched(appearance.numSeed6 / SIMS, GAMES_PER_SEASON, team, conference[5]);
		const seed5Chance = correctForEliminatedOrClinched(appearance.numSeed5 / SIMS, GAMES_PER_SEASON, team, conference[4]);
		const seed4Chance = correctForEliminatedOrClinched(appearance.numSeed4 / SIMS, GAMES_PER_SEASON, team, conference[3], division[0]);
		const seed3Chance = correctForEliminatedOrClinched(appearance.numSeed3 / SIMS, GAMES_PER_SEASON, team, conference[2], division[0]);
		const seed2Chance = correctForEliminatedOrClinched(appearance.numSeed2 / SIMS, GAMES_PER_SEASON, team, conference[1], division[0]);
		const seed1Chance = correctForEliminatedOrClinched(appearance.numSeed1 / SIMS, GAMES_PER_SEASON, team, conference[0], division[0]);
		const hostWcChance = appearance.numHostWc / SIMS;
		const hostDivChance = appearance.numHostDiv / SIMS;
		const hostConfChance = appearance.numHostConf / SIMS;
		const makeDivChance = correctForEliminated(appearance.numMakeDiv / SIMS, seed7Chance);
		const makeConfChance = correctForEliminated(appearance.numMakeConf / SIMS, makeDivChance);
		const makeSbChance = correctForEliminated(appearance.numMakeSb / SIMS, makeConfChance);
		const winSbChance = correctForEliminated(appearance.numWinSb / SIMS, makeSbChance);

		await teamChancesRepo.save({
			teamId: appearance.teamId,
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

		const gameAppearances = appearance.gameAppearances;

		for (let j = 0; j < gameAppearances.length; j++) {
			const gameAppearance = gameAppearances[j];
			const numHomeWins = gameAppearance.homeWins;
			const numAwayWins = gameAppearance.awayWins;

			await teamChancesByGameRepo.save({
				gameId: gameAppearance.gameId,
				teamId: appearance.teamId,
				homeSeed7: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed7Home / numHomeWins, numHomeWins),
				homeSeed6: adjustForMarginOfError(seed6Chance, gameAppearance.numSeed6Home / numHomeWins, numHomeWins),
				homeSeed5: adjustForMarginOfError(seed5Chance, gameAppearance.numSeed5Home / numHomeWins, numHomeWins),
				homeSeed4: adjustForMarginOfError(seed4Chance, gameAppearance.numSeed4Home / numHomeWins, numHomeWins),
				homeSeed3: adjustForMarginOfError(seed3Chance, gameAppearance.numSeed3Home / numHomeWins, numHomeWins),
				homeSeed2: adjustForMarginOfError(seed2Chance, gameAppearance.numSeed2Home / numHomeWins, numHomeWins),
				homeSeed1: adjustForMarginOfError(seed1Chance, gameAppearance.numSeed1Home / numHomeWins, numHomeWins),
				homeHostWildCard: adjustForMarginOfError(hostWcChance, gameAppearance.numHostWcHome / numHomeWins, numHomeWins),
				homeHostDivision: adjustForMarginOfError(hostDivChance, gameAppearance.numHostDivHome / numHomeWins, numHomeWins),
				homeHostConference: adjustForMarginOfError(hostConfChance, gameAppearance.numHostConfHome / numHomeWins, numHomeWins),
				homeMakeDivision: adjustForMarginOfError(makeDivChance, gameAppearance.numMakeDivHome / numHomeWins, numHomeWins),
				homeMakeConference: adjustForMarginOfError(makeConfChance, gameAppearance.numMakeConfHome / numHomeWins, numHomeWins),
				homeMakeSuperBowl: adjustForMarginOfError(makeSbChance, gameAppearance.numMakeSbHome / numHomeWins, numHomeWins),
				homeWinSuperBowl: adjustForMarginOfError(winSbChance, gameAppearance.numWinSbHome / numHomeWins, numHomeWins),
				awaySeed7: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed7Away / numAwayWins, numAwayWins),
				awaySeed6: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed6Away / numAwayWins, numAwayWins),
				awaySeed5: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed5Away / numAwayWins, numAwayWins),
				awaySeed4: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed4Away / numAwayWins, numAwayWins),
				awaySeed3: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed3Away / numAwayWins, numAwayWins),
				awaySeed2: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed2Away / numAwayWins, numAwayWins),
				awaySeed1: adjustForMarginOfError(seed7Chance, gameAppearance.numSeed1Away / numAwayWins, numAwayWins),
				awayHostWildCard: adjustForMarginOfError(hostWcChance, gameAppearance.numHostWcAway / numAwayWins, numAwayWins),
				awayHostDivision: adjustForMarginOfError(hostDivChance, gameAppearance.numHostDivAway / numAwayWins, numAwayWins),
				awayHostConference: adjustForMarginOfError(hostConfChance, gameAppearance.numHostConfAway / numAwayWins, numAwayWins),
				awayMakeDivision: adjustForMarginOfError(makeDivChance, gameAppearance.numMakeDivAway / numAwayWins, numAwayWins),
				awayMakeConference: adjustForMarginOfError(makeConfChance, gameAppearance.numMakeConfAway / numAwayWins, numAwayWins),
				awayMakeSuperBowl: adjustForMarginOfError(makeSbChance, gameAppearance.numMakeSbAway / numAwayWins, numAwayWins),
				awayWinSuperBowl: adjustForMarginOfError(winSbChance, gameAppearance.numWinSbAway / numAwayWins, numAwayWins),
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
	if (Math.abs(next - original) > moe) return next;
	return original;
}

/**
 * Corrects a playoff chance to be a value close to but between 0 and/or 1 when incorrectly simulated to be 0 or 1.
 * @param original      The simulated chance to be checked.
 * @param gamesInSeason Total number of games the teams play in the season.
 * @param team          The team whose chance is being checked.
 * @param opponent      The opponent team being checked against.
 * @param opponent2     The second opponent team being checked against, if applicable.
 * @returns 0.000001 if the simulated chance was 0 but mathematically shouldn't be, or 0.999999 if the simulated chance was 1 but mathematically shouldn't be; {@link original} otherwise.
 */
function correctForEliminatedOrClinched (
	original: number,
	gamesInSeason: number,
	team: SimTeam,
	opponent:SimTeam,
	opponent2: SimTeam = opponent
): number {
	if (original === 0 && team.getMagicNumber(opponent, gamesInSeason) > 0 && team.getMagicNumber(opponent2, gamesInSeason))
		return 0.000001;
	if (original === 1 && team.getMagicNumber(opponent, gamesInSeason) > 0 && team.getMagicNumber(opponent2, gamesInSeason))
		return 0.999999;
	return original;
}

/**
 * Corrects a playoff chance to be non-0 when incorrectly simulated to be 0.
 * @param original    The simulated chance to be checked.
 * @param floorChance The relevant chance that, if between 0 and 1 (non-inclusive), indicates that {@link original} should not be 0.
 * @returns 0.000001 if the simulated chance was 0 but mathematically shouldn't be; {@link original} otherwise.
 */
function correctForEliminated (original: number, floorChance: number): number {
	if (original === 0 && floorChance > 0 && floorChance < 1) return 0.000001;
	return original;
}
