using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Rektroth.Sports.API.Models
{
    /// <summary>
    /// An NFL team.
    /// </summary>
    [Table("team")]
    public class TeamModel
    {
        /// <summary>
        /// The team's unique identifier.
        /// </summary>
        [Key]
        [Column("id")]
        public short Id { get; set; }

        /// <summary>
        /// The unique identifier of the team's division.
        /// </summary>
        [Required]
        [Column("division_id")]
        public short DivisionId { get; set; }

        /// <summary>
        /// The team's unique abbreviation.
        /// </summary>
        [Required]
        [Column("abbreviation")]
        [MaxLength(3)]
        public string Abbreviation { get; set; }

        /// <summary>
        /// The team's name.
        /// </summary>
        [Required]
        [Column("name")]
        [MaxLength(32)]
        public string Name { get; set; }

        /// <summary>
        /// The team's simulated chance of the qualifying for the playoffs in the current season.
        /// </summary>
        [Column("sim_playoff_chance")]
        public decimal? SimPlayoffChance { get; set; }

        /// <summary>
        /// The team's primary color.
        /// </summary>
        [Required]
        [Column("color1")]
        [MaxLength(7)]
        public string Color1 { get; set; }

        /// <summary>
        /// The team's alternate color.
        /// </summary>
        [Required]
        [Column("color2")]
        [MaxLength(7)]
        public string Color2 { get; set; }

        /// <summary>
        /// The division of the team.
        /// </summary>
        [ForeignKey(nameof(DivisionId))]
        public DivisionModel Division { get; set; }

        /// <summary>
        /// The home games of the team.
        /// </summary>
        [InverseProperty(nameof(GameModel.HomeTeam))]
        public ICollection<GameModel> HomeGames { get; set; }

        /// <summary>
        /// The away games of the team.
        /// </summary>
        [InverseProperty(nameof(GameModel.AwayTeam))]
        public ICollection<GameModel> AwayGames { get; set; }
    }
}
