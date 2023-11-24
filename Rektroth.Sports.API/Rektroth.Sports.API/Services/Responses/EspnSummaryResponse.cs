namespace Rektroth.Sports.API.Services.Responses
{
    /// <summary>
    /// The body of a response from the ESPN API's summary endpoint.
    /// </summary>
    public class EspnSummaryResponse
    {
        /// <summary>
        /// The predictor for the summarized event.
        /// </summary>
        public EspnPredictor Predictor { get; set; }
    }

    /// <summary>
    /// A predictor object in the ESPN API.
    /// </summary>
    public struct EspnPredictor
    {
        /// <summary>
        /// The predictor's values for the home team.
        /// </summary>
        public EspnTeam HomeTeam { get; set; }
        /// <summary>
        /// The predictor's values for the away team.
        /// </summary>
        public EspnTeam AwayTeam { get; set; }
    }

    /// <summary>
    /// A team object in the ESPN API.
    /// </summary>
    public struct EspnTeam
    {
        /// <summary>
        /// The team's unique identifier.
        /// </summary>
        public string Id { get; set; }
        /// <summary>
        /// The team's projected chance of winning, out of 100.
        /// </summary>
        public string GameProjection { get; set; }
    }
}
