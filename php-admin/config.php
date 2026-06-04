<?php
// Database configuration (PHP admin's own auth)
$db_host     = 'localhost';
$db_user     = 'root';
$db_password = '';
$db_name     = 'surely_saas';

$conn = mysqli_connect($db_host, $db_user, $db_password, $db_name);
if (!$conn) die("Connection failed: " . mysqli_connect_error());
mysqli_set_charset($conn, "utf8mb4");

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    error_log("PDO Connection failed: " . $e->getMessage());
}

// ── Surely Node.js API ────────────────────────────────────────────────────────
define('SURELY_API_URL',  getenv('SURELY_API_URL')  ?: 'http://localhost:4000');
define('SURELY_API_KEY',  getenv('SURELY_API_KEY')  ?: 'change-this-secure-admin-key-123');
define('SURELY_DASH_URL', getenv('SURELY_DASH_URL') ?: 'http://localhost:3000');

function surelyApi(string $method, string $path, array $data = []): array {
    $url = SURELY_API_URL . '/api/admin-api' . $path;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . SURELY_API_KEY,
        ],
        CURLOPT_CUSTOMREQUEST  => strtoupper($method),
    ]);
    if (!empty($data) && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);
    if ($error) return ['success' => false, 'error' => 'API unreachable: ' . $error];
    $decoded = json_decode($response, true);
    return $decoded ?: ['success' => false, 'error' => 'Invalid API response'];
}
?>
