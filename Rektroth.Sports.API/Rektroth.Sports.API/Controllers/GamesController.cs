using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rektroth.Sports.API.Models;
using Rektroth.Sports.API.Views;

namespace Rektroth.Sports.API.Controllers
{
    /// <summary>
    /// A controller for games.
    /// </summary>
    [ApiController]
    [Route("[controller]")]
    public class GamesController : ControllerBase
    {
        private const short PAGE_SIZE = 20;
        private readonly SportsContext context;

        /// <summary>
        /// Creates a new instance of a games controller.
        /// </summary>
        /// <param name="context"></param>
        public GamesController(SportsContext context)
        {
            this.context = context;
        }

        /// <summary>
        /// Gets a list of games asynchronously.
        /// </summary>
        /// <param name="page">Which page of results to return.</param>
        /// <returns>A list of views of games.</returns>
        [HttpGet]
        public async Task<ActionResult<List<GameView>>> GetGamesAsync(int? page)
        {
            return await context.Games
                .OrderBy(g => g.Id)
                .Skip(page.HasValue ? PAGE_SIZE * page.Value : 0)
                .Take(PAGE_SIZE)
                .Select((g) => new GameView(g))
                .ToListAsync();
        }

        /// <summary>
        /// Gets a single game by unique identifier asynchronously.
        /// </summary>
        /// <param name="id">The unique identifier of the game to get.</param>
        /// <returns>A view of the game specified by unique identifer.</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<GameView>> GetGameAsync(short id)
        {
            GameModel? game = await context.Games.SingleOrDefaultAsync((g) => g.Id == id);
            return game == null ? NotFound() : new GameView(game);
        }
    }
}
