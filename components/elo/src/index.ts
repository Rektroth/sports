export const AVG_SCORE = 1500;	// this is arbitrary
const HOME_BIAS = 49;			// this is based on a non-elo-related statistic
const TIE_CHANCE = 0.002514669;	// this is based on a non-elo-related statistic
const BREAK_C = 4.843299;		// this is based on a non-elo-related statistic
const BREAK_B = -30.362724;		// this is based on a non-elo-related statistic
const K = 29;
const PRE_MULT = 0.3;
const POST_MULT = 1.2;
const EQL_MULT = 2 / 3;

enum SeasonType {
	PRE = 'pre',
	REGULAR = 'regular',
	POST = 'post'
}

export enum Outcome {
	WIN = 1,
	LOSS = 2,
	TIE = 3
}

export function equalize (elo: number): number {
	return Math.round(((elo - AVG_SCORE) * EQL_MULT) + AVG_SCORE);
}

function breakBias (days: number): number {
	return (BREAK_C * days) + BREAK_B;
}

export function chance (
	teamElo: number,
	oppElo: number,
	homeAdvantage: boolean,
	oppHomeAdvantage: boolean,
	seasonType: SeasonType,
	daysSinceLastGame: number,
	oppDaysSinceLastGame: number
): number {
	if (homeAdvantage && oppHomeAdvantage) {
		throw Error('Both teams can not have the home field advantage at the same time.');
	}

	const biasedTeamElo = homeAdvantage
		? teamElo + HOME_BIAS + breakBias(daysSinceLastGame)
		: teamElo + breakBias(daysSinceLastGame);
	const biasedOppElo = oppHomeAdvantage
		? oppElo + HOME_BIAS + breakBias(oppDaysSinceLastGame)
		: oppElo + breakBias(oppDaysSinceLastGame);
	const notTieChance = seasonType === SeasonType.POST ? 1 : 1 - TIE_CHANCE;
	const multiplier = seasonType === SeasonType.PRE ? PRE_MULT : seasonType === SeasonType.POST ? POST_MULT : 1;
	const difference = multiplier * (biasedOppElo - biasedTeamElo);
	return notTieChance * (1 / (1 + Math.pow(10, difference / 400)));
}

export function newElo (
	teamElo: number,
	oppElo: number,
	homeAdvantage: boolean,
	oppHomeAdvantage: boolean,
	seasonType: SeasonType,
	daysSinceLastGame: number,
	oppDaysSinceLastGame: number,
	outcome: Outcome
): number {
	const c = chance(
		teamElo,
		oppElo,
		homeAdvantage,
		oppHomeAdvantage,
		seasonType,
		daysSinceLastGame,
		oppDaysSinceLastGame);
	const w = outcome === Outcome.WIN ? 1 : outcome === Outcome.LOSS ? 0 : 0.5;
	return Math.round(teamElo + (K * (w - c)));
}
