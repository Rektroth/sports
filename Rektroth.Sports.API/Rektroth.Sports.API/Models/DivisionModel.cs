using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Rektroth.Sports.API.Models
{
    /// <summary>
    /// A division of a conference.
    /// </summary>
    [Table("division")]
    public class DivisionModel
    {
        /// <summary>
        /// The division's unique identifier.
        /// </summary>
        [Key]
        [Column("id")]
        public short Id { get; set; }

        /// <summary>
        /// The unique identifier of the division's conference.
        /// </summary>
        [Required]
        [Column("conference_id")]
        public short ConferenceId { get; set; }

        /// <summary>
        /// The division's name.
        /// </summary>
        [Required]
        [Column("name")]
        [MaxLength(32)]
        public string Name { get; set; }

        /// <summary>
        /// The conference of the division.
        /// </summary>
        [ForeignKey(nameof(ConferenceId))]
        public ConferenceModel Conference { get; set; }

        /// <summary>
        /// The teams of the division.
        /// </summary>
        [InverseProperty(nameof(TeamModel.Division))]
        public ICollection<TeamModel> Teams { get; set; }
    }
}
