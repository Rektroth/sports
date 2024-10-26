# Rektroth/Sports

A project for running analytics on sports.

## Database

This defines the schema of a PostgreSQL database that stores all of the analytical data.

### PostgreSQL

You first must install and set up PostgreSQL. Although the schema *may* (but is not guaranteed to) be compatible with other database managers, both the simulator and web service require PostgreSQL.

### Creating the Database

Once PostgreSQL is installed and configured, you will need to run the `create.sh` script in the `db` directory to initialize the database.

You will need to be logged in as a user you wish to have read/write access to the database - usually `postgres`.

### Upgrading the Database

Making changes to the database schema is done using a very simple versioning system.

All upgrade scripts are in the following format:

```
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM v.upgrades WHERE id = <x>) THEN
	INSERT INTO v.upgrades (id) VALUES (<x>);

  <changes>
END IF;
END; $$
```

Where `<x>` is the new version number and `<changes>` are the changes you're making to the schema.

With this versioning system, already existing upgrade scripts should almost never be modified. The only time an existing upgrade script should need updated is if it's causing an error when creating/upgrading the database. **All schema changes must be applied by creating a new upgrade script.**

Once you've completed your schema changes, or you have pulled new changes from the repository, you can run `upgrade.sh` to apply upgrades. Once again, you will need to be logged in as a user that has write access to the database - usually `postgres`.

## Components

The `@rektroth/elo` and `@rektroth/sports-entities` components are shared by both the simulator and web service. Since this is the case, you will need to compile both before running simulations or the web service.

To do so, in both `components/sports-entites` and `components/elo`, simply run `tsc`.

## Simulator

Located in the `simulator` directory.

### Dependencies

You must first compile the components that are shared by both the simulator and web service. See [Components](#Components) for instructions.

Run `npm install` to install all dependencies.

### Environment Variables

The application has default environment variables that it will use if none are provided, so this part is technically optional.

Create a file in root of the directory called `.env`.

The following variables can be provided:

- `CURRENT_SEASON`
  - the current NFL regular/post-season that is being simulated
  - default is `2023`
- `SUPER_BOWL_HOST`
  - the identifier of the team whose stadium is being used to host the Super Bowl
  - default is `1`
- `TOTAL_SIMS`
  - the total numbers of simulations that you wish run
  - default is `32768`
- `DB_HOST`
  - address of the database host
  - default is `localhost`
- `DB_PORT`
  - port the database host is listening on
  - default is `5432`
- `DB_USERNAME`
  - name of a user that has read access to the database
  - default is `postgres`
- `DB_PASSWORD`
  - password of the user provided in `DB_USERNAME`
  - default is `postgres`
- `CONFIDENCE_INTERVAL`
  - the "confidence interval" on the simulator's randomizer
    - differences in probabilities outside of a margin of error calculated using this interval will be ignored
  - default is `2.576`

Example:

```
CURRENT_SEASON=2023
SUPER_BOWL_HOST=13
TOTAL_SIMS=32768
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
MARGIN=0.05
```

### Run

To update the database with the latest season data from ESPN (which must be done at least once before simulating), run `npm run update`.

To run the simulator, run `npm run simulate`.

Should you run more than around ~100000 simulations, you will need to increase the JavaScript heap size. To do so, run `export NODE_OPTIONS="--max-old-space-size=8192"`, replacing `8192` with the number of MB that you would like to allocate. In this example, `8192` sets the JavaScript heap size to 8GB.

## Web

Located in the `web` directory.

### Dependencies

You must first compile the components that are shared by both the simulator and web service. See [Components](#Components) for instructions.

Run `npm install` to install all dependencies.

### Environment Variables

The application has default environment variables that it will use if none are provided, so this part is technically optional.

Create a file in root of the directory called `.env`.

The following variables can be provided:

- `HOST`
  - the web address that the application is available on
  - default is `localhost`
- `PORT`
  - the port the application listens on
  - default is `3080`
- `SSL_PORT`
  - the port the application listen on for SSL/TLS (HTTPS) requests
  - default is `3443`
- `DB_HOST`
  - address of the database host
  - default is `localhost`
- `DB_PORT`
  - port the database host is listening on
  - default is `5432`
- `DB_USERNAME`
  - name of a user that has read access to the database
  - default is `postgres`
- `DB_PASSWORD`
  - password of the user provided in `DB_USERNAME`
  - default is `postgres`
- `PRIVATE_KEY`
  - location of SSL/TLS private key file
  - no default; if not provided, application does not run on SSL port
- `CERTIFICATE`
  - location of SSL/TLS certificate file
  - no default; if not provided, application does not run on SSL port

Example:

```
HOST=localhost
PORT=3080
SSL_PORT=3443
DB_HOST=localhost
DB_PORT=54332
DB_USERNAME=postgres
DB_PASSWORD=postgres
PRIVATE_KEY=/etc/letsencrypt/live/example.com/privkey.pem
CERTIFICATE=/etc/letsencrypt/live/example.com/fullchain.pem
```

### Run

To run a development environment of the web application, run `npm run dev`.

To run a production environment, run `npm run prod`.
