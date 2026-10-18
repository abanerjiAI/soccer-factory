<?php
declare(strict_types=1);

/** Loads config.php (if present) merged over env vars and defaults. */
function cfg(string $key, $default = null) {
    static $c = null;
    if ($c === null) {
        $c = [
            'db_path' => getenv('LAB_DB_PATH') ?: '',
            'deepseek_api_key' => getenv('DEEPSEEK_API_KEY') ?: '',
            'deepseek_base_url' => getenv('DEEPSEEK_BASE_URL') ?: 'https://api.deepseek.com',
            'deepseek_model' => getenv('DEEPSEEK_MODEL') ?: 'deepseek-flash',
            'ai_per_ip_per_day' => 30,
            'ai_global_per_day' => 600,
            'writes_per_ip_per_day' => 300,
            'max_records_per_client' => 200,
            'trust_cloudflare' => false,
            'ip_salt' => getenv('LAB_IP_SALT') ?: 'change-me',
            // live-Coach gate: one sum, then 24 h unlocked in that browser
            'coach_gate' => true,
            'gate_secret' => getenv('LAB_GATE_SECRET') ?: '',
            'gate_misses_per_day' => 20,
        ];
        // LAB_CONFIG lets you keep the config file (and the API key) outside the web root, which is the safest place.
        $file = getenv('LAB_CONFIG') ?: __DIR__ . '/config.php';
        if (is_file($file)) {
            $over = require $file;
            if (is_array($over)) foreach ($over as $k => $v) if ($v !== '' && $v !== null) $c[$k] = $v;
        }
    }
    return $c[$key] ?? $default;
}

function db_path(): string {
    $p = (string) cfg('db_path', '');
    if ($p !== '') return $p;
    return dirname(__DIR__) . '/data/lab.sqlite';
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $path = db_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        throw new RuntimeException('Cannot create data directory');
    }
    // keep a copy of the folder guard when the default location is used
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 4000');
    $pdo->exec('PRAGMA foreign_keys = ON');
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void {
    // Experiments are append-only in spirit: the API has create / read / owner-delete, never update.
    $pdo->exec('CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT "analysis-output",
        mode TEXT NOT NULL,
        title TEXT NOT NULL,
        model_version TEXT NOT NULL,
        software_version TEXT NOT NULL,
        seed INTEGER NOT NULL,
        trials INTEGER NOT NULL DEFAULT 1,
        config TEXT NOT NULL,
        summary TEXT NOT NULL,
        uncertainty TEXT,
        result_hash TEXT NOT NULL,
        notes TEXT
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_exp_client ON experiments (client_id, created_at DESC)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS usage (
        bucket TEXT NOT NULL,
        day TEXT NOT NULL,
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (bucket, day)
    )');
    // forget counters older than 3 days
    $pdo->prepare('DELETE FROM usage WHERE day < ?')->execute([gmdate('Y-m-d', time() - 3 * 86400)]);
    // server-side key/value store: the gate secret is generated once and shared by every request
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
}

/** Visitor key for rate limits: salted hash, never the raw IP. */
function visitor_key(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (cfg('trust_cloudflare', false) && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    return substr(hash('sha256', (string) cfg('ip_salt', 'x') . '|' . $ip), 0, 24);
}

/** Atomically count one use of $bucket today. Returns false when the limit is already reached (nothing is counted then). */
function take(string $bucket, int $limit): bool {
    $pdo = db();
    $day = gmdate('Y-m-d');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT OR IGNORE INTO usage (bucket, day, n) VALUES (?, ?, 0)')->execute([$bucket, $day]);
        $st = $pdo->prepare('UPDATE usage SET n = n + 1 WHERE bucket = ? AND day = ? AND n < ?');
        $st->execute([$bucket, $day, $limit]);
        $ok = $st->rowCount() === 1;
        $pdo->commit();
        return $ok;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function used_today(string $bucket): int {
    $st = db()->prepare('SELECT n FROM usage WHERE bucket = ? AND day = ?');
    $st->execute([$bucket, gmdate('Y-m-d')]);
    $r = $st->fetch();
    return $r ? (int) $r['n'] : 0;
}
