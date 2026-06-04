<?php
// sidebar.php - Admin Sidebar Component
// Get current page name for active state
$current_page = basename($_SERVER['PHP_SELF']);
?>
<style>
    /* Sidebar Styles */
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        width: 280px;
        height: 100vh;
        background: linear-gradient(180deg, #0a2e1a 0%, #0b5e2e 100%);
        color: white;
        display: flex;
        flex-direction: column;
        z-index: 100;
        transition: all 0.3s ease;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
    }

    .sidebar-header {
        padding: 1.5rem;
        text-align: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 1rem;
    }

    .sidebar-logo {
        height: 45px;
        margin-bottom: 0.8rem;
        filter: brightness(0) invert(1);
        transition: transform 0.3s;
    }

    .sidebar-logo:hover {
        transform: scale(1.05);
    }

    .sidebar-header h3 {
        font-size: 1.2rem;
        font-weight: 600;
        color: white;
        margin: 0;
    }

    .sidebar-header p {
        font-size: 0.7rem;
        opacity: 0.7;
        margin-top: 0.3rem;
    }

    .sidebar-nav {
        flex: 1;
        padding: 0.5rem 0;
        overflow-y: auto;
    }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.8rem 1.5rem;
        color: rgba(255, 255, 255, 0.7);
        text-decoration: none;
        transition: all 0.3s;
        margin: 0.2rem 0.8rem;
        border-radius: 0.8rem;
        position: relative;
    }

    .nav-item i {
        width: 22px;
        font-size: 1.1rem;
        text-align: center;
    }

    .nav-item span {
        font-size: 0.9rem;
        font-weight: 500;
    }

    .nav-item:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        transform: translateX(5px);
    }

    .nav-item.active {
        background: rgba(37, 211, 102, 0.2);
        color: #25D366;
        border-left: 3px solid #25D366;
    }

    .nav-item.active i {
        color: #25D366;
    }

    /* Badge for notifications */
    .nav-badge {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        background: #dc2626;
        color: white;
        font-size: 0.6rem;
        padding: 0.15rem 0.4rem;
        border-radius: 1rem;
        font-weight: 600;
    }

    /* Section divider */
    .nav-divider {
        margin: 1rem 1.5rem;
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
    }

    .nav-section-title {
        padding: 0.5rem 1.5rem;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.4);
        font-weight: 600;
    }

    .sidebar-footer {
        padding: 1rem 0;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: auto;
    }

    /* User info in sidebar */
    .user-info {
        padding: 0.8rem 1.2rem;
        margin: 0 0.8rem 0.8rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    .user-avatar {
        width: 35px;
        height: 35px;
        background: linear-gradient(135deg, #25D366, #128C7E);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
    }

    .user-details {
        flex: 1;
    }

    .user-details .user-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: white;
    }

    .user-details .user-role {
        font-size: 0.65rem;
        opacity: 0.6;
    }

    /* Mobile sidebar toggle */
    .sidebar-toggle {
        display: none;
        position: fixed;
        left: 1rem;
        top: 1rem;
        z-index: 101;
        background: #0b5e2e;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .sidebar {
            transform: translateX(-100%);
            width: 260px;
        }
        .sidebar.active {
            transform: translateX(0);
        }
        .sidebar-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .main-content {
            margin-left: 0 !important;
        }
    }
</style>

<!-- Sidebar Toggle Button for Mobile -->
<button class="sidebar-toggle" id="sidebarToggle">
    <i class="fas fa-bars"></i>
</button>

<!-- Sidebar -->
<aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
        <a href="dashboard.php">
            <img src="../surely-logo.png" alt="Surely" class="sidebar-logo">
        </a>
        <!-- <h3>Surely Admin</h3> -->
        <!-- <p>AI WhatsApp Platform</p> -->
    </div>

    <!-- User Info -->
    <div class="user-info">
        <div class="user-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="user-details">
            <div class="user-name"><?php echo htmlspecialchars($_SESSION['admin_full_name'] ?? 'Admin'); ?></div>
            <div class="user-role"><?php echo ucfirst($_SESSION['admin_role'] ?? 'admin'); ?></div>
        </div>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section-title">Main</div>
        
        <!-- Dashboard -->
        <a href="dashboard.php" class="nav-item <?php echo $current_page == 'dashboard.php' ? 'active' : ''; ?>">
            <i class="fas fa-tachometer-alt"></i>
            <span>Dashboard</span>
        </a>

        <!-- Bookings -->
        <a href="bookings.php" class="nav-item <?php echo $current_page == 'bookings.php' ? 'active' : ''; ?>">
            <i class="fas fa-calendar-check"></i>
            <span>Demo Bookings</span>
            <?php
            // Get pending bookings count
            if (isset($conn)) {
                $pending_query = mysqli_query($conn, "SELECT COUNT(*) as count FROM demo_bookings WHERE status = 'pending'");
                if ($pending_query) {
                    $pending_count = mysqli_fetch_assoc($pending_query)['count'];
                    if ($pending_count > 0) {
                        echo "<span class='nav-badge'>$pending_count</span>";
                    }
                }
            }
            ?>
        </a>

        <!-- Leads -->
        <a href="#" class="nav-item">
            <i class="fas fa-users"></i>
            <span>Leads</span>
        </a>

        <!-- Messages -->
        <a href="#" class="nav-item">
            <i class="fas fa-envelope"></i>
            <span>Messages</span>
            <?php
            // Get unread messages count
            if (isset($conn)) {
                $unread_query = mysqli_query($conn, "SELECT COUNT(*) as count FROM contacts WHERE status = 'unread'");
                if ($unread_query) {
                    $unread_count = mysqli_fetch_assoc($unread_query)['count'];
                    if ($unread_count > 0) {
                        echo "<span class='nav-badge'>$unread_count</span>";
                    }
                }
            }
            ?>
        </a>

        <div class="nav-divider"></div>

        <div class="nav-section-title">Management</div>

        <!-- Users (Admin only) -->
        <?php if (isset($_SESSION['admin_role']) && $_SESSION['admin_role'] == 'admin'): ?>
        <a href="users.php" class="nav-item <?php echo $current_page == 'users.php' ? 'active' : ''; ?>">
            <i class="fas fa-user-shield"></i>
            <span>User Management</span>
        </a>
        <?php endif; ?>

        <!-- Profile -->
        <a href="profile.php" class="nav-item <?php echo $current_page == 'profile.php' ? 'active' : ''; ?>">
            <i class="fas fa-user-cog"></i>
            <span>My Profile</span>
        </a>

        <!-- Settings -->
        <a href="#" class="nav-item">
            <i class="fas fa-cog"></i>
            <span>Settings</span>
        </a>

        <div class="nav-divider"></div>

        <div class="nav-section-title">Reports</div>

        <!-- Analytics -->
        <a href="#" class="nav-item">
            <i class="fas fa-chart-line"></i>
            <span>Analytics</span>
        </a>

        <!-- Export Data -->
        <a href="#" class="nav-item">
            <i class="fas fa-download"></i>
            <span>Export Data</span>
        </a>
    </nav>

    <div class="sidebar-footer">
        <!-- Logout -->
        <a href="logout.php" class="nav-item">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
        </a>
        
        <!-- Version -->
        <div style="text-align: center; padding: 0.8rem; font-size: 0.65rem; opacity: 0.4;">
            Version 1.0.0
        </div>
    </div>
</aside>

<script>
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(event) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
                sidebar.classList.remove('active');
            }
        }
    });
    
    // Active link detection
    const currentUrl = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '#' && currentUrl.includes(href)) {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
</script>