# consulting-front Production SSR

This is **Nuxt 4 SSR**, not a static-only deploy. GitHub Actions builds using Node from `.nvmrc` (24.19.0), uploads only the Nuxt `.output` artifact, and deploys to a new release directory. The host runs the generated `server/index.mjs` under systemd and host Nginx proxies to `127.0.0.1:3100`.

## Before enabling automatic deployments

1. Confirm available disk space on the host (previously 90% used) and port 3100 availability.
2. Ensure Node.js **24.19.0** is installed for the systemd service; inspect `command -v node` and adjust `ExecStart` if Node is not `/usr/bin/node`. Node version used for build and runtime should be compatible.
3. Provision a dedicated `consulting-front` service account and a separate `deploy-consulting-front` SSH account (or equivalent restricted deployment identity). Prepare `/var/www/consulting/front/releases` and writable access for the deploy account, readable access for the service account, and `/var/www/consulting/front/current` symlink. Do not give the deploy account unrestricted root access.
4. Install and enable the provided systemd unit after adapting account names and Node path. Permit the deploy identity to run **only** `systemctl restart consulting-front.service` without a password through a narrowly scoped sudoers rule. Ensure it cannot edit the systemd unit or privileged paths.
5. Configure host Nginx proxy and HTTPS using `nginx.conf.example` as reference; adjust domain and existing server blocks, and run `nginx -t` before reload.
6. Create `/etc/consulting/front.env` for any runtime settings (e.g. `NUXT_PUBLIC_API_BASE=https://.../api`). The built app may embed public config defaults, so set the same production API URL in GitHub Actions variable `NUXT_PUBLIC_API_BASE` and runtime. Never expose credentials via public runtime config.
7. Set GitHub Actions repository **variable** `NUXT_PUBLIC_API_BASE` to the public production API URL (needed for builds). Add **secrets** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`. Pin and verify SSH host keys out of band, not via unauthenticated `ssh-keyscan` in the workflow.
8. Only after verifying everything, set GitHub Actions repository **variable** `ENABLE_PRODUCTION_DEPLOY=true`. Until then a push to `production` performs test/build only; deployment is disabled.

## Release process

On push to `production`, the workflow runs tests, builds, and (when enabled) uploads a unique release to `/var/www/consulting/front/releases/<commit-sha>`. It atomically switches `current`, restarts only `consulting-front`, then checks `http://127.0.0.1:3100/` with retries. A failed restart/health check attempts to restore the previous symlink and service (app rollback only).

No backend Docker containers, existing projects, Nginx configuration, or production credentials are modified by the workflow. Old releases are retained; clean up manually once rollback requirements are understood.

**Caveats:** SSR may require additional runtime variables and server-side API access. If homepage is not a safe 200 response, change the healthcheck to a dedicated public SSR route before enabling deployment.
