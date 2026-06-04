<?php
session_start();
require_once '../config.php';

// Redirect if already logged in
if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    header('Location: dashboard.php');
    exit;
}

$error = '';

// Handle login form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');
    
    // Fetch user from database
    $sql = "SELECT id, username, password, full_name, role, status FROM users WHERE username = ? AND status = 'active'";
    $stmt = mysqli_prepare($conn, $sql);
    
    if ($stmt) {
        mysqli_stmt_bind_param($stmt, "s", $username);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        
        if ($row = mysqli_fetch_assoc($result)) {
            if (password_verify($password, $row['password'])) {
                // Login successful
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_id'] = $row['id'];
                $_SESSION['admin_username'] = $row['username'];
                $_SESSION['admin_full_name'] = $row['full_name'];
                $_SESSION['admin_role'] = $row['role'];
                $_SESSION['admin_login_time'] = time();
                
                // Update last login
                $ip = $_SERVER['REMOTE_ADDR'] ?? '';
                $update_sql = "UPDATE users SET last_login = NOW(), last_login_ip = ? WHERE id = ?";
                $update_stmt = mysqli_prepare($conn, $update_sql);
                
                if ($update_stmt) {
                    mysqli_stmt_bind_param($update_stmt, "si", $ip, $row['id']);
                    mysqli_stmt_execute($update_stmt);
                    mysqli_stmt_close($update_stmt);
                }
                
                // Log activity - with error handling
                $log_sql = "INSERT INTO activity_log (user_id, action_type, action_details, ip_address) VALUES (?, 'login', ?, ?)";
                $log_stmt = mysqli_prepare($conn, $log_sql);
                
                if ($log_stmt) {
                    $details = "Admin login from IP: $ip";
                    mysqli_stmt_bind_param($log_stmt, "iss", $row['id'], $details, $ip);
                    mysqli_stmt_execute($log_stmt);
                    mysqli_stmt_close($log_stmt);
                }
                
                mysqli_stmt_close($stmt);
                header('Location: dashboard.php');
                exit;
            } else {
                $error = 'Invalid password!';
            }
        } else {
            $error = 'Username not found or account inactive!';
        }
        mysqli_stmt_close($stmt);
    } else {
        $error = 'Database error: ' . mysqli_error($conn);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - Surely SaaS</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a2e1a 0%, #0b5e2e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }

        .login-container {
            max-width: 450px;
            width: 100%;
        }

        .login-card {
            background: white;
            border-radius: 2rem;
            padding: 2.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: fadeInUp 0.6s ease;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }

        .logo img {
            height: 50px;
            margin-bottom: 1rem;
        }

        .logo h2 {
            color: #0b5e2e;
            font-size: 1.5rem;
        }

        .logo p {
            color: #6c8b7a;
            font-size: 0.85rem;
            margin-top: 0.3rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            font-size: 0.8rem;
            font-weight: 600;
            color: #1a2c3e;
            margin-bottom: 0.5rem;
        }

        .form-group input {
            width: 100%;
            padding: 0.9rem 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 1rem;
            font-size: 1rem;
            transition: all 0.3s;
            font-family: 'Inter', sans-serif;
        }

        .form-group input:focus {
            outline: none;
            border-color: #25D366;
            box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
        }

        .btn-login {
            width: 100%;
            background: linear-gradient(135deg, #0b5e2e, #1a8c4d);
            color: white;
            padding: 0.9rem;
            border: none;
            border-radius: 1rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(11, 94, 46, 0.3);
        }

        .error-message {
            background: #fee2e2;
            color: #dc2626;
            padding: 0.8rem;
            border-radius: 0.8rem;
            margin-bottom: 1.5rem;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .footer-links {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.8rem;
            color: #8ba39a;
        }

        .footer-links a {
            color: #0b5e2e;
            text-decoration: none;
        }

        @media (max-width: 480px) {
            .login-card {
                padding: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="logo">
                <img src="../surely-logo.png" alt="Surely">
                <h2>Admin Login</h2>
                <p>Access your dashboard to manage leads</p>
            </div>

            <?php if ($error): ?>
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> <?php echo $error; ?>
                </div>
            <?php endif; ?>

            <form method="POST" action="">
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Username</label>
                    <input type="text" name="username" placeholder="Enter username" required autofocus>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Password</label>
                    <input type="password" name="password" placeholder="Enter password" required>
                </div>
                <button type="submit" class="btn-login">
                    <i class="fas fa-sign-in-alt"></i> Login to Dashboard
                </button>
            </form>

            <div class="footer-links">
                <p><a href="../index.php"><i class="fas fa-arrow-left"></i> Back to Website</a></p>
            </div>
        </div>
    </div>
</body>
</html>