using Rektroth.Sports.API.Models;

namespace Rektroth.Sports.API.Views
{
    /// <summary>
    /// A view of a game.
    /// </summary>
    public class GameView
    {
        /// <summary>
        /// The game's unique identifier.
        /// </summary>
        public int Id { get; set; }
        /// <summary>
        /// The year of the game's season.
        /// </summary>
        public short Season { get; set; }
        /// <summary>
        /// The game's scheduled start date-time.
        /// </summary>
        public DateTime StartDateTime { get; set; }
        /// <summary>
        /// The unique identifier of the game's home team.
        /// </summary>
        public short HomeTeamId { get; set; }
        /// <summary>
        /// The unique identifier of the game's away team.
        /// </summary>
        public short AwayTeamId { get; set; }
        /// <summary>
        /// The projected chance of the home team winning the game.
        /// </summary>
        public decimal? HomePredictorChance { get; set; }
        /// <summary>
        /// The projected chance of the away team winning the game.
        /// </summary>
        public decimal? AwayPredictorChance { get; set; }
        /// <summary>
        /// The final score of the game's home team.
        /// </summary>
        public short? HomeTeamScore { get; set; }
        /// <summary>
        /// The final score of the game's away team.
        /// </summary>
        public short? AwayTeamScore { get; set; }
        /// <summary>
        /// Whether the game is a post-season game.
        /// </summary>
        public bool PostSeason { get; set; }

        /// <summary>
        /// Creates a new instance of the game view.
        /// </summary>
        /// <param name="game">A game model.</param>
        public GameView(GameModel game)
        {
            Id = game.Id;
            Season = game.Season;
            StartDateTime = game.StartDateTime;
            HomeTeamId = game.HomeTeamId;
            AwayTeamId = game.AwayTeamId;
            HomePredictorChance = game.HomePredictorChance;
            AwayPredictorChance = game.AwayPredictorChance;
            HomeTeamScore = game.HomeTeamScore;
            AwayTeamScore = game.AwayTeamScore;
            PostSeason = game.PostSeason;
        }
    }
}
