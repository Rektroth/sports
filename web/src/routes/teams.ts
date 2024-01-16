import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository, IsNull, Not } from 'typeorm';
import {
	type Division,
	type Game,
	type SimPlayoffChance,
	type Team,
	type TeamElo,
	SeasonType
} from '@rektroth/sports-entities';

const app = express();

class TeamView {
	id: number;
	name: string;
	division?: Division;
	simPlayoffChance?: number;
	simDivLeaderChance?: number;
	simConfLeaderChance?: number;
	simMakeDivChance?: number;
	simHostDivChance?: number;
	simWinDivChance?: number;
	simHostConfChance?: number;
	simWinConfChance?: number;
	simWinSuperBowlChance?: number;
	color1: string;
	record: string;
	elo: number;
	pct: number;
}

export default function TeamRoutes (
	teamRepo: Repository<Team>,
	chanceRepo: Repository<SimPlayoffChance>,
	gameRepo: Repository<Game>,
	eloRepo: Repository<TeamElo>
): Express {
	app.get('/', async (req: Request, res: Response) => {
		const teams = await teamRepo.find({
			relations: {
				division: true
			}
		});

		let teamViews: TeamView[] = [];

		for (let i = 0; i < teams.length; i++) {
			const games = await gameRepo.findBy([{
				homeTeamId: teams[i].id,
				homeTeamScore: Not(IsNull()),
				season: 2023,
				seasonType: SeasonType.REGULAR
			}, {
				awayTeamId: teams[i].id,
				awayTeamScore: Not(IsNull()),
				season: 2023,
				seasonType: SeasonType.REGULAR
			}]);

			const eloScore = await eloRepo.findOne({
				where: {
					teamId: teams[i].id
				},
				order: {
					date: 'DESC'
				}
			});

			const wonGames = games
				.filter(g =>
					(g.homeTeamId === teams[i].id && g.homeTeamScore > g.awayTeamScore) ||
					(g.awayTeamId === teams[i].id && g.homeTeamScore < g.awayTeamScore))
				.length;
			const lostGames = games
				.filter(g =>
					(g.homeTeamId === teams[i].id && g.homeTeamScore < g.awayTeamScore) ||
					(g.awayTeamId === teams[i].id && g.homeTeamScore > g.awayTeamScore))
				.length;
			const tiedGames = games
				.filter(g => g.homeTeamScore === g.awayTeamScore)
				.length;
			const pct = wonGames / (wonGames + lostGames);
			const rec = `${wonGames}-${lostGames}` + (tiedGames > 0 ? `-${tiedGames}` : '');

			teamViews.push({
				...teams[i],
				record: rec,
				elo: eloScore?.eloScore ?? 1500,
				pct
			});
		}

		teamViews = teamViews.sort((a, b) => {
			if (a.simWinSuperBowlChance !== undefined && b.simWinSuperBowlChance !== undefined) {
				if (a.simWinSuperBowlChance > b.simWinSuperBowlChance) {
					return -1;
				} else if (a.simWinSuperBowlChance < b.simWinSuperBowlChance) {
					return 1;
				}
			}

			if (a.simWinConfChance !== undefined && b.simWinConfChance !== undefined) {
				if (a.simWinConfChance > b.simWinConfChance) {
					return -1;
				} else if (a.simWinConfChance < b.simWinConfChance) {
					return 1;
				}
			}

			if (a.simWinDivChance !== undefined && b.simWinDivChance !== undefined) {
				if (a.simWinDivChance > b.simWinDivChance) {
					return -1;
				} else if (a.simWinDivChance < b.simWinDivChance) {
					return 1;
				}
			}

			if (a.simMakeDivChance !== undefined && b.simMakeDivChance !== undefined) {
				if (a.simMakeDivChance > b.simMakeDivChance) {
					return -1;
				} else if (a.simMakeDivChance < b.simMakeDivChance) {
					return 1;
				}
			}

			if (a.simConfLeaderChance !== undefined && b.simConfLeaderChance !== undefined) {
				if (a.simConfLeaderChance > b.simConfLeaderChance) {
					return -1;
				} else if (a.simConfLeaderChance < b.simConfLeaderChance) {
					return 1;
				}
			}

			if (a.simDivLeaderChance !== undefined && b.simDivLeaderChance !== undefined) {
				if (a.simDivLeaderChance > b.simDivLeaderChance) {
					return -1;
				} else if (a.simDivLeaderChance < b.simDivLeaderChance) {
					return 1;
				}
			}

			if (a.simPlayoffChance !== undefined && b.simPlayoffChance !== undefined) {
				if (a.simPlayoffChance > b.simPlayoffChance) {
					return -1;
				} else if (a.simPlayoffChance < b.simPlayoffChance) {
					return 1;
				}
			}

			if (a.pct > b.pct) {
				return -1;
			} else if (a.pct < b.pct) {
				return 1;
			}

			if (a.elo > b.elo) {
				return -1;
			} else if (a.elo < b.elo) {
				return 1;
			}

			if (a.name < b.name) {
				return -1;
			} else if (a.name > b.name) {
				return 1;
			}

			return 0;
		});

		res.render('teams', { teams: teamViews });
	});

	app.get('/:id', async (req: Request, res: Response) => {
		const teamId = Number(req.params.id);

		if (isNaN(teamId) || teamId > 32766 || teamId < 1) {
			res.render('404');
			return;
		}

		const team = await teamRepo.findOne({
			relations: {
				division: true
			},
			where: {
				id: teamId
			}
		});

		if (team === null) {
			res.render('404');
			return;
		}

		const games = await gameRepo.findBy([{
			homeTeamId: teamId,
			homeTeamScore: Not(IsNull()),
			season: 2023,
			seasonType: SeasonType.REGULAR
		}, {
			awayTeamId: teamId,
			awayTeamScore: Not(IsNull()),
			season: 2023,
			seasonType: SeasonType.REGULAR
		}]);

		const chances = (await chanceRepo.find({
			relations: {
				game: {
					homeTeam: true,
					awayTeam: true
				}
			},
			where: {
				teamId,
				game: {
					homeTeamScore: IsNull()
				}
			},
			order: {
				game: {
					startDateTime: 'ASC'
				}
			}
		})).slice(0, 16); // "take" doesn't work with relations

		const eloScore = await eloRepo.findOne({
			where: {
				teamId
			},
			order: {
				date: 'DESC'
			}
		});

		const wonGames = games
			.filter(g =>
				(g.homeTeamId === teamId && g.homeTeamScore > g.awayTeamScore) ||
				(g.awayTeamId === teamId && g.homeTeamScore < g.awayTeamScore))
			.length;
		const lostGames = games
			.filter(g =>
				(g.homeTeamId === teamId && g.homeTeamScore < g.awayTeamScore) ||
				(g.awayTeamId === teamId && g.homeTeamScore > g.awayTeamScore))
			.length;
		const tiedGames = games
			.filter(g => g.homeTeamScore === g.awayTeamScore)
			.length;
		const rec = `${wonGames}-${lostGames}` + (tiedGames > 0 ? `-${tiedGames}` : '');

		const elo = eloScore !== null ? eloScore.eloScore : 1500;
		res.render('team', { team: { ...team, record: rec, elo }, chances });
	});

	return app;
}
