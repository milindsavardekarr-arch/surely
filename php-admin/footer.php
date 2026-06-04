<?php
// Surely SaaS Platform - Footer Component with Animations
?>
<!-- Footer -->
<footer class="footer">
    <div class="footer-container">
        <div class="footer-grid">
            <div class="footer-col">
                <a href="index.php" style="display: inline-block; margin-bottom: 1rem;">
                    <img src="surely-logo.png" alt="Surely" style="height: 40px; filter: brightness(0) invert(1);">
                </a>
                <p style="font-size: 0.85rem; line-height: 1.5;">AI-powered WhatsApp engagement platform for growing businesses.</p>
                <div class="social-links">
                    <a href="#"><i class="fab fa-linkedin-in"></i></a>
                    <a href="#"><i class="fab fa-twitter"></i></a>
                    <a href="#"><i class="fab fa-facebook-f"></i></a>
                    <a href="#"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Product</h4>
                <ul>
                    <li><a href="#features">Features</a></li>
                    <li><a href="#pricing">Pricing</a></li>
                    <li><a href="#demo">Demo</a></li>
                    <li><a href="#">Integrations</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Company</h4>
                <ul>
                    <li><a href="#">About Us</a></li>
                    <li><a href="admin/login.php">Admin</a></li>
                    <li><a href="#">Careers</a></li>
                    <li><a href="#">Contact</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Support</h4>
                <ul>
                    <li><a href="#">Help Center</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                    <li><a href="#">Terms of Service</a></li>
                    <li><a href="#">Security</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Contact</h4>
                <ul>
                    <li><i class="fas fa-map-marker-alt"></i> Pune, India</li>
                    <li><i class="fas fa-envelope"></i> contact@surelysaas.com</li>
                    <li><i class="fab fa-whatsapp"></i> +91 98765 43210</li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>© 2026 Surely — AI WhatsApp Engagement Platform. All rights reserved.</p>
            <!-- <p style="margin-top: 0.5rem; font-size: 0.7rem;">No free trial. Yearly advance payment required.</p> -->
        </div>
    </div>
</footer>

<style>
    .footer {
        background: var(--gray-900);
        color: var(--gray-400);
        padding: 4rem 2rem 2rem;
        position: relative;
        overflow: hidden;
    }
    
    .footer::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--primary), var(--secondary), var(--primary));
        animation: shimmer 3s infinite;
        background-size: 200% 100%;
    }
    
    .footer-container {
        max-width: 1280px;
        margin: 0 auto;
        opacity: 0;
        transform: translateY(30px);
        animation: fadeInUp 0.6s ease forwards;
        animation-delay: 0.2s;
    }
    
    .footer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 3rem;
        margin-bottom: 3rem;
    }
    
    .footer-col {
        transition: transform 0.3s;
    }
    
    .footer-col:hover {
        transform: translateY(-5px);
    }
    
    .footer-col h4 {
        color: white;
        margin-bottom: 1rem;
        font-size: 1rem;
        font-weight: 600;
        position: relative;
        display: inline-block;
    }
    
    .footer-col h4::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 30px;
        height: 2px;
        background: var(--secondary);
        transition: width 0.3s;
    }
    
    .footer-col:hover h4::after {
        width: 100%;
    }
    
    .footer-col ul {
        list-style: none;
    }
    
    .footer-col ul li {
        margin-bottom: 0.6rem;
    }
    
    .footer-col a {
        color: var(--gray-400);
        text-decoration: none;
        transition: all 0.2s;
    }
    
    .footer-col a:hover {
        color: var(--secondary);
        transform: translateX(5px);
        display: inline-block;
    }
    
    .social-links {
        display: flex;
        gap: 0.8rem;
        margin-top: 1rem;
    }
    
    .social-links a {
        background: rgba(255, 255, 255, 0.1);
        width: 35px;
        height: 35px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
    }
    
    .social-links a:hover {
        background: var(--secondary);
        color: white;
        transform: translateY(-3px) scale(1.1);
    }
    
    .footer-bottom {
        text-align: center;
        padding-top: 2rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 0.8rem;
        transition: opacity 0.3s;
    }
    
    .footer-bottom:hover {
        opacity: 0.8;
    }
    
    @media (max-width: 768px) {
        .footer {
            padding: 3rem 1rem 1.5rem;
        }
        .footer-grid {
            gap: 2rem;
        }
    }
</style>

<script>
    // Smooth scroll for footer anchor links
    document.querySelectorAll('.footer a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
</script>
</body>
</html>