# Consulting Front + Panel: Docker deployment

The shared Compose file is `deployment/production/compose.web.yaml` in **consulting-front**. Copy it to `/var/www/consulting/compose.web.yaml` on the Ubuntu host. Both GitHub Actions workflows expect this exact location.

## Required server layout
```
/var/www/consulting/
  compose.web.yaml
  front/releases/<sha>/server/index.mjs
  front/current -> releases/<sha>
  panel/releases/<sha>/server/index.mjs
  panel/current -> releases/<sha>
/etc/consulting/web.env
```
Create `/etc/consulting/web.env` with `NUXT_PUBLIC_API_BASE=https://YOUR_API_DOMAIN/api` (no quotes required). Set restrictive permissions as appropriate. Both Compose services use this external environment file for interpolation.

Build remains in GitHub Actions. The two outputs are uploaded individually via SSH; the workflow atomically swaps the relevant `current` symlink and runs:

```bash
cd /var/www/consulting
docker compose --env-file /etc/consulting/web.env -f compose.web.yaml up -d --no-deps --force-recreate front
# or: ... panel
```

The forced recreation is **required**: a plain Docker restart does not necessarily pick up a changed symlink source for bind mounts. Each workflow then verifies its local HTTP endpoint, and attempts to restore the previous release on failure.

Nuxt Front: Node 24, SSR, 127.0.0.1:3100.
Nuxt Panel: Node 22, ssr:false SPA hosted by Nitro, 127.0.0.1:3200.

Host Nginx proxies the chosen domains to these ports; do not publish container ports on 0.0.0.0.

## Before enabling deployment

- Ensure server has enough free disk space, Docker access to the pinned Node images, and both port bindings available.
- Create the directory tree and ensure the SSH deploy account can write each release directory and update its `current` symlink.
- **Security:** Membership of the Docker group effectively grants root on the host. For a production SSH deploy identity, use a root-owned, strictly limited deployment wrapper (and narrowly scoped sudoers), not unrestricted Docker access. The workflows currently call Docker directly and will require an appropriately authorized deploy identity; revise them to use that wrapper before enabling for a restricted production setup.
- GitHub repository variable: `NUXT_PUBLIC_API_BASE` (public production API).
- GitHub repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
- `ENABLE_PRODUCTION_DEPLOY` must be `true` to deploy. Default is disabled.
- For first deploy, `up -d` creates a container if none exists; existing unrelated containers remain untouched.
- A failed health check restores the previous release symlink if a previous release exists; database state is unrelated.
- Existing `systemd` service examples are legacy reference files and should **not** be installed for this Docker architecture.
- No images are built on the production server. The server pulls official Node images and mounts prebuilt Nuxt output read-only.

GitHub Actions builds have not yet been verified as successful. Do not enable deployment until testing the images, DNS, permissions, and Nginx configuration.
