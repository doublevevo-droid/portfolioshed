// ── Firebase Storage helpers ──
let projectsCache = [];
let isFirebaseReady = false;

async function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.db) {
      isFirebaseReady = true;
      resolve();
    } else {
      const checkFirebase = setInterval(() => {
        if (window.db) {
          isFirebaseReady = true;
          clearInterval(checkFirebase);
          resolve();
        }
      }, 100);
    }
  });
}

async function getProjects() {
  if (!isFirebaseReady) await waitForFirebase();

  try {
    if (!window.db) {
      console.warn('Firebase not available, using localStorage fallback');
      return JSON.parse(localStorage.getItem('shed_projects') || '[]');
    }

    const querySnapshot = await window.getDocs(window.collection(window.db, 'projects'));
    const projects = [];
    querySnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date (newest first)
    projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    projectsCache = projects;
    return projects;
  } catch (error) {
    console.error('Error getting projects:', error);
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('shed_projects') || '[]');
  }
}

async function saveProjectToFirebase(project) {
  if (!isFirebaseReady) await waitForFirebase();

  try {
    if (!window.db) return false;

    const docRef = await window.addDoc(window.collection(window.db, 'projects'), {
      ...project,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving project:', error);
    return false;
  }
}

async function updateProjectInFirebase(id, project) {
  if (!isFirebaseReady) await waitForFirebase();

  try {
    if (!window.db) return false;

    const docRef = window.doc(window.db, 'projects', id);
    await window.updateDoc(docRef, project);
    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
}

async function deleteProjectFromFirebase(id) {
  if (!isFirebaseReady) await waitForFirebase();

  try {
    if (!window.db) return false;

    await window.deleteDoc(window.doc(window.db, 'projects', id));
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

// ── Theme ──
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('shed_theme') || 'light';
root.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function updateThemeIcon(theme) {
  if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('shed_theme', next);
    updateThemeIcon(next);
  });
}

// ── Mobile menu ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// ── Scroll Reveal ──
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Modal ──
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
let currentProject = null;

function openModal(project) {
  currentProject = project;
  document.getElementById('modalTitle').textContent = project.name || 'Проект';
  document.getElementById('modalDesc').textContent = project.fullDesc || project.desc || 'Описание отсутствует.';
  document.getElementById('modalPrice').textContent = project.price ? formatPrice(project.price) : 'По запросу';
  document.getElementById('modalTime').textContent = project.time || 'По договорённости';

  const imgContainer = document.getElementById('modalImg');
  if (project.image) {
    imgContainer.innerHTML = `<img src="${project.image}" alt="${project.name}" onerror="this.parentElement.innerHTML='<div class=\\'modal-img-placeholder\\'>🖥️</div>'">`;
  } else {
    imgContainer.innerHTML = `<div class="modal-img-placeholder">🖥️</div>`;
  }

  const goBtn = document.getElementById('modalGoBtn');
  if (project.url) {
    goBtn.style.display = '';
    goBtn.onclick = () => window.open(project.url, '_blank');
  } else {
    goBtn.style.display = 'none';
  }

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  currentProject = null;
}

if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalOverlay) {
  modalOverlay.querySelector('.modal-backdrop').addEventListener('click', closeModal);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Format helpers ──
function formatPrice(price) {
  if (!price) return 'По запросу';
  const n = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return price;
  return n.toLocaleString('ru-RU') + ' ₽';
}

// ── Render Projects ──
async function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  // Show loading state
  grid.innerHTML = '<div class="projects-loading"><div style="font-size:24px;margin-bottom:16px">⏳</div><p>Загрузка проектов...</p></div>';

  try {
    const projects = await getProjects();

    if (projects.length === 0) {
      grid.innerHTML = `<div class="projects-empty"><div style="font-size:48px;margin-bottom:16px;opacity:.3">📁</div><p>Проекты появятся здесь</p></div>`;
      return;
    }

    grid.innerHTML = projects.map((p, i) => `
      <div class="project-card reveal" style="transition-delay:${i * 0.07}s" onclick="openModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        <div class="card-img">
          ${p.image
            ? `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>🖥️</div>'">`
            : `<div class="card-img-placeholder">🖥️</div>`
          }
        </div>
        <div class="card-body">
          <div class="card-title">${p.name || 'Без названия'}</div>
          <div class="card-desc">${p.desc || ''}</div>
          <div class="card-meta">
            <div>
              <div class="card-price">${p.price ? formatPrice(p.price) : 'По запросу'}</div>
              <div class="card-time">⏱ ${p.time || 'Срок не указан'}</div>
            </div>
            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>
    `).join('');

    // re-observe new cards
    grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } catch (error) {
    console.error('Error rendering projects:', error);
    grid.innerHTML = `<div class="projects-empty"><div style="font-size:48px;margin-bottom:16px;opacity:.3">⚠️</div><p>Ошибка загрузки проектов</p></div>`;
  }
}

// ── Contact form ──
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const success = document.getElementById('formSuccess');
    if (success) {
      success.style.display = 'block';
      contactForm.reset();
      setTimeout(() => { success.style.display = 'none'; }, 4000);
    }
  });
}

// ── Init ──
(async function init() {
  await renderProjects();
})();

// Listen for storage updates (when admin changes projects) - fallback for local development
window.addEventListener('storage', e => {
  if (e.key === 'shed_projects') renderProjects();
});
