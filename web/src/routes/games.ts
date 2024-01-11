import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository } from 'typeorm';
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

		const game = await gameRepo.findOneBy({ id: Number(req.params.id) });

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
		})).sort((a, b) => sortChances(a, b));

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

		const homeBreak = homeTeamElo !== null ?
			(game.startDateTime.getTime() - homeTeamElo.date.getTime()) / 1000 / 60 / 60 / 24 :
			7;

		const awayBreak = awayTeamElo !== null ?
			(game.startDateTime.getTime() - awayTeamElo?.date.getTime()) / 1000 / 60 / 60 / 24 :
			7;

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
	if (a.team?.simPlayoffChance !== undefined && b.team?.simPlayoffChance !== undefined &&
		a.team?.simDivLeaderChance !== undefined && b.team?.simDivLeaderChance !== undefined &&
		a.team?.simConfLeaderChance !== undefined && b.team?.simConfLeaderChance !== undefined
	) {
		let aPlayoffChanceDiff = a.playoffChanceWithHomeWin > a.playoffChanceWithAwayWin
			? (a.playoffChanceWithHomeWin / a.playoffChanceWithAwayWin) - 1
			: (a.playoffChanceWithAwayWin / a.playoffChanceWithHomeWin) - 1;
		let bPlayoffChanceDiff = b.playoffChanceWithHomeWin > b.playoffChanceWithAwayWin
			? (b.playoffChanceWithHomeWin / b.playoffChanceWithAwayWin) - 1
			: (b.playoffChanceWithAwayWin / b.playoffChanceWithHomeWin) - 1;
		let aDivLeaderChanceDiff = a.divLeaderChanceWithHomeWin > a.divLeaderChanceWithAwayWin
			? (a.divLeaderChanceWithHomeWin / a.divLeaderChanceWithAwayWin) - 1
			: (a.divLeaderChanceWithAwayWin / a.divLeaderChanceWithHomeWin) - 1;
		let bDivLeaderChanceDiff = b.divLeaderChanceWithHomeWin > b.divLeaderChanceWithAwayWin
			? (b.divLeaderChanceWithHomeWin / b.divLeaderChanceWithAwayWin) - 1
			: (b.divLeaderChanceWithAwayWin / b.divLeaderChanceWithHomeWin) - 1;
		let aConfLeaderChanceDiff = a.confLeaderChanceWithHomeWin > a.confLeaderChanceWithAwayWin
			? (a.confLeaderChanceWithHomeWin / a.confLeaderChanceWithAwayWin) - 1
			: (a.confLeaderChanceWithAwayWin / a.confLeaderChanceWithHomeWin) - 1;
		let bConfLeaderChanceDiff = b.confLeaderChanceWithHomeWin > b.confLeaderChanceWithAwayWin
			? (b.confLeaderChanceWithHomeWin / b.confLeaderChanceWithAwayWin) - 1
			: (b.confLeaderChanceWithAwayWin / b.confLeaderChanceWithHomeWin) - 1;
		let aMakeDivChanceDiff = a.makeDivChanceWithHomeWin > a.makeDivChanceWithAwayWin
			? (a.makeDivChanceWithHomeWin / a.makeDivChanceWithAwayWin) - 1
			: (a.makeDivChanceWithAwayWin / a.makeDivChanceWithHomeWin) - 1;
		let bMakeDivChanceDiff = b.makeDivChanceWithHomeWin > b.makeDivChanceWithAwayWin
			? (b.makeDivChanceWithHomeWin / b.makeDivChanceWithAwayWin) - 1
			: (b.makeDivChanceWithAwayWin / b.makeDivChanceWithHomeWin) - 1;
		let aDivWinnerChanceDiff = a.divWinnerChanceWithHomeWin > a.divWinnerChanceWithAwayWin
			? (a.divWinnerChanceWithHomeWin / a.divWinnerChanceWithAwayWin) - 1
			: (a.divWinnerChanceWithAwayWin / a.divWinnerChanceWithHomeWin) - 1;
		let bDivWinnerChanceDiff = b.divWinnerChanceWithHomeWin > b.divWinnerChanceWithAwayWin
			? (b.divWinnerChanceWithHomeWin / b.divWinnerChanceWithAwayWin) - 1
			: (b.divWinnerChanceWithAwayWin / b.divWinnerChanceWithHomeWin) - 1;
		let aConfWinnerChanceDiff = a.confWinnerChanceWithHomeWin > a.confWinnerChanceWithAwayWin
			? (a.confWinnerChanceWithHomeWin / a.confWinnerChanceWithAwayWin) - 1
			: (a.confWinnerChanceWithAwayWin / a.confWinnerChanceWithHomeWin) - 1;
		let bConfWinnerChanceDiff = b.confWinnerChanceWithHomeWin > b.confWinnerChanceWithAwayWin
			? (b.confWinnerChanceWithHomeWin / b.confWinnerChanceWithAwayWin) - 1
			: (b.confWinnerChanceWithAwayWin / b.confWinnerChanceWithHomeWin) - 1;
		let aSuperBowlWinnerChanceDiff = a.superBowlWinnerChanceWithHomeWin > a.superBowlWinnerChanceWithAwayWin
			? (a.superBowlWinnerChanceWithHomeWin / a.superBowlWinnerChanceWithAwayWin) - 1
			: (a.superBowlWinnerChanceWithAwayWin / a.superBowlWinnerChanceWithHomeWin) - 1;
		let bSuperBowlWinnerChanceDiff = b.superBowlWinnerChanceWithHomeWin > b.superBowlWinnerChanceWithAwayWin
			? (b.superBowlWinnerChanceWithHomeWin / b.superBowlWinnerChanceWithAwayWin) - 1
			: (b.superBowlWinnerChanceWithAwayWin / b.superBowlWinnerChanceWithHomeWin) - 1;

		if (Number.isNaN(aPlayoffChanceDiff)) {
			aPlayoffChanceDiff = 0;
		}

		if (Number.isNaN(bPlayoffChanceDiff)) {
			bPlayoffChanceDiff = 0;
		}

		if (Number.isNaN(aDivLeaderChanceDiff)) {
			aDivLeaderChanceDiff = 0;
		}

		if (Number.isNaN(bDivLeaderChanceDiff)) {
			bDivLeaderChanceDiff = 0;
		}

		if (Number.isNaN(aConfLeaderChanceDiff)) {
			aConfLeaderChanceDiff = 0;
		}

		if (Number.isNaN(bConfLeaderChanceDiff)) {
			bConfLeaderChanceDiff = 0;
		}

		if (Number.isNaN(aMakeDivChanceDiff)) {
			aMakeDivChanceDiff = 0;
		}

		if (Number.isNaN(bMakeDivChanceDiff)) {
			bMakeDivChanceDiff = 0;
		}

		if (Number.isNaN(aDivWinnerChanceDiff)) {
			aDivWinnerChanceDiff = 0;
		}

		if (Number.isNaN(bDivWinnerChanceDiff)) {
			bDivWinnerChanceDiff = 0;
		}

		if (Number.isNaN(aConfWinnerChanceDiff)) {
			aConfWinnerChanceDiff = 0;
		}

		if (Number.isNaN(bConfWinnerChanceDiff)) {
			bConfWinnerChanceDiff = 0;
		}

		if (Number.isNaN(aSuperBowlWinnerChanceDiff)) {
			aSuperBowlWinnerChanceDiff = 0;
		}

		if (Number.isNaN(bSuperBowlWinnerChanceDiff)) {
			bSuperBowlWinnerChanceDiff = 0;
		}

		const aTotalDiff = aPlayoffChanceDiff +
			aDivLeaderChanceDiff +
			aConfLeaderChanceDiff +
			aMakeDivChanceDiff +
			aDivWinnerChanceDiff +
			aConfWinnerChanceDiff +
			aSuperBowlWinnerChanceDiff;
		const bTotalDiff = bPlayoffChanceDiff +
			bDivLeaderChanceDiff +
			bConfLeaderChanceDiff +
			bMakeDivChanceDiff +
			bDivWinnerChanceDiff +
			bConfWinnerChanceDiff +
			bSuperBowlWinnerChanceDiff;

		if (aTotalDiff > bTotalDiff) {
			return -1;
		} else if (aTotalDiff < bTotalDiff) {
			return 1;
		}
	}

	return 0;
}
