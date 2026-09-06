<?php
// API mínima de eventos manuales: guarda un JSON en disco, sin base de datos.
header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . '/manual_events.json';

function cargar($f) {
    if (!file_exists($f)) return [];
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : [];
}
function guardar($f, $events) {
    file_put_contents($f, json_encode(array_values($events), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

$method = $_SERVER['REQUEST_METHOD'];
$events = cargar($dataFile);

if ($method === 'GET') {
    echo json_encode($events, JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

if ($method === 'POST') {
    $date = trim($input['date'] ?? '');
    $time = trim($input['time'] ?? '');
    $title = trim($input['title'] ?? '');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $title === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Fecha (AAAA-MM-DD) o título inválido']);
        exit;
    }
    if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) {
        http_response_code(400);
        echo json_encode(['error' => 'Hora inválida, usa HH:MM']);
        exit;
    }

    $events[] = [
        'id' => uniqid('m_', true),
        'date' => $date,
        'time' => $time,
        'title' => $title,
    ];
    guardar($dataFile, $events);
    echo json_encode(['ok' => true]);
    exit;
}

if ($method === 'PUT') {
    $id = $input['id'] ?? '';
    $date = trim($input['date'] ?? '');
    $time = trim($input['time'] ?? '');
    $title = trim($input['title'] ?? '');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $title === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Fecha (AAAA-MM-DD) o título inválido']);
        exit;
    }
    if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) {
        http_response_code(400);
        echo json_encode(['error' => 'Hora inválida, usa HH:MM']);
        exit;
    }

    $found = false;
    foreach ($events as &$e) {
        if (($e['id'] ?? null) === $id) {
            $e['date'] = $date;
            $e['time'] = $time;
            $e['title'] = $title;
            $found = true;
            break;
        }
    }
    unset($e);
    if (!$found) {
        http_response_code(404);
        echo json_encode(['error' => 'Evento no encontrado']);
        exit;
    }
    guardar($dataFile, $events);
    echo json_encode(['ok' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $input['id'] ?? '';
    $events = array_values(array_filter($events, fn($e) => ($e['id'] ?? null) !== $id));
    guardar($dataFile, $events);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no soportado']);
