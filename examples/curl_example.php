<?php
/**
 * Example: Calling Token Talos Gateway from PHP
 * 
 * This example uses standard PHP cURL to communicate with the 
 * Token Talos Proxy Gateway.
 */

$apiUrl = 'http://localhost:8060/api/v1/usage/prompt/execute';
$apiKey = 'your-api-key'; // If running in managed mode

$data = [
    'projectId' => 'my-php-app',
    'provider' => 'openai',
    'model' => 'gpt-4o',
    'parts' => [
        'system' => 'You are a PHP expert.',
        'user_query' => 'What is the best way to handle JSON in PHP 8?'
    ]
];

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-TokenTalos-Key: ' . $apiKey
]);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
} else {
    $result = json_decode($response, true);
    echo "Response from Token Talos:
";
    echo $result['content'] . "
";
    echo "Tokens Used: " . ($result['usage']['total_tokens'] ?? 0) . "
";
}

curl_close($ch);
