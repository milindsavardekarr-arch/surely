<?php
session_start();
require_once '../config.php';

// Check if admin is logged in
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Get statistics
$stats_sql = "SELECT 
    (SELECT COUNT(*) FROM demo_bookings) as total_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'pending') as pending_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'contacted') as contacted_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'scheduled') as scheduled_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'completed') as completed_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'cancelled') as cancelled_bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE DATE(created_at) = CURDATE()) as today_bookings,
    (SELECT COUNT(*) FROM contacts WHERE status = 'unread') as unread_messages,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users";

$stats_result = mysqli_query($conn, $stats_sql);
$stats = mysqli_fetch_assoc($stats_result);

// Get weekly chart data
$chart_sql = "SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
FROM demo_bookings
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY date ASC";
$chart_result = mysqli_query($conn, $chart_sql);
$chart_data = [];
while ($row = mysqli_fetch_assoc($chart_result)) {
    $chart_data[] = $row;
}

// Get recent bookings
$recent_sql = "SELECT id, booking_id, full_name, email, company_name, phone, status, created_at 
               FROM demo_bookings 
               ORDER BY created_at DESC 
               LIMIT 10";
$recent_result = mysqli_query($conn, $recent_sql);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Surely Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .stat-card {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-icon {
            width: 50px;
            height: 50px;
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .stat-info h3 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1a2c3e;
        }

        .stat-info p {
            font-size: 0.75rem;
            color: #64748b;
        }

        .chart-card {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-container {
            height: 300px;
        }

        .recent-section {
            background: white;
            border-radius: 1rem;
            padding: 1.2rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.8rem;
            border-bottom: 1px solid #e2e8f0;
        }

        .section-header h3 {
            font-size: 1.1rem;
            font-weight: 600;
        }

        .section-header a {
            color: #0b5e2e;
            text-decoration: none;
            font-size: 0.85rem;
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

        .btn-view {
            background: #e2e8f0;
            color: #475569;
            padding: 0.3rem 0.8rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-size: 0.75rem;
        }

        .btn-view:hover {
            background: #0b5e2e;
            color: white;
        }

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>

<?php include 'sidebar.php'; ?>

<main class="main-content">
    <header class="top-header">
        <div class="header-left">
            <h1>Dashboard</h1>
            <p>Welcome back, <?php echo htmlspecialchars($_SESSION['admin_full_name']); ?>!</p>
        </div>
        <div class="header-right">
            <span style="font-size: 0.8rem; color: #64748b;">
                <i class="fas fa-calendar"></i> <?php echo date('l, d F Y'); ?>
            </span>
        </div>
    </header>

    <!-- Stats Cards -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon" style="background: #dcfce7; color: #0b5e2e;">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['total_bookings'] ?? 0); ?></h3>
                <p>Total Bookings</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #fef3c7; color: #d97706;">
                <i class="fas fa-clock"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['pending_bookings'] ?? 0); ?></h3>
                <p>Pending</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #dbeafe; color: #2563eb;">
                <i class="fas fa-phone-alt"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['contacted_bookings'] ?? 0); ?></h3>
                <p>Contacted</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #e0e7ff; color: #4f46e5;">
                <i class="fas fa-video"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['scheduled_bookings'] ?? 0); ?></h3>
                <p>Scheduled</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #d1fae5; color: #059669;">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['completed_bookings'] ?? 0); ?></h3>
                <p>Completed</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #fee2e2; color: #dc2626;">
                <i class="fas fa-times-circle"></i>
            </div>
            <div class="stat-info">
                <h3><?php echo number_format($stats['cancelled_bookings'] ?? 0); ?></h3>
                <p>Cancelled</p>
            </div>
        </div>
    </div>

    <!-- Chart -->
    <div class="chart-card">
        <div class="section-header">
            <h3><i class="fas fa-chart-line"></i> Last 7 Days Bookings</h3>
        </div>
        <div class="chart-container">
            <canvas id="bookingsChart"></canvas>
        </div>
    </div>

    <!-- Recent Bookings -->
    <div class="recent-section">
        <div class="section-header">
            <h3><i class="fas fa-history"></i> Recent Demo Bookings</h3>
            <a href="bookings.php">View All →</a>
        </div>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (mysqli_num_rows($recent_result) > 0): ?>
                        <?php while ($row = mysqli_fetch_assoc($recent_result)): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($row['booking_id']); ?></td>
                                <td><?php echo htmlspecialchars($row['full_name']); ?></td>
                                <td><?php echo htmlspecialchars($row['email']); ?></td>
                                <td><?php echo htmlspecialchars($row['company_name'] ?? '-'); ?></td>
                                <td>
                                    <?php
                                    $status_class = '';
                                    switch($row['status']) {
                                        case 'pending': $status_class = 'status-pending'; break;
                                        case 'contacted': $status_class = 'status-contacted'; break;
                                        case 'scheduled': $status_class = 'status-scheduled'; break;
                                        case 'completed': $status_class = 'status-completed'; break;
                                        case 'cancelled': $status_class = 'status-cancelled'; break;
                                    }
                                    ?>
                                    <span class="status-badge <?php echo $status_class; ?>"><?php echo ucfirst($row['status']); ?></span>
                                </td>
                                <td><?php echo date('d M Y', strtotime($row['created_at'])); ?></td>
                                <td>
                                    <a href="view-booking.php?id=<?php echo $row['id']; ?>" class="btn-view">View</a>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 2rem;">No bookings found</td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</main>

<script>
    // Chart.js for bookings chart
    const ctx = document.getElementById('bookingsChart').getContext('2d');
    const chartData = <?php echo json_encode($chart_data); ?>;
    
    const labels = chartData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    
    const counts = chartData.map(item => item.count);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bookings',
                data: counts,
                borderColor: '#0b5e2e',
                backgroundColor: 'rgba(11, 94, 46, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#25D366',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
</script>
</body>
</html>