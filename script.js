/**
 * FreeLanceFlow - Project Management Tool
 * Core Logic & State Management (Offline Mode via LocalStorage)
 */

// --- State Management ---
let state = {
    projects: [],
    currentView: 'dashboard',
    theme: localStorage.getItem('theme') || 'light'
};

// --- DOM Elements ---
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const mobileClose = document.getElementById('mobileClose');
const themeToggle = document.getElementById('themeToggle');
const projectModal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');
const closeViewAll = document.querySelectorAll('.view-all');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    loadProjects();
    setupEventListeners();
});

function loadProjects() {
    try {
        const storedProjects = localStorage.getItem('freelance_projects');
        if (storedProjects) {
            state.projects = JSON.parse(storedProjects);
        } else {
            state.projects = [];
        }
        renderAll();
    } catch (error) {
        console.error('Error loading projects from LocalStorage:', error);
        showToast('Error loading data.');
    }
}

function saveProjectsToStorage() {
    localStorage.setItem('freelance_projects', JSON.stringify(state.projects));
    renderAll();
}

function setupEventListeners() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            switchView(viewId);
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('active');
            }
        });
    });

    closeViewAll.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.getAttribute('data-view'));
        });
    });

    // Sidebar toggles
    menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    mobileClose.addEventListener('click', () => sidebar.classList.remove('active'));

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Modal controls
    document.getElementById('addProjectBtn').addEventListener('click', () => openModal());
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === projectModal) closeModal();
    });

    // Form submission
    projectForm.addEventListener('submit', handleFormSubmit);

    // Payment status change listener
    document.getElementById('paymentStatus').addEventListener('change', (e) => {
        const container = document.getElementById('partialPaidContainer');
        if (e.target.value === 'Partial') {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });

    // Filter controls
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderProjectsList(btn.getAttribute('data-filter'));
        });
    });

    // Export Data
    document.getElementById('exportData').addEventListener('click', exportToExcel);

    // Search
    document.querySelector('.search-bar input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (state.currentView === 'projects') {
            renderProjectsList('all', query);
        }
    });
}

// --- View Logic ---
function switchView(viewId) {
    state.currentView = viewId;
    views.forEach(view => {
        view.classList.remove('active');
        if (view.id === `${viewId}View`) {
            view.classList.add('active');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-view') === viewId) {
            link.classList.add('active');
        }
    });

    renderAll();
}

// --- Theme Logic ---
function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

function applyTheme() {
    document.body.setAttribute('data-theme', state.theme);
}

// --- CRUD Operations ---
function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('projectId').value; // String ID
    
    // Construct new project object
    const paymentStatus = document.getElementById('paymentStatus').value;
    const projectAmount = parseFloat(document.getElementById('projectAmount').value) || 0;
    
    let paidAmount = 0;
    if (paymentStatus === 'Paid') {
        paidAmount = projectAmount;
    } else if (paymentStatus === 'Partial') {
        paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
    }
    // If Unpaid, paidAmount stays 0

    const projectData = {
        id: id || Date.now().toString(),
        name: document.getElementById('projectName').value,
        client: document.getElementById('clientName').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        amount: projectAmount,
        status: document.getElementById('projectStatus').value,
        paymentStatus: paymentStatus,
        paidAmount: paidAmount,
        createdAt: id ? (state.projects.find(p => p.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (id) {
        // Edit existing
        const index = state.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            state.projects[index] = projectData;
            showToast('Project updated successfully!');
        } else {
            showToast('Error: Project not found.');
        }
    } else {
        // Add new
        state.projects.push(projectData);
        showToast('Project added successfully!');
    }

    saveProjectsToStorage();
    closeModal();
}

function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project?')) {
        state.projects = state.projects.filter(p => p.id !== id);
        saveProjectsToStorage();
        showToast('Project deleted.');
    }
}

function editProject(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;

    document.getElementById('modalTitle').textContent = 'Edit Project';
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('clientName').value = project.client;
    document.getElementById('startDate').value = project.startDate;
    document.getElementById('endDate').value = project.endDate;
    document.getElementById('projectAmount').value = project.amount;
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('paymentStatus').value = project.paymentStatus; // Should trigger logic if listener was already set, but we set values manually below loops usually

    const partialContainer = document.getElementById('partialPaidContainer');
    if (project.paymentStatus === 'Partial') {
        partialContainer.classList.remove('hidden');
        document.getElementById('paidAmount').value = project.paidAmount;
    } else {
        partialContainer.classList.add('hidden');
    }

    projectModal.classList.add('active');
}

// --- Rendering Logic ---
function renderAll() {
    renderDashboard();
    renderProjectsList();
    renderPayments();
    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderDashboard() {
    const total = state.projects.length;
    const ongoing = state.projects.filter(p => p.status === 'In Progress').length;
    const completed = state.projects.filter(p => p.status === 'Completed').length;

    const pendingPaymentTotal = state.projects.reduce((sum, p) => {
        const balance = p.amount - (p.paidAmount || 0);
        return sum + balance;
    }, 0);

    document.getElementById('statTotalProjects').textContent = total;
    document.getElementById('statOngoingProjects').textContent = ongoing;
    document.getElementById('statCompletedProjects').textContent = completed;
    document.getElementById('statPendingPayments').textContent = formatCurrency(pendingPaymentTotal);

    // Recent list (sort by newest first)
    // We sort a copy to not mutate state order if not desired, though usually acceptable
    const sortedProjects = [...state.projects].sort((a, b) => {
        // Sort by createdAt descending if available, else just reverse index roughly
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const recentList = document.getElementById('recentProjects');
    recentList.innerHTML = '';

    sortedProjects.slice(0, 5).forEach(p => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.innerHTML = `
            <div class="recent-info">
                <div class="project-name-cell">${p.name}</div>
                <div class="client-name-cell">${p.client}</div>
            </div>
            <span class="badge badge-${p.status.toLowerCase().replace(' ', '')}">${p.status}</span>
        `;
        recentList.appendChild(div);
    });

    // Status Summary (Bars)
    const summary = document.getElementById('statusSummary');
    const statusCounts = {
        'Pending': state.projects.filter(p => p.status === 'Pending').length,
        'In Progress': ongoing,
        'Completed': completed
    };

    summary.innerHTML = '';
    ['Pending', 'In Progress', 'Completed'].forEach(status => {
        const count = statusCounts[status];
        const percent = total > 0 ? (count / total) * 100 : 0;
        const color = status === 'Pending' ? 'var(--color-pending)' : (status === 'In Progress' ? 'var(--color-inprogress)' : 'var(--color-completed)');

        summary.innerHTML += `
            <div class="status-bar-item">
                <div class="status-info">
                    <span>${status}</span>
                    <span>${count} (${Math.round(percent)}%)</span>
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${percent}%; background-color: ${color}"></div>
                </div>
            </div>
        `;
    });
}

function renderProjectsList(filter = 'all', search = '') {
    const tableBody = document.getElementById('projectsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Sort logic can be unified, but for now just use state order (insertion order) or sorted
    let filtered = [...state.projects];

    if (filter !== 'all') {
        filtered = filtered.filter(p => p.status === filter);
    }
    if (search) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.client.toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableBody.innerHTML = '';

    filtered.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="project-name-cell">${p.name}</div>
            </td>
            <td>
                <div class="client-name-cell">${p.client}</div>
            </td>
            <td>${formatDate(p.startDate)} - ${formatDate(p.endDate)}</td>
            <td>${formatCurrency(p.amount)}</td>
            <td>
                <span class="badge badge-${p.status.toLowerCase().replace(' ', '')}">${p.status}</span>
            </td>
            <td>
                <span class="badge badge-${p.paymentStatus.toLowerCase()}">${p.paymentStatus}</span>
            </td>
            <td class="actions">
                <div class="actions-cell">
                    <button class="action-btn" onclick="editProject('${p.id}')" title="Edit"><i data-lucide="edit-2"></i></button>
                    <button class="action-btn delete" onclick="deleteProject('${p.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderPayments() {
    const tableBody = document.getElementById('paymentsTableBody');
    const totalEarnedEl = document.getElementById('totalEarned');
    const totalPendingEl = document.getElementById('totalPendingAmount');

    let totalEarned = 0;
    let totalPending = 0;

    tableBody.innerHTML = '';

    state.projects.forEach(p => {
        const balance = p.amount - (p.paidAmount || 0);
        totalEarned += (p.paidAmount || 0);
        totalPending += balance;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="project-name-cell">${p.name}</div></td>
            <td><div class="client-name-cell">${p.client}</div></td>
            <td>${formatCurrency(p.amount)}</td>
            <td><span class="badge badge-${p.paymentStatus.toLowerCase()}">${p.paymentStatus}</span></td>
            <td>${formatCurrency(balance)}</td>
            <td class="actions">
                <button class="action-btn" onclick="editProject('${p.id}')" title="Update Payment"><i data-lucide="indian-rupee"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    totalEarnedEl.textContent = formatCurrency(totalEarned);
    totalPendingEl.textContent = formatCurrency(totalPending);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- Helpers ---
function openModal() {
    document.getElementById('modalTitle').textContent = 'Add New Project';
    document.getElementById('projectId').value = '';
    projectForm.reset();
    document.getElementById('partialPaidContainer').classList.add('hidden');
    projectModal.classList.add('active');
}

function closeModal() {
    projectModal.classList.remove('active');
}

function formatCurrency(amt) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

function exportToExcel() {
    if (state.projects.length === 0) {
        showToast('No projects to export!');
        return;
    }

    const headers = ['Project Name', 'Client', 'Start Date', 'End Date', 'Amount (₹)', 'Status', 'Payment Status', 'Paid Amount (₹)'];
    const rows = state.projects.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.client.replace(/"/g, '""')}"`,
        p.startDate,
        p.endDate,
        p.amount,
        p.status,
        p.paymentStatus,
        p.paidAmount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'freelance_projects.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Excel/CSV exported successfully!');
}
