# Database Migrations

Sequential SQL migrations for the server-config database.

## Running

```bash
npm run migrate       # apply pending migrations
npm run migrate:down  # rollback last migration
```

## Adding a new migration

1. Create a new file with the next sequence number: `NNN_description.sql`
2. Follow the patterns in existing migrations
3. Read the comments in recent migrations for any operational notes
   from the database team
4. Test against a local Postgres instance before committing
