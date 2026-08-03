/* =============================================
   信阳市第五高级中学 - 前端交互逻辑
   ============================================= */

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// Mobile menu
navToggle && navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Smooth scroll nav links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    navLinks.classList.remove('open');
    navbar.classList.add('scrolled');
    const offset = 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });

    // Active link
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    a.classList.add('active');
  });
});

// Highlight nav on scroll
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 100;
    if (window.scrollY >= top) current = sec.getAttribute('id');
  });
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
});

// ---- Announcements / News ----
const newsList = document.getElementById('newsList');
const filterBtns = document.querySelectorAll('.filter-btn');

const API_BASE = '/api'; // Cloudflare Workers proxy

// Format date
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { day, month: months[d.getMonth()] };
}

// Render news card
function renderCard(item) {
  const { day, month } = formatDate(item.created_at);
  return `
    <article class="news-card" data-id="${item.id}" data-category="${item.category}">
      <div class="news-card-meta">
        <div class="news-date-day">${day}</div>
        <div class="news-date-month">${month}</div>
      </div>
      <div class="news-card-content">
        <span class="news-card-category ${item.category}">${item.category}</span>
        <h3 class="news-card-title">${escapeHtml(item.title)}</h3>
        <p class="news-card-excerpt">${escapeHtml(item.content || '')}</p>
      </div>
      <div class="news-card-arrow">→</div>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Render all
function renderNews(items) {
  if (!items || items.length === 0) {
    newsList.innerHTML = `
      <div class="news-empty">
        <div class="news-empty-icon">📭</div>
        <p>暂无公告</p>
      </div>`;
    return;
  }
  newsList.innerHTML = items.map(renderCard).join('');

  // Click to expand
  newsList.querySelectorAll('.news-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = items.find(i => i.id === id);
      if (!item) return;
      const { day, month } = formatDate(item.created_at);
      newsList.innerHTML = `
        <div class="news-detail">
          <button class="back-btn" onclick="loadNews(currentFilter)">← 返回列表</button>
          <div class="news-detail-header">
            <span class="news-card-category ${item.category}">${item.category}</span>
            <div class="news-detail-date">${day} ${month}</div>
          </div>
          <h2 class="news-detail-title">${escapeHtml(item.title)}</h2>
          <div class="news-detail-body">${escapeHtml(item.content || '（无详细内容）').replace(/\n/g, '<br>')}</div>
        </div>`;
      window.scrollTo({ top: newsList.offsetTop - 90, behavior: 'smooth' });
    });
  });
}

let currentFilter = 'all';

async function loadNews(filter = 'all') {
  currentFilter = filter;
  newsList.innerHTML = `
    <div class="news-loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>`;

  try {
    const url = filter === 'all'
      ? `${API_BASE}/announcements`
      : `${API_BASE}/announcements?category=${encodeURIComponent(filter)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // 倒序，最新的在前
    const sorted = (data.result || data || []).sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
    renderNews(sorted);
  } catch (err) {
    console.error('加载公告失败:', err);
    newsList.innerHTML = `
      <div class="news-empty">
        <div class="news-empty-icon">⚠️</div>
        <p>加载失败，请稍后重试</p>
        <small style="color:var(--text-light);font-size:0.8rem">${err.message}</small>
      </div>`;
  }
}

// Filter buttons
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadNews(btn.dataset.filter);
  });
});

// Init
loadNews();

// ---- Entrance animations (Intersection Observer) ----
const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.about-card, .honor-item, .feature-card, .stat-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

// Add animate-in style
const style = document.createElement('style');
style.textContent = `
.animate-in { opacity: 1 !important; transform: translateY(0) !important; }
`;
document.head.appendChild(style);
