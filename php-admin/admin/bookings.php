<?php
session_start();
require_once '../config.php';

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Handle status update
if (isset($_POST['update_status']) && isset($_POST['booking_id']) && isset($_POST['status'])) {
    $booking_id = (int)$_POST['booking_id'];
    $status = mysqli_real_escape_string($conn, $_POST['status']);
    
    $update_sql = "UPDATE demo_bookings SET status = ? WHERE id = ?";
    $stmt = mysqli_prepare($conn, $update_sql);
    mysqli_stmt_bind_param($stmt, "si", $status, $booking_id);
    
    if (mysqli_stmt_execute($stmt)) {
        $success_msg = "Booking status updated successfully!";
    } else {
        $error_msg = "Failed to update status.";
    }
}

// Handle search and filters
$search = isset($_GET['search']) ? mysqli_real_escape_string($conn, $_GET['search']) : '';
$status_filter = isset($_GET['status']) ? mysqli_real_escape_string($conn, $_GET['status']) : '';
$sort = isset($_GET['sort']) ? $_GET['sort'] : 'newest';

// Build query
$where_conditions = [];
if (!empty($search)) {
    $where_conditions[] = "(full_name LIKE '%$search%' OR email LIKE '%$search%' OR company_name LIKE '%$search%' OR booking_id LIKE '%$search%')";
}
if (!empty($status_filter) && $status_filter != 'all') {
    $where_conditions[] = "status = '$status_filter'";
}

$where_clause = !empty($where_conditions) ? "WHERE " . implode(" AND ", $where_conditions) : "";

// Sorting
$order_by = match($sort) {
    'oldest' => "created_at ASC",
    'name_asc' => "full_name ASC",
    'name_desc' => "full_name DESC",
    default => "created_at DESC"
};

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 20;
$offset = ($page - 1) * $limit;

// Get total count
$count_sql = "SELECT COUNT(*) as total FROM demo_bookings $where_clause";
$count_result = mysqli_query($conn, $count_sql);
$total_rows = mysqli_fetch_assoc($count_result)['total'];
$total_pages = ceil($total_rows / $limit);

// Get bookings
$sql = "SELECT * FROM demo_bookings $where_clause ORDER BY $order_by LIMIT $offset, $limit";
$result = mysqli_query($conn, $sql);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Bookings - Surely Admin</title>
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

        .filters-section {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .filters-form {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
        }

        .search-box {
            flex: 2;
            min-width: 200px;
            position: relative;
        }

        .search-box i {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
        }

        .search-box input {
            width: 100%;
            padding: 0.7rem 1rem 0.7rem 2.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.8rem;
            font-family: 'Inter', sans-serif;
        }

        .filter-group {
            min-width: 150px;
        }

        .filter-select {
            width: 100%;
            padding: 0.7rem 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.8rem;
            font-family: 'Inter', sans-serif;
            background: white;
            cursor: pointer;
        }

        .btn-filter, .btn-reset {
            padding: 0.7rem 1.2rem;
            border-radius: 0.8rem;
            border: none;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }

        .btn-filter {
            background: #0b5e2e;
            color: white;
        }

        .btn-reset {
            background: #e2e8f0;
            color: #475569;
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

        .alert-error {
            background: #fee2e2;
            color: #dc2626;
        }

        .table-card {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.8rem;
            border-bottom: 1px solid #e2e8f0;
        }

        .total-count {
            font-size: 0.85rem;
            color: #64748b;
        }

        .table-responsive {
            overflow-x: auto;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
        }

        .data-table th {
            text-align: left;
            padding: 0.8rem 0.5rem;
            background: #f8fafc;
            font-weight: 600;
            font-size: 0.8rem;
            color: #475569;
        }

        .data-table td {
            padding: 0.8rem 0.5rem;
            font-size: 0.85rem;
            border-bottom: 1px solid #f1f5f9;
        }

        .data-table tr:hover {
            background: #f8fafc;
        }

        .booking-id {
            font-family: monospace;
            font-size: 0.8rem;
            background: #f1f5f9;
            padding: 0.2rem 0.4rem;
            border-radius: 0.3rem;
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

        .status-select {
            padding: 0.3rem 0.5rem;
            border-radius: 0.5rem;
            border: 1px solid #e2e8f0;
            font-size: 0.75rem;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
        }

        .btn-view {
            background: #e2e8f0;
            color: #475569;
            padding: 0.3rem 0.8rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 0.75rem;
            transition: all 0.2s;
        }

        .btn-view:hover {
            background: #0b5e2e;
            color: white;
        }

        .pagination {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
        }

        .page-link {
            padding: 0.5rem 1rem;
            background: #f1f5f9;
            color: #475569;
            text-decoration: none;
            border-radius: 0.5rem;
            font-size: 0.85rem;
            transition: all 0.2s;
        }

        .page-link:hover, .page-link.active {
            background: #0b5e2e;
            color: white;
        }

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
            }
            .filters-form {
                flex-direction: column;
            }
            .search-box, .filter-group {
                width: 100%;
            }
        }
    </style>
</head>
<body>

<?php include 'sidebar.php'; ?>

<main class="main-content">
    <header class="top-header">
        <div class="header-left">
            <h1>Demo Bookings</h1>
            <p>Manage and track all demo requests</p>
        </div>
        <div class="header-right">
            <span style="font-size: 0.8rem; color: #64748b;">
                <i class="fas fa-users"></i> Total: <?php echo $total_rows; ?> bookings
            </span>
        </div>
    </header>

    <!-- Filters -->
    <div class="filters-section">
        <form method="GET" action="" class="filters-form">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" name="search" placeholder="Search by name, email, company or booking ID..." value="<?php echo htmlspecialchars($search); ?>">
            </div>
            <div class="filter-group">
                <select name="status" class="filter-select">
                    <option value="all" <?php echo $status_filter == 'all' ? 'selected' : ''; ?>>All Status</option>
                    <option value="pending" <?php echo $status_filter == 'pending' ? 'selected' : ''; ?>>Pending</option>
                    <option value="contacted" <?php echo $status_filter == 'contacted' ? 'selected' : ''; ?>>Contacted</option>
                    <option value="scheduled" <?php echo $status_filter == 'scheduled' ? 'selected' : ''; ?>>Scheduled</option>
                    <option value="completed" <?php echo $status_filter == 'completed' ? 'selected' : ''; ?>>Completed</option>
                    <option value="cancelled" <?php echo $status_filter == 'cancelled' ? 'selected' : ''; ?>>Cancelled</option>
                </select>
            </div>
            <div class="filter-group">
                <select name="sort" class="filter-select">
                    <option value="newest" <?php echo $sort == 'newest' ? 'selected' : ''; ?>>Newest First</option>
                    <option value="oldest" <?php echo $sort == 'oldest' ? 'selected' : ''; ?>>Oldest First</option>
                    <option value="name_asc" <?php echo $sort == 'name_asc' ? 'selected' : ''; ?>>Name (A-Z)</option>
                    <option value="name_desc" <?php echo $sort == 'name_desc' ? 'selected' : ''; ?>>Name (Z-A)</option>
                </select>
            </div>
            <button type="submit" class="btn-filter">Apply Filters</button>
            <a href="bookings.php" class="btn-reset">Reset</a>
        </form>
    </div>

    <!-- Messages -->
    <?php if (isset($success_msg)): ?>
        <div class="alert alert-success"><i class="fas fa-check-circle"></i> <?php echo $success_msg; ?></div>
    <?php endif; ?>
    <?php if (isset($error_msg)): ?>
        <div class="alert alert-error"><i class="fas fa-exclamation-circle"></i> <?php echo $error_msg; ?></div>
    <?php endif; ?>

    <!-- Bookings Table -->
    <div class="table-card">
        <div class="table-header">
            <h3><i class="fas fa-list"></i> All Bookings</h3>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (mysqli_num_rows($result) > 0): ?>
                        <?php while ($row = mysqli_fetch_assoc($result)): ?>
                            <tr>
                                <td><span class="booking-id"><?php echo htmlspecialchars($row['booking_id']); ?></span></td>
                                <td><?php echo htmlspecialchars($row['full_name']); ?></td>
                                <td><?php echo htmlspecialchars($row['email']); ?></td>
                                <td><?php echo htmlspecialchars($row['company_name'] ?? '-'); ?></td>
                                <td><?php echo htmlspecialchars($row['phone'] ?? '-'); ?></td>
                                <td>
                                    <form method="POST" action="" style="display: inline-block;">
                                        <input type="hidden" name="booking_id" value="<?php echo $row['id']; ?>">
                                        <select name="status" onchange="this.form.submit()" class="status-select">
                                            <option value="pending" <?php echo $row['status'] == 'pending' ? 'selected' : ''; ?>>Pending</option>
                                            <option value="contacted" <?php echo $row['status'] == 'contacted' ? 'selected' : ''; ?>>Contacted</option>
                                            <option value="scheduled" <?php echo $row['status'] == 'scheduled' ? 'selected' : ''; ?>>Scheduled</option>
                                            <option value="completed" <?php echo $row['status'] == 'completed' ? 'selected' : ''; ?>>Completed</option>
                                            <option value="cancelled" <?php echo $row['status'] == 'cancelled' ? 'selected' : ''; ?>>Cancelled</option>
                                        </select>
                                        <input type="hidden" name="update_status" value="1">
                                    </form>
                                </td>
                                <td><?php echo date('d M Y', strtotime($row['created_at'])); ?></td>
                                <td>
                                    <a href="view-booking.php?id=<?php echo $row['id']; ?>" class="btn-view">
                                        <i class="fas fa-eye"></i> View
                                    </a>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 2rem;">
                                <i class="fas fa-inbox" style="font-size: 2rem; color: #cbd5e1;"></i>
                                <p style="margin-top: 0.5rem;">No bookings found</p>
                            </td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <?php if ($total_pages > 1): ?>
            <div class="pagination">
                <?php if ($page > 1): ?>
                    <a href="?page=<?php echo $page-1; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo $status_filter; ?>&sort=<?php echo $sort; ?>" class="page-link">&laquo; Previous</a>
                <?php endif; ?>
                
                <?php for ($i = 1; $i <= $total_pages; $i++): ?>
                    <a href="?page=<?php echo $i; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo $status_filter; ?>&sort=<?php echo $sort; ?>" class="page-link <?php echo $i == $page ? 'active' : ''; ?>"><?php echo $i; ?></a>
                <?php endfor; ?>
                
                <?php if ($page < $total_pages): ?>
                    <a href="?page=<?php echo $page+1; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo $status_filter; ?>&sort=<?php echo $sort; ?>" class="page-link">Next &raquo;</a>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
</main>
</body>
</html>