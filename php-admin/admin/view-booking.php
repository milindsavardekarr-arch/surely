<?php
session_start();
require_once '../config.php';

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Get booking ID
$booking_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($booking_id <= 0) {
    header('Location: bookings.php');
    exit;
}

// Fetch booking details
$sql = "SELECT * FROM demo_bookings WHERE id = ?";
$stmt = mysqli_prepare($conn, $sql);
mysqli_stmt_bind_param($stmt, "i", $booking_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$booking = mysqli_fetch_assoc($result);

if (!$booking) {
    header('Location: bookings.php');
    exit;
}

// Handle status update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_status'])) {
    $status = mysqli_real_escape_string($conn, $_POST['status']);
    $update_sql = "UPDATE demo_bookings SET status = ? WHERE id = ?";
    $update_stmt = mysqli_prepare($conn, $update_sql);
    mysqli_stmt_bind_param($update_stmt, "si", $status, $booking_id);
    
    if (mysqli_stmt_execute($update_stmt)) {
        $success_msg = "Status updated successfully!";
        // Refresh booking data
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, "i", $booking_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $booking = mysqli_fetch_assoc($result);
    }
}

// Handle note update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_notes'])) {
    $notes = mysqli_real_escape_string($conn, $_POST['notes']);
    $update_sql = "UPDATE demo_bookings SET notes = ? WHERE id = ?";
    $update_stmt = mysqli_prepare($conn, $update_sql);
    mysqli_stmt_bind_param($update_stmt, "si", $notes, $booking_id);
    
    if (mysqli_stmt_execute($update_stmt)) {
        $success_msg = "Notes updated successfully!";
        // Refresh booking data
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, "i", $booking_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $booking = mysqli_fetch_assoc($result);
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>View Booking - Surely Admin</title>
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

        .header-left p {
            font-size: 0.85rem;
            color: #64748b;
        }

        .btn-back {
            background: #e2e8f0;
            color: #475569;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 0.85rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-back:hover {
            background: #0b5e2e;
            color: white;
        }

        .alert {
            padding: 1rem;
            border-radius: 0.8rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .alert-success {
            background: #d1fae5;
            color: #059669;
        }

        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 1.5rem;
        }

        .detail-card {
            background: white;
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .detail-card.full-width {
            grid-column: 1 / -1;
        }

        .card-header {
            padding: 1rem 1.5rem;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }

        .card-header h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #1a2c3e;
        }

        .card-header h3 i {
            margin-right: 0.5rem;
            color: #0b5e2e;
        }

        .card-body {
            padding: 1.5rem;
        }

        .detail-row {
            display: flex;
            margin-bottom: 0.8rem;
            padding-bottom: 0.8rem;
            border-bottom: 1px solid #f1f5f9;
        }

        .detail-label {
            width: 140px;
            font-weight: 600;
            color: #475569;
            font-size: 0.85rem;
        }

        .detail-value {
            flex: 1;
            color: #1a2c3e;
            font-size: 0.85rem;
        }

        .detail-value a {
            color: #0b5e2e;
            text-decoration: none;
        }

        .detail-value a:hover {
            text-decoration: underline;
        }

        .status-select {
            padding: 0.3rem 0.5rem;
            border-radius: 0.5rem;
            border: 1px solid #e2e8f0;
            font-size: 0.85rem;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
        }

        .message-text {
            color: #475569;
            line-height: 1.6;
            font-size: 0.9rem;
            background: #f8fafc;
            padding: 1rem;
            border-radius: 0.5rem;
        }

        .notes-textarea {
            width: 100%;
            padding: 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.8rem;
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            resize: vertical;
            margin-bottom: 1rem;
        }

        .btn-save-notes {
            background: #0b5e2e;
            color: white;
            padding: 0.6rem 1.2rem;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 500;
        }

        .status-badge {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 2rem;
            font-size: 0.7rem;
            font-weight: 600;
        }

        .status-pending { background: #fef3c7; color: #d97706; }
        .status-contacted { background: #dbeafe; color: #2563eb; }
        .status-scheduled { background: #e0e7ff; color: #4f46e5; }
        .status-completed { background: #d1fae5; color: #059669; }
        .status-cancelled { background: #fee2e2; color: #dc2626; }

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
            }
            .details-grid {
                grid-template-columns: 1fr;
            }
            .detail-row {
                flex-direction: column;
            }
            .detail-label {
                width: 100%;
                margin-bottom: 0.3rem;
            }
        }
    </style>
</head>
<body>

<?php include 'sidebar.php'; ?>

<main class="main-content">
    <header class="top-header">
        <div class="header-left">
            <h1>Booking Details</h1>
            <p>Booking ID: <?php echo htmlspecialchars($booking['booking_id']); ?></p>
        </div>
        <div class="header-right">
            <a href="bookings.php" class="btn-back">
                <i class="fas fa-arrow-left"></i> Back to Bookings
            </a>
        </div>
    </header>

    <!-- Success Message -->
    <?php if (isset($success_msg)): ?>
        <div class="alert alert-success">
            <i class="fas fa-check-circle"></i> <?php echo $success_msg; ?>
        </div>
    <?php endif; ?>

    <div class="details-grid">
        <!-- Customer Information -->
        <div class="detail-card">
            <div class="card-header">
                <h3><i class="fas fa-user"></i> Customer Information</h3>
            </div>
            <div class="card-body">
                <div class="detail-row">
                    <span class="detail-label">Full Name:</span>
                    <span class="detail-value"><?php echo htmlspecialchars($booking['full_name']); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email Address:</span>
                    <span class="detail-value">
                        <a href="mailto:<?php echo htmlspecialchars($booking['email']); ?>"><?php echo htmlspecialchars($booking['email']); ?></a>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone Number:</span>
                    <span class="detail-value">
                        <?php if ($booking['phone']): ?>
                            <a href="tel:<?php echo htmlspecialchars($booking['phone']); ?>"><?php echo htmlspecialchars($booking['phone']); ?></a>
                        <?php else: ?>
                            -
                        <?php endif; ?>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Company Name:</span>
                    <span class="detail-value"><?php echo htmlspecialchars($booking['company_name'] ?? '-'); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Industry:</span>
                    <span class="detail-value"><?php echo htmlspecialchars($booking['industry'] ?? '-'); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Interested Users:</span>
                    <span class="detail-value"><?php echo htmlspecialchars($booking['interested_users'] ?? '-'); ?></span>
                </div>
            </div>
        </div>

        <!-- Booking Information -->
        <div class="detail-card">
            <div class="card-header">
                <h3><i class="fas fa-calendar-check"></i> Booking Information</h3>
            </div>
            <div class="card-body">
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value"><?php echo htmlspecialchars($booking['booking_id']); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <form method="POST" action="" style="display: inline-block;">
                            <select name="status" onchange="this.form.submit()" class="status-select">
                                <option value="pending" <?php echo $booking['status'] == 'pending' ? 'selected' : ''; ?>>Pending</option>
                                <option value="contacted" <?php echo $booking['status'] == 'contacted' ? 'selected' : ''; ?>>Contacted</option>
                                <option value="scheduled" <?php echo $booking['status'] == 'scheduled' ? 'selected' : ''; ?>>Scheduled</option>
                                <option value="completed" <?php echo $booking['status'] == 'completed' ? 'selected' : ''; ?>>Completed</option>
                                <option value="cancelled" <?php echo $booking['status'] == 'cancelled' ? 'selected' : ''; ?>>Cancelled</option>
                            </select>
                            <input type="hidden" name="update_status" value="1">
                        </form>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Submitted On:</span>
                    <span class="detail-value"><?php echo date('d M Y, h:i A', strtotime($booking['created_at'])); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Updated:</span>
                    <span class="detail-value"><?php echo date('d M Y, h:i A', strtotime($booking['updated_at'])); ?></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Source:</span>
                    <span class="detail-value"><?php echo ucfirst($booking['source'] ?? 'Website'); ?></span>
                </div>
            </div>
        </div>

        <!-- Message -->
        <?php if (!empty($booking['message'])): ?>
            <div class="detail-card full-width">
                <div class="card-header">
                    <h3><i class="fas fa-comment"></i> Message / Requirements</h3>
                </div>
                <div class="card-body">
                    <p class="message-text"><?php echo nl2br(htmlspecialchars($booking['message'])); ?></p>
                </div>
            </div>
        <?php endif; ?>

        <!-- Internal Notes -->
        <div class="detail-card full-width">
            <div class="card-header">
                <h3><i class="fas fa-sticky-note"></i> Internal Notes</h3>
            </div>
            <div class="card-body">
                <form method="POST" action="">
                    <textarea name="notes" class="notes-textarea" rows="4" placeholder="Add internal notes about this lead..."><?php echo htmlspecialchars($booking['notes'] ?? ''); ?></textarea>
                    <button type="submit" name="update_notes" class="btn-save-notes">
                        <i class="fas fa-save"></i> Save Notes
                    </button>
                </form>
            </div>
        </div>
    </div>
</main>
</body>
</html>