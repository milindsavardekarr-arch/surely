<?php
// Surely SaaS Platform - Header Component with Animations
session_start();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="description" content="AI-powered WhatsApp engagement platform for growing businesses. Automate customer relationships with smart follow-ups and lead insights.">
    <meta name="keywords" content="WhatsApp API, AI chatbot, customer engagement, lead management">
    <meta name="author" content="Surely SaaS">
    <title>Surely | AI WhatsApp Engagement Platform</title>
    <link rel="icon" type="image/png" href="surely-favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #075E54;
            --primary-dark: #054a3a;
            --primary-light: #128C7E;
            --secondary: #25D366;
            --secondary-dark: #20b859;
            --accent: #34B7F1;
            --dark: #1a1a2e;
            --gray-50: #fafafa;
            --gray-100: #f5f5f5;
            --gray-200: #e5e5e5;
            --gray-300: #d4d4d4;
            --gray-400: #a3a3a3;
            --gray-500: #737373;
            --gray-600: #525252;
            --gray-700: #404040;
            --gray-800: #262626;
            --gray-900: #171717;
            --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
            --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
            --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
            --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);
            --shadow-2xl: 0 25px 50px -12px rgba(0,0,0,0.25);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            color: var(--gray-800);
            overflow-x: hidden;
            scroll-behavior: smooth;
        }

        /* Background Pattern - Visible Check/Grid Pattern */
        .bg-pattern {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background-image: 
                linear-gradient(rgba(37, 211, 102, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(37, 211, 102, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
        }
        
        /* Dot Pattern Overlay */
        .dot-pattern {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background-image: radial-gradient(rgba(7, 94, 84, 0.08) 1px, transparent 1px);
            background-size: 30px 30px;
            pointer-events: none;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--gray-100); }
        ::-webkit-scrollbar-thumb { background: var(--primary-light); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--primary); }

        /* Animations */
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

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideInLeft {
            from {
                opacity: 0;
                transform: translateX(-50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
        }

        @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        @keyframes glow {
            0% { box-shadow: 0 0 5px rgba(37,211,102,0.2); }
            100% { box-shadow: 0 0 30px rgba(37,211,102,0.5); }
        }
        
        @keyframes rotateSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        @keyframes wave {
            0%, 100% { transform: translateY(0); }
            25% { transform: translateY(-5px); }
            75% { transform: translateY(5px); }
        }

        .animate-fade-up {
            animation: fadeInUp 0.6s ease forwards;
        }

        .animate-fade {
            animation: fadeIn 0.5s ease forwards;
        }

        .animate-slide-left {
            animation: slideInLeft 0.6s ease forwards;
        }

        .animate-slide-right {
            animation: slideInRight 0.6s ease forwards;
        }

        .animate-float {
            animation: float 4s ease-in-out infinite;
        }

        .animate-pulse {
            animation: pulse 2s ease-in-out infinite;
        }

        .animate-bounce {
            animation: bounce 1s ease-in-out infinite;
        }

        .animate-glow {
            animation: glow 1.5s ease-in-out infinite alternate;
        }

        /* Navigation */
        .navbar {
            position: fixed;
            top: 0;
            width: 100%;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            box-shadow: var(--shadow-sm);
            z-index: 1000;
            padding: 1rem 0;
            transition: all 0.3s;
        }

        .navbar.scrolled {
            padding: 0.7rem 0;
            background: rgba(255, 255, 255, 0.98);
            box-shadow: var(--shadow-md);
        }

        .nav-container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            transition: transform 0.2s;
        }

        .logo:hover {
            transform: scale(1.02);
        }

        .logo-img {
            height: 38px;
            width: auto;
        }

        .logo-text {
            font-size: 1.4rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .nav-menu {
            display: flex;
            gap: 2.5rem;
            align-items: center;
        }

        .nav-link {
            text-decoration: none;
            color: var(--gray-600);
            font-weight: 500;
            transition: all 0.2s;
            position: relative;
        }

        .nav-link::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            transition: width 0.3s;
        }

        .nav-link:hover {
            color: var(--primary);
        }

        .nav-link:hover::after {
            width: 100%;
        }

        .btn-demo-nav {
            background: linear-gradient(135deg, var(--secondary), var(--secondary-dark));
            color: white;
            padding: 0.5rem 1.2rem;
            border-radius: 2rem;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
            position: relative;
            overflow: hidden;
        }

        .btn-demo-nav::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }

        .btn-demo-nav:hover::before {
            left: 100%;
        }

        .btn-demo-nav:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        .menu-toggle {
            display: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--primary);
            transition: transform 0.2s;
        }

        .menu-toggle:hover {
            transform: scale(1.1);
        }

        /* Responsive */
        @media (max-width: 968px) {
            .menu-toggle {
                display: block;
            }
            .nav-menu {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                flex-direction: column;
                padding: 1.5rem;
                gap: 1rem;
                box-shadow: var(--shadow-md);
                animation: fadeIn 0.3s ease;
            }
            .nav-menu.active {
                display: flex;
            }
            .nav-link::after {
                display: none;
            }
        }

        @media (max-width: 640px) {
            .nav-container {
                padding: 0 1rem;
            }
        }
    </style>
</head>
<body>

<!-- Background Patterns - Visible Check/Grid -->
<div class="bg-pattern"></div>
<div class="dot-pattern"></div>

<!-- Navigation -->
<nav class="navbar" id="navbar">
    <div class="nav-container">
        <a href="index.php" class="logo">
            <img src="surely-logo.png" alt="Surely" class="logo-img">
            <!-- <span class="logo-text">Surely</span> -->
        </a>
        <div class="menu-toggle" id="menuToggle">
            <i class="fas fa-bars"></i>
        </div>
        <div class="nav-menu" id="navMenu">
            <a href="#features" class="nav-link">Features</a>
            <a href="#pricing" class="nav-link">Pricing</a>
            <a href="#demo" class="nav-link">Demo</a>
            <a href="#demo" class="btn-demo-nav">Book Demo →</a>
        </div>
    </div>
</nav>

<script>
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Close mobile menu on link click
    document.querySelectorAll('.nav-link, .btn-demo-nav').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
</script>