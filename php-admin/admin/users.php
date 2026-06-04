<?php
session_start();
require_once '../config.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php'); exit;
}
if ($_SESSION['admin_role'] !== 'admin') {
    header('Location: dashboard.php'); exit;
}

$success_msg = '';
$error_msg   = '';

// ── Handle Create User (via Surely API) ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {

    if ($_POST['action'] === 'create_user') {
        $name        = trim($_POST['full_name']  ?? '');
        $email       = trim($_POST['email']      ?? '');
        $password    = trim($_POST['password']   ?? '');
        $companyName = trim($_POST['company_name'] ?? '');
        $industry    = trim($_POST['industry']   ?? '');
        $phone       = trim($_POST['phone']      ?? '');
        $confirm     = trim($_POST['confirm_password'] ?? '');

        if ($password !== $confirm) {
            $error_msg = "Passwords do not match!";
        } elseif (strlen($password) < 6) {
            $error_msg = "Password must be at least 6 characters!";
        } elseif (empty($name) || empty($email) || empty($companyName)) {
            $error_msg = "Name, Email, and Company Name are required!";
        } else {
            $result = surelyApi('POST', '/users', [
                'name'        => $name,
                'email'       => $email,
                'password'    => $password,
                'companyName' => $companyName,
                'industry'    => $industry ?: null,
                'phone'       => $phone    ?: null,
                'phpUserId'   => (string)$_SESSION['admin_id'],
            ]);

            if (!empty($result['success'])) {
                $success_msg = "✅ User <strong>" . htmlspecialchars($name) . "</strong> created!
                    Company: <strong>" . htmlspecialchars($companyName) . "</strong>.
                    Login: <a href='" . SURELY_DASH_URL . "/auth/login' target='_blank'>" . SURELY_DASH_URL . "/auth/login</a>";
            } else {
                $error_msg = "❌ " . (is_string($result['error'] ?? null) ? $result['error'] : "Failed to create user. Is the Surely backend running?");
            }
        }
    }

    if ($_POST['action'] === 'update_status') {
        $user_id  = $_POST['user_id']  ?? '';
        $isActive = ($_POST['status'] === 'active');
        $result = surelyApi('PATCH', '/users/' . urlencode($user_id) . '/status', ['isActive' => $isActive]);
        if (!empty($result['success'])) $success_msg = "User status updated!";
        else $error_msg = "Failed: " . ($result['error'] ?? 'Unknown error');
    }

    if ($_POST['action'] === 'delete_user') {
        $user_id = $_POST['user_id'] ?? '';
        $result = surelyApi('DELETE', '/users/' . urlencode($user_id));
        if (!empty($result['success'])) $success_msg = "User deleted successfully!";
        else $error_msg = "Failed: " . ($result['error'] ?? 'Unknown error');
    }
}

// ── Load users from Surely API ────────────────────────────────────────────────
$apiStats = surelyApi('GET', '/stats');
$apiUsers = surelyApi('GET', '/users?limit=100');
$users    = $apiUsers['data']['users'] ?? [];
$apiError = !empty($apiUsers['error']) ? $apiUsers['error'] : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Management - Surely Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f1f5f9; overflow-x: hidden; }
        .main-content { margin-left: 280px; padding: 1.5rem; }
        .top-header { background: white; border-radius: 1rem; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header-left h1 { font-size: 1.5rem; font-weight: 700; color: #1a2c3e; }
        .header-left p { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }
        .btn-primary { background: #0b5e2e; color: white; padding: 0.6rem 1.2rem; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.375rem; text-decoration: none; }
        .btn-primary:hover { background: #0a5229; }
        .alert { padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 0.625rem; font-size: 0.875rem; }
        .alert-success { background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
        .alert-error   { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
        .alert-warning { background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; }

        /* Stats row */
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .stat-card { background: white; border-radius: 0.875rem; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .stat-card .stat-val { font-size: 1.875rem; font-weight: 700; color: #0b5e2e; }
        .stat-card .stat-lbl { font-size: 0.8125rem; color: #64748b; margin-top: 0.25rem; }

        /* Table */
        .table-card { background: white; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.875rem; border-bottom: 1px solid #e2e8f0; }
        .table-title { font-size: 1rem; font-weight: 600; color: #1a2c3e; }
        .table-responsive { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 0.75rem 0.75rem; background: #f8fafc; font-weight: 600; font-size: 0.75rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table td { padding: 0.875rem 0.75rem; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: #f8fafc; }

        .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; }
        .badge-active   { background: #dcfce7; color: #0b5e2e; }
        .badge-inactive { background: #fee2e2; color: #dc2626; }
        .badge-industry { background: #dbeafe; color: #2563eb; }

        .user-info { display: flex; flex-direction: column; }
        .user-name  { font-weight: 600; color: #1e293b; }
        .user-email { font-size: 0.75rem; color: #64748b; }

        .company-info { display: flex; flex-direction: column; }
        .company-name { font-weight: 500; color: #334155; }
        .company-meta { font-size: 0.75rem; color: #94a3b8; }

        .action-btn { padding: 0.375rem 0.75rem; border-radius: 0.375rem; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem; margin: 0 0.125rem; }
        .btn-activate   { background: #dcfce7; color: #059669; }
        .btn-deactivate { background: #fef3c7; color: #d97706; }
        .btn-delete     { background: #fee2e2; color: #dc2626; }
        .btn-dashboard  { background: #dbeafe; color: #2563eb; text-decoration: none; }

        /* Modal */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
        .modal.active { display: flex; }
        .modal-content { background: white; border-radius: 1rem; padding: 2rem; max-width: 560px; width: 90%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .modal-header h3 { font-size: 1.125rem; font-weight: 700; color: #1a2c3e; }
        .close-modal { cursor: pointer; font-size: 1.5rem; color: #94a3b8; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { margin-bottom: 0; }
        .form-group.full-width { grid-column: 1 / -1; }
        .form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 0.375rem; }
        .form-group label span { color: #dc2626; }
        .form-group input, .form-group select { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s; }
        .form-group input:focus, .form-group select:focus { border-color: #0b5e2e; box-shadow: 0 0 0 3px rgba(11,94,46,0.1); }
        .divider { grid-column: 1 / -1; border: none; border-top: 1px solid #e2e8f0; margin: 0.5rem 0; }
        .section-label { grid-column: 1 / -1; font-size: 0.8125rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-submit { background: #0b5e2e; color: white; padding: 0.75rem; border: none; border-radius: 0.5rem; width: 100%; cursor: pointer; font-weight: 600; font-size: 0.9375rem; margin-top: 1.25rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-submit:hover { background: #0a5229; }

        .empty-state { text-align: center; padding: 3rem; color: #94a3b8; }
        .api-error { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 0.75rem; padding: 1rem; color: #dc2626; margin-bottom: 1rem; font-size: 0.875rem; }

        @media (max-width: 768px) { .main-content { margin-left: 0; } .form-grid { grid-template-columns: 1fr; } .stats-row { grid-template-columns: 1fr; } }
    </style>
</head>
<body>

<?php include 'sidebar.php'; ?>

<main class="main-content">
    <header class="top-header">
        <div class="header-left">
            <h1><i class="fas fa-building" style="color:#0b5e2e;margin-right:0.5rem;"></i>Client Management</h1>
            <p>Onboard companies and manage user access to Surely dashboard</p>
        </div>
        <button class="btn-primary" onclick="openModal()">
            <i class="fas fa-plus"></i> Onboard New Client
        </button>
    </header>

    <?php if ($success_msg): ?>
        <div class="alert alert-success"><i class="fas fa-check-circle"></i> <span><?= $success_msg ?></span></div>
    <?php endif; ?>
    <?php if ($error_msg): ?>
        <div class="alert alert-error"><i class="fas fa-exclamation-circle"></i> <?= htmlspecialchars($error_msg) ?></div>
    <?php endif; ?>

    <?php if ($apiError): ?>
        <div class="api-error">
            <strong><i class="fas fa-server"></i> Surely API Error:</strong> <?= htmlspecialchars($apiError) ?><br>
            <small>Make sure the Surely backend is running at: <code><?= SURELY_API_URL ?></code></small>
        </div>
    <?php endif; ?>

    <!-- Stats -->
    <?php if (!empty($apiStats['data'])): $s = $apiStats['data']; ?>
    <div class="stats-row">
        <div class="stat-card">
            <div class="stat-val"><?= $s['totalUsers'] ?? 0 ?></div>
            <div class="stat-lbl"><i class="fas fa-users"></i> Total Clients</div>
        </div>
        <div class="stat-card">
            <div class="stat-val" style="color:#059669;"><?= $s['activeUsers'] ?? 0 ?></div>
            <div class="stat-lbl"><i class="fas fa-check-circle"></i> Active</div>
        </div>
        <div class="stat-card">
            <div class="stat-val" style="color:#dc2626;"><?= $s['inactiveUsers'] ?? 0 ?></div>
            <div class="stat-lbl"><i class="fas fa-pause-circle"></i> Inactive</div>
        </div>
    </div>
    <?php endif; ?>

    <!-- Users Table -->
    <div class="table-card">
        <div class="table-header">
            <span class="table-title"><i class="fas fa-list"></i> All Clients</span>
            <span style="font-size:0.8125rem; color:#94a3b8;"><?= count($users) ?> total</span>
        </div>

        <?php if (empty($users)): ?>
            <div class="empty-state">
                <i class="fas fa-building" style="font-size:2.5rem; margin-bottom:1rem; opacity:0.3;"></i>
                <p style="font-weight:600; color:#64748b;">No clients onboarded yet</p>
                <p style="font-size:0.875rem; margin-top:0.375rem;">Click "Onboard New Client" to add your first client</p>
            </div>
        <?php else: ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Company</th>
                        <th>Industry</th>
                        <th>Status</th>
                        <th>Onboarded</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u):
                        $company = $u['businessAccounts'][0] ?? null;
                        $isActive = $u['isActive'] ?? true;
                    ?>
                    <tr>
                        <td>
                            <div class="user-info">
                                <span class="user-name"><?= htmlspecialchars($u['name']) ?></span>
                                <span class="user-email"><?= htmlspecialchars($u['email']) ?></span>
                            </div>
                        </td>
                        <td>
                            <?php if ($company): ?>
                            <div class="company-info">
                                <span class="company-name"><?= htmlspecialchars($company['name']) ?></span>
                                <?php if (!empty($company['phone'])): ?>
                                <span class="company-meta"><i class="fas fa-phone" style="font-size:0.65rem;"></i> <?= htmlspecialchars($company['phone']) ?></span>
                                <?php endif; ?>
                            </div>
                            <?php else: ?>
                            <span style="color:#94a3b8; font-size:0.8rem;">—</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!empty($company['industry'])): ?>
                            <span class="badge badge-industry"><?= htmlspecialchars($company['industry']) ?></span>
                            <?php else: ?>
                            <span style="color:#94a3b8;">—</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <span class="badge <?= $isActive ? 'badge-active' : 'badge-inactive' ?>">
                                <?= $isActive ? 'Active' : 'Inactive' ?>
                            </span>
                        </td>
                        <td style="font-size:0.8rem; color:#64748b;">
                            <?= date('d M Y', strtotime($u['createdAt'])) ?>
                        </td>
                        <td>
                            <a href="<?= SURELY_DASH_URL ?>" target="_blank" class="action-btn btn-dashboard" title="Open Dashboard">
                                <i class="fas fa-external-link-alt"></i> Dashboard
                            </a>
                            <form method="POST" style="display:inline;">
                                <input type="hidden" name="action"   value="update_status">
                                <input type="hidden" name="user_id"  value="<?= htmlspecialchars($u['id']) ?>">
                                <input type="hidden" name="status"   value="<?= $isActive ? 'inactive' : 'active' ?>">
                                <button type="submit" class="action-btn <?= $isActive ? 'btn-deactivate' : 'btn-activate' ?>"
                                    onclick="return confirm('<?= $isActive ? 'Deactivate' : 'Activate' ?> this user?')">
                                    <i class="fas <?= $isActive ? 'fa-pause' : 'fa-play' ?>"></i>
                                    <?= $isActive ? 'Deactivate' : 'Activate' ?>
                                </button>
                            </form>
                            <form method="POST" style="display:inline;">
                                <input type="hidden" name="action"  value="delete_user">
                                <input type="hidden" name="user_id" value="<?= htmlspecialchars($u['id']) ?>">
                                <button type="submit" class="action-btn btn-delete"
                                    onclick="return confirm('Permanently delete this user and ALL their data?')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </form>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
    </div>
</main>

<!-- Onboard Client Modal -->
<div id="onboardModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-building" style="color:#0b5e2e;margin-right:0.5rem;"></i>Onboard New Client</h3>
            <span class="close-modal" onclick="closeModal()">&times;</span>
        </div>
        <form method="POST">
            <input type="hidden" name="action" value="create_user">
            <div class="form-grid">
                <!-- Company Section -->
                <div class="section-label"><i class="fas fa-building"></i> Company Details</div>
                <div class="form-group full-width">
                    <label>Company / Business Name <span>*</span></label>
                    <input type="text" name="company_name" placeholder="e.g. Rajesh Enterprises" required>
                </div>
                <div class="form-group">
                    <label>Industry</label>
                    <select name="industry">
                        <option value="">Select industry...</option>
                        <option>Restaurant</option>
                        <option>Real Estate</option>
                        <option>Automobile</option>
                        <option>Insurance</option>
                        <option>Salon</option>
                        <option>Gym</option>
                        <option>Travel</option>
                        <option>Retail</option>
                        <option>Healthcare</option>
                        <option>Education</option>
                        <option>Finance</option>
                        <option>Technology</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Business Phone</label>
                    <input type="tel" name="phone" placeholder="+91 98765 43210">
                </div>

                <hr class="divider">

                <!-- User / Login Section -->
                <div class="section-label"><i class="fas fa-user"></i> Login Credentials</div>
                <div class="form-group full-width">
                    <label>Full Name <span>*</span></label>
                    <input type="text" name="full_name" placeholder="e.g. Rajesh Kumar" required>
                </div>
                <div class="form-group full-width">
                    <label>Email Address <span>*</span></label>
                    <input type="email" name="email" placeholder="rajesh@example.com" required>
                </div>
                <div class="form-group">
                    <label>Password <span>*</span></label>
                    <input type="password" name="password" placeholder="Min. 6 characters" required>
                </div>
                <div class="form-group">
                    <label>Confirm Password <span>*</span></label>
                    <input type="password" name="confirm_password" placeholder="Confirm password" required>
                </div>
            </div>

            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:0.5rem; padding:0.75rem; margin-top:1rem; font-size:0.8rem; color:#059669;">
                <i class="fas fa-info-circle"></i>
                After creation, the client can login at: <strong><?= SURELY_DASH_URL ?>/auth/login</strong>
            </div>

            <button type="submit" class="btn-submit">
                <i class="fas fa-rocket"></i> Create Company & User Account
            </button>
        </form>
    </div>
</div>

<script>
    function openModal()  { document.getElementById('onboardModal').classList.add('active'); }
    function closeModal() { document.getElementById('onboardModal').classList.remove('active'); }
    window.onclick = function(e) {
        if (e.target === document.getElementById('onboardModal')) closeModal();
    };
</script>
</body>
</html>
