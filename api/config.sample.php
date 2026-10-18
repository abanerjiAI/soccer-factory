<?php
// Copy to config.php (same folder) and edit. config.php is git-ignored and must NEVER be committed.
// Everything can also come from environment variables; config.php wins when both are set.
return [
    // Where the SQLite file lives. Best: a folder OUTSIDE the web root, e.g. '/var/lib/soccer-ie/lab.sqlite'.
    // Default (empty) = ../data/lab.sqlite next to the site, protected by .htaccess (Apache). On nginx, deny /data/ yourself.
    'db_path' => '',

    // DeepSeek (OpenAI-compatible). Leave key empty to run the Coach on its built-in offline template instead.
    'deepseek_api_key' => '',               // or env DEEPSEEK_API_KEY
    'deepseek_base_url' => 'https://api.deepseek.com',
    'deepseek_model' => 'deepseek-flash',   // 'deepseek-v4-pro' for deeper answers (costs more)

    // Public-demo protection (per visitor IP per UTC day, and a global daily cap on AI calls).
    'ai_per_ip_per_day' => 30,
    'ai_global_per_day' => 600,
    'writes_per_ip_per_day' => 300,
    'max_records_per_client' => 200,

    // Live-Coach gate: a visitor answers one random sum and that browser is unlocked for 24 hours.
    // Set 'coach_gate' => false only for a private deployment you control.
    'coach_gate' => true,
    // Long random string. Leave empty and the server generates one once and keeps it in the SQLite file.
    'gate_secret' => '',
    'gate_misses_per_day' => 20,

    // Behind Cloudflare? Set true so the real visitor IP (CF-Connecting-IP) is used for limits.
    'trust_cloudflare' => false,

    // Random string, used to hash IPs before they are stored (no raw IPs are kept). Change it.
    'ip_salt' => 'change-me',
];
