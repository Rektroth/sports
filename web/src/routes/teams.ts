import 'reflect-metadata';
import express, { type Express, type Request, type Response } from 'express';
import { type Repository, IsNull, Not } from 'typeorm';
import {
	type Division,
	type Game,
	type Team,
	type TeamChances,
	type TeamChancesByGame,
	type TeamElo,
	SeasonType
} from '@rektroth/sports-entities';

const app = express();

class TeamView {
	id: number;
	name: string;
	division?: Division;
	chances?: TeamChances[];
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
				record: rec,
				elo: eloScore?.eloScore ?? 1500,
				pct
			});
		}

		teamViews = teamViews.sort((a, b) => {
			if (a.chances?.at(0)?.winSuperBowl !== undefined && b.chances?.at(0)?.winSuperBowl !== undefined) {
				if (a.chances[0].winSuperBowl > b.chances[0].winSuperBowl) {
					return -1;
				} else if (a.chances[0].winSuperBowl < b.chances[0].winSuperBowl) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.makeSuperBowl !== undefined && b.chances?.at(0)?.makeSuperBowl !== undefined) {
				if (a.chances[0].makeSuperBowl > b.chances[0].makeSuperBowl) {
					return -1;
				} else if (a.chances[0].makeSuperBowl < b.chances[0].makeSuperBowl) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.makeConference !== undefined && b.chances?.at(0)?.makeConference !== undefined) {
				if (a.chances[0].makeConference > b.chances[0].makeConference) {
					return -1;
				} else if (a.chances[0].makeConference < b.chances[0].makeConference) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.makeDivision !== undefined && b.chances?.at(0)?.makeDivision !== undefined) {
				if (a.chances[0].makeDivision > b.chances[0].makeDivision) {
					return -1;
				} else if (a.chances[0].makeDivision < b.chances[0].makeDivision) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed1 !== undefined && b.chances?.at(0)?.seed1 !== undefined) {
				if (a.chances[0].seed1 > b.chances[0].seed1) {
					return -1;
				} else if (a.chances[0].seed1 < b.chances[0].seed1) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed2 !== undefined && b.chances?.at(0)?.seed2 !== undefined) {
				if (a.chances[0].seed2 > b.chances[0].seed2) {
					return -1;
				} else if (a.chances[0].seed2 < b.chances[0].seed2) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed3 !== undefined && b.chances?.at(0)?.seed3 !== undefined) {
				if (a.chances[0].seed3 > b.chances[0].seed3) {
					return -1;
				} else if (a.chances[0].seed3 < b.chances[0].seed3) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed4 !== undefined && b.chances?.at(0)?.seed4 !== undefined) {
				if (a.chances[0].seed4 > b.chances[0].seed4) {
					return -1;
				} else if (a.chances[0].seed4 < b.chances[0].seed4) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed5 !== undefined && b.chances?.at(0)?.seed5 !== undefined) {
				if (a.chances[0].seed5 > b.chances[0].seed5) {
					return -1;
				} else if (a.chances[0].seed5 < b.chances[0].seed5) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed6 !== undefined && b.chances?.at(0)?.seed6 !== undefined) {
				if (a.chances[0].seed6 > b.chances[0].seed6) {
					return -1;
				} else if (a.chances[0].seed6 < b.chances[0].seed6) {
					return 1;
				}
			}

			if (a.chances?.at(0)?.seed7 !== undefined && b.chances?.at(0)?.seed7 !== undefined) {
				if (a.chances[0].seed7 > b.chances[0].seed7) {
					return -1;
				} else if (a.chances[0].seed7 < b.chances[0].seed7) {
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
				division: true,
				chances: true
			},
			where: {
				id: teamId,
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
