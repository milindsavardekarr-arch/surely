<?php
// Surely SaaS Platform - Main Index Page with Clean Hero Section
include 'header.php';
?>

<?php
// Include database connection
include 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['demo_name'])) {
    $name = mysqli_real_escape_string($conn, $_POST['demo_name']);
    $email = mysqli_real_escape_string($conn, $_POST['demo_email']);
    $company = isset($_POST['demo_company']) ? mysqli_real_escape_string($conn, $_POST['demo_company']) : '';
    $industry = isset($_POST['demo_industry']) ? mysqli_real_escape_string($conn, $_POST['demo_industry']) : '';
    $phone = isset($_POST['demo_phone']) ? mysqli_real_escape_string($conn, $_POST['demo_phone']) : '';
    $message = isset($_POST['message']) ? mysqli_real_escape_string($conn, $_POST['message']) : '';
    $interested_users = isset($_POST['interested_users']) ? mysqli_real_escape_string($conn, $_POST['interested_users']) : '';
    
    // Generate unique booking ID
    $booking_id = 'BK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
    
    // Get IP address
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '';
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // Insert into database
    $sql = "INSERT INTO demo_bookings (booking_id, full_name, email, company_name, industry, phone, message, interested_users, ip_address, user_agent, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')";
    
    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "ssssssssss", $booking_id, $name, $email, $company, $industry, $phone, $message, $interested_users, $ip_address, $user_agent);
    
    if (mysqli_stmt_execute($stmt)) {
        $success_message = "Thanks $name! We'll contact you at $email within 24 hours. Your booking ID: $booking_id";
    } else {
        $error_message = "Sorry, something went wrong. Please try again later.";
    }
}
?>

<style>
    /* Hero Section Enhanced - No Rectangle */
    .hero {
        min-height: 100vh;
        display: flex;
        align-items: center;
        padding: 7rem 2rem 4rem;
        position: relative;
        overflow: hidden;
    }
    
    /* Hero Background Elements */
    .hero-bg-circle {
        position: absolute;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(37,211,102,0.08), transparent);
        pointer-events: none;
        z-index: 0;
    }
    
    .hero-bg-circle-1 {
        width: 500px;
        height: 500px;
        top: -200px;
        right: -100px;
        animation: float 8s ease-in-out infinite;
    }
    
    .hero-bg-circle-2 {
        width: 300px;
        height: 300px;
        bottom: -100px;
        left: -50px;
        animation: float 6s ease-in-out infinite reverse;
    }
    
    .hero-bg-circle-3 {
        width: 200px;
        height: 200px;
        bottom: 20%;
        right: 20%;
        animation: pulse 4s ease-in-out infinite;
    }
    
    .hero-bg-blur {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        height: 80%;
        background: radial-gradient(circle, rgba(37,211,102,0.03), transparent);
        filter: blur(60px);
        pointer-events: none;
    }

    .hero-container {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
        align-items: center;
        position: relative;
        z-index: 2;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: rgba(37, 211, 102, 0.12);
        backdrop-filter: blur(4px);
        color: var(--primary);
        padding: 0.4rem 1.2rem;
        border-radius: 2rem;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        border: 1px solid rgba(37,211,102,0.2);
    }

    .hero-title {
        font-size: 3.8rem;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 1.5rem;
        color: var(--gray-900);
    }

    .hero-title-gradient {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        position: relative;
        display: inline-block;
    }
    
    .hero-title-gradient::before {
        content: '';
        position: absolute;
        bottom: 8px;
        left: 0;
        right: 0;
        height: 10px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        opacity: 0.15;
        border-radius: 5px;
        z-index: -1;
    }

    .hero-desc {
        font-size: 1.1rem;
        color: var(--gray-500);
        line-height: 1.7;
        margin-bottom: 2rem;
    }

    .hero-buttons {
        display: flex;
        gap: 1rem;
        margin-bottom: 2.5rem;
        flex-wrap: wrap;
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--primary), var(--primary-light));
        color: white;
        padding: 0.9rem 2.2rem;
        border-radius: 3rem;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.3s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(7,94,84,0.2);
    }

    .btn-primary::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s;
    }

    .btn-primary:hover::before {
        left: 100%;
    }

    .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(7,94,84,0.3);
    }

    .btn-outline {
        background: transparent;
        border: 1.5px solid var(--primary);
        color: var(--primary);
        padding: 0.9rem 2.2rem;
        border-radius: 3rem;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.3s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
    }

    .btn-outline:hover {
        background: rgba(7, 94, 84, 0.05);
        transform: translateY(-3px);
        box-shadow: 0 4px 15px rgba(7,94,84,0.1);
    }

    .hero-stats {
        display: flex;
        gap: 2.5rem;
        flex-wrap: wrap;
    }

    .stat-item {
        transition: transform 0.3s;
        padding: 0.5rem 1rem;
        background: rgba(255,255,255,0.5);
        backdrop-filter: blur(4px);
        border-radius: 1rem;
    }
    
    .stat-item:hover {
        transform: translateY(-5px);
        background: white;
        box-shadow: var(--shadow-md);
    }
    
    .stat-item h3 {
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--primary);
    }

    .stat-item p {
        font-size: 0.85rem;
        color: var(--gray-500);
    }

    /* Clean WhatsApp Icon - No Rectangle */
    .hero-image {
        text-align: center;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .whatsapp-icon {
        font-size: 14rem;
        color: var(--secondary);
        filter: drop-shadow(0 20px 30px rgba(37,211,102,0.2));
        transition: all 0.3s ease;
        position: relative;
        z-index: 2;
        display: inline-block;
    }
    
    .whatsapp-icon:hover {
        transform: scale(1.05) translateY(-5px);
        filter: drop-shadow(0 30px 40px rgba(37,211,102,0.3));
    }
    
    /* Floating Elements around WhatsApp */
    .floating-element {
        position: absolute;
        font-size: 1.5rem;
        opacity: 0.7;
        animation: float 6s ease-in-out infinite;
        z-index: 3;
    }
    
    .floating-1 {
        top: 5%;
        right: 10%;
        animation-delay: 0s;
        color: var(--primary);
    }
    
    .floating-2 {
        bottom: 10%;
        left: 5%;
        animation-delay: 1s;
        font-size: 2rem;
        color: var(--secondary);
    }
    
    .floating-3 {
        top: 20%;
        left: -5%;
        animation-delay: 2s;
        font-size: 1.2rem;
        color: var(--primary-light);
    }
    
    .floating-4 {
        bottom: 15%;
        right: 0%;
        animation-delay: 0.5s;
        font-size: 1.8rem;
        color: var(--secondary-dark);
    }
    
    .floating-5 {
        top: 50%;
        right: -8%;
        animation-delay: 1.5s;
        font-size: 1.3rem;
        color: var(--primary);
    }
    
    .floating-6 {
        bottom: 30%;
        left: -3%;
        animation-delay: 2.5s;
        font-size: 1rem;
        color: var(--secondary);
    }

    /* Section Styles */
    .section {
        padding: 5rem 2rem;
        position: relative;
    }

    .section-container {
        max-width: 1280px;
        margin: 0 auto;
        position: relative;
        z-index: 2;
    }

    .section-header {
        text-align: center;
        max-width: 600px;
        margin: 0 auto 3rem;
    }

    .section-tag {
        display: inline-block;
        background: rgba(7, 94, 84, 0.1);
        color: var(--primary);
        padding: 0.3rem 1rem;
        border-radius: 2rem;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }

    .section-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: var(--gray-900);
        margin-bottom: 1rem;
    }

    .section-desc {
        color: var(--gray-500);
        font-size: 1rem;
    }

    /* Features Grid */
    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 2rem;
    }

    .feature-card {
        background: white;
        padding: 2rem;
        border-radius: 1.5rem;
        box-shadow: var(--shadow-md);
        transition: all 0.3s;
        border: 1px solid rgba(0, 0, 0, 0.05);
        opacity: 0;
        transform: translateY(30px);
    }

    .feature-card.visible {
        opacity: 1;
        transform: translateY(0);
    }

    .feature-card:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: var(--shadow-xl);
        border-color: var(--secondary);
    }

    .feature-icon {
        width: 55px;
        height: 55px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        border-radius: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.5rem;
        transition: all 0.3s;
    }
    
    .feature-card:hover .feature-icon {
        transform: rotate(10deg) scale(1.05);
    }

    .feature-icon i {
        font-size: 1.6rem;
        color: white;
    }

    .feature-card h3 {
        font-size: 1.3rem;
        margin-bottom: 0.5rem;
    }

    .feature-card p {
        color: var(--gray-500);
        line-height: 1.5;
    }

    /* Pricing Section */
    .pricing-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 2rem;
    }

    .pricing-card {
        background: white;
        border-radius: 1.5rem;
        overflow: hidden;
        transition: all 0.3s;
        box-shadow: var(--shadow-md);
        border: 1px solid rgba(0, 0, 0, 0.05);
        position: relative;
        opacity: 0;
        transform: translateY(30px);
    }

    .pricing-card.visible {
        opacity: 1;
        transform: translateY(0);
    }

    .pricing-card:hover {
        transform: translateY(-8px);
        box-shadow: var(--shadow-2xl);
    }

    .pricing-popular {
        border: 2px solid var(--secondary);
        transform: scale(1.02);
    }

    .pricing-popular:hover {
        transform: scale(1.02) translateY(-8px);
    }

    .popular-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--secondary);
        color: white;
        padding: 0.25rem 1rem;
        border-radius: 2rem;
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
        animation: pulse 2s ease-in-out infinite;
    }

    .pricing-header {
        padding: 2rem;
        text-align: center;
        background: linear-gradient(135deg, rgba(7, 94, 84, 0.05), rgba(37, 211, 102, 0.05));
    }

    .pricing-icon {
        font-size: 2.5rem;
        color: var(--primary);
        margin-bottom: 1rem;
        transition: transform 0.3s;
    }
    
    .pricing-card:hover .pricing-icon {
        transform: scale(1.1);
    }

    .pricing-name {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .pricing-desc {
        color: var(--gray-500);
        font-size: 0.85rem;
    }

    .pricing-price {
        padding: 1.5rem;
        text-align: center;
        border-bottom: 1px solid var(--gray-200);
    }

    .price-current {
        font-size: 2.5rem;
        font-weight: 800;
        color: var(--primary);
    }

    .price-original {
        text-decoration: line-through;
        color: var(--gray-400);
        font-size: 1rem;
        margin-left: 0.5rem;
    }

    .price-period {
        font-size: 0.8rem;
        color: var(--gray-500);
        margin-top: 0.25rem;
    }

    .pricing-features {
        padding: 1.5rem;
        list-style: none;
    }

    .pricing-features li {
        padding: 0.6rem 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--gray-600);
        font-size: 0.9rem;
        transition: transform 0.2s;
    }
    
    .pricing-features li:hover {
        transform: translateX(5px);
    }

    .pricing-features li i {
        color: var(--secondary);
        font-size: 1rem;
    }

    .pricing-btn {
        margin: 0 1.5rem 1.5rem;
        display: block;
        text-align: center;
        background: var(--primary);
        color: white;
        padding: 0.8rem;
        border-radius: 2rem;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s;
    }

    .pricing-btn:hover {
        background: var(--primary-light);
        transform: translateY(-2px);
    }

    /* Demo Section */
    .demo-section {
        background: linear-gradient(135deg, var(--primary), var(--primary-dark));
        border-radius: 2rem;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1fr 1fr;
        opacity: 0;
        transform: translateY(30px);
    }

    .demo-section.visible {
        opacity: 1;
        transform: translateY(0);
    }

    .demo-form {
        background: white;
        padding: 3rem;
    }

    .demo-form h2 {
        font-size: 1.8rem;
        margin-bottom: 0.5rem;
        color: var(--gray-900);
    }

    .demo-form p {
        color: var(--gray-500);
        margin-bottom: 2rem;
    }

    .form-group {
        margin-bottom: 1.2rem;
    }

    .form-group label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--gray-700);
        margin-bottom: 0.3rem;
    }

    .form-group input,
    .form-group select {
        width: 100%;
        padding: 0.8rem 1rem;
        border: 1px solid var(--gray-200);
        border-radius: 0.8rem;
        font-family: 'Inter', sans-serif;
        transition: all 0.2s;
    }

    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: var(--secondary);
        box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
        transform: scale(1.01);
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .btn-submit {
        width: 100%;
        background: linear-gradient(135deg, var(--secondary), var(--secondary-dark));
        color: white;
        padding: 0.9rem;
        border: none;
        border-radius: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
    }

    .btn-submit::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s;
    }

    .btn-submit:hover::before {
        left: 100%;
    }

    .btn-submit:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .demo-content {
        padding: 3rem;
        color: white;
    }

    .demo-content h3 {
        font-size: 1.5rem;
        margin-bottom: 1.5rem;
    }

    .demo-list {
        list-style: none;
        margin-bottom: 2rem;
    }

    .demo-list li {
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transition: transform 0.2s;
    }
    
    .demo-list li:hover {
        transform: translateX(5px);
    }

    .demo-list li i {
        color: var(--secondary);
        font-size: 1.1rem;
    }

    .demo-feature {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.2rem;
        margin-top: 1.5rem;
        transition: transform 0.3s;
    }
    
    .demo-feature:hover {
        transform: scale(1.02);
    }

    .demo-trust {
        text-align: center;
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 0.85rem;
    }

    /* Success Message */
    .success-message {
        background: #d4edda;
        color: var(--primary);
        padding: 1rem;
        border-radius: 0.8rem;
        margin-bottom: 1.5rem;
        text-align: center;
        animation: fadeInUp 0.5s ease;
    }

    /* Responsive */
    @media (max-width: 968px) {
        .hero-container {
            grid-template-columns: 1fr;
            text-align: center;
        }
        .hero-buttons {
            justify-content: center;
        }
        .hero-stats {
            justify-content: center;
        }
        .demo-section {
            grid-template-columns: 1fr;
        }
        .pricing-popular {
            transform: scale(1);
        }
        .hero {
            padding: 6rem 1rem 3rem;
        }
        .section {
            padding: 3rem 1rem;
        }
        .hero-title {
            font-size: 2.5rem;
        }
        .whatsapp-icon {
            font-size: 8rem;
        }
        .floating-element {
            display: none;
        }
    }

    @media (max-width: 640px) {
        .form-row {
            grid-template-columns: 1fr;
        }
        .section-title {
            font-size: 1.8rem;
        }
        .hero-title {
            font-size: 2rem;
        }
        .whatsapp-icon {
            font-size: 6rem;
        }
    }
</style>

<!-- Hero Section - Clean, No Rectangle -->
<section class="hero">
    <!-- Background Circles -->
    <div class="hero-bg-circle hero-bg-circle-1"></div>
    <div class="hero-bg-circle hero-bg-circle-2"></div>
    <div class="hero-bg-circle hero-bg-circle-3"></div>
    <div class="hero-bg-blur"></div>
    
    <!-- Floating Elements around WhatsApp -->
    <div class="floating-element floating-1"><i class="fab fa-whatsapp"></i></div>
    <div class="floating-element floating-2"><i class="fas fa-comment-dots"></i></div>
    <div class="floating-element floating-3"><i class="fas fa-robot"></i></div>
    <div class="floating-element floating-4"><i class="fas fa-chart-line"></i></div>
    <div class="floating-element floating-5"><i class="fas fa-bolt"></i></div>
    <div class="floating-element floating-6"><i class="fas fa-users"></i></div>
    
    <div class="hero-container">
        <div>
            <div class="hero-badge animate-fade-up">
                <i class="fas fa-robot"></i> AI-Powered Engagement
            </div>
            <h1 class="hero-title animate-fade-up" style="animation-delay: 0.1s;">
                Build stronger lead relationships<br>with <span class="hero-title-gradient">AI WhatsApp</span>
            </h1>
            <p class="hero-desc animate-fade-up" style="animation-delay: 0.2s;">
                Smart follow-ups, relationship tracking, and lead insights — fully automated. 
                Trusted by 2,000+ growing businesses across India.
            </p>
            <div class="hero-buttons animate-fade-up" style="animation-delay: 0.3s;">
                <a href="#pricing" class="btn-primary"><i class="fas fa-rocket"></i> See plans →</a>
                <a href="#demo" class="btn-outline"><i class="fas fa-calendar-check"></i> Book a Demo</a>
            </div>
            <div class="hero-stats animate-fade-up" style="animation-delay: 0.4s;">
                <div class="stat-item">
                    <h3>2,000+</h3>
                    <p><i class="fas fa-building"></i> Businesses</p>
                </div>
                <div class="stat-item">
                    <h3>1.2M+</h3>
                    <p><i class="fas fa-envelope"></i> Messages/mo</p>
                </div>
                <div class="stat-item">
                    <h3>98%</h3>
                    <p><i class="fas fa-star"></i> Satisfaction</p>
                </div>
            </div>
        </div>
        <div class="hero-image">
            <!-- Clean WhatsApp Icon - No Rectangle/Box -->
            <i class="fab fa-whatsapp whatsapp-icon animate-float"></i>
        </div>
    </div>
</section>

<!-- Features Section -->
<section id="features" class="section" style="background: white;">
    <div class="section-container">
        <div class="section-header">
            <div class="section-tag">Why Choose Surely</div>
            <h2 class="section-title">Everything to automate WhatsApp relationships</h2>
            <p class="section-desc">Track, engage, convert — all from one smart dashboard</p>
        </div>
        <div class="features-grid">
            <div class="feature-card" data-animate>
                <div class="feature-icon"><i class="fas fa-comment-dots"></i></div>
                <h3>AI Chat Sequences</h3>
                <p>Automated two-way conversations, smart replies & personalized broadcasts.</p>
            </div>
            <div class="feature-card" data-animate>
                <div class="feature-icon"><i class="fas fa-chart-line"></i></div>
                <h3>Lead Insights</h3>
                <p>Predict engagement scores, track sentiment, and get actionable analytics.</p>
            </div>
            <div class="feature-card" data-animate>
                <div class="feature-icon"><i class="fas fa-clock"></i></div>
                <h3>Smart Follow-ups</h3>
                <p>Never lose a lead — intelligent reminders & re-engagement flows.</p>
            </div>
            <div class="feature-card" data-animate>
                <div class="feature-icon"><i class="fas fa-users"></i></div>
                <h3>Relationship CRM</h3>
                <p>Centralized history, tags, notes — keep customers close, always.</p>
            </div>
        </div>
    </div>
</section>

<!-- Pricing Section -->
<section id="pricing" class="section">
    <div class="section-container">
        <div class="section-header">
            <div class="section-tag">Pricing</div>
            <h2 class="section-title">Simple, transparent pricing for teams</h2>
            <p class="section-desc">No free trial. Pay yearly in advance and save up to 30%.</p>
        </div>
        <div class="pricing-grid">
            <!-- Starter Plan -->
            <div class="pricing-card" data-animate>
                <div class="pricing-header">
                    <div class="pricing-icon"><i class="fas fa-seedling"></i></div>
                    <h3 class="pricing-name">Starter</h3>
                    <p class="pricing-desc">Perfect for small teams</p>
                </div>
                <div class="pricing-price">
                    <span class="price-current">₹1999</span>
                    <span class="price-original">₹2499</span>
                    <div class="price-period">per user / month + taxes</div>
                </div>
                <ul class="pricing-features">
                    <li><i class="fas fa-check-circle"></i> 1-5 team members</li>
                    <li><i class="fas fa-check-circle"></i> AI Chat Sequences</li>
                    <li><i class="fas fa-check-circle"></i> Lead Insights Basic</li>
                    <li><i class="fas fa-check-circle"></i> Smart Follow-ups</li>
                    <li><i class="fas fa-check-circle"></i> Email Support</li>
                </ul>
                <a href="#demo" class="pricing-btn">Book Demo →</a>
            </div>

            <!-- Growth Plan -->
            <div class="pricing-card pricing-popular" data-animate>
                <div class="popular-badge">Most Popular</div>
                <div class="pricing-header">
                    <div class="pricing-icon"><i class="fas fa-chart-line"></i></div>
                    <h3 class="pricing-name">Growth</h3>
                    <p class="pricing-desc">Best for growing teams</p>
                </div>
                <div class="pricing-price">
                    <span class="price-current">₹1699</span>
                    <span class="price-original">₹2299</span>
                    <div class="price-period">per user / month + taxes</div>
                </div>
                <ul class="pricing-features">
                    <li><i class="fas fa-check-circle"></i> 6-10 team members</li>
                    <li><i class="fas fa-check-circle"></i> Everything in Starter</li>
                    <li><i class="fas fa-check-circle"></i> Advanced Lead Insights</li>
                    <li><i class="fas fa-check-circle"></i> Priority Support</li>
                    <li><i class="fas fa-check-circle"></i> API Access</li>
                </ul>
                <a href="#demo" class="pricing-btn">Book Demo →</a>
            </div>

            <!-- Business Plan -->
            <div class="pricing-card" data-animate>
                <div class="pricing-header">
                    <div class="pricing-icon"><i class="fas fa-crown"></i></div>
                    <h3 class="pricing-name">Business</h3>
                    <p class="pricing-desc">For large organizations</p>
                </div>
                <div class="pricing-price">
                    <span class="price-current">₹1499</span>
                    <span class="price-original">₹1999</span>
                    <div class="price-period">per user / month + taxes</div>
                </div>
                <ul class="pricing-features">
                    <li><i class="fas fa-check-circle"></i> 11-15 team members</li>
                    <li><i class="fas fa-check-circle"></i> Everything in Growth</li>
                    <li><i class="fas fa-check-circle"></i> Dedicated Account Manager</li>
                    <li><i class="fas fa-check-circle"></i> Custom Integration</li>
                    <li><i class="fas fa-check-circle"></i> 24/7 Phone Support</li>
                </ul>
                <a href="#demo" class="pricing-btn">Book Demo →</a>
            </div>
        </div>
    </div>
</section>

<!-- Demo Section -->
<section id="demo" class="section" style="background: #f0fdf4;">
    <div class="section-container">
        <div class="demo-section" data-animate>
            <div class="demo-form">
                <h2>See surely in action</h2>
                <p>Book a personalized demo and discover how surely can help you build stronger customer relationships.</p>
                
                <?php if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['demo_name'])): 
                    $name = htmlspecialchars($_POST['demo_name']);
                    $email = htmlspecialchars($_POST['demo_email']);
                ?>
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i> Thanks <?php echo $name; ?>! We'll contact you at <?php echo $email; ?> within 24 hours.
                    </div>
                <?php endif; ?>
                
                <form method="POST">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="demo_name" placeholder="Maya Chen" required>
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="demo_email" placeholder="maya@company.com" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Company Name</label>
                            <input type="text" name="demo_company" placeholder="Coastal Properties">
                        </div>
                        <div class="form-group">
                            <label>Industry</label>
                            <select name="demo_industry">
                                <option value="">Select industry</option>
                                <option>Real Estate</option>
                                <option>E-commerce</option>
                                <option>Education</option>
                                <option>Healthcare</option>
                                <option>Technology</option>
                                <option>Manufacturing</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" name="demo_phone" placeholder="+91 98765 43210">
                    </div>
                    <button type="submit" class="btn-submit"><i class="fas fa-calendar-check"></i> Book Demo →</button>
                    <p style="font-size: 0.7rem; text-align: center; margin-top: 1rem; color: var(--gray-400);">
                        By booking a demo, you agree to our Privacy Policy and Terms of Service.
                    </p>
                </form>
            </div>
            <div class="demo-content">
                <h3><i class="fas fa-graduation-cap"></i> What you'll learn</h3>
                <ul class="demo-list">
                    <li><i class="fas fa-bolt"></i> Respond to customers 3x faster with AI</li>
                    <li><i class="fas fa-timeline"></i> Track every conversation in one timeline</li>
                    <li><i class="fas fa-chart-simple"></i> Identify leads ready to convert now</li>
                    <li><i class="fas fa-plug"></i> Integrate with your existing tools</li>
                    <li><i class="fas fa-laptop-code"></i> Live demo with your use case</li>
                </ul>
                <div class="demo-feature">
                    <h3 style="font-size: 1rem; margin-bottom: 0.8rem;"><i class="fas fa-question-circle"></i> Why book a demo?</h3>
                    <p><strong>✓ 30-min personalized session</strong> — Tailored to your needs</p>
                    <p style="margin-top: 0.5rem;"><strong>✓ Live Q&A</strong> — Get answers from experts</p>
                    <p style="margin-top: 0.5rem;"><strong>✓ No obligation</strong> — See if it's right for you</p>
                </div>
                <div class="demo-trust">
                    <i class="fas fa-check-circle"></i> Trusted by 2,000+ businesses across India
                </div>
            </div>
        </div>
    </div>
</section>

<?php include 'footer.php'; ?>

<script>
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe elements with data-animate attribute
    document.querySelectorAll('[data-animate]').forEach(el => {
        observer.observe(el);
    });
    
    // Also observe demo section
    const demoSections = document.querySelectorAll('.demo-section');
    demoSections.forEach(el => observer.observe(el));
</script>