import { type Team } from '@rektroth/sports-entities';

/** Represents an NFL team that is being simulated. */
export default class SimTeam {
	/**
	 * The team's ID.
	 */
	id: number;
	/**
	 * The ID of the team's division.
	 */
	divisionId: number;
	/**
	 * The ID of the team's conference.
	 */
	conferenceId: number;
	/**
	 * List of opponents beaten.
	 */
	winOpponents: number[];
	/**
	 * List of opponents lost to.
	 */
	lossOpponents: number[];
	/**
	 * List of opponents tied with.
	 */
	tieOpponents: number[];
	/**
	 * The team's elo rating.
	 */
	elo: number;
	/**
	 * The date of the team's last game.
	 */
	lastGame: Date;
	/**
	 * The team's seed in the conference.
	 * This property is for sorting.
	 */
	seed: number;
	/**
	 * The team's rank in their division.
	 * This property is for sorting.
	 */
	divisionRank: number;

	/**
	 * Creates a new instance of SimTeam.
	 * @param team - The team entity being simulated.
	 */
	constructor (
		id: number,
		divisionId: number,
		conferenceId: number,
		winOpponents: number[] = [],
		lossOpponents: number[] = [],
		tieOpponents: number[] = [],
		elo: number = 1500,
		seed: number = 0,
		divisionRank: number = 0,
		lastGame: Date = new Date()
	) {
		this.id = id;
		this.divisionId = divisionId;
		this.conferenceId = conferenceId;
		this.winOpponents = winOpponents;
		this.lossOpponents = lossOpponents;
		this.tieOpponents = tieOpponents;
		this.elo = elo;
		this.seed = seed;
		this.divisionRank = divisionRank;
		this.lastGame = lastGame;
	}

	/**
	 * Adds a team to the list of opponents beaten.
	 * @param teamId The ID of the opponent beaten.
	 */
	winGame (teamId: number): void {
		this.winOpponents.push(teamId);
	}

	/**
	 * Adds a team to the list of opponents lost to.
	 * @param teamId The ID of the opponent lost to.
	 */
	loseGame (teamId: number): void {
		this.lossOpponents.push(teamId);
	}

	/**
	 * Adds a team to the list of opponents tied with.
	 * @param teamId The ID of the opponent tied with.
	 */
	tieGame (teamId: number): void {
		this.tieOpponents.push(teamId);
	}

	/**
	 * Gets the team's win percentage.
	 * @returns The team's win percentage.
	 */
	getWinPercentage (): number {
		const totalGames = this.winOpponents.length + this.lossOpponents.length + this.tieOpponents.length;

		if (totalGames === 0) {
			return 0;
		}

		const wins = this.winOpponents.length;
		const ties = this.tieOpponents.length;
		return (wins + (0.5 * ties)) / totalGames;
	}

	/**
	 * Gets the team's win percentage against a specified list of opponents.
	 * @param teamIds The IDs of the opponents to get the team's win percentage against.
	 * @returns The team's win percentage against the specified opponents.
	 */
	getWinPercentageAgainstOpponents (teamIds: number[]): number {
		const wins = this.winOpponents.filter((t1) => teamIds.filter((t2) => t1 === t2).length > 0).length;
		const losses = this.lossOpponents.filter((t1) => teamIds.filter((t2) => t1 === t2).length > 0).length;
		const ties = this.tieOpponents.filter(t1 => teamIds.filter(t2 => t1 === t2).length > 0).length;
		const totalGames = wins + losses + ties;

		if (totalGames === 0) {
			return 0;
		}

		return (wins + (0.5 * ties)) / totalGames;
	}

	/**
	 * Gets the team's strength of victory.
	 * @param teams All the teams in the league.
	 * @returns The team's strength of victory.
	 */
	getStrengthOfVictory (teams: SimTeam[]): number {
		const wins = this.winOpponents.length;
		const ties = this.tieOpponents.length;

		if (wins === 0 && ties === 0) {
			return 0;
		}

		let sum = 0;

		for (let i = 0; i < wins; i++) {
			sum += teams.find(t => t.id === this.winOpponents[i])?.getWinPercentage() ?? 0;
		}

		for (let i = 0; i < ties; i++) {
			sum += 0.5 * (teams.find(t => t.id === this.tieOpponents[i])?.getWinPercentage() ?? 0);
		}

		return sum / (wins + (0.5 * ties));
	}

	/**
	 * Gets the team's strength of schedule.
	 * @param teams All the teams in the league.
	 * @returns The team's strength of schedule.
	 */
	getStrengthOfSchedule (teams: SimTeam[]): number {
		const wins = this.winOpponents.length;
		const losses = this.lossOpponents.length;
		const ties = this.tieOpponents.length;
		const totalGames = wins + losses + ties;
		let sum = 0;

		for (let i = 0; i < wins; i++) {
			sum += teams.find(t => t.id === this.winOpponents[i])?.getWinPercentage() ?? 0;
		}

		for (let i = 0; i < losses; i++) {
			sum += teams.find(t => t.id === this.lossOpponents[i])?.getWinPercentage() ?? 0;
		}

		for (let i = 0; i < ties; i++) {
			sum += teams.find(t => t.id === this.tieOpponents[i])?.getWinPercentage() ?? 0;
		}

		return sum / totalGames;
	}
}
