<?php
/** GET /api/projects.php[?all=1] — knowledge-base active-projects index. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET');
bf_require_user();
$all = ($_GET['all'] ?? '') === '1';
$out = [];
foreach (bf_index_read() as $e) {
    $n = bf_index_normalize($e);
    if ($all || in_array($n['status'], ['bid', 'active'], true)) {
        $out[] = $n;
    }
}
usort($out, static fn($a, $b) => strcmp((string)($b['updatedAt'] ?? ''), (string)($a['updatedAt'] ?? '')) ?: strcmp($a['name'], $b['name']));
bf_json(['projects' => $out]);
