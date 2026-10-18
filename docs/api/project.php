<?php
/** GET /api/project.php?slug=… — canonical schedule, activity, versions, uploads. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET');
bf_require_user();
$slug = bf_require_slug($_GET['slug'] ?? null);
$dir = bf_project_dir($slug);
[$canonical, , $hash, $version] = bf_canonical_load($slug);
$index = null;
foreach (bf_index_read() as $e) {
    if ($e['slug'] === $slug) {
        $index = bf_index_normalize($e);
    }
}
if ($canonical === null && $index === null && !is_dir($dir)) {
    bf_error(404, 'not_found', 'Unknown project');
}
$uploads = bf_read_json($dir . '/uploads.json', []);
$uploads = is_array($uploads) ? array_reverse(array_values($uploads)) : [];
bf_json([
    'slug'      => $slug,
    'project'   => $index,          // normalized index entry (or null)
    'canonical' => $canonical,
    'version'   => $version,        // top-level `version`, else meta.version
    'hash'      => $hash,           // sha256 of stored canonical.json bytes (send back as baseHash)
    'liveUrl'   => '/?project=' . $slug,
    'hasLive'   => is_file($dir . '/live.html'),
    'liveVersion' => is_file($dir . '/live.json') ? (bf_read_json($dir . '/live.json', [])['version'] ?? null) : null,
    'unpulled'  => bf_pending_unpulled($slug), // site saves the KB has not pulled yet
    'activity'  => bf_activity_views(bf_activity_read($slug)),
    'versions'  => bf_versions_list($slug),
    'uploads'   => $uploads,        // newest first
]);
