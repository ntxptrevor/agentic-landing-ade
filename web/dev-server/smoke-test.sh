#!/usr/bin/env bash
# End-to-end smoke test of the BidForge PHP API with `php -S` (NOT deployed).
#   bash web/dev-server/smoke-test.sh [workdir] [port]
# Creates a throwaway fixture (fake "demo-clinic"), starts php -S, runs checks.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PUB="$HERE/../public"
WORK="${1:-$(mktemp -d)}"
PORT="${2:-8099}"
B="http://127.0.0.1:$PORT"
J="$WORK/cookies.txt"
TOKEN="dev-publish-token"
PASS=0; FAIL=0

rm -rf "$WORK/data" "$WORK/v" "$J" "$WORK/vcookies.txt"; mkdir -p "$WORK"
php "$HERE/make-fixture.php" "$WORK" >/dev/null
PHP_CLI_SERVER_WORKERS=8 BIDFORGE_CONFIG="$WORK/bidforge-config.php" php -S 127.0.0.1:"$PORT" -t "$PUB" "$HERE/router.php" >"$WORK/server.log" 2>&1 &
SRV=$!
# Second server ("viewer" site): a copy of web/public plus a fake built SPA, same data dir, config with
# passphrase_role=viewer, Google not configured, and a ~5 s absolute session lifetime.
VPORT=$((PORT+1)); V="http://127.0.0.1:$VPORT"
mkdir -p "$WORK/v/site/assets"; cp -R "$PUB/." "$WORK/v/site/"
printf '<!doctype html><title>SPA</title><script type="module" src="/assets/index-AbCd1234.js"></script>\n' > "$WORK/v/site/index.html"
echo 'export default 1;' > "$WORK/v/site/assets/pdf.worker.min-AbCd1234.mjs"
php -r '$c = require $argv[1]; $c["passphrase_role"] = "viewer"; $c["google_client_id"] = ""; $c["session_max_hours"] = 0.0015;
  file_put_contents($argv[2], "<?php return " . var_export($c, true) . ";\n");' "$WORK/bidforge-config.php" "$WORK/v/bidforge-config.php"
BIDFORGE_CONFIG="$WORK/v/bidforge-config.php" php -S 127.0.0.1:"$VPORT" -t "$WORK/v/site" "$HERE/router.php" >"$WORK/vserver.log" 2>&1 &
VSRV=$!
trap 'kill $SRV $VSRV 2>/dev/null' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "$B/api/session.php" && curl -s -o /dev/null "$V/api/session.php" && break; sleep 0.1; done
NOW=$(date -u +%FT%TZ); HOURAGO=$(date -u -d '-1 hour' +%FT%TZ)

ok()   { PASS=$((PASS+1)); echo "PASS $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL $1 :: $2"; }
# chk <label> <expected-status> <status> [jq-filter-that-must-be-true] [body-file]
chk() {
  local label="$1" want="$2" got="$3" filt="${4:-}" body="${5:-$WORK/body}"
  if [ "$got" != "$want" ]; then bad "$label" "status $got (want $want): $(head -c 300 "$body")"; return; fi
  if [ -n "$filt" ] && ! jq -e "$filt" "$body" >/dev/null 2>&1; then bad "$label" "filter $filt failed: $(head -c 300 "$body")"; return; fi
  ok "$label"
}
get()  { curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -c "$J" "$B$1"; }
post() { curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -c "$J" -H 'X-BidForge: 1' -H "Origin: $B" -H 'Content-Type: application/json' --data-binary "$2" "$B$1"; }
bearer() { curl -s -o "$WORK/body" -w '%{http_code}' -H "Authorization: Bearer $1" -H 'Content-Type: application/json' "${@:2}"; }

echo "== auth"
chk "session unauthenticated"            200 "$(get /api/session.php)" '.authenticated==false and .user==null and .authMethods.google==true and .authMethods.passphrase==true'
chk "projects without session -> 401"    401 "$(get /api/projects.php)"
chk "project without session -> 401"     401 "$(get '/api/project.php?slug=demo-clinic')"
chk "live without session -> 401"        401 "$(get '/api/live.php?slug=demo-clinic')"
c=$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -c "$J" -H 'Content-Type: application/json' --data '{"passphrase":"admin"}' "$B/api/login.php")
chk "login without X-BidForge -> 403"    403 "$c" '.error=="csrf"'
c=$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -c "$J" -H 'X-BidForge: 1' -H 'Origin: https://evil.example' --data '{"passphrase":"admin"}' "$B/api/login.php")
chk "login cross-origin -> 403"          403 "$c" '.error=="csrf_origin"'
chk "login GET -> 405"                   405 "$(get /api/login.php)"
chk "login wrong passphrase -> 401"      401 "$(post /api/login.php '{"passphrase":"wrong"}')"
chk "login dev-fixture passphrase -> 200 (editor)" 200 "$(post /api/login.php '{"passphrase":"admin"}')" '.authenticated==true and .user.method=="passphrase" and .user.role=="editor" and .readOnly==false'
grep -q 'HttpOnly' <(curl -s -D - -o /dev/null -H 'X-BidForge: 1' --data '{"passphrase":"admin"}' "$B/api/login.php" -c /dev/null) \
  && grep -qi 'samesite=lax' <(curl -s -D - -o /dev/null -H 'X-BidForge: 1' --data '{"passphrase":"admin"}' "$B/api/login.php") \
  && ok "session cookie HttpOnly + SameSite=Lax" || bad "session cookie flags" "missing"

echo "== google oauth (redirect building only; no live Google round-trip here)"
GJ="$WORK/gcookies.txt"
LOC=$(curl -s -D - -o /dev/null -c "$GJ" "$B/auth/google.php?next=/%3Fproject%3Ddemo-clinic" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
case "$LOC" in https://accounts.google.com/o/oauth2/v2/auth\?*) ok "google.php redirects to Google";; *) bad "google.php redirect" "$LOC";; esac
for k in 'state=[0-9a-f]\{48\}' 'nonce=[0-9a-f]\{48\}' 'hd=ntxpllc.com' 'prompt=select_account' 'scope=openid%20email%20profile'; do
  echo "$LOC" | grep -q "$k" && ok "redirect has $k" || bad "redirect param $k" "$LOC"
done
LOC=$(curl -s -D - -o /dev/null -b "$GJ" "$B/auth/callback.php?state=forged&code=x" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
[ "$LOC" = "/?auth_error=bad_state" ] && ok "callback forged state -> /?auth_error=bad_state" || bad "callback state" "$LOC"
LOC=$(curl -s -D - -o /dev/null -b "$GJ" "$B/auth/callback.php?error=access_denied" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
[ "$LOC" = "/?auth_error=access_denied" ] && ok "callback error param -> /?auth_error=access_denied" || bad "callback error" "$LOC"
LOC=$(curl -s -D - -o /dev/null -b "$GJ" "$B/auth/callback.php?error=server_error" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
[ "$LOC" = "/?auth_error=token" ] && ok "callback other Google error -> /?auth_error=token" || bad "callback error map" "$LOC"
grep -q "tokeninfo', \['id_token'" "$PUB/auth/callback.php" && ! grep -q 'tokeninfo?id_token' "$PUB/auth/callback.php" \
  && ok "tokeninfo called with POST body (no id_token in URL)" || bad "tokeninfo POST" "callback.php"

echo "== read"
chk "projects (default bid/active)"      200 "$(get /api/projects.php)" '(.projects|length)==1 and .projects[0].slug=="demo-clinic" and .projects[0].liveUrl=="/?project=demo-clinic" and .projects[0].folder.kind=="project"'
chk "projects ?all=1 includes closed"    200 "$(get '/api/projects.php?all=1')" '(.projects|length)==2'
chk "project load"                       200 "$(get '/api/project.php?slug=demo-clinic')" '.canonical.version==1 and .version==1 and (.hash|length)==64 and (.activity.critical|length)==1 and (.activity.recent|length)==3 and (.versions|length)==1 and (.canonical.extras|type)=="object"'
HASH1=$(jq -r .hash "$WORK/body")
chk "project bad slug -> 400"            400 "$(get '/api/project.php?slug=../etc')"
chk "project unknown -> 404"             404 "$(get '/api/project.php?slug=nope-nope')"
chk "live.html served"                   200 "$(get '/api/live.php?slug=demo-clinic')"
grep -q 'Demo Family Clinic' "$WORK/body" && ok "live.html content" || bad "live.html content" "$(head -c 100 "$WORK/body")"
H=$(curl -s -D - -o /dev/null -b "$J" "$B/api/live.php?slug=demo-clinic" | tr -d '\r')
echo "$H" | grep -qi "^content-security-policy: default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'self'; sandbox$" \
  && echo "$H" | grep -qi '^x-content-type-options: nosniff' && ok "live.php CSP (sandbox, no scripts) + nosniff" || bad "live.php CSP" "$H"

echo "== save"
get '/api/project.php?slug=demo-clinic' >/dev/null
CAN=$(jq -c --arg ts "$HOURAGO" '.canonical | .tasks += [{"id":"T4","name":"Punch list","duration":5}] | .project.slug="wrong-slug"
  | .sync={"publishedVersion":2,"lastPublish":{"version":2,"at":"2026-10-14T00:00:00Z","target":"site"}}
  | .activity=[{"ts":$ts,"source":"schedule","kind":"event","text":"CHG-0001 add_event · T4: Owner asked for punch list","link":"javascript:alert(1)","rating":3,"critical":true,"sources":[{"type":"email","title":"Owner request","url":"https://example.com/m/1","date":"2026-10-14"}]}]' "$WORK/body")
chk "save without X-BidForge -> 403"     403 "$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" --data "{\"slug\":\"demo-clinic\"}" "$B/api/save.php")"
chk "save existing (base v1 + hash)"     200 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":1,\"baseHash\":\"$HASH1\",\"reason\":\"Add punch list\",\"sources\":[{\"type\":\"email\",\"title\":\"Owner request [fake]\",\"url\":\"https://example.com/m/1\",\"date\":\"2026-10-14\"}]}")" '.ok==true and .version==2 and .liveUrl=="/?project=demo-clinic" and .slug=="demo-clinic" and .slugRewritten==true and .canonicalSlugWas=="wrong-slug" and .activityAdded==1'
HASH2=$(jq -r .hash "$WORK/body")
chk "save stale baseVersion -> 409"      409 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":1,\"reason\":\"stale\"}")" '.conflict==true and .currentVersion==2 and .currentHash=="'"$HASH2"'"'
chk "save stale baseHash -> 409"         409 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":2,\"baseHash\":\"$HASH1\",\"reason\":\"stale\"}")" '.conflict==true'
chk "save new slug (baseVersion null)"   200 "$(post /api/save.php '{"slug":"new-demo-bid","name":"New Demo Bid","status":"bid","canonical":{"schema":"bidforge.canonical.v1","project":{"name":"New Demo Bid"},"links":{"hostUrl":"https://example.com/host"},"tasks":[]},"baseVersion":null,"reason":"Initial schedule","sources":[]}')" '.version==1'
chk "save new slug with baseVersion -> 409" 409 "$(post /api/save.php '{"slug":"another-new","canonical":{"tasks":[]},"baseVersion":3,"reason":"x"}')" '.conflict==true and .currentVersion==null'
chk "save invalid slug -> 400"           400 "$(post /api/save.php '{"slug":"Bad Slug","canonical":{},"baseVersion":null}')"
chk "project after save"                 200 "$(get '/api/project.php?slug=demo-clinic')" '.version==2 and .hash=="'"$HASH2"'" and (.versions|length)==2 and (.activity.recent[0].text|test("Schedule v2 saved by team@ntxpllc.com \\(passphrase\\): Add punch list")) and .activity.recent[0].method=="passphrase" and .unpulled==[2]'
jq -e '.canonical.project.slug=="demo-clinic"' "$WORK/body" >/dev/null && ok "canonical slug rewritten to routing slug" || bad "slug rewrite" "$(jq -c .canonical.project "$WORK/body")"
jq -e '.canonical.sync.siteSavedVersion==2 and .canonical.sync.publishedVersion==null and .canonical.sync.lastPublish==null and .project.publishedVersion==null and .project.siteSavedVersion==2' "$WORK/body" >/dev/null \
  && ok "site save is not a publish (siteSavedVersion set, client publishedVersion stripped)" || bad "publishedVersion strip" "$(jq -c '[.canonical.sync, .project.publishedVersion]' "$WORK/body")"
jq -e '(.activity.recent|map(select(.text|startswith("CHG-0001 add_event")))) as $a | ($a|length)==1 and $a[0].link==null and $a[0].sources[0].url=="https://example.com/m/1" and ((.activity.critical|map(.text))|index("CHG-0001 add_event · T4: Owner asked for punch list")!=null)' "$WORK/body" >/dev/null \
  && ok "canonical per-change activity merged (javascript: link dropped)" || bad "activity merge" "$(jq -c .activity.recent "$WORK/body")"
chk "save with array reason -> clean 409 (no PHP error)" 409 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":1,\"reason\":[\"x\"]}")" '.conflict==true'
chk "index upserted (new bid + routing)" 200 "$(get '/api/projects.php')" '(.projects|map(select(.slug=="new-demo-bid"))[0] | .folder.path=="!Active Bids/New Demo Bid/Schedules" and .version==1 and .hostUrl=="https://example.com/host") and (.projects|map(select(.slug=="demo-clinic"))[0].version==2)'
D="$WORK/data/projects/demo-clinic"
grep -q 'v2\*\* saved by team@ntxpllc.com via passphrase.*Add punch list.*wrong-slug.*\[Owner request \\\[fake\\\]\](https://example.com/m/1)' "$D/changelog.md" && ok "changelog line with method, slug note, linked source" || bad "changelog" "$(cat "$D/changelog.md")"
[ "$(wc -l < "$D/pending_sync.jsonl")" = "1" ] && jq -e '.method=="passphrase" and (.sources|length)==1' "$D/pending_sync.jsonl" >/dev/null \
  && ok "pending_sync.jsonl appended (method + sources)" || bad "pending_sync" "$(cat "$D/pending_sync.jsonl" 2>/dev/null)"
ls "$D/versions" | grep -q '^v002-' && ok "immutable version snapshot v002" || bad "version snapshot" "$(ls "$D/versions")"
[ "$(echo -n "$(cat "$D/canonical.json")" | wc -c)" -gt 0 ] && [ "$(sha256sum "$D/canonical.json" | cut -d' ' -f1)" = "$HASH2" ] && ok "hash == sha256(canonical.json bytes)" || bad "hash rule" "mismatch"

echo "== upload / file"
printf '%%PDF-1.4\n%%fake\n1 0 obj<<>>endobj\ntrailer<<>>\n%%%%EOF\n' > "$WORK/spec.pdf"
printf '\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0\x1f\x15\xc4\x89\0\0\0\rIDATx\x9cc\xf8\x0f\0\0\x01\x01\0\x05\x18\xd8N\0\0\0\0IEND\xaeB`\x82' > "$WORK/photo.png"
echo '<?php echo 1;' > "$WORK/evil.php"; echo 'MZ' > "$WORK/tool.exe"; echo 'x' > "$WORK/trick.php.pdf"
up() { curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -H 'X-BidForge: 1' -H "Origin: $B" "$@" "$B/api/upload.php"; }
chk "upload pdf + png"                   200 "$(up -F slug=demo-clinic -F kind=spec -F "files[]=@$WORK/spec.pdf" -F "files[]=@$WORK/photo.png")" '(.uploads|length)==2 and .uploads[0].mime=="application/pdf" and .uploads[1].mime=="image/png" and (.uploads[0].url|startswith("/api/file.php?slug=demo-clinic&id="))'
PDFID=$(jq -r '.uploads[0].id' "$WORK/body"); PNGID=$(jq -r '.uploads[1].id' "$WORK/body")
chk "upload .php rejected"               400 "$(up -F slug=demo-clinic -F kind=spec -F "files[]=@$WORK/evil.php")" '.rejected[0].error=="extension_not_allowed"'
chk "upload .exe rejected"               400 "$(up -F slug=demo-clinic -F kind=spec -F "files[]=@$WORK/tool.exe")" '.rejected[0].error=="extension_not_allowed"'
chk "upload .php.pdf neutralized"        200 "$(up -F slug=demo-clinic -F kind=plan -F "files[]=@$WORK/trick.php.pdf")" '(.uploads[0].path|test("-trick_php\\.pdf$"))'
chk "upload bad kind -> 400"             400 "$(up -F slug=demo-clinic -F kind=virus -F "files[]=@$WORK/spec.pdf")"
chk "upload without X-BidForge -> 403"   403 "$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -F slug=demo-clinic -F kind=spec -F "files[]=@$WORK/spec.pdf" "$B/api/upload.php")"
H=$(curl -s -D - -o "$WORK/dl.pdf" -b "$J" "$B/api/file.php?slug=demo-clinic&id=$PDFID")
echo "$H" | grep -qi '^content-type: application/pdf' && echo "$H" | grep -qi '^content-disposition: inline' && cmp -s "$WORK/dl.pdf" "$WORK/spec.pdf" \
  && ok "file download pdf (inline, bytes match)" || bad "file download pdf" "$H"
H=$(curl -s -D - -o /dev/null -b "$J" "$B/api/file.php?slug=demo-clinic&id=$PNGID"); echo "$H" | grep -qi '^content-type: image/png' && ok "file download png" || bad "file png" "$H"
chk "file without session -> 401"        401 "$(curl -s -o "$WORK/body" -w '%{http_code}' "$B/api/file.php?slug=demo-clinic&id=$PDFID")"
chk "file traversal id -> 400"           400 "$(get '/api/file.php?slug=demo-clinic&id=../../canonical.json')"
chk "file unknown id -> 404"             404 "$(get '/api/file.php?slug=demo-clinic&id=0123456789abcdef')"
chk "uploads listed on project"          200 "$(get '/api/project.php?slug=demo-clinic')" '(.uploads|length)==3 and (.activity.recent|map(select(.kind=="upload"))|length)==2'

echo "== publish / changes (bearer)"
chk "publish bad token -> 401"           401 "$(bearer wrong-token --data '{"projects":[]}' "$B/api/publish.php")"
chk "publish no token -> 401"            401 "$(curl -s -o "$WORK/body" -w '%{http_code}' --data '{}' "$B/api/publish.php")"
chk "publish GET -> 405"                 405 "$(bearer "$TOKEN" "$B/api/publish.php")"
PUB_BODY=$(jq -cn --argjson can "$(cat "$D/versions/v001-2026-10-01.json")" '{
  projects:[{slug:"demo-clinic",name:"Demo Family Clinic Renovation",status:"active",version:1,owner:"KB owner (fake)"},
            {slug:"kb-only-job",name:"KB Only Job",number:"KB-9",status:"bid",version:3,folder:{kind:"bid",path:"Bids/KB Only Job/Schedules"}}],
  bundles:[{slug:"demo-clinic",canonical:$can,activity_stream:{section:"activity_stream",entries:[{ts:"2026-10-13T12:00:00Z",source:"kb",kind:"note",text:"From KB",rating:3}]}},
           {slug:"kb-only-job",canonical:{schema:"bidforge.canonical.v1",version:3,tasks:[]},html:"<!doctype html><p>KB live</p>"}]}')
chk "publish with token (stale bundle refused)" 200 "$(bearer "$TOKEN" --data "$PUB_BODY" "$B/api/publish.php")" '.results[0].status==409 and .results[0].conflict==true and .results[0].error=="stale_version" and .results[0].currentVersion==2 and .results[0].currentHash=="'"$HASH2"'" and .results[0].unpulled==[2] and .results[0].activityAdded==1 and .results[1].status==200 and .results[1].version==3 and .results[1].live==true and .results[1].liveVersion==3'
KBH3=$(jq -r '.results[1].hash' "$WORK/body")
chk "site save not overwritten"          200 "$(get '/api/project.php?slug=demo-clinic')" '.version==2 and .hash=="'"$HASH2"'" and .project.version==2 and .project.owner=="KB owner (fake)"'
chk "kb-only project published"          200 "$(get '/api/project.php?slug=kb-only-job')" '.version==3 and .hasLive==true and .liveVersion==3 and .project.folder.path=="Bids/KB Only Job/Schedules" and .project.publishedVersion==3 and .hash=="'"$KBH3"'"'
NEWER=$(jq -c '.version=4' "$D/canonical.json")
chk "publish without base on existing slug -> 409 base_mismatch" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"kb-only-job\",\"canonical\":$NEWER}]}" "$B/api/publish.php")" '.results[0].status==409 and .results[0].error=="base_mismatch" and .results[0].currentVersion==3'
chk "publish newer version with base accepted" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"kb-only-job\",\"baseVersion\":3,\"baseHash\":\"$KBH3\",\"canonical\":$NEWER}]}" "$B/api/publish.php")" '.results[0].status==200 and .results[0].version==4'
KBH4=$(jq -r '.results[0].hash' "$WORK/body")
JUMP=$(jq -c '.version=50' "$D/canonical.json")
chk "publish absurd version jump -> 400 version_jump" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"kb-only-job\",\"baseVersion\":4,\"baseHash\":\"$KBH4\",\"canonical\":$JUMP}]}" "$B/api/publish.php")" '.results[0].status==400 and .results[0].error=="version_jump" and .results[0].maxVersion==5'
chk "publish new slug with non-null baseVersion -> 409" 200 "$(bearer "$TOKEN" --data '{"bundles":[{"slug":"kb-new-two","baseVersion":2,"baseHash":"x","canonical":{"version":1,"tasks":[]}}]}' "$B/api/publish.php")" '.results[0].status==409 and .results[0].error=="base_mismatch" and .results[0].currentVersion==null'
chk "publish status change re-routes folder (bid -> active)" 200 "$(bearer "$TOKEN" --data '{"projects":[{"slug":"new-demo-bid","name":"New Demo Bid","status":"awarded"}]}' "$B/api/publish.php")"
chk "index folder follows KB status"     200 "$(get '/api/projects.php')" '(.projects|map(select(.slug=="new-demo-bid"))[0] | .status=="active" and .folder.kind=="project" and .folder.path=="!Active Projects/New Demo Bid/06 - Schedule")'
chk "changes bad token -> 401"           401 "$(bearer nope "$B/api/changes.php")"
chk "changes since epoch"                200 "$(bearer "$TOKEN" "$B/api/changes.php?since=2000-01-01T00:00:00Z")" '(.changes|length)==2 and (.changes|map(.slug)|sort)==["demo-clinic","new-demo-bid"] and (.changes[0].hash|length)==64 and (.changes|map(select(.slug=="demo-clinic"))[0] | .version==2 and .by=="team@ntxpllc.com" and .method=="passphrase" and .reason=="Add punch list" and (.sources|length)==1 and .canonicalUrl=="/api/changes.php?slug=demo-clinic&version=2" and (.savedAt|length)>0)'
chk "changes ?project= filter"           200 "$(bearer "$TOKEN" "$B/api/changes.php?project=new-demo-bid")" '(.changes|length)==1 and .changes[0].slug=="new-demo-bid"'
chk "changes since future -> none"       200 "$(bearer "$TOKEN" "$B/api/changes.php?since=2099-01-01T00:00:00Z")" '(.changes|length)==0'
chk "changes bad since -> 400"           400 "$(bearer "$TOKEN" "$B/api/changes.php?since=notadate")"
chk "changes fetch version JSON"         200 "$(bearer "$TOKEN" "$B/api/changes.php?slug=demo-clinic&version=2")" '.version==2 and (.tasks|length)==4'
chk "changes ack"                        200 "$(bearer "$TOKEN" --data '{"ack":[{"slug":"demo-clinic","version":2}]}' "$B/api/changes.php")" '.acked==1'
chk "changes after ack"                  200 "$(bearer "$TOKEN" "$B/api/changes.php")" '(.changes|length)==1 and .changes[0].slug=="new-demo-bid"'

echo "== fork guard: KB publish vs un-pulled site save (A-02 / F-01 / F-03)"
# KB has pulled + acked v2 (base = v2/HASH2). A site user now saves v3.
get '/api/project.php?slug=demo-clinic' >/dev/null
CAN3=$(jq -c '.canonical | .tasks += [{"id":"T5","name":"SITE EDIT punch walk","duration":1}]' "$WORK/body")
chk "site save v3 (base v2)"             200 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN3,\"baseVersion\":2,\"baseHash\":\"$HASH2\",\"reason\":\"SITE EDIT punch walk\",\"sources\":[{\"type\":\"site\",\"title\":\"Walk with owner\",\"date\":\"2026-10-15\"}]}")" '.version==3 and .activityAdded==0'
HASH3=$(jq -r .hash "$WORK/body")
# The KB branched from v2: one sync item, published as v4 on base v2.
bearer "$TOKEN" "$B/api/changes.php?slug=demo-clinic&version=2" >/dev/null; cp "$WORK/body" "$WORK/kb-v2.json"
KBEDIT='.tasks += [{"id":"T6","name":"KB sync item","duration":2}] | .version=4
  | .changelog = ((.changelog // []) + [{"id":"CHG-0002","at":$now,"type":"duration_change","target":"T2","reason":"RFI 12 answer","jevRating":2,
      "sources":[{"type":"rfi","title":"RFI 12","url":"https://example.com/rfi/12","date":"2026-10-15"}]}])
  | .activity = [{"ts":$now,"source":"kb","kind":"note","text":"CHG-0002 duration_change · T2: RFI 12 answer","rating":2,"sources":[{"type":"rfi","title":"RFI 12","url":"https://example.com/rfi/12"}]}]'
KB4=$(jq -c --arg now "$NOW" "$KBEDIT" "$WORK/kb-v2.json")
chk "publish forked v4 on stale base -> 409 base_mismatch, live.html untouched" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"demo-clinic\",\"baseVersion\":2,\"baseHash\":\"$HASH2\",\"canonical\":$KB4,\"html\":\"<p>KB FORK</p>\",\"htmlVersion\":4}]}" "$B/api/publish.php")" \
  '.results[0].status==409 and .results[0].conflict==true and .results[0].error=="base_mismatch" and .results[0].currentVersion==3 and .results[0].currentHash=="'"$HASH3"'" and .results[0].unpulled==[3] and .results[0].live==false and .results[0].liveError=="canonical_refused"'
chk "site edit survives the forked publish" 200 "$(get '/api/project.php?slug=demo-clinic')" '.version==3 and .hash=="'"$HASH3"'" and (.canonical.tasks|map(.name)|index("SITE EDIT punch walk")!=null) and (.canonical.tasks|map(.name)|index("KB sync item")==null) and .liveVersion==null'
get '/api/live.php?slug=demo-clinic' >/dev/null; grep -q 'Demo Family Clinic' "$WORK/body" && ! grep -q 'KB FORK' "$WORK/body" && ok "live.html not written for refused bundle" || bad "live.html on refused bundle" "$(head -c 100 "$WORK/body")"
# KB rebases on v3 but has not acked it yet → still refused.
chk "changes lists un-pulled site save v3" 200 "$(bearer "$TOKEN" "$B/api/changes.php?project=demo-clinic&since=2000-01-01T00:00:00Z")" '(.changes|length)==1 and .changes[0].version==3 and .changes[0].hash=="'"$HASH3"'" and .changes[0].reason=="SITE EDIT punch walk" and .changes[0].sources[0].title=="Walk with owner" and .changes[0].canonicalUrl=="/api/changes.php?slug=demo-clinic&version=3"'
CURL3=$(jq -r '.changes[0].canonicalUrl' "$WORK/body")
bearer "$TOKEN" "$B$CURL3" >/dev/null; cp "$WORK/body" "$WORK/site-v3.json"
jq -e '.version==3 and (.tasks|map(.name)|index("SITE EDIT punch walk")!=null)' "$WORK/site-v3.json" >/dev/null && ok "canonicalUrl serves site v3 JSON" || bad "canonicalUrl" "$(head -c 200 "$WORK/site-v3.json")"
KB4B=$(jq -c --arg now "$NOW" "$KBEDIT" "$WORK/site-v3.json")
chk "publish on right base but un-acked -> 409 unpulled_site_saves" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"demo-clinic\",\"baseVersion\":3,\"baseHash\":\"$HASH3\",\"canonical\":$KB4B}]}" "$B/api/publish.php")" \
  '.results[0].status==409 and .results[0].error=="unpulled_site_saves" and .results[0].unpulled==[3] and .results[0].currentVersion==3'
chk "identical v3 publish while un-acked -> 409 (not 'unchanged')" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"demo-clinic\",\"baseVersion\":3,\"baseHash\":\"$HASH3\",\"canonical\":$(cat "$WORK/site-v3.json")}]}" "$B/api/publish.php")" \
  '.results[0].status==409 and .results[0].error=="unpulled_site_saves" and (.results[0].unchanged|not)'
chk "ack site v3"                        200 "$(bearer "$TOKEN" --data '{"ack":[{"slug":"demo-clinic","version":3}]}' "$B/api/changes.php")" '.acked==1'
chk "publish v4 with right base after ack -> 200 + live" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"demo-clinic\",\"baseVersion\":3,\"baseHash\":\"$HASH3\",\"canonical\":$KB4B,\"html\":\"<!doctype html><p>KB live v4</p>\",\"htmlVersion\":4}]}" "$B/api/publish.php")" \
  '.results[0].status==200 and .results[0].version==4 and .results[0].live==true and .results[0].liveVersion==4 and .results[0].activityAdded==1'
HASH4=$(jq -r '.results[0].hash' "$WORK/body")
chk "merged v4 holds site edit + KB item" 200 "$(get '/api/project.php?slug=demo-clinic')" '.version==4 and .hash=="'"$HASH4"'" and (.canonical.tasks|map(.name)|index("SITE EDIT punch walk")!=null) and (.canonical.tasks|map(.name)|index("KB sync item")!=null) and .liveVersion==4 and .unpulled==[] and .project.publishedVersion==4'
jq -e '(.activity.recent|map(.text)) as $t | ($t|index("CHG-0002 duration_change · T2: RFI 12 answer")!=null) and ($t|map(select(test("^Schedule v4 published from knowledge base: 1 change\\(s\\): CHG-0002 duration_change: RFI 12 answer")))|length)==1' "$WORK/body" >/dev/null \
  && ok "publish merges canonical activity + adds publish line" || bad "publish activity" "$(jq -c '.activity.recent|map(.text)' "$WORK/body")"
tail -1 "$D/changelog.md" | grep -q "^- [0-9-]\{10\} — \*\*v4\*\* published from knowledge base by kb-sync (\[v004-.*CHG-0002.*RFI 12 answer — Sources: rfi: \[RFI 12\](https://example.com/rfi/12) (2026-10-15)$" \
  && ok "publish appends dated changelog line with linked sources" || bad "publish changelog" "$(tail -1 "$D/changelog.md")"
get '/api/live.php?slug=demo-clinic' >/dev/null; grep -q 'KB live v4' "$WORK/body" && ok "live.html written for accepted bundle" || bad "live.html accepted" "$(head -c 100 "$WORK/body")"
chk "html-only bundle for an old version refused" 200 "$(bearer "$TOKEN" --data '{"bundles":[{"slug":"demo-clinic","html":"<p>old v3 html</p>","htmlVersion":3}]}' "$B/api/publish.php")" '.results[0].live==false and .results[0].liveError=="html_version_mismatch"'
chk "html-only bundle for the stored version accepted" 200 "$(bearer "$TOKEN" --data '{"bundles":[{"slug":"demo-clinic","html":"<p>v4 html refresh</p>","htmlVersion":4}]}' "$B/api/publish.php")" '.results[0].live==true and .results[0].liveVersion==4'
chk "re-publish identical v4 -> unchanged" 200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"demo-clinic\",\"baseVersion\":4,\"baseHash\":\"$HASH4\",\"canonical\":$KB4B}]}" "$B/api/publish.php")" '.results[0].status==200 and .results[0].unchanged==true'

echo "== site save after publish: publishedVersion stays KB-owned (A-07), activity dedupe (A-11)"
get '/api/project.php?slug=demo-clinic' >/dev/null
CAN5=$(jq -c '.canonical | .sync.publishedVersion=9 | .sync.lastPublish={"version":9,"at":"x","target":"site"} | .tasks[0].duration=4' "$WORK/body")
chk "site save v5 claiming publishedVersion 9" 200 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN5,\"baseVersion\":4,\"baseHash\":\"$HASH4\",\"reason\":\"Mobilization 4d\"}")" '.version==5 and .activityAdded==0'
HASH5=$(jq -r .hash "$WORK/body")
chk "stored publishedVersion = KB-published 4" 200 "$(get '/api/project.php?slug=demo-clinic')" '.canonical.sync.publishedVersion==4 and .canonical.sync.lastPublish==null and .canonical.sync.siteSavedVersion==5 and .project.publishedVersion==4 and .project.siteSavedVersion==5 and .unpulled==[5]'

echo "== version jump guard (F-16 / C-45)"
get '/api/project.php?slug=demo-clinic' >/dev/null; cp "$WORK/body" "$WORK/p5.json"
J50=$(jq -c '.canonical | .version=50' "$WORK/p5.json")
chk "save version 50 on v5 -> 400 version_jump" 400 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$J50,\"baseVersion\":5,\"baseHash\":\"$HASH5\",\"reason\":\"jump\"}")" '.error=="version_jump" and .maxVersion==6'
J20=$(jq -c '.canonical | .version=100000000000000000000' "$WORK/p5.json")
chk "save version 1e20 -> 400 invalid_version" 400 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$J20,\"baseVersion\":5,\"baseHash\":\"$HASH5\",\"reason\":\"jump\"}")" '.error=="invalid_version"'
J8=$(jq -c --arg now "$NOW" '.canonical | .version=8 | .changelog += [{"id":"CHG-0003","at":$now,"type":"a"},{"id":"CHG-0004","at":$now,"type":"b"},{"id":"CHG-0005","at":$now,"type":"c"}]' "$WORK/p5.json")
chk "save version 8 backed by 3 new changelog entries -> 200" 200 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$J8,\"baseVersion\":5,\"baseHash\":\"$HASH5\",\"reason\":\"three edits\"}")" '.version==8'
chk "project version 8, nothing stored above it" 200 "$(get '/api/project.php?slug=demo-clinic')" '.version==8 and (.versions|map(.version)|max)==8 and (.versions|length)==6'

echo "== snapshots: older than newest N (fixture N=3) are gzipped and still served"
ls "$D/versions" | grep -q '^v001-.*\.json\.gz$' && ls "$D/versions" | grep -q '^v003-.*\.json\.gz$' && ls "$D/versions" | grep -q '^v008-.*\.json$' \
  && ok "old snapshots gzipped, newest plain" || bad "gzip snapshots" "$(ls "$D/versions")"
chk "changes serves a gzipped snapshot"   200 "$(bearer "$TOKEN" "$B/api/changes.php?slug=demo-clinic&version=2")" '.version==2 and (.tasks|length)==4'

echo "== viewer role, auth_error codes, session lifetime, SPA headers (second server)"
VJ="$WORK/vcookies.txt"
vget()  { curl -s -o "$WORK/body" -w '%{http_code}' -b "$VJ" -c "$VJ" "$V$1"; }
vpost() { curl -s -o "$WORK/body" -w '%{http_code}' -b "$VJ" -c "$VJ" -H 'X-BidForge: 1' -H "Origin: $V" -H 'Content-Type: application/json' --data-binary "$2" "$V$1"; }
chk "viewer: login -> role viewer"       200 "$(vpost /api/login.php '{"passphrase":"admin"}')" '.user.role=="viewer" and .readOnly==true and .authMethods.google==false'
chk "viewer: read project ok"            200 "$(vget '/api/project.php?slug=demo-clinic')" '.version==8'
chk "viewer: save -> 403 read_only"      403 "$(vpost /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":{\"tasks\":[]},\"baseVersion\":8,\"reason\":\"x\"}")" '.error=="read_only"'
chk "viewer: upload -> 403 read_only"    403 "$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$VJ" -H 'X-BidForge: 1' -H "Origin: $V" -F slug=demo-clinic -F kind=spec -F "files[]=@$WORK/spec.pdf" "$V/api/upload.php")" '.error=="read_only"'
LOC=$(curl -s -D - -o /dev/null "$V/auth/google.php" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
[ "$LOC" = "/?auth_error=config" ] && ok "google not configured -> /?auth_error=config" || bad "auth_error config" "$LOC"
LOC=$(curl -s -D - -o /dev/null "$V/auth/callback.php?state=x&code=y" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
[ "$LOC" = "/?auth_error=config" ] && ok "callback without Google config -> /?auth_error=config" || bad "callback config" "$LOC"
H=$(curl -s -D - -o /dev/null "$V/?project=demo-clinic" | tr -d '\r')
echo "$H" | grep -qi "^content-security-policy: .*script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:;.*frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com" \
  && echo "$H" | grep -qi '^cache-control: no-cache' && ok "SPA index: site CSP + no-cache" || bad "SPA CSP" "$H"
H=$(curl -s -D - -o /dev/null "$V/assets/pdf.worker.min-AbCd1234.mjs" | tr -d '\r')
echo "$H" | grep -qi '^content-type: text/javascript' && echo "$H" | grep -qi '^cache-control: public, max-age=31536000, immutable' \
  && ok ".mjs worker served as text/javascript, immutable" || bad ".mjs headers" "$H"
grep -q "AddType text/javascript .js .mjs" "$PUB/.htaccess" && grep -q "worker-src 'self' blob:" "$PUB/.htaccess" && ok ".htaccess has .mjs type + worker-src" || bad ".htaccess" "mjs/csp"
sleep 6
chk "viewer: absolute session lifetime expired -> 401" 401 "$(vget /api/projects.php)"

echo "== server errors are generic JSON (no paths)"
: > "$WORK/data/projects/boom-file"   # a FILE where the project directory should be
c=$(post /api/save.php '{"slug":"boom-file","canonical":{"tasks":[]},"baseVersion":null,"reason":"x"}')
chk "exception -> 500 generic JSON"       500 "$c" '.error=="server_error" and .message=="Internal server error"'
grep -q "$WORK\|/data/\|Warning\|Stack" "$WORK/body" && bad "500 leaks details" "$(cat "$WORK/body")" || ok "500 body has no paths/warnings"
printf '<?php return ["data_dir" => %s];\n' "'$PUB/api'" > "$WORK/inside-config.php"
OUT=$(BIDFORGE_CONFIG="$WORK/inside-config.php" php -r 'require $argv[1]; bf_data_dir(); echo "NO-REFUSAL";' "$PUB/api/_lib.php" 2>/dev/null)
echo "$OUT" | grep -q '"error":"data_dir_inside_webroot"' && ok "data_dir inside web root refused" || bad "data_dir inside web root" "$OUT"

echo "== router / static denies"
chk "GET /api/data/ forbidden"           403 "$(get /api/data/)"
chk "GET /api/_lib.php forbidden"        403 "$(get /api/_lib.php)"
chk "GET /api/config.sample.php forbidden" 403 "$(get /api/config.sample.php)"
chk "GET /api/README.md forbidden"       403 "$(get /api/README.md)"
chk "GET /.htaccess forbidden"           403 "$(get /.htaccess)"
chk "unknown /api/ path -> 404 (no SPA)" 404 "$(get /api/nope.php)"

echo "== logout + rate limit"
chk "logout without header -> 403"       403 "$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" -X POST "$B/api/logout.php")"
chk "logout"                             200 "$(post /api/logout.php '{}')" '.ok==true'
chk "projects after logout -> 401"       401 "$(get /api/projects.php)"
mkdir -p "$WORK/data/ratelimit"; echo '[1]' > "$WORK/data/ratelimit/login-stale.json"; touch -d '2 days ago' "$WORK/data/ratelimit/login-stale.json"
for i in $(seq 1 10); do post /api/login.php '{"passphrase":"bad"}' >/dev/null; done
chk "11th attempt rate-limited (even correct) -> 429" 429 "$(post /api/login.php '{"passphrase":"admin"}')" '.error=="rate_limited" and .retryAfter>0'
[ ! -e "$WORK/data/ratelimit/login-stale.json" ] && ok "rate-limit files older than 24 h garbage-collected" || bad "ratelimit GC" "stale file kept"
# C-27: 60 parallel guesses from one client IP evaluate at most login_max_attempts (10).
seq 1 60 | xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' -H 'X-BidForge: 1' -H 'X-Forwarded-For: 10.9.9.9' -H 'Content-Type: application/json' \
  --data '{"passphrase":"bad"}' "$B/api/login.php" > "$WORK/burst.txt"
N401=$(grep -c '^401$' "$WORK/burst.txt"); N429=$(grep -c '^429$' "$WORK/burst.txt")
[ "$N401" -le 10 ] && [ $((N401+N429)) = 60 ] && ok "parallel burst: $N401 evaluated (<=10), $N429 x 429" || bad "parallel burst" "401=$N401 429=$N429"
# Global limiter: failures from many IPs (each under the per-IP limit) lock passphrase login for everyone.
for i in $(seq 1 40); do
  curl -s -o /dev/null -H 'X-BidForge: 1' -H "X-Forwarded-For: 10.1.0.$i" -H 'Content-Type: application/json' --data '{"passphrase":"bad"}' "$B/api/login.php"
done
c=$(curl -s -o "$WORK/body" -w '%{http_code}' -H 'X-BidForge: 1' -H 'X-Forwarded-For: 10.2.0.1' -H 'Content-Type: application/json' --data '{"passphrase":"admin"}' "$B/api/login.php")
chk "global lockout: correct passphrase from a fresh IP -> 429 passphrase_locked" 429 "$c" '.error=="passphrase_locked" and .retryAfter>800'
LOC=$(curl -s -D - -o /dev/null "$B/auth/google.php" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')
case "$LOC" in https://accounts.google.com/*) ok "Google login unaffected by passphrase lockout";; *) bad "google during lockout" "$LOC";; esac
grep -v boom-file "$WORK/server.log" | grep -q 'Warning\|Fatal\|Deprecated' && bad "server log has PHP warnings" "$(grep -m3 'Warning\|Fatal\|Deprecated' "$WORK/server.log")" || ok "no unexpected PHP warnings in server log"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
