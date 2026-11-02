#!/usr/bin/env bash
set -euo pipefail

readonly frontend_dir='/home/saeed/elham-nuxt4'
readonly backend_dir='/home/saeed/project/consulting-backend/consulting-backend'
readonly compose_file="$backend_dir/compose.mysql-test.yaml"
readonly patch_file="$frontend_dir/diagnostics/isolated-http-login-diagnostics.patch"
readonly expected_database='consulting_booking_test_20261012'
readonly expected_host='mysql-test'
readonly run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(12).toString("hex"))')"
patch_applied=0
export E2E_AUTH_RUN_ID="$run_id"
if [[ ! "$run_id" =~ ^[a-f0-9]{24}$ ]]; then
  echo 'BLOCKED: Could not create a valid private diagnostic run marker.' >&2
  exit 2
fi

compose() {
  docker compose --project-directory "$backend_dir" -f "$compose_file" "$@"
}

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'BLOCKED: Docker Compose is required; no database operation was run.' >&2
  exit 2
fi
if ! command -v patch >/dev/null 2>&1; then
  echo 'BLOCKED: patch utility is required; no backend files were changed.' >&2
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo 'BLOCKED: curl is required to verify only the isolated API on port 8011.' >&2
  exit 2
fi

verify_isolated_database() {
  local identity
  identity="$(compose exec -T laravel-test php -r '
require "vendor/autoload.php";
$app=require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$name=(string)config("database.default");
$configured=(array)config("database.connections.".$name,[]);
if($name!=="mysql"||($configured["driver"]??null)!=="mysql"||($configured["host"]??null)!=="mysql-test"||($configured["database"]??null)!=="consulting_booking_test_20261012") exit(2);
$db=\Illuminate\Support\Facades\DB::connection($name);
$actual=$db->selectOne("SELECT DATABASE() AS database_name")->database_name ?? null;
echo json_encode(["environment"=>app()->environment(),"connection"=>$name,"driver"=>$db->getDriverName(),"host"=>$db->getConfig("host"),"configured_database"=>$configured["database"],"actual_database"=>$actual], JSON_THROW_ON_ERROR);
' 2>/dev/null)" || {
    echo 'BLOCKED: Could not verify the database inside laravel-test.' >&2
    return 1
  }
  node -e '
let data=""; for await (const part of process.stdin) data+=part;
const x=JSON.parse(data);
if(x.environment!=="testing"||x.connection!=="mysql"||x.driver!=="mysql"||x.host!=="mysql-test"||x.configured_database!=="consulting_booking_test_20261012"||x.actual_database!=="consulting_booking_test_20261012") process.exit(1);
' <<<"$identity" || {
    echo 'BLOCKED: Runtime database identity was not the required isolated test database.' >&2
    return 1
  }
  printf 'Isolated runtime verification: PASS (%s on %s; Laravel testing environment).\n' "$expected_database" "$expected_host"
}

verify_http_process() {
  local process_check host_hash container_hash
  process_check="$(compose exec -T -e "AUTH_DIAG_EXPECTED_RUN_ID=$run_id" laravel-test php -r '
$raw=@file_get_contents("/proc/1/environ");
$argv=@file_get_contents("/proc/1/cmdline");
if ($raw===false || $argv===false) exit(1);
$env=[]; foreach(explode("\0",$raw) as $pair) { $parts=explode("=",$pair,2); if(count($parts)===2) $env[$parts[0]]=$parts[1]; }
$command=str_replace("\0"," ",$argv);
$checks=["artisan_server"=>str_contains($command,"artisan serve --host=0.0.0.0 --port=8000"),"testing_environment"=>($env["APP_ENV"]??null)==="testing","diagnostic_flag"=>($env["AUTH_E2E_LOGIN_DIAGNOSTICS"]??null)==="1","run_id_matches"=>isset($env["AUTH_E2E_RUN_ID"])&&is_string(getenv("AUTH_DIAG_EXPECTED_RUN_ID"))&&preg_match("/^[a-f0-9]{24}$/",$env["AUTH_E2E_RUN_ID"])===1&&hash_equals(getenv("AUTH_DIAG_EXPECTED_RUN_ID"),$env["AUTH_E2E_RUN_ID"]),"isolated_db_host"=>($env["DB_HOST"]??null)==="mysql-test","isolated_db_name"=>($env["DB_DATABASE"]??null)==="consulting_booking_test_20261012","no_config_cache"=>!is_file("bootstrap/cache/config.php")];
echo json_encode($checks,JSON_THROW_ON_ERROR);
' 2>/dev/null)" || {
    echo 'BLOCKED: Could not inspect the actual laravel-test HTTP process environment.' >&2
    return 1
  }
  printf 'HTTP process gates: %s\n' "$process_check"
  node -e 'let s="";for await(const c of process.stdin)s+=c;const x=JSON.parse(s);if(Object.values(x).some(v=>v!==true))process.exit(1)' <<<"$process_check" || {
    echo 'BLOCKED: One or more HTTP process gates failed; login requests were not sent.' >&2
    return 1
  }
  host_hash="$(sha256sum "$backend_dir/app/Http/Controllers/Booking/ClientAuthController.php" | awk '{print $1}')"
  container_hash="$(compose exec -T laravel-test sha256sum /var/www/html/app/Http/Controllers/Booking/ClientAuthController.php 2>/dev/null | awk '{print $1}')"
  [[ -n "$host_hash" && "$host_hash" == "$container_hash" ]] || {
    echo 'BLOCKED: Controller source mount hash differs between host and laravel-test.' >&2
    return 1
  }
  echo 'HTTP process/source handshake: PASS source_mount_match=true'
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$patch_applied" == '1' ]]; then
    if ! (cd "$backend_dir" && patch -R -p1 < "$patch_file" >/dev/null); then
      echo 'FAIL: Could not revert temporary Laravel diagnostics patch.' >&2
      status=1
    else
      patch_applied=0
      if ! compose up -d --no-deps --force-recreate laravel-test >/dev/null; then
        echo 'FAIL: Could not recreate the isolated Laravel service without diagnostics.' >&2
        status=1
      else
        echo 'Temporary controller instrumentation removed; isolated laravel-test recreated.'
      fi
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

running_services="$(compose ps --status running --services 2>/dev/null)" || {
  echo 'BLOCKED: Could not query the isolated Compose project.' >&2
  exit 2
}
grep -Fxq 'laravel-test' <<<"$running_services" || {
  echo 'BLOCKED: laravel-test is not running; refusing to use another service.' >&2
  exit 2
}
grep -Fxq 'mysql-test' <<<"$running_services" || {
  echo 'BLOCKED: mysql-test is not running; no fixture operation was started.' >&2
  exit 2
}
published_port="$(compose port laravel-test 8000 2>/dev/null || true)"
[[ "$published_port" == '127.0.0.1:8011' ]] || {
  echo 'BLOCKED: laravel-test is not published exclusively on 127.0.0.1:8011.' >&2
  exit 2
}
verify_isolated_database

(cd "$backend_dir" && patch --dry-run -p1 < "$patch_file" >/dev/null) || {
  echo 'BLOCKED: Diagnostic patch does not match the current backend source; no patch was applied.' >&2
  exit 2
}
patch_applied=1
(cd "$backend_dir" && patch -p1 < "$patch_file" >/dev/null)

# Recreate only the explicitly isolated PHP service so its diagnostic flag is
# present in the actual HTTP server process. mysql-test and all other services
# remain untouched.
compose up -d --no-deps --force-recreate laravel-test >/dev/null
verify_isolated_database
verify_http_process
api_ready=0
for attempt in $(seq 1 30); do
  if [[ "$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' http://127.0.0.1:8011/api/auth/config 2>/dev/null || true)" == '200' ]]; then
    api_ready=1
    break
  fi
  sleep 1
done
[[ "$api_ready" == '1' ]] || {
  echo 'BLOCKED: Isolated API did not become ready on 127.0.0.1:8011.' >&2
  exit 2
}
echo 'Isolated HTTP endpoint readiness: PASS (127.0.0.1:8011).'

cd "$frontend_dir"
npm run test:e2e:integration
