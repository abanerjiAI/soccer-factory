# Deploying Soccer Factory (NAIC showcase / nashvilleaiclub.com)

The lab is **static files + one PHP API + one SQLite file**. It fits the NAIC demo pattern
(`<docroot>/demo/abanerji/<slug>/`) on the Coolify Hetzner WordPress box, which already runs PHP.

- Live: https://nashvilleaiclub.com/demo/abanerji/soccer-factory/
- Stage: https://stage.nashvilleaiclub.com/demo/abanerji/soccer-factory/ (shared docroot, one copy answers both)

## Build and push

```bash
npm run package                                   # -> dist/ (files + MANIFEST.json with sha256 per file)
tar czf /tmp/soccer-factory.tar.gz -C dist .
scp /tmp/soccer-factory.tar.gz snappyserver_hetzner_ab:/root/soccer-factory.tar.gz
ssh snappyserver_hetzner_ab 'D=/data/coolify/services/mq5mrcplwy6i6amvpnpycmh5/wordpress/demo/abanerji/soccer-factory
  sudo mkdir -p "$D" && sudo tar xzf /root/soccer-factory.tar.gz -C "$D"    # never rm -rf first: an empty tree 404s mid-deploy
  sudo chown -R www-data:www-data "$D"
  sudo bash -c "find \"$D\" -type d -exec chmod 755 {} + ; find \"$D\" -type f -exec chmod 644 {} +"'
```

`config.php` is **not** shipped and is not in git. Create it on the server, outside the web root
where possible:

```php
<?php return [
  // Empty = <app>/data/lab.sqlite, denied by data/.htaccess (403 measured on the box).
  // Do NOT use a host path such as /var/lib/... : only the docroot is mounted into the WordPress
  // container, so any other path resolves inside the container and cannot be written.
  'db_path' => '',
  'deepseek_api_key' => '...',                        // leave empty to run the Coach offline
  'deepseek_base_url' => 'https://api.deepseek.com',
  'deepseek_model' => 'deepseek-flash',
  'ai_per_ip_per_day' => 30,
  'ai_global_per_day' => 600,                         // hard daily cost cap
  'writes_per_ip_per_day' => 300,
  'max_records_per_client' => 200,
  'trust_cloudflare' => true,                         // use CF-Connecting-IP for limits
  'ip_salt' => 'a-long-random-string',                // IPs are stored only as a salted hash
  // live-Coach gate: one sum, then 24 h unlocked in that browser
  'coach_gate' => true,
  'gate_secret' => '',                                // empty = generated once and kept in the SQLite file
  'gate_misses_per_day' => 20,
];
```

Without `config.php` everything still works: SQLite lands in `data/` (guarded by `.htaccess`) and the
Coach runs on its offline template.

- **Apache**: `api/.htaccess` and `data/.htaccess` deny the config and database files and disable
  directory listing.
- **nginx**: deny `~ /(api/config.*|data/)` yourself; the app never links into `data/`.
- PHP needs `pdo_sqlite`, plus `openssl`/`curl` for the live Coach. No Composer, no Node on the server.

## Verify through the edge (every asset, not just /)

```bash
# the app is a hash router: /#/lab, not /lab
for u in / /index.html "/#/examples" "/#/lab" "api/index.php?r=health"; do
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://nashvilleaiclub.com/demo/abanerji/soccer-factory$u"
done
A=$(curl -s "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/" | grep -o 'assets/index-[^"]*\.js' | head -1)
curl -s -o /dev/null -w "$A %{http_code}\n" "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/$A"
curl -s "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/api/index.php?r=health"
# -> {"ok":true,"php":"8.x","sqlite":"3.x","records":0,"ai":"deepseek","coachGate":true,...}
curl -s "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/api/index.php?r=gate/challenge"
# -> {"required":true,"a":..,"b":..,"exp":..,"sig":"..","seconds":300}
curl -s -o /dev/null -w "config.php must be 403: %{http_code}\n" "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/api/config.php"
curl -s -o /dev/null -w "data/ must be 403: %{http_code}\n" "https://nashvilleaiclub.com/demo/abanerji/soccer-factory/data/"
```

Then walk `tools/browser-check.mjs` against the live URL (needs Chrome with
`--remote-debugging-port=9222`) and keep the screenshots. Two known non-issues when comparing bytes:
the box writes CRLF and Cloudflare injects its bot-challenge script — compare parsed content, not
file sizes.

## GitHub (abanerjiAI)

The repo is source, not the host: GitHub Pages cannot run PHP. Push `src/` (with `dist/`,
`node_modules/`, `.build-*`, `.local-data/`, `api/config.php` git-ignored), let the demo box serve
the app, and put a link to the live demo in the README.

## Showcases note

The experiment log and notebook are **per-visitor** (an anonymous id in localStorage). A visitor
clearing browser data loses their own records — the FAQ says so. The Coach budget is shared
(`ai_global_per_day`) and has never been exceeded at showcase volume (30 calls per visitor, and a
one-sum gate in front of the first call).

## Showcase post (naic_showcase on nashvilleaiclub, blog 4)

Structure of the existing posts (`Tools and approach` → `Review` → `What we learned` → demo
button). The content source is `docs/showcase-post.md`; it carries the four worked examples with the
soccer → factory toggle, the numbers read from the app, and the limits of each one.
