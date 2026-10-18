<?php
declare(strict_types=1);
/**
 * Tiny JSON API for the Soccer-IE Lab. One-file router, PHP 8.1+ with pdo_sqlite.
 *   GET    index.php?r=health
 *   GET    index.php?r=experiments            (this browser's records, newest first)
 *   POST   index.php?r=experiments            (append a record)
 *   GET    index.php?r=experiments/{id}
 *   DELETE index.php?r=experiments/{id}       (owner only)
 *   POST   index.php?r=ai/explain             (Coach)
 * A browser identifies itself with the header X-Client-Id (a random id kept in localStorage). It is NOT a login: it only
 * keeps one visitor's saved runs apart from everyone else's on a public demo.
 */
require __DIR__ . '/db.php';
require __DIR__ . '/ai.php';
require __DIR__ . '/gate.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out($data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
function fail(string $msg, int $status = 400): never { out(['error' => $msg], $status); }

function client_id(): string {
    $id = $_SERVER['HTTP_X_CLIENT_ID'] ?? '';
    if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/', $id)) fail('missing or invalid X-Client-Id', 400);
    return $id;
}
function body_json(int $max = 3000000): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > $max) fail('payload too large', 413);
    $j = json_decode($raw, true);
    if (!is_array($j)) fail('invalid JSON', 400);
    return $j;
}

const KINDS = ['simulation', 'compare', 'montecarlo', 'sensitivity', 'optimization', 'pareto', 'robust', 'hypothesis', 'cv-measurement', 'validation', 'tracking', 'layouts', 'reach'];
const STAGES = ['raw', 'validated', 'processed', 'model-input', 'simulation-output', 'analysis-output', 'published'];
const MODES = ['soccer', 'facility'];

try {
    $route = trim((string) ($_GET['r'] ?? ''), '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'OPTIONS') out(['ok' => true]);
    $parts = $route === '' ? [] : explode('/', $route);

    if ($route === 'health') {
        $pdo = db();
        $n = (int) $pdo->query('SELECT COUNT(*) FROM experiments')->fetchColumn();
        out(['ok' => true, 'php' => PHP_VERSION, 'sqlite' => $pdo->query('select sqlite_version()')->fetchColumn(), 'records' => $n,
             'ai' => ((string) cfg('deepseek_api_key', '') !== '') ? 'deepseek' : 'offline-template',
             'coachGate' => gate_enabled(),
             'aiUsedToday' => used_today('ai:global'), 'aiGlobalLimit' => (int) cfg('ai_global_per_day', 600)]);
    }

    // ---- live-Coach gate: one arithmetic question, then 24 h unlocked in that browser --------------------
    if ($route === 'gate/challenge' && $method === 'GET') {
        if (!gate_enabled()) out(['required' => false, 'ai' => 'offline-template']);
        out(['required' => true] + gate_challenge());
    }
    if ($route === 'gate/verify' && $method === 'POST') {
        if (!gate_enabled()) out(['required' => false, 'ai' => 'offline-template']);
        out(['ok' => true, 'required' => true] + gate_verify(body_json(2000)));
    }

    if ($parts && $parts[0] === 'experiments') {
        $cid = client_id();
        $pdo = db();
        if (count($parts) === 1 && $method === 'GET') {
            $st = $pdo->prepare('SELECT id, created_at AS createdAt, kind, stage, mode, title, model_version AS modelVersion, software_version AS softwareVersion, seed, trials, result_hash AS resultHash, uncertainty, notes
                                 FROM experiments WHERE client_id = ? ORDER BY created_at DESC LIMIT 200');
            $st->execute([$cid]);
            out(['experiments' => $st->fetchAll()]);
        }
        if (count($parts) === 1 && $method === 'POST') {
            $b = body_json();
            $kind = $b['kind'] ?? null; $mode = $b['mode'] ?? null; $title = $b['title'] ?? null;
            $stage = $b['stage'] ?? 'analysis-output'; $hash = $b['resultHash'] ?? null; $seed = $b['seed'] ?? null;
            $config = $b['config'] ?? null; $summary = $b['summary'] ?? null;
            if (!is_string($kind) || !in_array($kind, KINDS, true)) fail('invalid kind');
            if (!is_string($mode) || !in_array($mode, MODES, true)) fail('invalid mode');
            if (!is_string($stage) || !in_array($stage, STAGES, true)) fail('invalid stage');
            if (!is_string($title) || trim($title) === '' || mb_strlen($title) > 200) fail('title required (<= 200 chars)');
            if (!is_string($hash) || $hash === '' || strlen($hash) > 64) fail('resultHash required');
            if (!is_int($seed) && !is_float($seed)) fail('seed must be a number');
            if (!is_array($config) || !is_array($summary)) fail('config and summary must be objects');
            $count = $pdo->prepare('SELECT COUNT(*) FROM experiments WHERE client_id = ?');
            $count->execute([$cid]);
            if ((int) $count->fetchColumn() >= (int) cfg('max_records_per_client', 200)) fail('record limit reached - delete some old runs first', 429);
            if (!take('write:' . visitor_key(), (int) cfg('writes_per_ip_per_day', 300))) fail('daily save limit reached - try again tomorrow', 429);
            $id = 'exp_' . base_convert((string) (int) (microtime(true) * 1000), 10, 36) . '_' . bin2hex(random_bytes(3));
            $pdo->prepare('INSERT INTO experiments (id, client_id, created_at, kind, stage, mode, title, model_version, software_version, seed, trials, config, summary, uncertainty, result_hash, notes)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([
                $id, $cid, gmdate('Y-m-d\TH:i:s\Z'), $kind, $stage, $mode, trim($title),
                is_string($b['modelVersion'] ?? null) ? mb_substr($b['modelVersion'], 0, 32) : 'unknown',
                is_string($b['softwareVersion'] ?? null) ? mb_substr($b['softwareVersion'], 0, 32) : 'unknown',
                (int) $seed, is_numeric($b['trials'] ?? null) ? max(1, (int) $b['trials']) : 1,
                json_encode($config, JSON_UNESCAPED_UNICODE), json_encode($summary, JSON_UNESCAPED_UNICODE),
                is_string($b['uncertainty'] ?? null) ? mb_substr($b['uncertainty'], 0, 2000) : null, $hash,
                is_string($b['notes'] ?? null) ? mb_substr($b['notes'], 0, 2000) : null,
            ]);
            out(['id' => $id], 201);
        }
        if (count($parts) === 2 && preg_match('/^exp_[a-z0-9_]{4,40}$/', $parts[1])) {
            if ($method === 'GET') {
                $st = $pdo->prepare('SELECT * FROM experiments WHERE id = ? AND client_id = ?');
                $st->execute([$parts[1], $cid]);
                $r = $st->fetch();
                if (!$r) fail('not found', 404);
                out(['experiment' => [
                    'id' => $r['id'], 'createdAt' => $r['created_at'], 'kind' => $r['kind'], 'stage' => $r['stage'], 'mode' => $r['mode'], 'title' => $r['title'],
                    'modelVersion' => $r['model_version'], 'softwareVersion' => $r['software_version'], 'seed' => (int) $r['seed'], 'trials' => (int) $r['trials'],
                    'config' => json_decode($r['config'], true), 'summary' => json_decode($r['summary'], true),
                    'uncertainty' => $r['uncertainty'], 'resultHash' => $r['result_hash'], 'notes' => $r['notes'],
                ]]);
            }
            if ($method === 'DELETE') {
                $st = $pdo->prepare('DELETE FROM experiments WHERE id = ? AND client_id = ?');
                $st->execute([$parts[1], $cid]);
                out(['ok' => true, 'deleted' => $st->rowCount()]);
            }
        }
        fail('not found', 404);
    }

    if ($route === 'ai/explain' && $method === 'POST') {
        $b = body_json(40000);
        if (!is_string($b['topic'] ?? null) || !is_string($b['context'] ?? null)) fail('topic and context are required strings');
        $topic = mb_substr(trim($b['topic']), 0, 120);
        $context = mb_substr($b['context'], 0, 4000);
        $question = is_string($b['question'] ?? null) ? mb_substr(trim($b['question']), 0, 300) : '';
        $audience = in_array($b['audience'] ?? '', ['technical', 'interview'], true) ? $b['audience'] : 'highschool';
        $live = (string) cfg('deepseek_api_key', '') !== '';
        if ($live) {
            gate_check();
            if (!take('ai:ip:' . visitor_key(), (int) cfg('ai_per_ip_per_day', 30))) {
                out(array_merge(explain_fallback($topic, $context, $question, 'Daily Coach limit reached for this visitor - showing the offline template.'), ['limited' => true]));
            }
            if (!take('ai:global', (int) cfg('ai_global_per_day', 600))) {
                out(array_merge(explain_fallback($topic, $context, $question, 'The Coach has reached its daily budget for everyone - showing the offline template.'), ['limited' => true]));
            }
        }
        out(explain($topic, $context, $audience, $question));
    }

    fail('not found', 404);
} catch (Throwable $e) {
    error_log('[soccer-ie] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(['error' => 'server error'], 500);
}
