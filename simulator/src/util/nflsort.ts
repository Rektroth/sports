import type Team from './simteam';

export default function nflSort (teams: Team[], divIds: number[]): Team[] {
	let newTeams: Team[] = [];

	for (let i = 0; i < divIds.length; i++) {
		const divTeams = teams
			.filter(t => t.divisionId === divIds[i])
			.sort((a, b) => pctSortDiv(a, b, teams));

		for (let j = 0; j < divTeams.length; j++) {
			divTeams[j].divRank = j;
		}

		newTeams = newTeams.concat(divTeams);
	}

	return newTeams.sort((a, b) => teamSort(a, b, newTeams));
}

function teamSort (a: Team, b: Team, teams: Team[]): number {
	if (a.divisionId === b.divisionId) {
		return pctSortDiv(a, b, teams);
	}

	if (a.conferenceId === b.conferenceId) {
		if (a.divRank === 0 && b.divRank !== 0) {
			return -1;
		}

		if (a.divRank !== 0 && b.divRank === 0) {
			return 1;
		}

		return pctSortConf(a, b, teams);
	}

	return 0;
}

function pctSortDiv (a: Team, b: Team, teams: Team[]): number {
	const aPct = a.getPercentage();
	const bPct = b.getPercentage();

	if (aPct < bPct) {
		return 1;
	}

	if (aPct > bPct) {
		return -1;
	}

	const divTeams = teams.filter(t => t.divisionId === a.divisionId);
	const tiedTeams = divTeams.filter(t => t.getPercentage() === aPct);
	return headToHeadSortDiv(a, b, teams, tiedTeams);
}

function pctSortConf (a: Team, b: Team, teams: Team[]): number {
	const aPct = a.getPercentage();
	const bPct = b.getPercentage();

	if (aPct < bPct) {
		return 1;
	} else if (aPct > bPct) {
		return -1;
	}

	const confTeams = teams.filter(t => t.conferenceId === a.conferenceId);
	const tiedTeams = confTeams.filter(t =>
		t.getPercentage() === aPct &&
		((a.divRank === 0 && t.divRank === 0) ||
		(a.divRank !== 0 && t.divRank !== 0)));
	return headToHeadSortConf(a, b, teams, tiedTeams);
}

function headToHeadSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const tiedTeamIds = tiedTeams.map(t => t.id);
	const tiedTeamsSorted = tiedTeams.sort((x, y) => {
		const xPct = x.getPercentageS(tiedTeamIds);
		const yPct = y.getPercentageS(tiedTeamIds);

		if (xPct < yPct) {
			return 1;
		}

		if (xPct > yPct) {
			return -1;
		}

		const stillTiedTeams = tiedTeams.filter(t =>
			t.getPercentageS(tiedTeamIds) === xPct);

		if (stillTiedTeams.length < tiedTeams.length) {
			return headToHeadSortDiv(x, y, teams, stillTiedTeams);
		}

		return divPctSortDiv(x, y, teams, tiedTeams);
	});

	for (let i = 0; i < tiedTeamsSorted.length; i++) {
		if (tiedTeamsSorted[i].id === a.id) {
			return -1;
		}

		if (tiedTeamsSorted[i].id === b.id) {
			return 1;
		}
	}

	// this *shouldn't* ever be reached
	console.log('!!!! headToHeadSortDiv return 0 somehow reached !!!!');
	return 0;
}

function headToHeadSortConf (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const divisions = tiedTeams.map(t => t.divisionId);
	const duplicateDivisions = divisions.filter((item, index) =>
		divisions.indexOf(item) !== index);

	if (duplicateDivisions.length > 0) {
		const uniqueDivisions = divisions.filter((item, index) =>
			divisions.indexOf(item) === index);
		let newTiedTeams: Team[] = [];

		for (let i = 0; i < uniqueDivisions.length; i++) {
			const divTeams = tiedTeams
				.filter(t => t.divisionId === uniqueDivisions[i])
				.sort((x, y) => x.divRank < y.divRank ? -1 : 1);
			newTiedTeams = newTiedTeams.concat(divTeams[0]);
		}

		newTiedTeams = newTiedTeams.sort((x, y) =>
			headToHeadSortConf(x, y, teams, newTiedTeams));
		const containsA = newTiedTeams.filter(t => t.id === a.id).length > 0;
		const containsB = newTiedTeams.filter(t => t.id === b.id).length > 0;

		if (containsA && containsB) {
			for (let i = 0; i < newTiedTeams.length; i++) {
				if (newTiedTeams[i].id === a.id) {
					return -1;
				}

				if (newTiedTeams[i].id === b.id) {
					return 1;
				}
			}
		}

		if (newTiedTeams[0].id === a.id) {
			return -1;
		}

		if (newTiedTeams[0].id === b.id) {
			return 1;
		}

		newTiedTeams = tiedTeams.filter(t => t.id !== newTiedTeams[0].id);
		return headToHeadSortConf(a, b, teams, newTiedTeams);
	}

	if (tiedTeams.length > 2) {
		for (let i = 0; i < tiedTeams.length; i++) {
			let allWins = true;

			for (let j = 0; j < tiedTeams.length; j++) {
				if (!tiedTeams[i].winOpps.includes(tiedTeams[j].id)) {
					allWins = false;
					break;
				}
			}

			if (allWins) {
				if (tiedTeams[i].id === a.id) {
					return -1;
				}

				if (tiedTeams[i].id === b.id) {
					return 1;
				}

				tiedTeams.filter(t => t.id !== tiedTeams[i].id);
				return headToHeadSortConf(a, b, teams, tiedTeams);
			}
		}

		for (let i = 0; i < tiedTeams.length; i++) {
			let allLosses = true;

			for (let j = 0; j < tiedTeams.length; j++) {
				if (!tiedTeams[i].lossOpps.includes(tiedTeams[j].id)) {
					allLosses = false;
					break;
				}
			}

			if (allLosses) {
				if (tiedTeams[i].id === a.id) {
					return 1;
				}

				if (tiedTeams[i].id === b.id) {
					return -1;
				}

				tiedTeams.filter(t => t.id !== tiedTeams[i].id);
				return headToHeadSortConf(a, b, teams, tiedTeams);
			}
		}

		return confPctSortConf(a, b, teams, tiedTeams);
	}

	const tiedTeamIds = tiedTeams.map(t => t.id);

	const tiedTeamsSorted = tiedTeams.sort((x, y) => {
		const xPct = x.getPercentageS(tiedTeamIds);
		const yPct = y.getPercentageS(tiedTeamIds);

		if (xPct < yPct) {
			return 1;
		}

		if (xPct > yPct) {
			return -1;
		}

		const stillTiedTeams = tiedTeams.filter(t =>
			t.getPercentageS(tiedTeamIds) === xPct);

		if (stillTiedTeams.length < tiedTeams.length) {
			return headToHeadSortConf(x, y, teams, stillTiedTeams);
		}

		return confPctSortConf(x, y, teams, stillTiedTeams);
	});

	for (let i = 0; i < tiedTeamsSorted.length; i++) {
		if (tiedTeamsSorted[i].id === a.id) {
			return -1;
		}

		if (tiedTeamsSorted[i].id === b.id) {
			return 1;
		}
	}

	// this *shouldn't* ever be reached
	console.log('!!!! headToHeadSortConf return 0 somehow reached !!!!');
	return 0;
}

function divPctSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const divTeams = teams
		.filter(t => t.divisionId === a.divisionId)
		.map(t => t.id);
	const aPct = a.getPercentageS(divTeams);
	const bPct = b.getPercentageS(divTeams);

	if (aPct < bPct) {
		return 1;
	}

	if (aPct > bPct) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getPercentageS(divTeams) === aPct);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortDiv(a, b, teams, stillTiedTeams);
	}

	return commonOpponentsPctSortDiv(a, b, teams, stillTiedTeams);
}

function commonOpponentsPctSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const commonOpps = teams.filter(t => {
		const opps = t.winOpps.concat(t.lossOpps).concat(t.tieOpps);

		if (opps.includes(a.id) && opps.includes(b.id)) {
			return true;
		}

		return false;
	}).map(t => t.id);

	if (commonOpps.length >= 4) {
		const tiedTeamsSorted = tiedTeams.sort((x, y) => {
			const xPct = x.getPercentageS(commonOpps);
			const yPct = y.getPercentageS(commonOpps);

			if (xPct < yPct) {
				return 1;
			}

			if (xPct > yPct) {
				return -1;
			}

			const stillTiedTeams = tiedTeams.filter(t =>
				t.getPercentageS(commonOpps) === xPct);

			if (stillTiedTeams.length < tiedTeams.length) {
				return headToHeadSortDiv(x, y, teams, stillTiedTeams);
			}

			return confPctSortDiv(a, b, teams, stillTiedTeams);
		});

		for (let i = 0; i < tiedTeamsSorted.length; i++) {
			if (tiedTeamsSorted[i].id === a.id) {
				return -1;
			}

			if (tiedTeamsSorted[i].id === b.id) {
				return 1;
			}
		}
	}

	return confPctSortDiv(a, b, teams, tiedTeams);
}

function commonOpponentsPctSortConf (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const commonOpps = teams.filter(t => {
		const opps = t.winOpps.concat(t.lossOpps).concat(t.tieOpps);

		if (opps.includes(a.id) && opps.includes(b.id)) {
			return true;
		}

		return false;
	}).map(t => t.id);

	if (commonOpps.length >= 4) {
		const tiedTeamsSorted = tiedTeams.sort((x, y) => {
			const xPct = x.getPercentageS(commonOpps);
			const yPct = y.getPercentageS(commonOpps);

			if (xPct < yPct) {
				return 1;
			}

			if (xPct > yPct) {
				return -1;
			}

			const stillTiedTeams = tiedTeams.filter(t =>
				t.getPercentageS(commonOpps) === xPct);

			if (stillTiedTeams.length < tiedTeams.length) {
				return headToHeadSortConf(x, y, teams, stillTiedTeams);
			}

			return sovSortConf(a, b, teams, stillTiedTeams);
		});

		for (let i = 0; i < tiedTeamsSorted.length; i++) {
			if (tiedTeamsSorted[i].id === a.id) {
				return -1;
			}

			if (tiedTeamsSorted[i].id === b.id) {
				return 1;
			}
		}
	}

	return sovSortConf(a, b, teams, tiedTeams);
}

function confPctSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const confTeams = teams
		.filter(t => t.conferenceId === a.conferenceId)
		.map(t => t.id);
	const aPct = a.getPercentageS(confTeams);
	const bPct = b.getPercentageS(confTeams);

	if (aPct < bPct) {
		return 1;
	}

	if (aPct > bPct) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getPercentageS(confTeams) === aPct);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortDiv(a, b, teams, stillTiedTeams);
	}

	return sovSortDiv(a, b, teams, stillTiedTeams);
}

function confPctSortConf (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const confTeams = teams
		.filter(t => t.conferenceId === a.conferenceId)
		.map(t => t.id);
	const aPct = a.getPercentageS(confTeams);
	const bPct = b.getPercentageS(confTeams);

	if (aPct < bPct) {
		return 1;
	}

	if (aPct > bPct) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getPercentageS(confTeams) === aPct);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortConf(a, b, teams, stillTiedTeams);
	}

	return commonOpponentsPctSortConf(a, b, teams, tiedTeams);
}

function sovSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const aSov = a.getStrengthOfVictory(teams);
	const bSov = b.getStrengthOfVictory(teams);

	if (aSov < bSov) {
		return 1;
	}

	if (aSov > bSov) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getStrengthOfVictory(teams) === aSov);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortDiv(a, b, teams, stillTiedTeams);
	}

	return sosSortDiv(a, b, teams, stillTiedTeams);
}

function sovSortConf (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const aSov = a.getStrengthOfVictory(teams);
	const bSov = b.getStrengthOfVictory(teams);

	if (aSov < bSov) {
		return 1;
	}

	if (aSov > bSov) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getStrengthOfVictory(teams) === aSov);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortConf(a, b, teams, stillTiedTeams);
	}

	return sosSortConf(a, b, teams, stillTiedTeams);
}

function sosSortDiv (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const aSos = a.getStrengthOfSchedule(teams);
	const bSos = b.getStrengthOfSchedule(teams);

	if (aSos < bSos) {
		return 1;
	}

	if (aSos > bSos) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getStrengthOfSchedule(teams) === aSos);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortDiv(a, b, teams, stillTiedTeams);
	}

	return coinToss();
}

function sosSortConf (
	a: Team,
	b: Team,
	teams: Team[],
	tiedTeams: Team[]
): number {
	const aSos = a.getStrengthOfSchedule(teams);
	const bSos = b.getStrengthOfSchedule(teams);

	if (aSos < bSos) {
		return 1;
	}

	if (aSos > bSos) {
		return -1;
	}

	const stillTiedTeams = tiedTeams.filter(t =>
		t.getStrengthOfSchedule(teams) === aSos);

	if (stillTiedTeams.length < tiedTeams.length) {
		return headToHeadSortConf(a, b, teams, stillTiedTeams);
	}

	return coinToss();
}

function coinToss (): number {
	// In reality, the NFL will at this point use 5 methods involving the total
	// number of points/touchdowns scored by each team throughout the season to
	// break ties.
	// Since this simulator merely generates outcomes rather than scores,
	// these are skipped.
	return Math.random() < 0.5 ? 1 : -1;
}
