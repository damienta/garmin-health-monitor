#!/usr/bin/env bash
# After a deploy, check the live site really answers the way it should.
#   smoke.sh api <url>   the API is up and still refuses requests without a token (401)
#   smoke.sh web <url>   the website is up and still behind Cloudflare Access (redirect to sign-in)
# Retries for a minute, because a new deploy can take a few seconds to reach every edge.
set -euo pipefail
kind=$1
url=${2%/}
[ -n "$url" ] || { echo "::error::smoke test: no URL for $kind"; exit 1; }

for attempt in 1 2 3 4 5 6; do
  case $kind in
    api)
      code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$url/api/health" || true)
      echo "try $attempt: GET /api/health without a token -> $code (want 401)"
      [ "$code" = 401 ] && { echo "API is live and still needs a token."; exit 0; } ;;
    web)
      read -r code location < <(curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -m 10 "$url/" || true)
      echo "try $attempt: GET / signed out -> $code ${location%%\?*} (want a redirect to cloudflareaccess.com)"
      case $code:$location in
        30[1237]:*cloudflareaccess.com*) echo "Website is live and still behind Cloudflare Access."; exit 0 ;;
      esac ;;
    *) echo "usage: smoke.sh api|web <url>"; exit 2 ;;
  esac
  sleep 10
done
echo "::error::smoke test failed: $kind at $url did not answer as expected"
exit 1
