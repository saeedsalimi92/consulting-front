#!/usr/bin/env bash
set -euo pipefail

readonly expected_database='consulting_booking_test_20261012'
readonly expected_host='mysql-test'
readonly isolated_api_base='http://127.0.0.1:8011/api'
readonly backend_dir='/home/saeed/project/consulting-backend/consulting-backend'
readonly compose_file="$backend_dir/compose.mysql-test.yaml"
readonly run_id="${E2E_AUTH_RUN_ID:-$(node -e 'process.stdout.write(require("node:crypto").randomBytes(12).toString("hex"))')}"
fixture_maybe_created=0
fixture_json=''
auth_mobile=''
auth_password=''

if [[ ! "$run_id" =~ ^[a-f0-9]{24}$ ]]; then
  echo 'BLOCKED: Invalid diagnostic run marker; no fixture was created.' >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo 'BLOCKED: Docker CLI is unavailable; isolated database identity cannot be verified.' >&2
  exit 2
fi
if ! docker compose version >/dev/null 2>&1; then
  echo 'BLOCKED: Docker Compose is unavailable; isolated database identity cannot be verified.' >&2
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo 'BLOCKED: curl is required to verify the isolated API and CORS.' >&2
  exit 2
fi
compose() {
  docker compose --project-directory "$backend_dir" -f "$compose_file" "$@"
}

# Resolve the isolated PHP container by its Compose service, never by a
# container-name guess. --project-directory keeps the existing project identity.
if ! running_services="$(compose ps --status running --services 2>/dev/null)"; then
  echo 'BLOCKED: Could not query the isolated Docker Compose project (permission denied or Compose unavailable).' >&2
  exit 2
fi
if ! grep -Fxq 'laravel-test' <<<"$running_services"; then
  echo 'BLOCKED: Isolated Compose service laravel-test is not running; refusing to use any other service.' >&2
  exit 2
fi

# The PHP in this heredoc is piped to `php` inside laravel-test. It never runs
# in the host PHP process and it only emits the resolved DB identity.
verify_database() {
  compose exec -T laravel-test php -r 'eval(stream_get_contents(STDIN));' <<'PHP'
require "vendor/autoload.php";
$app=require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$default=(string)config("database.default");
$configured=(array)config("database.connections.".$default, []);
if($default!=="mysql"||($configured["driver"]??null)!=="mysql"||($configured["host"]??null)!=="mysql-test"||($configured["database"]??null)!=="consulting_booking_test_20261012") throw new RuntimeException("Unsafe E2E database configuration.");
$connection=\Illuminate\Support\Facades\DB::connection($default);
$actual=$connection->selectOne("SELECT DATABASE() AS database_name")->database_name ?? null;
echo json_encode([
  "connection"=>$default,
  "driver"=>$connection->getDriverName(),
  "host"=>$connection->getConfig("host"),
  "configured_database"=>$configured["database"] ?? null,
  "actual_database"=>$actual,
], JSON_THROW_ON_ERROR);
PHP
}

if ! database_identity="$(verify_database 2>/dev/null)"; then
  echo 'BLOCKED: Could not verify the resolved database from inside laravel-test.' >&2
  exit 2
fi
if ! node -e '
let input=""; for await (const chunk of process.stdin) input+=chunk;
const v=JSON.parse(input);
if(v.connection!=="mysql"||v.driver!=="mysql"||v.host!=="mysql-test"||v.configured_database!=="consulting_booking_test_20261012"||v.actual_database!=="consulting_booking_test_20261012") process.exit(1);
' <<<"$database_identity"; then
  printf 'BLOCKED: Laravel DB identity did not match the required isolated MySQL connection (%s on %s). No fixture was created.\n' "$expected_database" "$expected_host" >&2
  exit 2
fi
printf 'Database safety check: PASS (%s on %s).\n' "$expected_database" "$expected_host"

cors_headers="$(curl -sS --max-time 5 -D - -o /dev/null -X OPTIONS \
  'http://127.0.0.1:8011/api/client/login' \
  -H 'Origin: http://127.0.0.1:3001' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type,x-auth-e2e-run-id' 2>/dev/null)" || {
  echo 'BLOCKED: Isolated Laravel API is not reachable at 127.0.0.1:8011.' >&2
  exit 2
}
if ! grep -Eiq '^access-control-allow-origin:[[:space:]]*http://127\.0\.0\.1:3001[[:space:]]*$' <<<"$cors_headers"; then
  echo 'BLOCKED: Laravel CORS does not allow the required origin http://127.0.0.1:3001.' >&2
  exit 2
fi
echo 'CORS preflight: PASS (http://127.0.0.1:3001).'

fixture_php="$(cat <<'PHP'
require "vendor/autoload.php";
$app=require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$guard=function() {
  $default=(string)config("database.default");
  $config=(array)config("database.connections.".$default, []);
  if($default!=="mysql"||($config["driver"]??null)!=="mysql"||($config["host"]??null)!=="mysql-test"||($config["database"]??null)!=="consulting_booking_test_20261012") throw new RuntimeException("Unsafe E2E database configuration.");
  $db=\Illuminate\Support\Facades\DB::connection($default);
  if($db->getDriverName()!=="mysql"||$db->getConfig("host")!=="mysql-test"||($db->selectOne("SELECT DATABASE() AS database_name")->database_name??null)!=="consulting_booking_test_20261012") throw new RuntimeException("Unsafe E2E database connection.");
  return $db;
};
$db=$guard();
$runId=(string)getenv("AUTH_E2E_RUN_ID");
if(!preg_match("/^[a-f0-9]{24}$/",$runId)) throw new RuntimeException("Invalid fixture run marker.");
$action=(string)getenv("AUTH_E2E_ACTION");
$email="auth-e2e-".$runId."@example.test";
if($action==="cleanup") {
  $user=\App\Models\User::where("email",$email)->first();
  if(!$user) { echo "absent"; return; }
  if($user->last_name!=="E2E-".$runId) throw new RuntimeException("Fixture ownership check failed.");
  try { $mobile=\App\Services\Auth\IranianMobile::normalize((string)$user->phone); }
  catch(\InvalidArgumentException $exception) { throw new RuntimeException("Fixture ownership check failed."); }
  if(!str_starts_with($mobile,"+989")) throw new RuntimeException("Fixture ownership check failed.");
  \Laravel\Sanctum\PersonalAccessToken::query()->where("tokenable_type",$user->getMorphClass())->where("tokenable_id",$user->getKey())->delete();
  $user->delete();
  echo "cleaned";
  return;
}
if($action!=="setup") throw new RuntimeException("Invalid fixture action.");
foreach(["name","first_name","last_name","email","password","phone","phone_verified_at","last_otp_verified_at","is_admin","is_active","admin_permissions"] as $column) if(!\Illuminate\Support\Facades\Schema::hasColumn("users",$column)) throw new RuntimeException("Required auth schema is unavailable.");
if(!\Illuminate\Support\Facades\Schema::hasTable("auth_mobile_claims")) throw new RuntimeException("Mobile claim schema is unavailable.");
if(\App\Models\User::where("email",$email)->exists()) throw new RuntimeException("Fixture email collision.");
$hasPhoneCollision=function(string $candidate) {
  foreach(\App\Models\User::whereNotNull("phone")->pluck("phone") as $stored) {
    try { if(\App\Services\Auth\IranianMobile::normalize((string)$stored)===$candidate) return true; }
    catch(\InvalidArgumentException $exception) { continue; }
  }
  return false;
};
$national=(string)getenv("AUTH_E2E_MOBILE");
if(!preg_match("/^09\\d{9}$/",$national)) throw new RuntimeException("Fixture mobile does not match the supported Iranian mobile format.");
$mobile=\App\Services\Auth\IranianMobile::normalize($national);
if($hasPhoneCollision($mobile)||$db->table("auth_mobile_claims")->where("mobile",$mobile)->exists()) throw new RuntimeException("Fixture mobile collision.");
$password=bin2hex(random_bytes(24));
$user=\Illuminate\Support\Facades\DB::transaction(function() use($email,$mobile,$password,$runId,$db,$hasPhoneCollision) {
  if(\App\Models\User::where("email",$email)->exists()||$hasPhoneCollision($mobile)||$db->table("auth_mobile_claims")->where("mobile",$mobile)->exists()) throw new RuntimeException("Fixture uniqueness collision.");
  return \App\Models\User::create([
    "name"=>"E2E disposable client",
    "first_name"=>"آزمایشی",
    "last_name"=>"E2E-".$runId,
    "email"=>$email,
    // User::$casts uses Laravel's `hashed` cast. Assign plaintext here so the
    // model creates exactly one hash using the same configured hasher as login.
    "password"=>$password,
    "phone"=>$mobile,
    "phone_verified_at"=>now(),
    "last_otp_verified_at"=>now(),
    "is_admin"=>false,
    "is_active"=>true,
    "admin_permissions"=>null,
  ]);
});
if(!\Illuminate\Support\Facades\Hash::check($password,(string)$user->password)) throw new RuntimeException("E2E fixture password hash verification failed.");
if(!(bool)$user->is_active||!$user->canAccessClientPortal()) throw new RuntimeException("E2E fixture is not eligible for client password login.");
$mobileMatches=app(\App\Services\Auth\OtpAuthentication::class)->usersForMobile($mobile);
if(count($mobileMatches)!==1||(int)$mobileMatches[0]->id!==(int)$user->id) throw new RuntimeException("E2E fixture mobile lookup did not resolve to its user.");
$matched=$mobileMatches[0];
$controllerPredicates=["exactlyOneMatch"=>count($mobileMatches)===1,"matchIsFixture"=>(int)$matched->id===(int)$user->id,"active"=>(bool)($matched->is_active??true),"passwordNonempty"=>filled($matched->password),"passwordMatches"=>filled($matched->password)&&\Illuminate\Support\Facades\Hash::check($password,(string)$matched->password),"canAccessAdmin"=>$matched->canAccessAdmin(),"isCounselorAccount"=>$matched->isCounselorAccount(),"canAccessClientPortal"=>$matched->canAccessClientPortal(),"requiredSelectedColumnsPresent"=>collect(["id","password","is_active","is_admin","admin_permissions"])->every(fn($column)=>array_key_exists($column,$matched->getAttributes()))];
$controllerPredicates["compoundRejectionCondition"] = !$controllerPredicates["exactlyOneMatch"] || !$controllerPredicates["active"] || !$controllerPredicates["passwordNonempty"] || !$controllerPredicates["passwordMatches"] || !$controllerPredicates["canAccessClientPortal"];
$default=(string)config("database.default");
$connection=\Illuminate\Support\Facades\DB::connection($default);
$configured=(array)config("database.connections.".$default, []);
$actualDatabase=$connection->selectOne("SELECT DATABASE() AS database_name")->database_name ?? null;
$diagnostics=[
  "database"=>["connection"=>$default,"driver"=>$connection->getDriverName(),"host"=>$connection->getConfig("host"),"configured"=>$configured["database"]??null,"actual"=>$actualDatabase],
  "fixturePreflight"=>["passwordHashMatches"=>\Illuminate\Support\Facades\Hash::check($password,(string)$user->password),"active"=>(bool)$user->is_active,"clientPortalAllowed"=>$user->canAccessClientPortal(),"mobileLookupCount"=>count($mobileMatches),"lookupMatchesFixture"=>(int)$matched->id===(int)$user->id],
  "controllerEquivalent"=>["mobileLookupCount"=>count($mobileMatches)]+$controllerPredicates,
];
echo json_encode(["mobile"=>$national,"password"=>$password,"diagnostics"=>$diagnostics],JSON_THROW_ON_ERROR);
PHP
)"

run_fixture_php() {
  local action="$1"
  local candidate_mobile="${2:-}"
  printf '%s' "$fixture_php" | compose exec -T -e "AUTH_E2E_ACTION=$action" -e "AUTH_E2E_RUN_ID=$run_id" -e "AUTH_E2E_MOBILE=$candidate_mobile" laravel-test php -d display_errors=stderr -d error_reporting=-1 -r 'eval(stream_get_contents(STDIN));'
}

cleanup_fixture() {
  local status=$?
  trap - EXIT
  if [[ "$fixture_maybe_created" == '1' ]]; then
    if ! run_fixture_php cleanup >/dev/null 2>&1; then
      echo 'FAIL: Test fixture cleanup failed its safety checks; inspect the isolated test container.' >&2
      status=1
    else
      echo 'Fixture cleanup: complete.'
    fi
  fi
  local diagnostic_log="storage/logs/auth-e2e-login-diagnostics-$run_id.jsonl"
  local out_of_band="/tmp/auth-e2e-login-diagnostics-$run_id.out-of-band.jsonl"
  local diagnostic_content=''
  local fallback_content=''
  local diagnostic_read_ok=1
  local fallback_read_ok=1
  diagnostic_content="$(compose exec -T laravel-test sh -c "cat '$diagnostic_log' 2>/dev/null || true")" || { diagnostic_read_ok=0; status=1; }
  fallback_content="$(compose exec -T laravel-test sh -c "cat '$out_of_band' 2>/dev/null || true")" || { fallback_read_ok=0; status=1; }
  if [[ "$diagnostic_read_ok" != '1' || "$fallback_read_ok" != '1' ]]; then
    echo 'HTTP diagnostic handshake: outcome=DIAGNOSTIC_READ_FAILED (container log retrieval failed).'
  elif [[ -n "$diagnostic_content" ]]; then
    local expected_source_sha
    expected_source_sha="$(compose exec -T laravel-test sha256sum app/Http/Controllers/Booking/ClientAuthController.php 2>/dev/null | awk '{print $1}')"
    if ! printf '%s\n' "$diagnostic_content" | EXPECTED_CONTROLLER_SHA="$expected_source_sha" EXPECTED_AUTH_RUN_ID="$run_id" node --input-type=module -e '
let input=""; for await (const chunk of process.stdin) input+=chunk;
const expected=process.env.EXPECTED_CONTROLLER_SHA ?? "";
const expectedRun=process.env.EXPECTED_AUTH_RUN_ID ?? "";
const rows=input.trim().split(/\n+/).filter(Boolean).map(line=>JSON.parse(line));
const stages=rows.map(row=>row.stage);
const probe=stages.includes("runner_writer_probe");
const entered=stages.includes("controller_entered");
const disabled=stages.includes("diagnostics_disabled");
const gateRejected=stages.includes("diagnostic_gate_rejected");
const writerFailed=stages.includes("controller_diagnostic_writer_failed");
const auth=stages.filter(stage=>["rate_limited","authentication_rejected","authenticated","validation_rejected"].includes(stage));
const sourceRows=rows.filter(row=>row.controller_source_sha256);
const sourceMatch=sourceRows.length===0?null:sourceRows.every(row=>row.controller_source_sha256===expected);
const runRows=rows.filter(row=>row.test_run_id);
const runMatch=runRows.length===0?null:runRows.every(row=>row.test_run_id===expectedRun);
const requestRows=rows.filter(row=>row.gates&&Object.hasOwn(row.gates,"request_run_id_matches_process"));
const requestCorrelation=requestRows.length===0?null:requestRows.every(row=>row.gates.request_run_id_matches_process===true);
const filePath=rows.find(row=>row.diagnostic_file)?.diagnostic_file??"unknown";
let outcome;
if (writerFailed) outcome="C_DIAGNOSTICS_ENABLED_BUT_WRITING_FAILED";
else if (disabled||gateRejected) outcome="B_CONTROLLER_REACHED_DIAGNOSTICS_DISABLED_OR_GATE_REJECTED";
else if (auth.includes("authentication_rejected")||auth.includes("rate_limited")) outcome="D_DIAGNOSTICS_ACTIVE_AUTH_REJECTED";
else if (auth.includes("authenticated")) outcome="DIAGNOSTICS_ACTIVE_AUTHENTICATED";
else if (entered) outcome="CONTROLLER_REACHED_NO_AUTH_DECISION_RECORDED";
else if (probe) outcome="A_CONTROLLER_NOT_REACHED_AFTER_WRITER_PROBE";
else outcome="WRITER_PROBE_NOT_PRESENT_NO_REQUEST_EVIDENCE";
console.log(`HTTP diagnostic handshake: outcome=${outcome}, writer_probe=${probe?"PASS":"MISSING"}, controller_entry=${entered?"YES":"NO"}, auth_branch=${auth.join(",")||"NONE"}, run_id_matches=${runMatch===null?"NOT_APPLICABLE":runMatch?"YES":"NO"}, request_correlation_matches=${requestCorrelation===null?"NOT_APPLICABLE":requestCorrelation?"YES":"NO"}, controller_source_matches=${sourceMatch===null?"NOT_APPLICABLE":sourceMatch?"YES":"NO"}, diagnostic_file=${filePath}`);
for (const row of rows) console.log(JSON.stringify(row));
if (sourceMatch===false||runMatch===false) process.exitCode=1;
'; then status=1; fi
  else
    echo 'HTTP diagnostic handshake: outcome=WRITER_PROBE_MISSING_OR_FILE_EMPTY (no primary records; no controller conclusion).'
  fi
  if [[ -n "$fallback_content" ]]; then
    if ! printf '%s\n' "$fallback_content" | node --input-type=module -e '
let input=""; for await (const chunk of process.stdin) input+=chunk;
const rows=input.trim().split(/\n+/).filter(Boolean).map(line=>JSON.parse(line));
const stages=rows.map(row=>row.stage);
const writerFailed=stages.includes("controller_diagnostic_writer_failed");
const gateFailed=stages.some(stage=>["diagnostic_gate_rejected","diagnostic_database_gate_failed"].includes(stage));
const fallbackProbe=stages.includes("runner_fallback_writer_probe");
const outcome=writerFailed?"C_DIAGNOSTICS_ENABLED_BUT_WRITING_FAILED":gateFailed?"B_CONTROLLER_REACHED_BUT_DIAGNOSTIC_GATE_FAILED":fallbackProbe?"FALLBACK_WRITER_PROBE_PASS":"OUT_OF_BAND_DIAGNOSTIC_RECORDED";
console.log(`HTTP diagnostic handshake: outcome=${outcome}, fallback_writer_probe=${fallbackProbe?"PASS":"MISSING"}`);
for (const row of rows) console.log(JSON.stringify(row));
'; then status=1; fi
  fi
  compose exec -T laravel-test rm -f "$diagnostic_log" >/dev/null 2>&1 || true
  compose exec -T laravel-test rm -f "$out_of_band" >/dev/null 2>&1 || true
  unset auth_password fixture_json
  exit "$status"
}
trap cleanup_fixture EXIT

# Probe the exact diagnostic path before issuing HTTP requests. This verifies
# the isolated runtime, required gates, and file writer without fixture secrets.
if ! probe_output="$(compose exec -T -e "AUTH_E2E_RUN_ID=$run_id" laravel-test php -r '
require "vendor/autoload.php";
$app=require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$name=(string)config("database.default");
$configured=(array)config("database.connections.".$name,[]);
if ($name!=="mysql" || ($configured["driver"]??null)!=="mysql" || ($configured["host"]??null)!=="mysql-test"
    || ($configured["database"]??null)!=="consulting_booking_test_20261012") exit(3);
$db=\Illuminate\Support\Facades\DB::connection($name);
$actual=$db->selectOne("SELECT DATABASE() AS database_name")->database_name ?? null;
$run=(string)getenv("AUTH_E2E_RUN_ID");
if (!app()->environment("testing") || getenv("AUTH_E2E_LOGIN_DIAGNOSTICS")!=="1" || !preg_match("/^[a-f0-9]{24}$/",$run)
    || $db->getDriverName()!=="mysql" || $db->getConfig("host")!=="mysql-test" || $actual!=="consulting_booking_test_20261012") exit(3);
$path=storage_path("logs/auth-e2e-login-diagnostics-".$run.".jsonl");
$row=json_encode(["stage"=>"runner_writer_probe","test_run_id"=>$run,"diagnostic_file"=>$path,"gates"=>["testing_environment"=>true,"diagnostic_flag"=>true,"isolated_database_identity"=>true,"storage_writer"=>true]],JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES).PHP_EOL;
if (file_put_contents($path,$row,FILE_APPEND|LOCK_EX)===false) { fwrite(STDERR,"writer_create_failed\n"); exit(4); }
$contents=@file_get_contents($path);
if (!is_string($contents)||!str_contains($contents,$run)||!str_contains($contents,"runner_writer_probe")) { fwrite(STDERR,"writer_readback_failed\n"); exit(5); }
$fallback=sys_get_temp_dir()."/auth-e2e-login-diagnostics-".$run.".out-of-band.jsonl";
$fallbackRow=json_encode(["stage"=>"runner_fallback_writer_probe","test_run_id"=>$run,"diagnostic_file"=>$fallback],JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES).PHP_EOL;
if (file_put_contents($fallback,$fallbackRow,FILE_APPEND|LOCK_EX)===false) { fwrite(STDERR,"fallback_writer_create_failed\n"); exit(6); }
$fallbackContents=@file_get_contents($fallback);
if (!is_string($fallbackContents)||!str_contains($fallbackContents,$run)||!str_contains($fallbackContents,"runner_fallback_writer_probe")) { fwrite(STDERR,"fallback_writer_readback_failed\n"); exit(7); }
echo "Diagnostic writer probe: PASS (storage and out-of-band paths create/readback).\n";
' 2>&1)"; then
  printf '%s\n' "$probe_output"
else
  if grep -Fq 'writer_create_failed' <<<"$probe_output"; then
    echo 'BLOCKED: Diagnostic writer stage=CREATE_FAILED; no fixture or HTTP login was attempted.' >&2
  elif grep -Fq 'writer_readback_failed' <<<"$probe_output"; then
    echo 'BLOCKED: Diagnostic writer stage=READBACK_FAILED; no fixture or HTTP login was attempted.' >&2
  else
    echo 'BLOCKED: Diagnostic writer stage=GATES_OR_CONTAINER_EXEC_FAILED; no fixture or HTTP login was attempted.' >&2
  fi
  exit 2
fi

# Setup and cleanup use the same in-container PHP runner; its DB guard runs
# before either operation. Once setup returns successfully, the EXIT trap owns cleanup.
fixture_candidate_mobile="$(node --input-type=module -e 'import { generateAuthE2EMobile } from "./scripts/auth-e2e-fixture-mobile.mjs"; process.stdout.write(generateAuthE2EMobile())')"
if ! fixture_json="$(run_fixture_php setup "$fixture_candidate_mobile")"; then
  echo 'FAIL: Could not create the disposable auth fixture; no existing user was modified.' >&2
  exit 1
fi
fixture_maybe_created=1

mapfile -t fixture_values < <(node --input-type=module -e '
let input=""; for await (const chunk of process.stdin) input+=chunk;
const value=JSON.parse(input);
console.error("In-container login-condition diagnostics:", JSON.stringify(value.diagnostics));
process.stdout.write(`${value.mobile}\n${value.password}\n`);
' <<<"$fixture_json")
if [[ "${#fixture_values[@]}" -ne 2 || -z "${fixture_values[0]}" || -z "${fixture_values[1]}" ]]; then
  echo 'FAIL: Fixture initialization returned an invalid result; cleanup will run.' >&2
  exit 1
fi
auth_mobile="${fixture_values[0]}"
auth_password="${fixture_values[1]}"
export E2E_AUTH_MOBILE="$auth_mobile" E2E_AUTH_PASSWORD="$auth_password" E2E_AUTH_RUN_ID="$run_id"
unset fixture_json fixture_values
echo 'Disposable password-auth fixture: ready.'

# Compare the browser's JSON contract against the isolated API using exactly
# the fixture credentials. Keep response tokens in memory and revoke them
# immediately; diagnostics intentionally contain no credential or token data.
E2E_AUTH_MOBILE="$auth_mobile" E2E_AUTH_PASSWORD="$auth_password" E2E_AUTH_RUN_ID="$run_id" E2E_AUTH_API_BASE="$isolated_api_base" node --input-type=module <<'NODE'
const base = process.env.E2E_AUTH_API_BASE
const body = { email: process.env.E2E_AUTH_MOBILE, password: process.env.E2E_AUTH_PASSWORD }
try {
  const response = await fetch(`${base}/client/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3001', 'X-Auth-E2E-Run-Id': process.env.E2E_AUTH_RUN_ID },
    body: JSON.stringify(body),
  })
  let result = {}
  try { result = await response.json() } catch { /* Keep diagnostics status-only. */ }
  let logoutStatus = null
  const token = typeof result.token === 'string' ? result.token : ''
  if (token) {
    const logout = await fetch(`${base}/client/logout`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    logoutStatus = logout.status
  }
  const errors = result.errors && typeof result.errors === 'object' ? Object.keys(result.errors) : []
  console.log(JSON.stringify({
    status: response.status,
    message: typeof result.message === 'string' ? result.message : null,
    errorFields: errors,
    tokenReturned: Boolean(token),
    logoutStatus,
  }))
} catch {
  console.log(JSON.stringify({ status: null, message: 'isolated_api_unreachable', errorFields: [], tokenReturned: false, logoutStatus: null }))
}
NODE

npx playwright test --config=playwright.integration.config.ts
