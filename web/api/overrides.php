<?php
// Guarda ediciones/ocultaciones de eventos que vienen del Excel (events.json es
// regenerado por el script de Python, así que no se puede tocar directamente).
// Cada override se guarda por id: {title?, date?, time?, deleted?}
header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . '/overrides.json';

function cargar($f) {
    if (!file_exists($f)) return new stdClass();
    $d = json_decode(file_get_contents($f));
    return is_object($d) ? $d : new stdClass();
}
function guardar($f, $overrides) {
    file_put_contents($f, json_encode($overrides, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

$method = $_SERVER['REQUEST_METHOD'];
$overrides = cargar($dataFile);

if ($method === 'GET') {
    echo json_encode($overrides, JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$id = $input['id'] ?? '';

if ($id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Falta el id del evento']);
    exit;
}

if ($method === 'POST') {
    $patch = $input['patch'] ?? [];
    if (!is_array($patch)) $patch = [];

    if (isset($patch['date']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $patch['date'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Fecha inválida']);
        exit;
    }
    if (isset($patch['time']) && $patch['time'] !== '' && !preg_match('/^\d{2}:\d{2}$/', $patch['time'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Hora inválida']);
        exit;
    }

    $actual = (array) ($overrides->$id ?? []);
    $overrides->$id = (object) array_merge($actual, $patch);
    guardar($dataFile, $overrides);
    echo json_encode(['ok' => true]);
    exit;
}

if ($method === 'DELETE') {
    unset($overrides->$id);
    guardar($dataFile, $overrides);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no soportado']);
