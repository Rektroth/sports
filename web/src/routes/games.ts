import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { LessThan, type Repository } from 'typeorm';
import { chance } from '@rektroth/elo';
import {
	type Game,
	type SeasonType,
	type Team,
	type TeamChancesByGame,
	type TeamElo
} from '@rektroth/sports-entities';

class GameView {
	id: number;
	homeTeam?: Team;
	awayTeam?: Team;
	neutralSite: boolean;
	seasonType: SeasonType;
	homeChance: number = 0;
	awayChance: number = 0;
	homeScore?: number;
	awayScore?: number;
	date: Date;

	constructor(
		id: number,
		neutralSite: boolean,
		seasonType: SeasonType,
		date: Date,
		homeTeam?: Team,
		awayTeam?: Team,
		homeScore?: number,
		awayScore?: number
	) {
		this.id = id;
		this.homeTeam = homeTeam;
		this.awayTeam = awayTeam;
		this.neutralSite = neutralSite;
		this.seasonType = seasonType;
		this.date = date;
		this.homeScore = homeScore;
		this.awayScore = awayScore;
	}
}

const app = express();

export default function GameRoutes (
	gameRepo: Repository<Game>,
	teamChancesByGameRepo: Repository<TeamChancesByGame>,
	eloRepo: Repository<TeamElo>
): Express {
	app.get('/', async (req: Request, res: Response) => {
		const games = await gameRepo.find({
			relations: {
				homeTeam: true,
				awayTeam: true
			},
			where: {
				season: 2024
			},
			order: {
				startDateTime: 'ASC'
			}
		});

		const gameViews = games.map(g => new GameView(g.id, g.neutralSite, g.seasonType, g.startDateTime, g.homeTeam, g.awayTeam, g.homeScore, g.awayScore));

		for (let i = 0; i < gameViews.length; i++) {
			const game = gameViews[i];

			const homeTeamElo = await eloRepo.findOne({
				where: {
					teamId: game.homeTeam?.id,
					date: LessThan(game.date)
				},
				order: {
					date: 'DESC'
				}
			});
	
			const awayTeamElo = await eloRepo.findOne({
				where: {
					teamId: game.awayTeam?.id,
					date: LessThan(game.date)
				},
				order: {
					date: 'DESC'
				}
			});
	
			const homeTeamLastGameDate = (await gameRepo.findOne({
				where: [{
					homeTeamId: game.homeTeam?.id,
					startDateTime: LessThan(game.date)
				}, {
					awayTeamId: game.homeTeam?.id,
					startDateTime: LessThan(game.date)
				}],
				order: {
					startDateTime: 'DESC'
				}
			}))?.startDateTime.getTime();
	
			const awayTeamLastGameDate = (await gameRepo.findOne({
				where: [{
					homeTeamId: game.awayTeam?.id,
					startDateTime: LessThan(game.date)
				}, {
					awayTeamId: game.awayTeam?.id,
					startDateTime: LessThan(game.date)
				}],
				order: {
					startDateTime: 'DESC'
				}
			}))?.startDateTime.getTime();
	
			let homeBreak = 7;
			let awayBreak = 7;
	
			if (homeTeamLastGameDate !== null && homeTeamLastGameDate !== undefined) {
				homeBreak = (game.date.getTime() - homeTeamLastGameDate) / 1000 / 60 / 60 / 24;
			}
	
			if (awayTeamLastGameDate !== null && awayTeamLastGameDate !== undefined) {
				awayBreak = (game.date.getTime() - awayTeamLastGameDate) / 1000 / 60 / 60 / 24;
			}
	
			const homeElo = homeTeamElo?.eloScore ?? 1500;
			const awayElo = awayTeamElo?.eloScore ?? 1500;
	
			game.homeChance = chance(
				homeElo,
				awayElo,
				!game.neutralSite,
				false,
				game.seasonType,
				homeBreak,
				awayBreak);
	
			game.awayChance = chance(
				awayElo,
				homeElo,
				false,
				!game.neutralSite,
				game.seasonType,
				awayBreak,
				homeBreak);
		}
		
		res.render('games', { games: gameViews });
	});

	app.get('/:id', async (req: Request, res: Response) => {
		const gameId = Number(req.params.id);

		if (isNaN(gameId) || gameId > 2147483646 || gameId < 1) {
			res.render('404');
			return;
		}

		const game = await gameRepo.findOne({
			relations: {
				homeTeam: true,
				awayTeam: true
			},
			where: {
				id: Number(req.params.id)
			}
		});

		if (game === null) {
			res.render('404');
			return;
		}

		const chances = (await teamChancesByGameRepo.find({
			relations: {
				team: true,
				game: {
					homeTeam: true,
					awayTeam: true
				}
			},
			where: {
				gameId: Number(req.params.id)
			}
		})).filter(a => totalChanceDiff(a) > 0).sort((a, b) => sortChances(a, b));

		const homeTeamElo = await eloRepo.findOne({
			where: {
				teamId: game.homeTeamId,
				date: LessThan(game.startDateTime)
			},
			order: {
				date: 'DESC'
			}
		});

		const awayTeamElo = await eloRepo.findOne({
			where: {
				teamId: game.awayTeamId,
				date: LessThan(game.startDateTime)
			},
			order: {
				date: 'DESC'
			}
		});

		const homeTeamLastGameDate = (await gameRepo.findOne({
			where: [{
				homeTeamId: game.homeTeamId,
				startDateTime: LessThan(game.startDateTime)
			}, {
				awayTeamId: game.homeTeamId,
				startDateTime: LessThan(game.startDateTime)
			}],
			order: {
				startDateTime: 'DESC'
			}
		}))?.startDateTime.getTime();

		const awayTeamLastGameDate = (await gameRepo.findOne({
			where: [{
				homeTeamId: game.awayTeamId,
				startDateTime: LessThan(game.startDateTime)
			}, {
				awayTeamId: game.awayTeamId,
				startDateTime: LessThan(game.startDateTime)
			}],
			order: {
				startDateTime: 'DESC'
			}
		}))?.startDateTime.getTime();

		let homeBreak = 7;
		let awayBreak = 7;

		if (homeTeamLastGameDate !== null && homeTeamLastGameDate !== undefined) {
			homeBreak = (game.startDateTime.getTime() - homeTeamLastGameDate) / 1000 / 60 / 60 / 24;
		}

		if (awayTeamLastGameDate !== null && awayTeamLastGameDate !== undefined) {
			awayBreak = (game.startDateTime.getTime() - awayTeamLastGameDate) / 1000 / 60 / 60 / 24;
		}

		const homeElo = homeTeamElo?.eloScore ?? 1500;
		const awayElo = awayTeamElo?.eloScore ?? 1500;

		const homeChance = chance(
			homeElo,
			awayElo,
			!game.neutralSite,
			false,
			game.seasonType,
			homeBreak,
			awayBreak);

		const awayChance = chance(
			awayElo,
			homeElo,
			false,
			!game.neutralSite,
			game.seasonType,
			awayBreak,
			homeBreak);

		res.render('game', {
			chances,
			game: {
				...game,
				homePredictorChance: homeChance,
				awayPredictorChance: awayChance
			}
		});
	});

	return app;
}

function sortChances (a: TeamChancesByGame, b: TeamChancesByGame): number {
	const aTotalDiff = totalChanceDiff(a);
	const bTotalDiff = totalChanceDiff(b);

	if (aTotalDiff > bTotalDiff) {
		return -1;
	} else if (aTotalDiff < bTotalDiff) {
		return 1;
	}

	return 0;
}

function totalChanceDiff(chances: TeamChancesByGame): number {
	let seed7ChanceDiff = chances.homeSeed7 > chances.awaySeed7
		? (chances.homeSeed7 / chances.awaySeed7) - 1
		: (chances.awaySeed7 / chances.homeSeed7) - 1;
	let seed6ChanceDiff = chances.homeSeed6 > chances.awaySeed6
		? (chances.homeSeed6 / chances.awaySeed6) - 1
		: (chances.awaySeed6 / chances.homeSeed6) - 1;
	let seed5ChanceDiff = chances.homeSeed5 > chances.awaySeed5
		? (chances.homeSeed5 / chances.awaySeed5) - 1
		: (chances.awaySeed5 / chances.homeSeed5) - 1;
	let seed4ChanceDiff = chances.homeSeed4 > chances.awaySeed4
		? (chances.homeSeed4 / chances.awaySeed4) - 1
		: (chances.awaySeed4 / chances.homeSeed4) - 1;
	let seed3ChanceDiff = chances.homeSeed3 > chances.awaySeed3
		? (chances.homeSeed3 / chances.awaySeed3) - 1
		: (chances.awaySeed3 / chances.homeSeed3) - 1;
	let seed2ChanceDiff = chances.homeSeed2 > chances.awaySeed2
		? (chances.homeSeed2 / chances.awaySeed2) - 1
		: (chances.awaySeed2 / chances.homeSeed2) - 1;
	let seed1ChanceDiff = chances.homeSeed1 > chances.awaySeed1
		? (chances.homeSeed1 / chances.awaySeed1) - 1
		: (chances.awaySeed1 / chances.homeSeed1) - 1;
	let hostWcChanceDiff = chances.homeHostWildCard > chances.awayHostWildCard
		? (chances.homeHostWildCard / chances.awayHostWildCard) - 1
		: (chances.awayHostWildCard / chances.homeHostWildCard) - 1;
	let hostDivChanceDiff = chances.homeHostDivision > chances.awayHostDivision
		? (chances.homeHostDivision / chances.awayHostDivision) - 1
		: (chances.awayHostDivision / chances.homeHostDivision) - 1;
	let hostConfChanceDiff = chances.homeHostConference > chances.awayHostConference
		? (chances.homeHostConference / chances.awayHostConference) - 1
		: (chances.awayHostConference / chances.homeHostConference) - 1;
	let makeDivChanceDiff = chances.homeMakeDivision > chances.awayMakeDivision
		? (chances.homeMakeDivision / chances.awayMakeDivision) - 1
		: (chances.awayMakeDivision / chances.homeMakeDivision) - 1;
	let makeConfChanceDiff = chances.homeMakeConference > chances.awayMakeConference
		? (chances.homeMakeConference / chances.awayMakeConference) - 1
		: (chances.awayMakeConference / chances.homeMakeConference) - 1;
	let makeSbChanceDiff = chances.homeMakeSuperBowl > chances.awayMakeSuperBowl
		? (chances.homeMakeSuperBowl / chances.awayMakeSuperBowl) - 1
		: (chances.awayMakeSuperBowl / chances.homeMakeSuperBowl) - 1;
	let winSbChanceDiff = chances.homeWinSuperBowl > chances.awayWinSuperBowl
		? (chances.homeWinSuperBowl / chances.awayWinSuperBowl) - 1
		: (chances.awayWinSuperBowl / chances.homeWinSuperBowl) - 1;

	if (Number.isNaN(seed7ChanceDiff)) {
		seed7ChanceDiff = 0;
	}

	if (Number.isNaN(seed6ChanceDiff)) {
		seed6ChanceDiff = 0;
	}

	if (Number.isNaN(seed5ChanceDiff)) {
		seed5ChanceDiff = 0;
	}

	if (Number.isNaN(seed4ChanceDiff)) {
		seed4ChanceDiff = 0;
	}

	if (Number.isNaN(seed3ChanceDiff)) {
		seed3ChanceDiff = 0;
	}

	if (Number.isNaN(seed2ChanceDiff)) {
		seed2ChanceDiff = 0;
	}

	if (Number.isNaN(seed1ChanceDiff)) {
		seed1ChanceDiff = 0;
	}

	if (Number.isNaN(hostWcChanceDiff)) {
		hostWcChanceDiff = 0;
	}

	if (Number.isNaN(hostDivChanceDiff)) {
		hostDivChanceDiff = 0;
	}

	if (Number.isNaN(hostConfChanceDiff)) {
		hostConfChanceDiff = 0;
	}

	if (Number.isNaN(makeDivChanceDiff)) {
		makeDivChanceDiff = 0;
	}

	if (Number.isNaN(makeConfChanceDiff)) {
		makeConfChanceDiff = 0;
	}

	if (Number.isNaN(makeSbChanceDiff)) {
		makeSbChanceDiff = 0;
	}

	if (Number.isNaN(winSbChanceDiff)) {
		winSbChanceDiff = 0;
	}

	return seed7ChanceDiff +
		seed6ChanceDiff +
		seed5ChanceDiff +
		seed4ChanceDiff +
		seed3ChanceDiff +
		seed2ChanceDiff +
		seed1ChanceDiff +
		hostWcChanceDiff +
		hostDivChanceDiff +
		hostConfChanceDiff +
		makeDivChanceDiff +
		makeConfChanceDiff +
		makeSbChanceDiff +
		winSbChanceDiff;
}
