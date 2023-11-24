using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Rektroth.Sports.API.Models
{
    /// <summary>
    /// An NFL game.
    /// </summary>
    [Table("game")]
    public class GameModel
    {
        /// <summary>
        /// The game's unique identifier.
        /// </summary>
        [Key]
        [Column("id")]
        public int Id { get; set; }

        /// <summary>
        /// The season year of the game.
        /// </summary>
        [Required]
        [Column("season")]
        public short Season { get; set; }

        /// <summary>
        /// The game's scheduled start date/time.
        /// </summary>
        [Required]
        [Column("start_date_time")]
        public DateTime StartDateTime { get; set; }

        /// <summary>
        /// The unique identifier of the game's home team.
        /// </summary>
        [Required]
        [Column("home_team_id")]
        public short HomeTeamId { get; set; }

        /// <summary>
        /// The unique identifier of the game's away team.
        /// </summary>
        [Required]
        [Column("away_team_id")]
        public short AwayTeamId { get; set; }

        /// <summary>
        /// The projected chance of the home team winning the game.
        /// </summary>
        [Column("home_predictor_chance")]
        public decimal? HomePredictorChance { get; set; }

        /// <summary>
        /// The projected chance of the away team winning the game.
        /// </summary>
        [Column("away_predictor_chance")]
        public decimal? AwayPredictorChance { get; set; }

        /// <summary>
        /// The final score of the game's home team.
        /// </summary>
        [Column("home_team_score")]
        public short? HomeTeamScore { get; set; }

        /// <summary>
        /// The final score of the game's away team.
        /// </summary>
        [Column("away_team_score")]
        public short? AwayTeamScore { get; set; }

        /// <summary>
        /// Whether the game is a post-season game.
        /// </summary>
        [Required]
        [Column("post_season")]
        public bool PostSeason { get; set; }

        /// <summary>
        /// The home team of the game.
        /// </summary>
        [ForeignKey(nameof(HomeTeamId))]
        public TeamModel HomeTeam { get; set; }

        /// <summary>
        /// The away team of the game.
        /// </summary>
        [ForeignKey(nameof(AwayTeamId))]
        public TeamModel AwayTeam { get; set; }
    }
}
