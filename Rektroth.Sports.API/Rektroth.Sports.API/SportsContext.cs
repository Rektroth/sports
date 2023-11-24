using Microsoft.EntityFrameworkCore;
using Rektroth.Sports.API.Models;

namespace Rektroth.Sports.API
{
    /// <summary>
    /// A session with the Sports database.
    /// </summary>
    public class SportsContext : DbContext
    {
        /// <summary>
        /// NFL conferences.
        /// </summary>
        public DbSet<ConferenceModel> Conferences { get; set; }
        /// <summary>
        /// NFL divisions.
        /// </summary>
        public DbSet<DivisionModel> Divisions { get; set; }
        /// <summary>
        /// NFL teams.
        /// </summary>
        public DbSet<TeamModel> Teams { get; set; }
        /// <summary>
        /// NFL games.
        /// </summary>
        public DbSet<GameModel> Games { get; set; }
        protected readonly IConfiguration Configuration;

        /// <summary>
        /// Creates a new session with the Sports database.
        /// </summary>
        /// <param name="configuration"></param>
        public SportsContext(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        protected override void OnConfiguring(DbContextOptionsBuilder options)
        {
            options.UseNpgsql("Host=localhost;Database=nfl;Username=postgres;Password=password");
        }
    }
}
