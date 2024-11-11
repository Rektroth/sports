/** Represents an NFL team that is being simulated. */
export default class SimTeam {
	/**
	 * The team's ID.
	 */
	private id: number;
	/**
	 * The ID of the team's division.
	 */
	private divisionId: number;
	/**
	 * The ID of the team's conference.
	 */
	private conferenceId: number;
	/**
	 * List of opponents beaten.
	 */
	private winOpponents: number[];
	/**
	 * List of opponents lost to.
	 */
	private lossOpponents: number[];
	/**
	 * List of opponents tied with.
	 */
	private tieOpponents: number[];
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
		elo: number = 1500,
		winOpponents: number[] = [],
		lossOpponents: number[] = [],
		tieOpponents: number[] = [],
		seed: number = 0,
		divisionRank: number = 0,
		lastGame: Date = new Date()
	) {
		this.id = structuredClone(id);
		this.divisionId = structuredClone(divisionId);
		this.conferenceId = structuredClone(conferenceId);
		this.winOpponents = structuredClone(winOpponents);
		this.lossOpponents = structuredClone(lossOpponents);
		this.tieOpponents = structuredClone(tieOpponents);
		this.elo = structuredClone(elo);
		this.seed = structuredClone(seed);
		this.divisionRank = structuredClone(divisionRank);
		this.lastGame = structuredClone(lastGame);
	}

	getId(): number {
		return this.id;
	}

	getDivisionId(): number {
		return this.divisionId;
	}

	getConferenceId(): number {
		return this.conferenceId;
	}

	getWinOpponents (): number[] {
		return this.winOpponents;
	}

	getLossOpponents (): number[] {
		return this.lossOpponents;
	}

	getTieOpponents (): number[] {
		return this.tieOpponents;
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
	 * Gets the team's total wins.
	 * @returns The team's total wins.
	 */
	getTotalWins (): number {
		return this.winOpponents.length;
	}

	/**
	 * Gets the team's total losses.
	 * @returns The team's total losses.
	 */
	getTotalLosses (): number {
		return this.lossOpponents.length;
	}

	/**
	 * Gets the team's total ties.
	 * @returns The team's total ties.
	 */
	getTotalTies (): number {
		return this.tieOpponents.length;
	}

	/**
	 * Gets the team's total wins with ties calculated as 1/2 of a win.
	 * @returns The team's total wins.
	 */
	getTotalWinsWithTies (): number {
		return this.getTotalWins() + (0.5 * this.getTotalTies());
	}

	/**
	 * Gets the team's total losses with ties calculated as 1/2 of a loss.
	 * @returns The team's total losses.
	 */
	getTotalLossesWithTies (): number {
		return this.getTotalLosses() + (0.5 * this.getTotalTies());
	}

	/**
	 * Gets the team's total games played.
	 * @returns The team's total games played.
	 */
	getTotalGamesPlayed (): number {
		return this.getTotalWins() + this.getTotalLosses() + this.getTotalTies();
	}

	/**
	 * Gets the team's total number of games remaining to be played based on a provided number of games in the season.
	 * @param totalGamesOfSeason The total number of games the team plays this season.
	 * @returns The team's total number of games remaining to be played.
	 */
	getTotalGamesRemaining (totalGamesOfSeason: number): number {
		return totalGamesOfSeason - this.getTotalGamesPlayed();
	}

	/**
	 * Gets the team's win percentage.
	 * @returns The team's win percentage.
	 */
	getWinPercentage (): number {
		const totalGames = this.getTotalGamesPlayed();

		if (totalGames === 0) {
			return 0;
		}

		return this.getTotalWinsWithTies() / totalGames;
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
		const wins = this.getTotalWins();
		const ties = this.getTotalTies();

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

		return sum / this.getTotalWinsWithTies();
	}

	/**
	 * Gets the team's strength of schedule.
	 * @param teams All the teams in the league.
	 * @returns The team's strength of schedule.
	 */
	getStrengthOfSchedule (teams: SimTeam[]): number {
		const wins = this.getTotalWins();
		const losses = this.getTotalLosses();
		const ties = this.getTotalTies();
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

	/**
	 * Gets the team's magic number to be eliminated from the seed presently held by any given team.
	 * @param team The team to be compared against.
	 * @returns The team's magic number.
	 */
	getMagicNumber (team: SimTeam, totalGamesPerSeason: number): number {
		// TODO: the "1" in the equation should be removed in the event that it is impossible for "this" to win a tiebreaker against "team"
		return totalGamesPerSeason + 1 - team.getTotalWinsWithTies() - this.getTotalLossesWithTies();
	}
}
