<?php
session_start();
require_once '../config.php';

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$user_id = isset($_GET['id']) ? (int)$_GET['id'] : $_SESSION['admin_id'];
$is_own_profile = ($user_id == $_SESSION['admin_id']);

// Only admin can edit other users
if (!$is_own_profile && $_SESSION['admin_role'] !== 'admin') {
    header('Location: dashboard.php');
    exit;
}

$success_msg = '';
$error_msg = '';

// Get user details
$sql = "SELECT * FROM users WHERE id = ?";
$stmt = mysqli_prepare($conn, $sql);
mysqli_stmt_bind_param($stmt, "i", $user_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($result);

if (!$user) {
    header('Location: users.php');
    exit;
}

// Handle Update Profile
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['update_profile'])) {
        $full_name = trim(mysqli_real_escape_string($conn, $_POST['full_name']));
        $email = trim(mysqli_real_escape_string($conn, $_POST['email']));
        
        $update_sql = "UPDATE users SET full_name = ?, email = ? WHERE id = ?";
        $update_stmt = mysqli_prepare($conn, $update_sql);
        mysqli_stmt_bind_param($update_stmt, "ssi", $full_name, $email, $user_id);
        
        if (mysqli_stmt_execute($update_stmt)) {
            $success_msg = "Profile updated successfully!";
            if ($is_own_profile) {
                $_SESSION['admin_full_name'] = $full_name;
            }
            // Refresh user data
            $stmt = mysqli_prepare($conn, $sql);
            mysqli_stmt_bind_param($stmt, "i", $user_id);
            mysqli_stmt_execute($stmt);
            $result = mysqli_stmt_get_result($stmt);
            $user = mysqli_fetch_assoc($result);
        } else {
            $error_msg = "Error updating profile.";
        }
    }
    
    if (isset($_POST['change_password'])) {
        $current_password = $_POST['current_password'] ?? '';
        $new_password = $_POST['new_password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';
        
        if ($new_password !== $confirm_password) {
            $error_msg = "New passwords do not match!";
        } elseif (strlen($new_password) < 6) {
            $error_msg = "Password must be at least 6 characters!";
        } else {
            if ($is_own_profile) {
                if (!password_verify($current_password, $user['password'])) {
                    $error_msg = "Current password is incorrect!";
                } else {
                    $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                    $update_sql = "UPDATE users SET password = ? WHERE id = ?";
                    $update_stmt = mysqli_prepare($conn, $update_sql);
                    mysqli_stmt_bind_param($update_stmt, "si", $hashed_password, $user_id);
                    
                    if (mysqli_stmt_execute($update_stmt)) {
                        $success_msg = "Password changed successfully!";
                    } else {
                        $error_msg = "Error changing password.";
                    }
                }
            } else {
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                $update_sql = "UPDATE users SET password = ? WHERE id = ?";
                $update_stmt = mysqli_prepare($conn, $update_sql);
                mysqli_stmt_bind_param($update_stmt, "si", $hashed_password, $user_id);
                
                if (mysqli_stmt_execute($update_stmt)) {
                    $success_msg = "Password changed successfully for " . htmlspecialchars($user['full_name']) . "!";
                } else {
                    $error_msg = "Error changing password.";
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $is_own_profile ? 'My Profile' : 'Edit User'; ?> - Surely Admin</title>
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
            background: #f1f5f9;
            overflow-x: hidden;
        }

        .main-content {
            margin-left: 280px;
            padding: 1rem;
            transition: margin-left 0.3s ease;
        }

        .profile-container {
            max-width: 800px;
            margin: 0 auto;
        }

        .top-header {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem 1.5rem;
            margin-bottom: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .header-left h1 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1a2c3e;
            margin-bottom: 0.2rem;
        }

        .btn-back {
            background: #e2e8f0;
            color: #475569;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 0.85rem;
        }

        .profile-card {
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .profile-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e2e8f0;
        }

        .profile-avatar {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #0b5e2e, #25D366);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            color: white;
        }

        .profile-title h2 {
            font-size: 1.3rem;
            margin-bottom: 0.2rem;
        }

        .profile-title p {
            font-size: 0.85rem;
            color: #64748b;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-group label {
            display: block;
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 0.3rem;
            color: #1a2c3e;
        }

        .form-group input {
            width: 100%;
            padding: 0.7rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            font-family: 'Inter', sans-serif;
        }

        .form-group input:focus {
            outline: none;
            border-color: #0b5e2e;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }

        .btn-save {
            background: #0b5e2e;
            color: white;
            padding: 0.7rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 600;
        }

        .alert {
            padding: 1rem;
            border-radius: 0.8rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .alert-success { background: #d1fae5; color: #059669; }
        .alert-error { background: #fee2e2; color: #dc2626; }

        @media (max-width: 768px) {
            .main-content { margin-left: 0; }
            .form-row { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

<?php include 'sidebar.php'; ?>

<main class="main-content">
    <div class="profile-container">
        <header class="top-header">
            <div class="header-left">
                <h1><?php echo $is_own_profile ? 'My Profile' : 'Edit User'; ?></h1>
                <p><?php echo $is_own_profile ? 'Manage your account settings' : 'Edit user information'; ?></p>
            </div>
            <div class="header-right">
                <a href="<?php echo $is_own_profile ? 'dashboard.php' : 'users.php'; ?>" class="btn-back">
                    <i class="fas fa-arrow-left"></i> Back
                </a>
            </div>
        </header>

        <?php if ($success_msg): ?>
            <div class="alert alert-success"><i class="fas fa-check-circle"></i> <?php echo $success_msg; ?></div>
        <?php endif; ?>
        <?php if ($error_msg): ?>
            <div class="alert alert-error"><i class="fas fa-exclamation-circle"></i> <?php echo $error_msg; ?></div>
        <?php endif; ?>

        <!-- Profile Information -->
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar"><i class="fas fa-user"></i></div>
                <div class="profile-title">
                    <h2><?php echo htmlspecialchars($user['full_name']); ?></h2>
                    <p><i class="fas fa-envelope"></i> <?php echo htmlspecialchars($user['email']); ?> | <i class="fas fa-user-tag"></i> <?php echo ucfirst($user['role']); ?></p>
                </div>
            </div>
            
            <form method="POST">
                <input type="hidden" name="update_profile" value="1">
                <div class="form-row">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="full_name" value="<?php echo htmlspecialchars($user['full_name']); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" value="<?php echo htmlspecialchars($user['email']); ?>" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" value="<?php echo htmlspecialchars($user['username']); ?>" disabled style="background: #f1f5f9;">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <input type="text" value="<?php echo ucfirst($user['role']); ?>" disabled style="background: #f1f5f9;">
                    </div>
                </div>
                <button type="submit" class="btn-save">Save Changes</button>
            </form>
        </div>

        <!-- Change Password -->
        <div class="profile-card">
            <h3 style="margin-bottom: 1.5rem;"><i class="fas fa-key"></i> Change Password</h3>
            <form method="POST">
                <input type="hidden" name="change_password" value="1">
                <?php if ($is_own_profile): ?>
                    <div class="form-group">
                        <label>Current Password</label>
                        <input type="password" name="current_password" placeholder="Enter current password" required>
                    </div>
                <?php endif; ?>
                <div class="form-row">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" name="new_password" placeholder="Enter new password" required>
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input type="password" name="confirm_password" placeholder="Confirm new password" required>
                    </div>
                </div>
                <button type="submit" class="btn-save">Change Password</button>
            </form>
        </div>
    </div>
</main>
</body>
</html>