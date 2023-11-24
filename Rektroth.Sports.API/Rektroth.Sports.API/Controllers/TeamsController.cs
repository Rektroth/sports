using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rektroth.Sports.API.Models;
using Rektroth.Sports.API.Views;

namespace Rektroth.Sports.API.Controllers
{
    /// <summary>
    /// A controller for teams.
    /// </summary>
    [ApiController]
    [Route("[controller]")]
    public class TeamsController : ControllerBase
    {
        private readonly SportsContext context;

        /// <summary>
        /// Creates a new instance of a teams controller.
        /// </summary>
        /// <param name="context"></param>
        public TeamsController(SportsContext context)
        {
            this.context = context;
        }

        /// <summary>
        /// Gets a list of all teams asynchronously.
        /// </summary>
        /// <returns>A list views of all teams.</returns>
        [HttpGet]
        public async Task<ActionResult<List<TeamView>>> GetTeamsAsync()
        {
            return await context.Teams.Select(t => new TeamView(t)).ToListAsync();
        }

        /// <summary>
        /// Gets a single team by its unique identifier asynchronously.
        /// </summary>
        /// <param name="id">The unique identifier of the team to get.</param>
        /// <returns>A view of the team specified by unique identifier.</returns>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<TeamView>> GetTeamByIdAsync(short id)
        {
            TeamModel? team = await context.Teams.SingleOrDefaultAsync(t => t.Id == id);
            return team == null ? NotFound() : new TeamView(team);
        }

        /// <summary>
        /// Gets a single team by its unique abbreviation asynchronously.
        /// </summary>
        /// <param name="abbreviation">The unique abbreviation of the team to get.</param>
        /// <returns>A view of the team specified by unique abbreviation.</returns>
        [HttpGet("{abbreviation:regex(^[[A-Za-z]]{{2,3}}$)}")]
        public async Task<ActionResult<TeamView>> GetTeamByAbbreviationAsync(string abbreviation)
        {
            TeamModel? team = await context.Teams.SingleOrDefaultAsync(t => t.Abbreviation == abbreviation.ToUpper());
            return team == null ? NotFound() : new TeamView(team);
        }

        /// <summary>
        /// Gets a list of games by the unique identifier of either the home or away team asynchronously.
        /// </summary>
        /// <param name="id">The unique identifier of the team to get games by.</param>
        /// <returns>A list of views of the games featuring the team specified by unique identifier.</returns>
        [HttpGet("{id:int}/Games")]
        public async Task<ActionResult<List<GameView>>> GetGamesByTeamIdAsync(short id)
        {
            return await context.Games
                .Where(g => g.HomeTeamId == id || g.AwayTeamId == id)
                .Select(g => new GameView(g))
                .ToListAsync();
        }

        /// <summary>
        /// Gets a list of games by the unique abbreviation of either the home or away team asynchronously.
        /// </summary>
        /// <param name="abbreviation">The unique abbreviation of the team to get games by.</param>
        /// <returns>A list of views of the games featuring the team specified by unique abbreviation.</returns>
        [HttpGet("{abbreviation:regex(^[[A-Za-z]]{{2,3}}$)}/Games")]
        public async Task<ActionResult<List<GameView>>> GetGamesByTeamAbbreviationAsync(string abbreviation)
        {
            return await context.Games
                .Include(g => g.HomeTeam)
                .Include(g => g.AwayTeam)
                .Where(g => g.HomeTeam.Abbreviation == abbreviation || g.AwayTeam.Abbreviation == abbreviation)
                .Select(g => new GameView(g))
                .ToListAsync();
        }
    }
}
