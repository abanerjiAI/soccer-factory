<?php
declare(strict_types=1);
/**
 * A one-question gate in front of the LIVE Coach (the paid DeepSeek call).
 *
 * Why: the demo is public and carries a real API key. Rate limits already cap how many calls a visitor can
 * make, but they do not stop someone scripting the endpoint from the first request. The gate costs a human
 * about four seconds: answer one random sum, and this browser is unlocked for 24 hours. Nothing is stored
 * about the person - the token is an HMAC over an expiry and a salted hash of the visitor, kept in
 * localStorage. Saving experiments is NOT gated: it costs nothing and works without the Coach.
 *
 * Routes (in index.php): GET gate/challenge, POST gate/verify.
 */
const GATE_CHALLENGE_TTL = 300;   // seconds to answer the sum
const GATE_TOKEN_TTL = 86400;     // seconds the browser stays unlocked (24 h)

/** The gate only matters when there is a key to protect. */
function gate_enabled(): bool
{
    return (string) cfg('deepseek_api_key', '') !== '' && (bool) cfg('coach_gate', true);
}

/**
 * HMAC secret. config.php wins; otherwise one is generated once and kept in the SQLite file, so every PHP
 * worker signs the same tokens and a restart does not invalidate every visitor's 24 hours.
 */
function gate_secret(): string
{
    $s = trim((string) cfg('gate_secret', ''));
    if (strlen($s) >= 32) return $s;
    $pdo = db();
    $st = $pdo->prepare('SELECT v FROM settings WHERE k = ?');
    $st->execute(['gate_secret']);
    $v = $st->fetchColumn();
    if (is_string($v) && strlen($v) >= 64) return $v;
    $v = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)')->execute(['gate_secret', $v]);
    $st->execute(['gate_secret']);
    return (string) $st->fetchColumn();
}

function gate_sign(string $s): string
{
    return hash_hmac('sha256', $s, gate_secret());
}

/** A fresh sum. The signature binds the two numbers to the expiry, so the client cannot pick its own sum. */
function gate_challenge(): array
{
    $a = random_int(11, 98);
    $b = random_int(11, 98);
    $exp = time() + GATE_CHALLENGE_TTL;
    return ['a' => $a, 'b' => $b, 'exp' => $exp, 'sig' => gate_sign("challenge|$a|$b|$exp"), 'seconds' => GATE_CHALLENGE_TTL];
}

/** base64url of the payload + HMAC. No server-side session: the token verifies itself. */
function gate_issue(): array
{
    $exp = time() + GATE_TOKEN_TTL;
    $payload = ['exp' => $exp, 'v' => substr(visitor_key(), 0, 12)];
    $p = rtrim(strtr(base64_encode((string) json_encode($payload)), '+/', '-_'), '=');
    return ['token' => $p . '.' . gate_sign('token|' . $p), 'expiresAt' => $exp, 'hours' => (int) (GATE_TOKEN_TTL / 3600)];
}

function gate_required(): never
{
    out([
        'error' => 'The live Coach needs one sum answered first. It stays unlocked on this browser for 24 hours.',
        'code' => 'gate_required',
        'gate' => true,
    ], 401);
}

/** Called by ai/explain before any paid call. Throws the 401 that makes the browser show the sum. */
function gate_check(): void
{
    if (!gate_enabled()) return;
    $t = (string) ($_SERVER['HTTP_X_GATE_TOKEN'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{16,400}\.[a-f0-9]{64}$/', $t)) gate_required();
    [$p, $sig] = explode('.', $t, 2);
    if (!hash_equals(gate_sign('token|' . $p), $sig)) gate_required();
    $pad = strlen($p) % 4 === 0 ? '' : str_repeat('=', 4 - (strlen($p) % 4));
    $j = json_decode((string) base64_decode(strtr($p, '-_', '+/') . $pad, true), true);
    if (!is_array($j) || (int) ($j['exp'] ?? 0) < time()) gate_required();
    if (!hash_equals((string) ($j['v'] ?? ''), substr(visitor_key(), 0, 12))) gate_required();
}

/** Checks the answer and returns a token. Wrong answers are counted so one challenge cannot be brute-forced. */
function gate_verify(array $b): array
{
    $a = (int) ($b['a'] ?? 0);
    $c = (int) ($b['b'] ?? 0);
    $exp = (int) ($b['exp'] ?? 0);
    $sig = (string) ($b['sig'] ?? '');
    $answer = $b['answer'] ?? null;

    if ($exp <= 0 || $exp + 30 < time()) fail('That question expired. Ask for a new one.', 400);
    if ($a < 1 || $c < 1 || $a > 999 || $c > 999) fail('Invalid question.', 400);
    if (!hash_equals(gate_sign("challenge|$a|$c|$exp"), $sig)) fail('Invalid question. Ask for a new one.', 400);
    if (!is_int($answer) && !(is_string($answer) && preg_match('/^-?\d{1,5}$/', trim($answer)))) fail('Enter the number only.', 400);
    if ((int) $answer !== $a + $c) {
        if (!take('gatefail:' . visitor_key(), (int) cfg('gate_misses_per_day', 20))) {
            fail('Too many wrong sums today. Come back tomorrow, or read the Study Guide instead - it needs no AI.', 429);
        }
        fail('That sum is not right. Try again, or ask for a new question.', 400);
    }
    return gate_issue();
}
