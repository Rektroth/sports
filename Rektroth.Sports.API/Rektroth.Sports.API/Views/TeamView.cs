using Rektroth.Sports.API.Models;

namespace Rektroth.Sports.API.Views
{
    /// <summary>
    /// A view of a team.
    /// </summary>
    public class TeamView
    {
        /// <summary>
        /// The team's unqiue identifier.
        /// </summary>
        public int Id { get; set; }
        /// <summary>
        /// The unique identifier of the team's division.
        /// </summary>
        public short DivisionId { get; set; }
        /// <summary>
        /// The team's unique abbreviation.
        /// </summary>
        public string Abbreviation { get; set; }
        /// <summary>
        /// The team's name.
        /// </summary>
        public string Name { get; set; }
        /// <summary>
        /// The team's simulated changes of qualifying for the playoffs.
        /// </summary>
        public decimal? SimPlayoffChance { get; set; }
        /// <summary>
        /// The team's primary color.
        /// </summary>
        public string Color1 { get; set; }
        /// <summary>
        /// The team's alternate color.
        /// </summary>
        public string Color2 { get; set; }

        /// <summary>
        /// Creates a new instance of the team view.
        /// </summary>
        /// <param name="team">A team model.</param>
        public TeamView(TeamModel team)
        {
            Id = team.Id;
            DivisionId = team.DivisionId;
            Abbreviation = team.Abbreviation;
            Name = team.Name;
            SimPlayoffChance = team.SimPlayoffChance;
            Color1 = team.Color1;
            Color2 = team.Color2;
        }
    }
}
