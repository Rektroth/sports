import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository, LessThan } from 'typeorm';
import { chance } from '@rektroth/elo';
import { type Game, type SimPlayoffChance, type TeamElo } from '@rektroth/sports-entities';

const app = express();

export default function GameRoutes (
	gameRepo: Repository<Game>,
	chanceRepo: Repository<SimPlayoffChance>,
	eloRepo: Repository<TeamElo>
): Express {
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

		const chances = (await chanceRepo.find({
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
				teamId: game.homeTeamId
			},
			order: {
				date: 'DESC'
			}
		});

		const awayTeamElo = await eloRepo.findOne({
			where: {
				teamId: game.awayTeamId
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

function sortChances (a: SimPlayoffChance, b: SimPlayoffChance): number {
	const aTotalDiff = totalChanceDiff(a);
	const bTotalDiff = totalChanceDiff(b);

	if (aTotalDiff > bTotalDiff) {
		return -1;
	} else if (aTotalDiff < bTotalDiff) {
		return 1;
	}

	return 0;
}

function totalChanceDiff (chance: SimPlayoffChance): number {
	if (chance.team?.simPlayoffChance !== undefined &&
		chance.team?.simDivLeaderChance !== undefined &&
		chance.team?.simConfLeaderChance !== undefined
	) {
		let playoffChanceDiff = chance.playoffChanceWithHomeWin > chance.playoffChanceWithAwayWin
			? (chance.playoffChanceWithHomeWin / chance.playoffChanceWithAwayWin) - 1
			: (chance.playoffChanceWithAwayWin / chance.playoffChanceWithHomeWin) - 1;
		let divLeaderChanceDiff = chance.divLeaderChanceWithHomeWin > chance.divLeaderChanceWithAwayWin
			? (chance.divLeaderChanceWithHomeWin / chance.divLeaderChanceWithAwayWin) - 1
			: (chance.divLeaderChanceWithAwayWin / chance.divLeaderChanceWithHomeWin) - 1;
		let confLeaderChanceDiff = chance.confLeaderChanceWithHomeWin > chance.confLeaderChanceWithAwayWin
			? (chance.confLeaderChanceWithHomeWin / chance.confLeaderChanceWithAwayWin) - 1
			: (chance.confLeaderChanceWithAwayWin / chance.confLeaderChanceWithHomeWin) - 1;
		let makeDivChanceDiff = chance.makeDivChanceWithHomeWin > chance.makeDivChanceWithAwayWin
			? (chance.makeDivChanceWithHomeWin / chance.makeDivChanceWithAwayWin) - 1
			: (chance.makeDivChanceWithAwayWin / chance.makeDivChanceWithHomeWin) - 1;
		let divWinnerChanceDiff = chance.divWinnerChanceWithHomeWin > chance.divWinnerChanceWithAwayWin
			? (chance.divWinnerChanceWithHomeWin / chance.divWinnerChanceWithAwayWin) - 1
			: (chance.divWinnerChanceWithAwayWin / chance.divWinnerChanceWithHomeWin) - 1;
		let confWinnerChanceDiff = chance.confWinnerChanceWithHomeWin > chance.confWinnerChanceWithAwayWin
			? (chance.confWinnerChanceWithHomeWin / chance.confWinnerChanceWithAwayWin) - 1
			: (chance.confWinnerChanceWithAwayWin / chance.confWinnerChanceWithHomeWin) - 1;
		let superBowlWinnerChanceDiff = chance.superBowlWinnerChanceWithHomeWin > chance.superBowlWinnerChanceWithAwayWin
			? (chance.superBowlWinnerChanceWithHomeWin / chance.superBowlWinnerChanceWithAwayWin) - 1
			: (chance.superBowlWinnerChanceWithAwayWin / chance.superBowlWinnerChanceWithHomeWin) - 1;

		if (Number.isNaN(playoffChanceDiff)) {
			playoffChanceDiff = 0;
		}

		if (Number.isNaN(divLeaderChanceDiff)) {
			divLeaderChanceDiff = 0;
		}

		if (Number.isNaN(confLeaderChanceDiff)) {
			confLeaderChanceDiff = 0;
		}

		if (Number.isNaN(makeDivChanceDiff)) {
			makeDivChanceDiff = 0;
		}

		if (Number.isNaN(divWinnerChanceDiff)) {
			divWinnerChanceDiff = 0;
		}

		if (Number.isNaN(confWinnerChanceDiff)) {
			confWinnerChanceDiff = 0;
		}

		if (Number.isNaN(superBowlWinnerChanceDiff)) {
			superBowlWinnerChanceDiff = 0;
		}

		const totalDiff = playoffChanceDiff +
			divLeaderChanceDiff +
			confLeaderChanceDiff +
			makeDivChanceDiff +
			divWinnerChanceDiff +
			confWinnerChanceDiff +
			superBowlWinnerChanceDiff;

		return totalDiff;
	}

	return 0;
}
