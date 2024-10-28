import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository, IsNull, Not } from 'typeorm';
import {
	type Division,
	type Game,
	type TeamChancesByGame,
	type Team,
	type TeamElo,
	SeasonType
} from '@rektroth/sports-entities';

const app = express();

class TeamView {
	id: number;
	name: string;
	division?: Division;
	seed7Chance?: number;
	seed6Chance?: number;
	seed5Chance?: number;
	seed4Chance?: number;
	seed3Chance?: number;
	seed2Chance?: number;
	seed1Chance?: number;
	hostWcChance?: number;
	hostDivChance?: number;
	hostConfChance?: number;
	makeDivChance?: number;
	makeConfChance?: number;
	makeSbChance?: number;
	winSbChance?: number;
	color1: string;
	record: string;
	elo: number;
	pct: number;
}

export default function TeamRoutes (
	teamRepo: Repository<Team>,
	teamChancesByGameRepo: Repository<TeamChancesByGame>,
	gameRepo: Repository<Game>,
	eloRepo: Repository<TeamElo>
): Express {
	app.get('/', async (req: Request, res: Response) => {
		const teams = await teamRepo.find({
			relations: {
				division: true,
				chances: true
			},
			where: {
				chances: {
					season: 2024
				}
			},
			order: {
				chances: {
					week: 'DESC'
				}
			}
		});

		let teamViews: TeamView[] = [];

		for (let i = 0; i < teams.length; i++) {
			const games = await gameRepo.findBy([{
				homeTeamId: teams[i].id,
				homeScore: Not(IsNull()),
				season: 2024,
				seasonType: SeasonType.REGULAR
			}, {
				awayTeamId: teams[i].id,
				awayScore: Not(IsNull()),
				season: 2024,
				seasonType: SeasonType.REGULAR
			}]);

			const chances = teams[i].chances?.at(0);
			console.log(chances?.seed7);

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
					(g.homeTeamId === teams[i].id && g.homeScore > g.awayScore) ||
					(g.awayTeamId === teams[i].id && g.homeScore < g.awayScore))
				.length;
			const lostGames = games
				.filter(g =>
					(g.homeTeamId === teams[i].id && g.homeScore < g.awayScore) ||
					(g.awayTeamId === teams[i].id && g.homeScore > g.awayScore))
				.length;
			const tiedGames = games
				.filter(g => g.homeScore === g.awayScore)
				.length;
			const pct = wonGames / (wonGames + lostGames);
			const rec = `${wonGames}-${lostGames}` + (tiedGames > 0 ? `-${tiedGames}` : '');

			teamViews.push({
				...teams[i],
				seed7Chance: chances?.seed7,
				seed6Chance: chances?.seed6,
				seed5Chance: chances?.seed5,
				seed4Chance: chances?.seed4,
				seed3Chance: chances?.seed3,
				seed2Chance: chances?.seed2,
				seed1Chance: chances?.seed1,
				hostWcChance: chances?.hostWildCard,
				hostDivChance: chances?.hostDivision,
				hostConfChance: chances?.hostConference,
				makeDivChance: chances?.makeDivision,
				makeConfChance: chances?.makeConference,
				makeSbChance: chances?.makeSuperBowl,
				winSbChance: chances?.winSuperBowl,
				record: rec,
				elo: eloScore?.eloScore ?? 1500,
				pct
			});
		}

		teamViews = teamViews.sort((a, b) => {
			if (a.winSbChance !== undefined && b.winSbChance !== undefined) {
				if (a.winSbChance > b.winSbChance) {
					return -1;
				} else if (a.winSbChance < b.winSbChance) {
					return 1;
				}
			}

			if (a.makeSbChance !== undefined && b.makeSbChance !== undefined) {
				if (a.makeSbChance > b.makeSbChance) {
					return -1;
				} else if (a.makeSbChance < b.makeSbChance) {
					return 1;
				}
			}

			if (a.makeConfChance !== undefined && b.makeConfChance !== undefined) {
				if (a.makeConfChance > b.makeConfChance) {
					return -1;
				} else if (a.makeConfChance < b.makeConfChance) {
					return 1;
				}
			}

			if (a.makeDivChance !== undefined && b.makeDivChance !== undefined) {
				if (a.makeDivChance > b.makeDivChance) {
					return -1;
				} else if (a.makeDivChance < b.makeDivChance) {
					return 1;
				}
			}

			if (a.seed1Chance !== undefined && b.seed1Chance !== undefined) {
				if (a.seed1Chance > b.seed1Chance) {
					return -1;
				} else if (a.seed1Chance < b.seed1Chance) {
					return 1;
				}
			}

			if (a.seed2Chance !== undefined && b.seed2Chance !== undefined) {
				if (a.seed2Chance > b.seed2Chance) {
					return -1;
				} else if (a.seed2Chance < b.seed2Chance) {
					return 1;
				}
			}

			if (a.seed3Chance !== undefined && b.seed3Chance !== undefined) {
				if (a.seed3Chance > b.seed3Chance) {
					return -1;
				} else if (a.seed3Chance < b.seed3Chance) {
					return 1;
				}
			}

			if (a.seed4Chance !== undefined && b.seed4Chance !== undefined) {
				if (a.seed4Chance > b.seed4Chance) {
					return -1;
				} else if (a.seed4Chance < b.seed4Chance) {
					return 1;
				}
			}

			if (a.seed5Chance !== undefined && b.seed5Chance !== undefined) {
				if (a.seed5Chance > b.seed5Chance) {
					return -1;
				} else if (a.seed5Chance < b.seed5Chance) {
					return 1;
				}
			}

			if (a.seed6Chance !== undefined && b.seed6Chance !== undefined) {
				if (a.seed6Chance > b.seed6Chance) {
					return -1;
				} else if (a.seed6Chance < b.seed6Chance) {
					return 1;
				}
			}

			if (a.seed7Chance !== undefined && b.seed7Chance !== undefined) {
				if (a.seed7Chance > b.seed7Chance) {
					return -1;
				} else if (a.seed7Chance < b.seed7Chance) {
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
			homeScore: Not(IsNull()),
			season: 2024,
			seasonType: SeasonType.REGULAR
		}, {
			awayTeamId: teamId,
			awayScore: Not(IsNull()),
			season: 2024,
			seasonType: SeasonType.REGULAR
		}]);

		const chances = (await teamChancesByGameRepo.find({
			relations: {
				game: {
					homeTeam: true,
					awayTeam: true
				}
			},
			where: {
				teamId,
				game: {
					homeScore: IsNull()
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
				(g.homeTeamId === teamId && g.homeScore > g.awayScore) ||
				(g.awayTeamId === teamId && g.homeScore < g.awayScore))
			.length;
		const lostGames = games
			.filter(g =>
				(g.homeTeamId === teamId && g.homeScore < g.awayScore) ||
				(g.awayTeamId === teamId && g.homeScore > g.awayScore))
			.length;
		const tiedGames = games
			.filter(g => g.homeScore === g.awayScore)
			.length;
		const rec = `${wonGames}-${lostGames}` + (tiedGames > 0 ? `-${tiedGames}` : '');

		const elo = eloScore !== null ? eloScore.eloScore : 1500;
		res.render('team', { team: { ...team, record: rec, elo }, chances });
	});

	return app;
}
