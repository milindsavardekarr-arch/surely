<?php
// Run this file once to create admin user with proper password hash
require_once 'config.php';

// Admin credentials
$username = 'admin';
$password = 'Surely@2025';
$email = 'admin@surelysaas.com';
$full_name = 'Super Admin';
$role = 'admin';

// Generate password hash
$hashed_password = password_hash($password, PASSWORD_DEFAULT);

// Check if admin already exists
$check_sql = "SELECT id FROM users WHERE username = ?";
$check_stmt = mysqli_prepare($conn, $check_sql);
mysqli_stmt_bind_param($check_stmt, "s", $username);
mysqli_stmt_execute($check_stmt);
$check_result = mysqli_stmt_get_result($check_stmt);

if (mysqli_num_rows($check_result) == 0) {
    // Insert admin user
    $sql = "INSERT INTO users (username, password, email, full_name, role, status) VALUES (?, ?, ?, ?, ?, 'active')";
    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "sssss", $username, $hashed_password, $email, $full_name, $role);
    
    if (mysqli_stmt_execute($stmt)) {
        echo "✅ Admin user created successfully!<br>";
        echo "Username: admin<br>";
        echo "Password: Surely@2025<br>";
    } else {
        echo "❌ Error creating admin user: " . mysqli_error($conn);
    }
} else {
    // Update existing admin password
    $update_sql = "UPDATE users SET password = ? WHERE username = ?";
    $update_stmt = mysqli_prepare($conn, $update_sql);
    mysqli_stmt_bind_param($update_stmt, "ss", $hashed_password, $username);
    
    if (mysqli_stmt_execute($update_stmt)) {
        echo "✅ Admin password updated successfully!<br>";
        echo "Username: admin<br>";
        echo "Password: Surely@2025<br>";
    } else {
        echo "❌ Error updating admin password: " . mysqli_error($conn);
    }
}

// Close connection
mysqli_close($conn);
?>