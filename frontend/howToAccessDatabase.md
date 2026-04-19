# Accessing Prisma Studio Inside Docker via SSH Tunnel

This guide explains how to access Prisma Studio running inside a Docker container through an SSH
tunnel.

## Steps

1. **Enter the Docker container:**

   ```bash
   docker compose exec chronos bash
   ```

2. **Get the internal container IP:**

   ```bash
   hostname -I
   # Example output: 172.18.0.5
   ```

3. **Start Prisma Studio listening on all interfaces:**

   ```bash
   npx prisma studio --port 5555 --hostname 0.0.0.0 --browser none
   ```

4. **From your local machine, create the SSH tunnel:**

   ```bash
   ssh -N -L 5555:172.18.0.5:5555 root@bobagi.space
   ```

5. **Open Prisma Studio in your browser:**

   Go to:

   ```
   http://localhost:5555
   ```

   Prisma Studio should now be accessible and connected to your containerized database.
