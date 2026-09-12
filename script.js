document.addEventListener('DOMContentLoaded', () => {
    
    const loader = document.getElementById('loader');
    const app = document.getElementById('app');
    const cover = document.getElementById('cover');
    const coverLeft = document.querySelector('.cover-left');
    const coverRight = document.querySelector('.cover-right');
    const coverBadge = document.querySelector('.cover-center-badge');
    const invitationCard = document.querySelector('.invitation-card');
    const sections = document.querySelectorAll('.section');
    const bgMusic = document.getElementById('bgMusic');
    
    // New Audio Widget
    const audioWidget = document.getElementById('audioPlayerWidget');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    
    let isPlaying = false;

    // Loader Animation
    setTimeout(() => {
        gsap.to(loader, {
            opacity: 0,
            duration: 1,
            onComplete: () => {
                loader.style.display = 'none';
                app.classList.remove('hidden');
                
                // Initial intro animation for the cover
                gsap.from(coverBadge, {
                    scale: 0,
                    opacity: 0,
                    duration: 1.5,
                    ease: "elastic.out(1, 0.5)"
                });
            }
        });
    }, 2500);

    // Audio Control Toggle
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            bgMusic.pause();
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        } else {
            bgMusic.play();
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }
        isPlaying = !isPlaying;
    });

    // Cover Open Animation (The "Wow" Factor)
    cover.addEventListener('click', () => {
        // Play music on first interaction if allowed
        bgMusic.play().then(() => {
            isPlaying = true;
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }).catch(e => console.log("Audio autoplay prevented"));

        // Show audio widget
        audioWidget.classList.add('visible');

        // Hide badge
        gsap.to(coverBadge, {
            scale: 0,
            opacity: 0,
            duration: 0.5,
            ease: "back.in(1.7)"
        });

        // Open doors
        gsap.to(coverLeft, {
            rotationY: -120,
            x: -100,
            opacity: 0,
            duration: 1.5,
            ease: "power3.inOut",
            delay: 0.3
        });

        gsap.to(coverRight, {
            rotationY: 120,
            x: 100,
            opacity: 0,
            duration: 1.5,
            ease: "power3.inOut",
            delay: 0.3,
            onComplete: () => {
                cover.style.display = 'none';
                document.body.style.overflow = 'auto'; // allow scrolling
            }
        });

        // Reveal Inner Card
        gsap.to(invitationCard, {
            opacity: 1,
            y: 0,
            duration: 1.5,
            ease: "power3.out",
            delay: 1
        });

        // Staggered reveal of sections inside the card
        gsap.from(sections, {
            opacity: 0,
            y: 30,
            duration: 1,
            stagger: 0.2,
            ease: "power2.out",
            delay: 1.5
        });

        // Fluid handwriting reveal for the main name
        gsap.from('.main-name', {
            clipPath: "inset(0 100% 0 0)",
            duration: 2,
            ease: "power1.inOut",
            delay: 2.2
        });

    }, { once: true });

    // Countdown Timer logic
    const countDownDate = new Date("Nov 14, 2026 10:00:00").getTime();
    
    const countdownInterval = setInterval(function() {
        const now = new Date().getTime();
        const distance = countDownDate - now;
        
        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById("timer").innerHTML = "<p class='time-number' style='font-size:1.5rem'>¡El gran día ha llegado!</p>";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        document.getElementById("days").innerHTML = days < 10 ? "0" + days : days;
        document.getElementById("hours").innerHTML = hours < 10 ? "0" + hours : hours;
        document.getElementById("minutes").innerHTML = minutes < 10 ? "0" + minutes : minutes;
        document.getElementById("seconds").innerHTML = seconds < 10 ? "0" + seconds : seconds;
        
    }, 1000);

    // Carousel Logic
    window.moveSlide = function(sliderId, n) {
        showSlide(sliderId, getSlideIndex(sliderId) + n);
    };

    window.currentSlide = function(sliderId, n) {
        showSlide(sliderId, n);
    };

    function getSlideIndex(sliderId) {
        const slider = document.getElementById(sliderId);
        const slides = slider.getElementsByClassName('slide');
        for (let i = 0; i < slides.length; i++) {
            if (slides[i].classList.contains('active')) return i;
        }
        return 0;
    }

    function showSlide(sliderId, n) {
        const slider = document.getElementById(sliderId);
        const slides = slider.getElementsByClassName('slide');
        const dotsContainer = document.getElementById(sliderId.replace('slider', 'dots'));
        const dots = dotsContainer.getElementsByClassName('dot');
        
        let index = n;
        if (index >= slides.length) { index = 0; }
        if (index < 0) { index = slides.length - 1; }
        
        for (let i = 0; i < slides.length; i++) {
            slides[i].classList.remove('active');
            dots[i].classList.remove('active');
        }
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
    }

    // Petals animation logic
    function createPetals() {
        const container = document.getElementById('petals-container');
        if (!container) return;
        
        const petalCount = 12; // Just a few for a subtle effect

        for (let i = 0; i < petalCount; i++) {
            let petal = document.createElement('div');
            petal.classList.add('petal');
            container.appendChild(petal);

            let size = Math.random() * 10 + 8; // 8px to 18px
            petal.style.width = size + 'px';
            petal.style.height = size + 'px';
            
            let startX = Math.random() * window.innerWidth;
            let startY = -50 - Math.random() * 200;
            let duration = Math.random() * 6 + 7; // 7 to 13 seconds
            let delay = Math.random() * 8;

            gsap.set(petal, { x: startX, y: startY, rotation: Math.random() * 360 });

            gsap.to(petal, {
                y: window.innerHeight + 100,
                x: startX + (Math.random() * 200 - 100),
                rotation: "+=" + (Math.random() * 360 + 180),
                duration: duration,
                delay: delay,
                ease: "none",
                repeat: -1
            });
        }
    }

    createPetals();

    // Recreate on resize to adjust bounds
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const container = document.getElementById('petals-container');
            if (container) {
                container.innerHTML = '';
                createPetals();
            }
        }, 500);
    });

});
