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

async function loadProjects() {
    try {
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .order('createdAt', { ascending: false }); // Optional sorting

        if (error) throw error;

        state.projects = data || [];
        renderAll();
    } catch (error) {
        console.error('Error loading projects from Supabase:', error);
        showToast('Error loading data.');
    }
}

// function saveProjectsToStorage() { ... } // Removed in favor of direct DB calls

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
async function handleFormSubmit(e) {
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
        name: document.getElementById('projectName').value,
        client: document.getElementById('clientName').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        amount: projectAmount,
        status: document.getElementById('projectStatus').value,
        paymentStatus: paymentStatus,
        paidAmount: paidAmount,
        // createdAt: handled by default in DB or preserved. 
        // If we want to preserve original creation time for edits, we might need to select it, 
        // but for now let's treat it simple.
    };

    // Add createdAt if new
    if (!id) {
        projectData.createdAt = new Date().toISOString();
    }

    try {
        if (id) {
            // Edit existing
            const { error } = await supabaseClient
                .from('projects')
                .update(projectData)
                .eq('id', id);

            if (error) throw error;
            showToast('Project updated successfully!');
        } else {
            // Add new
            // We can let Supabase generate ID (uuid) or keep using our logic if we defined ID column as text.
            // Assuming Supabase ID is primary key. 
            // If the table is auto-increment or uuid default, we don't send ID.

            const { error } = await supabaseClient
                .from('projects')
                .insert([projectData]);

            if (error) throw error;
            showToast('Project added successfully!');
        }

        if (projectData.paymentStatus === 'Paid') {
            generateInvoicePDF(projectData);
            showToast('Project updated and Invoice generated!');
        } else {
            showToast('Project updated successfully!');
        }

        await loadProjects(); // Refresh data
        closeModal();
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Error saving project: ' + error.message);
    }
}

async function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project?')) {
        try {
            const { error } = await supabaseClient
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Project deleted.');
            await loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('Error deleting project.');
        }
        // state update handled by loadProjects
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
        const invoiceBtn = p.paymentStatus === 'Paid'
            ? `<button class="action-btn" onclick="state.projects.find(proj => proj.id === '${p.id}') && generateInvoicePDF(state.projects.find(proj => proj.id === '${p.id}'))" title="Download Invoice"><i data-lucide="file-down"></i></button>`
            : '';

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
                    ${invoiceBtn}
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
        const invoiceBtn = p.paymentStatus === 'Paid'
            ? `<button class="action-btn" onclick="state.projects.find(proj => proj.id === '${p.id}') && generateInvoicePDF(state.projects.find(proj => proj.id === '${p.id}'))" title="Download Invoice"><i data-lucide="file-down"></i></button>`
            : '';

        row.innerHTML = `
            <td><div class="project-name-cell">${p.name}</div></td>
            <td><div class="client-name-cell">${p.client}</div></td>
            <td>${formatCurrency(p.amount)}</td>
            <td><span class="badge badge-${p.paymentStatus.toLowerCase()}">${p.paymentStatus}</span></td>
            <td>${formatCurrency(balance)}</td>
            <td class="actions">
                ${invoiceBtn}
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

async function generateInvoicePDF(project) {
    if (!window.jspdf) {
        showToast('Error: jsPDF library not loaded.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // -- Helper to load image --
    const loadImage = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    // -- Colors --
    const colorPrimary = [128, 0, 128]; // Purple-ish
    const colorText = [40, 40, 40];
    const colorLightText = [100, 100, 100];
    const colorLine = [200, 200, 200];

    // -- Header --
    try {
        const logoData = await loadImage('img/1.png');
        doc.addImage(logoData, 'PNG', 20, 20, 15, 15); // Adjust size as needed
    } catch (err) {
        console.error('Logo load failed', err);
        // Fallback or just ignore
    }

    doc.setFontSize(24);
    doc.setTextColor(...colorPrimary); // Purple
    doc.setFont("helvetica", "bold");
    doc.text('FreeLanceFlow', 40, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colorText);
    doc.text('Project Management', 40, 35);

    // Graphic (Simulated dots top right)
    doc.setTextColor(255, 182, 193); // Pinkish dots
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            doc.text('.', 170 + (i * 3), 25 + (j * 3));
        }
    }

    doc.setFontSize(16);
    doc.setTextColor(...colorText);
    doc.setFont("helvetica", "normal");
    doc.text('INVOICE', 160, 60);

    // -- Content --
    const startY = 80;

    // Billed To
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text('Billed to', 20, startY);

    doc.setFont("helvetica", "normal");
    doc.text(project.client || 'Client Name', 20, startY + 7);
    doc.text('123 Client Address', 20, startY + 12); // Pllaceholder
    doc.text('City, State, Zip', 20, startY + 17); // Placeholder

    // Invoice Info (Right aligned)
    doc.setFont("helvetica", "bold");
    doc.text('Invoice number', 140, startY);
    doc.setFont("helvetica", "normal");
    doc.text(project.id ? '#' + project.id.substring(0, 6).toUpperCase() : '#000001', 140, startY + 7);

    doc.setFont("helvetica", "bold");
    doc.text('Date of issue', 140, startY + 17);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(new Date()), 140, startY + 24);

    // -- Table --
    const tableTop = startY + 40;

    // Line above
    doc.setDrawColor(...colorLine);
    doc.line(20, tableTop, 190, tableTop);

    // Headers
    doc.setFont("helvetica", "bold");
    doc.text('Description', 25, tableTop + 8);
    doc.text('Price', 100, tableTop + 8);
    doc.text('Amount', 160, tableTop + 8);

    // Line below headers
    doc.line(20, tableTop + 12, 190, tableTop + 12);

    // Row 1
    doc.setFont("helvetica", "normal");
    doc.text(`${project.name}`, 25, tableTop + 22);
    doc.text(`Rs. ${project.amount.toLocaleString('en-IN')}`, 100, tableTop + 22);
    doc.text(`Rs. ${project.amount.toLocaleString('en-IN')}`, 160, tableTop + 22);

    // Line below content
    doc.line(20, tableTop + 35, 190, tableTop + 35);

    // -- Total --
    doc.setFont("helvetica", "bold");
    doc.text('Total :', 130, tableTop + 45);
    doc.text(`Rs. ${project.amount.toLocaleString('en-IN')}`, 160, tableTop + 45);

    // -- Footer --
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(8);
    doc.setTextColor(...colorLightText);

    // Bottom Address
    doc.text('Come and join us 2900', 20, pageHeight - 30);
    doc.text('Park Ave. Sacramento,', 20, pageHeight - 26);
    doc.text('CA 95817', 20, pageHeight - 22);

    // Separator
    doc.setDrawColor(255, 69, 0); // Accent color for slashes
    doc.line(75, pageHeight - 30, 80, pageHeight - 20);

    // Contact
    doc.text('For more info please', 85, pageHeight - 28);
    doc.text('call 916-494-3347', 85, pageHeight - 24);

    // Separator
    doc.line(135, pageHeight - 30, 140, pageHeight - 20);

    // Web
    doc.text('itsoftware.com', 145, pageHeight - 28);
    doc.text('info@itsoftware.com', 145, pageHeight - 24);


    // Save
    doc.save(`Invoice_${project.name.replace(/\s+/g, '_')}.pdf`);
}
