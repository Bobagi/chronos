# Accessing the Chronos database

From the repository root, launch a shell inside the backend container and open Prisma Studio without a browser:

```bash
docker compose exec chronos sh
npx prisma studio --port 5555 --browser none
```
