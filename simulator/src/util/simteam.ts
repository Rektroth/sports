import { type Team } from '@rektroth/sports-entities';

export default class SimTeam {
	id: number;
	divisionId: number;
	conferenceId: number;
	name: string;
	winOpps: number[];
	lossOpps: number[];
	tieOpps: number[];
	divRank: number;
	elo: number;
	lastGame: Date;
	seed: number;

	constructor (team: Team) {
		this.id = team.id;
		this.divisionId = team.divisionId;
		this.conferenceId = team.division?.conferenceId ?? 0;
		this.name = team.name;
		this.winOpps = [];
		this.lossOpps = [];
		this.tieOpps = [];
		this.elo = team.eloScores !== undefined ? team.eloScores[0].eloScore : 1500;
		this.seed = 0;
	}

	winGame (teamId: number): void {
		this.winOpps.push(teamId);
	}

	loseGame (teamId: number): void {
		this.lossOpps.push(teamId);
	}

	tieGame (teamId: number): void {
		this.tieOpps.push(teamId);
	}

	getRecord (): string {
		let a = this.winOpps.length + '-' + this.lossOpps.length;
		a = this.tieOpps.length > 0 ? a + '-' + this.lossOpps.length : a;
		return a;
	}

	getRecordS (teams: SimTeam[]): string {
		const wins = this.winOpps.filter((t1) => teams.filter((t2) => t1 === t2.id).length > 0).length;
		const losses = this.lossOpps.filter((t1) => teams.filter((t2) => t1 === t2.id).length > 0).length;
		return wins + '-' + losses;
	}

	getPercentage (): number {
		if (this.winOpps.length + this.lossOpps.length + this.tieOpps.length > 0) {
			return (this.winOpps.length + (0.5 * this.tieOpps.length)) / (this.winOpps.length + this.lossOpps.length + this.tieOpps.length);
		}

		return 0;
	}

	getPercentageS (teamIds: number[]): number {
		const wins = this.winOpps.filter((t1) => teamIds.filter((t2) => t1 === t2).length > 0).length;
		const losses = this.lossOpps.filter((t1) => teamIds.filter((t2) => t1 === t2).length > 0).length;
		const ties = this.tieOpps.filter(t1 => teamIds.filter(t2 => t1 === t2).length > 0).length;

		if (wins + losses + ties > 0) {
			return (wins + (0.5 * ties)) / (wins + losses + ties);
		}

		return 0;
	}

	getStrengthOfVictory (teams: SimTeam[]): number {
		let sum = 0;

		for (let i = 0; i < this.winOpps.length; i++) {
			sum += teams.find(t => t.id === this.winOpps[i])?.getPercentage() ?? 0;
		}

		for (let i = 0; i < this.tieOpps.length; i++) {
			const x = teams.find(t => t.id === this.tieOpps[i])?.getPercentage();

			if (x !== undefined) {
				sum += 0.5 * x;
			}
		}

		return sum / (this.winOpps.length + (0.5 * this.tieOpps.length));
	}

	getStrengthOfSchedule (teams: SimTeam[]): number {
		let sum = 0;

		for (let i = 0; i < this.winOpps.length; i++) {
			sum += teams.find(t => t.id === this.winOpps[i])?.getPercentage() ?? 0;
		}

		for (let i = 0; i < this.lossOpps.length; i++) {
			sum += teams.find(t => t.id === this.lossOpps[i])?.getPercentage() ?? 0;
		}

		for (let i = 0; i < this.tieOpps.length; i++) {
			sum += teams.find(t => t.id === this.tieOpps[i])?.getPercentage() ?? 0;
		}

		return sum / (this.winOpps.length + this.lossOpps.length + this.tieOpps.length);
	}

	getAllStats (teams: SimTeam[]): string {
		const winLose = this.getRecord().padEnd(6);
		const div = this.getRecordS(teams.filter((t) => t.divisionId === this.divisionId)).padEnd(4);
		const conf = this.getRecordS(teams.filter((t) => t.conferenceId === this.conferenceId)).padEnd(4);
		const sov = String(Math.round(this.getStrengthOfVictory(teams) * 1000) / 10).padEnd(4);
		const sos = Math.round(this.getStrengthOfSchedule(teams) * 1000) / 10;
		return winLose + ' | ' + div + ' | ' + conf + ' | ' + sov + ' | ' + sos;
	}
}
