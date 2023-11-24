using Microsoft.EntityFrameworkCore;
using Rektroth.Sports.API.Models;
using Rektroth.Sports.API.Services.Responses;
using System.Text.Json;

namespace Rektroth.Sports.API.Services
{
    /// <summary>
    /// Service that routinely updates the database with the latest game data from ESPN.
    /// </summary>
    public class GameUpdateService : BackgroundService
    {
        private const short FIRST_SEASON = 2002;
        private const short LAST_SEASON = 2023;
        private const short MAX_HTTP_TRIES = 5;
        private readonly SportsContext context;
        private readonly ILogger<GameUpdateService> logger;

        private readonly HttpClient espnScoreboardClient = new()
        {
            BaseAddress = new Uri("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")
        };

        private readonly HttpClient espnSummaryClient = new()
        {
            BaseAddress = new Uri("https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary")
        };

        /// <summary>
        /// Creates a new instance of a game update service.
        /// </summary>
        /// <param name="context">The Sports database session.</param>
        /// <param name="logger">Generic logger for a game update service.</param>
        public GameUpdateService(SportsContext context, ILogger<GameUpdateService> logger)
        {
            this.context = context;
            this.logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            logger.LogInformation("Game Update Service running.");
            await doWorkAsync(stoppingToken);
        }

        private async Task doWorkAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                logger.LogInformation("Game Update Sevice working.");

                /*List<EspnEvent> events = [];
                List<TeamModel> teams = await context.Teams.ToListAsync(stoppingToken);
                List<GameModel> existingGames = await context.Games.ToListAsync(stoppingToken);
                List<GameModel> existingUnplayedGames = await context.Games
                    .Where(g => g.HomeTeamScore == null)
                    .ToListAsync(stoppingToken);

                for (short year = FIRST_SEASON; year <= LAST_SEASON + 1; year++)
                {
                    EspnScoreboardResponse? scoreboard = JsonSerializer
                        .Deserialize<EspnScoreboardResponse>(await getYearGamesJsonAsync(year, stoppingToken));

                    if (scoreboard?.Events != null)
                    {
                        events = [.. events, .. scoreboard.Events];
                    }
                }

                events = events
                    .Where(e =>
                        // filter out games that aren't in one of the valid seasons
                        e.Season.Year >= FIRST_SEASON && e.Season.Year <= LAST_SEASON
                        // filter out games between special teams
                        && teams.FindAll(t => e.Competitions[0].Competitors[0].Id == t.Id.ToString()).Count > 0
                        && teams.FindAll(t => e.Competitions[0].Competitors[1].Id == t.Id.ToString()).Count > 0)
                    .ToList();

                List<EspnEvent> completedEvents = events
                    .Where(e =>
                        // filter out games that aren't regular or post-season
                        e.Season.Type is EspnSeasonType.Regular or EspnSeasonType.Post
                        // filter out games that aren't finished
                        && e.Status.Type.Completed)
                   .ToList();
                List<EspnEvent> unplayedEvents = events
                    .Where(e =>
                        // filter out games that aren't regular or post-season
                        e.Season.Type is EspnSeasonType.Regular or EspnSeasonType.Post
                        // filter out games that are finished or cancelled/postponed
                        && e.Status.Type.Id is EspnStatusType.SCHEDULED or EspnStatusType.IN_PROGRESS)
                   .ToList();
                List<EspnEvent> cancelledOrPostponedEvents = events
                    .Where(e => e.Status.Type.Id is not EspnStatusType.SCHEDULED
                        or EspnStatusType.IN_PROGRESS or EspnStatusType.FINAL)
                    .ToList();

                List<EspnEvent> completedEventsToUpdate = completedEvents
                    .Where(e =>existingUnplayedGames.Select(g =>
                        g.Id.ToString()).ToList().FindAll(i => i == e.Id).Count > 0)
                    .ToList();
                List<EspnEvent> completedEventsToInsert = completedEvents
                    .Where(e => existingGames.Select(g => g.Id.ToString()).ToList().FindAll(i => i == e.Id).Count == 0)
                    .ToList();
                List<EspnEvent> unplayedEventsToUpdate = unplayedEvents
                    .Where(e => existingGames.Select(g => g.Id.ToString()).ToList().FindAll(i => i == e.Id).Count > 0)
                    .ToList();
                List<EspnEvent> unplayedEventsToInsert = unplayedEvents
                    .Where(e => existingGames.Select(g => g.Id.ToString()).ToList().FindAll(i => i == e.Id).Count == 0)
                    .ToList();

                foreach (EspnEvent e in completedEventsToUpdate)
                {
                    int id = int.Parse(e.Id);
                    GameModel? game = await context.Games.SingleOrDefaultAsync(g => g.Id == id, stoppingToken);

                    if (game != null)
                    {
                        game.StartDateTime = DateTime.Parse(e.Date);
                        game.HomeTeamScore = short.Parse(e.Competitions[0].Competitors.SingleOrDefault(c =>
                            c.HomeAway is EspnCompetitor.HOME).Score);
                        game.AwayTeamScore = short.Parse(e.Competitions[0].Competitors.SingleOrDefault(c =>
                            c.HomeAway is EspnCompetitor.AWAY).Score);
                        await context.SaveChangesAsync(stoppingToken);
                    }
                }

                foreach (EspnEvent e in completedEventsToInsert)
                {
                    GameModel game = new()
                    {
                        Id = int.Parse(e.Id),
                        Season = e.Season.Year,
                        StartDateTime = DateTime.Parse(e.Date),
                        HomeTeamId = short.Parse(e.Competitions[0].Competitors.Find(c =>
                            c.HomeAway == EspnCompetitor.HOME).Id),
                        AwayTeamId = short.Parse(e.Competitions[0].Competitors.Find(c =>
                            c.HomeAway == EspnCompetitor.AWAY).Id),
                        HomeTeamScore = short.Parse(e.Competitions[0].Competitors.Find(c =>
                            c.HomeAway == EspnCompetitor.HOME).Score),
                        AwayTeamScore = short.Parse(e.Competitions[0].Competitors.Find(c =>
                            c.HomeAway == EspnCompetitor.AWAY).Score),
                        PostSeason = e.Season.Type is EspnSeasonType.Post
                    };

                    await context.Games.AddAsync(game, stoppingToken);
                }

                foreach (EspnEvent e in unplayedEventsToUpdate)
                {
                    int id = int.Parse(e.Id);
                    EspnSummaryResponse? summary = JsonSerializer
                        .Deserialize<EspnSummaryResponse>(await getGameJsonAsync(id, stoppingToken));
                    GameModel? game = await context.Games.SingleOrDefaultAsync(g => g.Id == id, stoppingToken);

                    if (summary != null && game != null)
                    {
                        game.StartDateTime = DateTime.Parse(e.Date);
                        game.HomePredictorChance = decimal.Parse(summary.Predictor.HomeTeam.GameProjection) / 100;
                        game.AwayPredictorChance = decimal.Parse(summary.Predictor.AwayTeam.GameProjection) / 100;
                        await context.SaveChangesAsync(stoppingToken);
                    }
                }

                foreach (EspnEvent e in unplayedEventsToInsert)
                {
                    EspnSummaryResponse? summary = JsonSerializer
                        .Deserialize<EspnSummaryResponse>(await getGameJsonAsync(int.Parse(e.Id), stoppingToken));

                    if (summary != null)
                    {
                        GameModel game = new()
                        {
                            Id = int.Parse(e.Id),
                            Season = e.Season.Year,
                            StartDateTime = DateTime.Parse(e.Date),
                            HomeTeamId = short.Parse(e.Competitions[0].Competitors.Find(c =>
                                c.HomeAway == EspnCompetitor.HOME).Id),
                            AwayTeamId = short.Parse(e.Competitions[0].Competitors.Find(c =>
                                c.HomeAway == EspnCompetitor.AWAY).Id),
                            HomePredictorChance = decimal.Parse(summary.Predictor.HomeTeam.GameProjection) / 100,
                            AwayPredictorChance = decimal.Parse(summary.Predictor.AwayTeam.GameProjection) / 100,
                            PostSeason = e.Season.Type is EspnSeasonType.Post
                        };

                        await context.Games.AddAsync(game, stoppingToken);
                    }
                }
                
                // TODO: run simulator

                // 12 hours
                int delay = 43200000;

                if (events.Where(e => e.Status.Type.Id is EspnStatusType.IN_PROGRESS).ToList().Count > 0)
                {
                    // 1 minute
                    delay = 60000;
                }
                else
                {
                    GameModel nextGame = (await context.Games
                        .Where(g => g.HomeTeamScore == null)
                        .OrderBy(g => g.StartDateTime)
                        .ToListAsync(stoppingToken))[0];

                    if (nextGame.StartDateTime <= DateTime.UtcNow.AddHours(14))
                    {
                        // 90 minutes before the next game
                        delay = (int)nextGame.StartDateTime.AddMinutes(-90).Subtract(DateTime.UtcNow).TotalMilliseconds;
                    }
                }

                await Task.Delay(delay, stoppingToken);*/

                await Task.Delay(86400000, stoppingToken);
            }

            logger.LogInformation("Game Update Sevice stopping.");
        }

        /*private async Task<int> millisecondsToNextRunAsync()
        {
            GameModel nextGame = (await context.Games
                .Where(g => g.HomeTeamScore == null)
                .OrderBy(g => g.StartDateTime)
                .ToListAsync())[0];

            if (nextGame.StartDateTime <= DateTime.UtcNow.AddHours(14))
            {
                // 90 minutes before the next game
                return (int)nextGame.StartDateTime.AddMinutes(-90).Subtract(DateTime.UtcNow).TotalMilliseconds;
            }

            // 12 hours from now
            return 43200000;
        }

        private async Task<string> getYearGamesJsonAsync(short year, CancellationToken stoppingToken, short tries = 0)
        {
            if (tries < MAX_HTTP_TRIES)
            {
                try
                {
                    using HttpResponseMessage response = await espnScoreboardClient
                        .GetAsync($"?limit=500&dates={year}", stoppingToken);
                    return await response.Content.ReadAsStringAsync(stoppingToken);
                }
                catch
                {
                    return await getYearGamesJsonAsync(year, stoppingToken, ++tries);
                }
            }
            else
            {
                throw new Exception();
            }
        }

        private async Task<string> getGameJsonAsync(int id, CancellationToken stoppingToken, short tries = 0)
        {
            if (tries < MAX_HTTP_TRIES)
            {
                try
                {
                    using HttpResponseMessage response = await espnSummaryClient
                        .GetAsync($"?event={id}", stoppingToken);
                    return await response.Content.ReadAsStringAsync(stoppingToken);
                }
                catch
                {
                    return await getGameJsonAsync(id, stoppingToken, ++tries);
                }
            }
            else
            {
                throw new Exception();
            }
        }*/
    }
}
