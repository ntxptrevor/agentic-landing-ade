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

rm -rf "$WORK/data" "$J"; mkdir -p "$WORK"
php "$HERE/make-fixture.php" "$WORK" >/dev/null
BIDFORGE_CONFIG="$WORK/bidforge-config.php" php -S 127.0.0.1:"$PORT" -t "$PUB" "$HERE/router.php" >"$WORK/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "$B/api/session.php" && break; sleep 0.1; done

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
chk "login 'admin' -> 200"               200 "$(post /api/login.php '{"passphrase":"admin"}')" '.authenticated==true and .user.method=="passphrase"'
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

echo "== read"
chk "projects (default bid/active)"      200 "$(get /api/projects.php)" '(.projects|length)==1 and .projects[0].slug=="demo-clinic" and .projects[0].liveUrl=="/?project=demo-clinic" and .projects[0].folder.kind=="project"'
chk "projects ?all=1 includes closed"    200 "$(get '/api/projects.php?all=1')" '(.projects|length)==2'
chk "project load"                       200 "$(get '/api/project.php?slug=demo-clinic')" '.canonical.version==1 and .version==1 and (.hash|length)==64 and (.activity.critical|length)==1 and (.activity.recent|length)==3 and (.versions|length)==1 and (.canonical.extras|type)=="object"'
HASH1=$(jq -r .hash "$WORK/body")
chk "project bad slug -> 400"            400 "$(get '/api/project.php?slug=../etc')"
chk "project unknown -> 404"             404 "$(get '/api/project.php?slug=nope-nope')"
chk "live.html served"                   200 "$(get '/api/live.php?slug=demo-clinic')"
grep -q 'Demo Family Clinic' "$WORK/body" && ok "live.html content" || bad "live.html content" "$(head -c 100 "$WORK/body")"

echo "== save"
CAN=$(jq -c '.canonical | .tasks += [{"id":"T4","name":"Punch list","duration":5}]' <(get '/api/project.php?slug=demo-clinic' >/dev/null; cat "$WORK/body"))
chk "save without X-BidForge -> 403"     403 "$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$J" --data "{\"slug\":\"demo-clinic\"}" "$B/api/save.php")"
chk "save existing (base v1 + hash)"     200 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":1,\"baseHash\":\"$HASH1\",\"reason\":\"Add punch list\",\"sources\":[{\"type\":\"email\",\"title\":\"Owner request [fake]\",\"url\":\"https://example.com/m/1\",\"date\":\"2026-10-14\"}]}")" '.ok==true and .version==2 and .liveUrl=="/?project=demo-clinic"'
HASH2=$(jq -r .hash "$WORK/body")
chk "save stale baseVersion -> 409"      409 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":1,\"reason\":\"stale\"}")" '.conflict==true and .currentVersion==2 and .currentHash=="'"$HASH2"'"'
chk "save stale baseHash -> 409"         409 "$(post /api/save.php "{\"slug\":\"demo-clinic\",\"canonical\":$CAN,\"baseVersion\":2,\"baseHash\":\"$HASH1\",\"reason\":\"stale\"}")" '.conflict==true'
chk "save new slug (baseVersion null)"   200 "$(post /api/save.php '{"slug":"new-demo-bid","name":"New Demo Bid","status":"bid","canonical":{"schema":"bidforge.canonical.v1","project":{"name":"New Demo Bid"},"links":{"hostUrl":"https://example.com/host"},"tasks":[]},"baseVersion":null,"reason":"Initial schedule","sources":[]}')" '.version==1'
chk "save new slug with baseVersion -> 409" 409 "$(post /api/save.php '{"slug":"another-new","canonical":{"tasks":[]},"baseVersion":3,"reason":"x"}')" '.conflict==true and .currentVersion==null'
chk "save invalid slug -> 400"           400 "$(post /api/save.php '{"slug":"Bad Slug","canonical":{},"baseVersion":null}')"
chk "project after save"                 200 "$(get '/api/project.php?slug=demo-clinic')" '.version==2 and .hash=="'"$HASH2"'" and (.versions|length)==2 and (.activity.recent[0].text|test("Schedule v2 saved by team@ntxpllc.com: Add punch list"))'
chk "index upserted (new bid + routing)" 200 "$(get '/api/projects.php')" '(.projects|map(select(.slug=="new-demo-bid"))[0] | .folder.path=="Bids/New Demo Bid/Schedules" and .version==1 and .hostUrl=="https://example.com/host") and (.projects|map(select(.slug=="demo-clinic"))[0].version==2)'
D="$WORK/data/projects/demo-clinic"
grep -q 'v2\*\* saved by team@ntxpllc.com.*Add punch list.*\[Owner request \\\[fake\\\]\](https://example.com/m/1)' "$D/changelog.md" && ok "changelog line with linked source" || bad "changelog" "$(cat "$D/changelog.md")"
[ "$(wc -l < "$D/pending_sync.jsonl")" = "1" ] && ok "pending_sync.jsonl appended" || bad "pending_sync" "$(cat "$D/pending_sync.jsonl" 2>/dev/null)"
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
chk "publish with token (stale bundle refused)" 200 "$(bearer "$TOKEN" --data "$PUB_BODY" "$B/api/publish.php")" '.results[0].status==409 and .results[0].conflict==true and .results[0].currentVersion==2 and .results[0].activityAdded==1 and .results[1].status==200 and .results[1].version==3 and .results[1].live==true'
chk "site save not overwritten"          200 "$(get '/api/project.php?slug=demo-clinic')" '.version==2 and .hash=="'"$HASH2"'" and .project.version==2 and .project.owner=="KB owner (fake)"'
chk "kb-only project published"          200 "$(get '/api/project.php?slug=kb-only-job')" '.version==3 and .hasLive==true and .project.folder.path=="Bids/KB Only Job/Schedules"'
NEWER=$(jq -c '.version=5' "$D/canonical.json")
chk "publish newer version accepted"     200 "$(bearer "$TOKEN" --data "{\"bundles\":[{\"slug\":\"kb-only-job\",\"canonical\":$NEWER}]}" "$B/api/publish.php")" '.results[0].status==200 and .results[0].version==5'
chk "changes bad token -> 401"           401 "$(bearer nope "$B/api/changes.php")"
chk "changes since epoch"                200 "$(bearer "$TOKEN" "$B/api/changes.php?since=2000-01-01T00:00:00Z")" '(.changes|length)==2 and (.changes|map(.slug)|sort)==["demo-clinic","new-demo-bid"] and (.changes[0].hash|length)==64'
chk "changes since future -> none"       200 "$(bearer "$TOKEN" "$B/api/changes.php?since=2099-01-01T00:00:00Z")" '(.changes|length)==0'
chk "changes bad since -> 400"           400 "$(bearer "$TOKEN" "$B/api/changes.php?since=notadate")"
chk "changes fetch version JSON"         200 "$(bearer "$TOKEN" "$B/api/changes.php?slug=demo-clinic&version=2")" '.version==2 and (.tasks|length)==4'
chk "changes ack"                        200 "$(bearer "$TOKEN" --data '{"ack":[{"slug":"demo-clinic","version":2}]}' "$B/api/changes.php")" '.acked==1'
chk "changes after ack"                  200 "$(bearer "$TOKEN" "$B/api/changes.php")" '(.changes|length)==1 and .changes[0].slug=="new-demo-bid"'

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
for i in $(seq 1 10); do post /api/login.php '{"passphrase":"bad"}' >/dev/null; done
chk "11th attempt rate-limited (even correct) -> 429" 429 "$(post /api/login.php '{"passphrase":"admin"}')" '.error=="rate_limited" and .retryAfter>0'

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
