using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Rektroth.Sports.API.Models
{
    /// <summary>
    /// A conference in the NFL.
    /// </summary>
    [Table("conference")]
    public class ConferenceModel
    {
        /// <summary>
        /// The conference's unique identifier.
        /// </summary>
        [Key]
        [Column("id")]
        public short Id { get; set; }

        /// <summary>
        /// The conference's name.
        /// </summary>
        [Required]
        [Column("name")]
        [MaxLength(28)]
        public string Name { get; set; }

        /// <summary>
        /// The divisions of the conference.
        /// </summary>
        [InverseProperty(nameof(DivisionModel.Conference))]
        public ICollection<DivisionModel> Divisions { get; set; }
    }
}
