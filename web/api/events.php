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

/* Valida y normaliza el cuerpo de un evento manual. Devuelve [datos, error]. */
function leerEvento($input) {
    $date = trim($input['date'] ?? '');
    $time = trim($input['time'] ?? '');
    $endTime = trim($input['endTime'] ?? '');
    $title = trim($input['title'] ?? '');
    $location = trim($input['location'] ?? '');
    $audience = trim($input['audience'] ?? '');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $title === '') {
        return [null, 'Fecha (AAAA-MM-DD) o título inválido'];
    }
    if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) {
        return [null, 'Hora inválida, usa HH:MM'];
    }
    if ($endTime !== '' && !preg_match('/^\d{2}:\d{2}$/', $endTime)) {
        return [null, 'Hora de fin inválida, usa HH:MM'];
    }

    return [[
        'date' => $date, 'time' => $time, 'endTime' => $endTime,
        'title' => $title, 'location' => $location, 'audience' => $audience,
    ], null];
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
    [$datosEvento, $error] = leerEvento($input);
    if ($error) {
        http_response_code(400);
        echo json_encode(['error' => $error]);
        exit;
    }
    $events[] = array_merge(['id' => uniqid('m_', true)], $datosEvento);
    guardar($dataFile, $events);
    echo json_encode(['ok' => true]);
    exit;
}

if ($method === 'PUT') {
    $id = $input['id'] ?? '';
    [$datosEvento, $error] = leerEvento($input);
    if ($error) {
        http_response_code(400);
        echo json_encode(['error' => $error]);
        exit;
    }

    $found = false;
    foreach ($events as &$e) {
        if (($e['id'] ?? null) === $id) {
            $e = array_merge($e, $datosEvento);
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
