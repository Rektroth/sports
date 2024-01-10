import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { chance } from '@rektroth/elo';
import { type Game, type SimPlayoffChance } from '@rektroth/sports-entities';

const app = express();

export default function GameRoutes (gameRepo: Repository<Game>, chanceRepo: Repository<SimPlayoffChance>): Express {
	app.get('/', async (req: Request, res: Response) => {
		const games = await gameRepo.find();
		res.render('games', { games });
	});

	app.get('/:id', async (req: Request, res: Response) => {
		let chances = await chanceRepo.find({
			relations: {
				team: true,
				game: {
					homeTeam: true,
					awayTeam: true
				}
			},
			where: { gameId: Number(req.params.id) }
		});

		chances = chances.sort((a, b) => sortChances(a, b));

		const game = (await gameRepo.find({
			relations: {
				homeTeam: {
					eloScores: true
				},
				awayTeam: {
					eloScores: true
				}
			},
			where: {
				id: Number(req.params.id),
				homeTeam: {
					eloScores: {
						date: MoreThanOrEqual(new Date('2023-01-01'))
					}
				},
				awayTeam: {
					eloScores: {
						date: MoreThanOrEqual(new Date('2023-01-01'))
					}
				}
			}
		}))[0];

		const prevHomeTeamGame = (await gameRepo.find({
			where: {
				startDateTime: LessThan(game.startDateTime)
			},
			order: {
				startDateTime: 'DESC'
			},
			take: 1
		}))[0];
		const prevAwayTeamGame = (await gameRepo.find({
			where: {
				startDateTime: LessThan(game.startDateTime)
			},
			order: {
				startDateTime: 'DESC'
			},
			take: 1
		}))[0];

		const homeBreak =
			(game.startDateTime.getTime() - prevHomeTeamGame.startDateTime.getTime()) / 1000 / 60 / 60 / 24;
		const awayBreak =
			(game.startDateTime.getTime() - prevAwayTeamGame.startDateTime.getTime()) / 1000 / 60 / 60 / 24;
		const homeElo = game.homeTeam?.eloScores?.sort((a, b) => a.date.getTime() > b.date.getTime() ? -1 : 1)[0].eloScore ?? 1500;
		const awayElo = game.awayTeam?.eloScores?.sort((a, b) => a.date.getTime() > b.date.getTime() ? -1 : 1)[0].eloScore ?? 1500;
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

		const aTotalDiff = aPlayoffChanceDiff + aDivLeaderChanceDiff + aConfLeaderChanceDiff;
		const bTotalDiff = bPlayoffChanceDiff + bDivLeaderChanceDiff + bConfLeaderChanceDiff;

		if (aTotalDiff > bTotalDiff) {
			return -1;
		} else if (aTotalDiff < bTotalDiff) {
			return 1;
		}
	}

	return 0;
}
