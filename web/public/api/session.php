<?php
/** GET /api/session.php — current auth state + available login methods. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET');
bf_json(bf_session_payload());
