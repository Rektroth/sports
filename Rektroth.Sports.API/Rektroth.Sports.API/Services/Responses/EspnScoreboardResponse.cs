namespace Rektroth.Sports.API.Services.Responses
{
    /// <summary>
    /// The body of a response from the ESPN API's scoreboard endpoint.
    /// </summary>
    public class EspnScoreboardResponse
    {
        /// <summary>
        /// The events returned by the ESPN API.
        /// </summary>
        public List<EspnEvent>? Events { get; set; }
    }

    /// <summary>
    /// An event object in the ESPN API.
    /// </summary>
    public struct EspnEvent
    {
        /// <summary>
        /// The event's unique identifier.
        /// </summary>
        public string Id { get; set; }
        /// <summary>
        /// The event's scheduled starting date/time.
        /// </summary>
        public string Date { get; set; }
        /// <summary>
        /// The scheduled season of the event.
        /// </summary>
        public EspnSeason Season { get; set; }
        /// <summary>
        /// The competitions within the event.
        /// </summary>
        public List<EspnCompetition> Competitions { get; set; }
        /// <summary>
        /// The event's status.
        /// </summary>
        public EspnStatus Status { get; set; }
    }

    /// <summary>
    /// A season object in the ESPN API.
    /// </summary>
    public struct EspnSeason
    {
        /// <summary>
        /// The year of the scheduled season.
        /// </summary>
        public short Year { get; set; }
        /// <summary>
        /// The type of season.
        /// </summary>
        public EspnSeasonType Type { get; set; }
    }

    /// <summary>
    /// Type of season in the ESPN API.
    /// </summary>
    public enum EspnSeasonType
    {
        /// <summary>
        /// Pre-season type.
        /// </summary>
        Pre = 1,
        /// <summary>
        /// Regular-season type.
        /// </summary>
        Regular = 2,
        /// <summary>
        /// Post-season type.
        /// </summary>
        Post = 3
    }

    /// <summary>
    /// A competition object in the ESPN API.
    /// </summary>
    public struct EspnCompetition
    {
        /// <summary>
        /// The competition's competitors.
        /// </summary>
        public List<EspnCompetitor> Competitors { get; set; }
    }

    /// <summary>
    /// A competitor object in the ESPN API.
    /// </summary>
    public struct EspnCompetitor
    {
        /// <summary>
        /// HomeAway value of the home team.
        /// </summary>
        public const string HOME = "home";
        /// <summary>
        /// HomeAway value of the away team.
        /// </summary>
        public const string AWAY = "away";
        /// <summary>
        /// The competitor's unique identifier.
        /// </summary>
        public string Id { get; set; }
        /// <summary>
        /// Whether the competitor is the home or away team.
        /// </summary>
        public string HomeAway { get; set; }
        /// <summary>
        /// The competitor's score.
        /// </summary>
        public string Score { get; set; }
    }

    /// <summary>
    /// A status object in the ESPN API.
    /// </summary>
    public struct EspnStatus
    {
        /// <summary>
        /// The type of status.
        /// </summary>
        public EspnStatusType Type { get; set; }
    }

    /// <summary>
    /// A status type object in the ESPN API.
    /// </summary>
    public struct EspnStatusType
    {
        /// <summary>
        /// Identifier value of scheduled events.
        /// </summary>
        public const string SCHEDULED = "1";
        /// <summary>
        /// Identifier value of in progress events.
        /// </summary>
        public const string IN_PROGRESS = "2";
        /// <summary>
        /// Identifier value of finished events.
        /// </summary>
        public const string FINAL = "3";
        /// <summary>
        /// The identifier of the status type.
        /// </summary>
        public string Id { get; set; }
        /// <summary>
        /// Whether the status of the event is completed.
        /// </summary>
        public bool Completed { get; set; }
    }
}
