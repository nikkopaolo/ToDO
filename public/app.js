// Task class to manage individual tasks
class Task {
    constructor(text, dueDate = null, url = '', client = '', priority = 'medium', notes = '') {
        this.id = Date.now().toString();
        this.text = text;
        
        // Fix date handling for new tasks
        if (!dueDate) {
            const today = new Date();
            dueDate = today.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local timezone
        }
        this.dueDate = dueDate;
        
        this.url = url ? (url.startsWith('http') ? url : `https://${url}`) : '';
        this.client = client;
        this.priority = priority;
        this.notes = notes;
        this.completed = false;
        this.createdAt = new Date().toISOString();
        this.completedAt = null;
        this.subtasks = [];
        this.history = [{
            timestamp: new Date().toISOString(),
            action: 'created',
            details: 'Task created'
        }];
    }

    toggleComplete() {
        this.completed = !this.completed;
        this.completedAt = this.completed ? new Date().toISOString() : null;
        this.addHistory(this.completed ? 'completed' : 'uncompleted', 
            `Task ${this.completed ? 'marked as complete' : 'marked as incomplete'}`);
    }

    update(updates) {
        const changes = [];
        for (const [key, value] of Object.entries(updates)) {
            if (this[key] !== value) {
                changes.push(`${key}: ${this[key]} → ${value}`);
                this[key] = value;
            }
        }
        if (changes.length > 0) {
            this.addHistory('modified', `Changes: ${changes.join(', ')}`);
        }
    }

    addSubtask(text) {
        const subtask = {
            id: Date.now().toString(),
            text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.subtasks.push(subtask);
        this.addHistory('subtask-added', `Added subtask: ${text}`);
        return subtask;
    }

    toggleSubtask(subtaskId) {
        const subtask = this.subtasks.find(st => st.id === subtaskId);
        if (subtask) {
            subtask.completed = !subtask.completed;
            this.addHistory('subtask-toggled', 
                `Subtask "${subtask.text}" ${subtask.completed ? 'completed' : 'uncompleted'}`);
        }
    }

    addHistory(action, details) {
        this.history.push({
            timestamp: new Date().toISOString(),
            action,
            details
        });
    }

    toExcel() {
        return {
            'Task ID': this.id,
            'Text': this.text,
            'Due Date': this.dueDate,
            'URL': this.url,
            'Client': this.client,
            'Priority': this.priority,
            'Notes': this.notes,
            'Status': this.completed ? 'Completed' : 'Active',
            'Created At': this.createdAt,
            'Subtasks': this.subtasks.map(st => st.text).join('; '),
            'Subtasks Status': this.subtasks.map(st => 
                `${st.text}: ${st.completed ? 'Completed' : 'Active'}`).join('; ')
        };
    }
}

// TaskManager class to handle all task operations
class TaskManager {
    constructor() {
        this.loadFromLocalStorage();
        this.currentDate = new Date();
        this.selectedDate = null;
        this.setupEventListeners();
        this.setupTheme();
        this.setupCollapsibleSections();
        this.renderCalendar();
        this.renderTasks();
        this.renderClients();
        this.updateStats();
        this.initializeChart();
    }

    loadFromLocalStorage() {
        try {
            // Load and convert tasks
            const savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];
            this.tasks = savedTasks.map(taskData => {
                const task = new Task(taskData.text);
                return Object.assign(task, taskData);
            });

            // Load clients
            this.clients = JSON.parse(localStorage.getItem('clients')) || [];
        } catch (error) {
            console.error('Error loading data:', error);
            this.tasks = [];
            this.clients = [];
        }
    }

    setupTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', theme);
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    setupCollapsibleSections() {
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            const targetId = btn.dataset.target;
            const savedState = localStorage.getItem(`section-${targetId}`);
            const content = document.getElementById(targetId);
            
            if (savedState === 'collapsed') {
                content.style.display = 'none';
                btn.querySelector('i').classList.replace('fa-chevron-up', 'fa-chevron-down');
            }

            btn.addEventListener('click', () => {
                const isCollapsed = content.style.display === 'none';
                content.style.display = isCollapsed ? 'block' : 'none';
                btn.querySelector('i').classList.replace(
                    isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up',
                    isCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'
                );
                localStorage.setItem(`section-${targetId}`, isCollapsed ? 'expanded' : 'collapsed');
            });
        });
    }

    setupEventListeners() {
        // Task Management
        document.getElementById('add-task')?.addEventListener('click', () => this.addTask());
        document.getElementById('new-task')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        document.getElementById('search')?.addEventListener('input', () => this.filterTasks());
        document.getElementById('sort-select')?.addEventListener('change', () => this.renderTasks());
        
        // Import/Export
        document.getElementById('import-btn')?.addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importFromExcel(file);
                e.target.value = ''; // Reset file input
            }
        });
        
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportToExcel();
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterTasks();
            });
        });

        // Client Management
        document.getElementById('add-client')?.addEventListener('click', () => {
            const clientName = prompt('Enter client name:');
            if (clientName && !this.clients.includes(clientName)) {
                this.addClient(clientName);
            }
        });

        // Calendar Navigation
        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('next-month')?.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Statistics
        document.getElementById('active-tasks-count')?.addEventListener('click', () => this.filterByStatus('active'));
        document.getElementById('completed-today')?.addEventListener('click', () => this.filterByStatus('completed-today'));
        document.getElementById('due-today')?.addEventListener('click', () => this.filterByStatus('due-today'));
    }

    filterTasks() {
        this.renderTasks();
    }

    getFilteredTasks() {
        let tasks = [...this.tasks];
        const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        
        // Search filter
        if (searchTerm) {
            tasks = tasks.filter(task => 
                task.text.toLowerCase().includes(searchTerm) ||
                task.client.toLowerCase().includes(searchTerm) ||
                task.notes.toLowerCase().includes(searchTerm)
            );
        }

        // Status filter
        switch (activeFilter) {
            case 'active':
                tasks = tasks.filter(task => !task.completed);
                break;
            case 'completed':
                tasks = tasks.filter(task => task.completed);
                break;
        }

        // Date filter
        if (this.selectedDate) {
            const selectedDate = new Date(this.selectedDate);
            selectedDate.setHours(0, 0, 0, 0);
            tasks = tasks.filter(task => {
                const taskDate = new Date(task.dueDate);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === selectedDate.getTime();
            });
        }

        return tasks;
    }

    renderTasks() {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;

        tasksList.innerHTML = '';
        const filteredTasks = this.getFilteredTasks();
        const sortedTasks = this.sortTasks(filteredTasks);

        sortedTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''} priority-${task.priority}`;
            li.dataset.taskId = task.id;
            li.dataset.editing = 'false';

            const taskContent = `
                <div class="task-creation-time">Created: ${new Date(task.createdAt).toLocaleString()}</div>
                <div class="task-header">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                    <div class="task-content ${task.completed ? 'completed' : ''}">
                        <span class="task-text">${task.text}</span>
                        ${task.url ? `<a href="${task.url}" target="_blank" class="task-url">${task.url}</a>` : ''}
                    </div>
                </div>
                <div class="task-info">
                    <span class="task-client">${task.client || 'No Client'}</span>
                    <span class="task-date">${task.dueDate}</span>
                    <span class="task-priority">${task.priority}</span>
                </div>
                ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
                ${this.renderSubtasks(task)}
                <div class="task-actions">
                    <button class="edit-task-btn" title="Edit Task"><i class="fas fa-edit"></i></button>
                    <button class="add-subtask-btn" title="Add Subtask"><i class="fas fa-tasks"></i></button>
                    <button class="view-history-btn" title="View History"><i class="fas fa-history"></i></button>
                    <button class="delete-task-btn" title="Delete Task"><i class="fas fa-trash"></i></button>
                </div>
                <div class="task-edit-form" style="display: none;">
                    <div class="edit-group">
                        <input type="text" class="task-text-edit" value="${task.text}">
                        <input type="url" class="task-url-edit" value="${task.url}" placeholder="Add URL">
                    </div>
                    <div class="edit-group">
                        <select class="task-client-edit">
                            <option value="">No Client</option>
                            ${this.clients.map(c => `<option value="${c}" ${task.client === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        <input type="date" class="task-date-edit" value="${task.dueDate}">
                        <select class="task-priority-edit">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <textarea class="task-notes-edit" placeholder="Add notes">${task.notes}</textarea>
                    <div class="edit-actions">
                        <button class="save-edit-btn">Save</button>
                        <button class="cancel-edit-btn">Cancel</button>
                    </div>
                </div>
                <div class="task-history" style="display: none;">
                    <h4>Task History</h4>
                    <ul>
                        ${task.history.map(h => `
                            <li>
                                <span class="history-time">${new Date(h.timestamp).toLocaleString()}</span>
                                <span class="history-action">${h.action}</span>
                                <span class="history-details">${h.details}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;

            li.innerHTML = taskContent;
            this.setupTaskEventListeners(li, task);
            tasksList.appendChild(li);
        });

        this.updateClientSelect();
    }

    renderSubtasks(task) {
        return `
            <div class="subtasks-container">
                <ul class="subtasks-list">
                    ${task.subtasks.map(subtask => `
                        <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
                            <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
                            <input type="text" class="subtask-text-edit" value="${subtask.text}">
                            <input type="url" class="subtask-url-edit" value="${subtask.url || ''}" placeholder="Add URL">
                            <button class="delete-subtask-btn"><i class="fas fa-times"></i></button>
                        </li>
                    `).join('')}
                </ul>
                <div class="add-subtask-form" style="display: none;">
                    <input type="text" class="new-subtask-input" placeholder="New subtask...">
                    <input type="url" class="new-subtask-url" placeholder="Subtask URL (optional)">
                    <button class="submit-subtask-btn" type="button"><i class="fas fa-plus"></i></button>
                </div>
            </div>
        `;
    }

    setupTaskEventListeners(taskElement, task) {
        // Task completion
        taskElement.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
            task.toggleComplete();
            taskElement.classList.toggle('completed');
            taskElement.querySelector('.task-content').classList.toggle('completed');
            this.saveTasks();
            this.updateStats();
            this.updateChart();
            
            // Store and update client views
            const activeClientViews = Array.from(document.querySelectorAll('.client-tasks-view.active'))
                .map(view => view.id);
            this.updateClientViews(activeClientViews);
        });

        // Edit button
        taskElement.querySelector('.edit-task-btn').addEventListener('click', () => {
            taskElement.dataset.editing = 'true';
            taskElement.querySelector('.task-edit-form').style.display = 'block';
        });

        // Cancel edit
        taskElement.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            taskElement.dataset.editing = 'false';
            taskElement.querySelector('.task-edit-form').style.display = 'none';
        });

        // Save edit
        taskElement.querySelector('.save-edit-btn').addEventListener('click', () => {
            const updates = {
                text: taskElement.querySelector('.task-text-edit').value,
                url: taskElement.querySelector('.task-url-edit').value,
                client: taskElement.querySelector('.task-client-edit').value,
                dueDate: taskElement.querySelector('.task-date-edit').value,
                priority: taskElement.querySelector('.task-priority-edit').value,
                notes: taskElement.querySelector('.task-notes-edit').value
            };
            
            task.update(updates);
            this.saveTasks();
            
            // Update display
            taskElement.querySelector('.task-text').textContent = updates.text;
            taskElement.querySelector('.task-client').textContent = updates.client || 'No Client';
            taskElement.querySelector('.task-date').textContent = updates.dueDate;
            taskElement.querySelector('.task-priority').textContent = updates.priority;
            if (updates.notes) {
                taskElement.querySelector('.task-notes').textContent = updates.notes;
            }
            
            // Hide edit form
            taskElement.dataset.editing = 'false';
            taskElement.querySelector('.task-edit-form').style.display = 'none';
            
            // Update all views
            this.renderCalendar();
            this.updateStats();
            const activeClientViews = Array.from(document.querySelectorAll('.client-tasks-view.active'))
                .map(view => view.id);
            this.updateClientViews(activeClientViews);
        });

        // Subtask management
        taskElement.querySelectorAll('.subtask-item').forEach(subtaskElement => {
            const subtaskId = subtaskElement.dataset.subtaskId;
            const subtask = task.subtasks.find(st => st.id === subtaskId);

            // Toggle subtask completion
            subtaskElement.querySelector('input[type="checkbox"]').addEventListener('change', () => {
                task.toggleSubtask(subtaskId);
                this.saveTasks();
                subtaskElement.classList.toggle('completed');
            });

            // Save subtask changes
            subtaskElement.querySelector('.subtask-text-edit').addEventListener('change', (e) => {
                subtask.text = e.target.value;
                this.saveTasks();
            });

            subtaskElement.querySelector('.subtask-url-edit').addEventListener('change', (e) => {
                subtask.url = e.target.value;
                this.saveTasks();
            });

            // Delete subtask
            subtaskElement.querySelector('.delete-subtask-btn').addEventListener('click', () => {
                task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
                this.saveTasks();
                subtaskElement.remove();
            });
        });

        // Add new subtask button in task actions
        taskElement.querySelector('.add-subtask-btn').addEventListener('click', () => {
            const subtaskForm = taskElement.querySelector('.add-subtask-form');
            if (subtaskForm) {
                subtaskForm.style.display = subtaskForm.style.display === 'none' ? 'grid' : 'none';
            }
        });

        // Add new subtask form submit
        const addSubtaskForm = taskElement.querySelector('.add-subtask-form');
        if (addSubtaskForm) {
            const submitSubtaskBtn = addSubtaskForm.querySelector('.submit-subtask-btn');
            if (submitSubtaskBtn) {
                submitSubtaskBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const textInput = addSubtaskForm.querySelector('.new-subtask-input');
                    const urlInput = addSubtaskForm.querySelector('.new-subtask-url');
                    
                    if (textInput && textInput.value.trim()) {
                        const subtask = task.addSubtask(textInput.value.trim());
                        if (urlInput && urlInput.value.trim()) {
                            subtask.url = urlInput.value.trim();
                        }
                        this.saveTasks();
                        
                        // Clear inputs
                        textInput.value = '';
                        if (urlInput) urlInput.value = '';
                        
                        // Hide the form
                        addSubtaskForm.style.display = 'none';
                        
                        // Refresh the subtasks list
                        const subtasksContainer = taskElement.querySelector('.subtasks-container');
                        if (subtasksContainer) {
                            subtasksContainer.innerHTML = this.renderSubtasks(task);
                            this.setupTaskEventListeners(taskElement, task);
                        }
                    }
                });
            }
        }

        // View history
        taskElement.querySelector('.view-history-btn').addEventListener('click', () => {
            const historyDiv = taskElement.querySelector('.task-history');
            historyDiv.style.display = historyDiv.style.display === 'none' ? 'block' : 'none';
        });

        // Delete task
        taskElement.querySelector('.delete-task-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this task?')) {
                const activeClientViews = Array.from(document.querySelectorAll('.client-tasks-view.active'))
                    .map(view => view.id);
                
                this.tasks = this.tasks.filter(t => t.id !== task.id);
                this.saveTasks();
                taskElement.remove();
                
                this.updateStats();
                this.renderCalendar();
                this.updateChart();
                this.updateClientViews(activeClientViews);
            }
        });
    }

    // Helper method to update client views
    updateClientViews(activeClientViews) {
        this.clients.forEach(client => {
            const clientId = `client-tasks-${client.replace(/\s+/g, '-')}`;
            const clientView = document.getElementById(clientId);
            if (clientView && activeClientViews.includes(clientId)) {
                const taskTree = clientView.querySelector('.task-tree');
                taskTree.innerHTML = this.renderClientTaskTree(client);
                this.setupClientTaskListeners(clientView, client);
                clientView.classList.add('active');
                
                const calendarContainer = clientView.querySelector('.client-calendar-container');
                if (calendarContainer) {
                    this.renderClientCalendar(client, calendarContainer);
                }
            }
        });
    }

    sortTasks(tasks) {
        const sortValue = document.getElementById('sort-select').value;
        const [field, direction] = sortValue.split('-');

        return tasks.sort((a, b) => {
            let comparison = 0;
            switch (field) {
                case 'createdAt':
                    comparison = new Date(a.createdAt) - new Date(b.createdAt);
                    break;
                case 'dueDate':
                    comparison = new Date(a.dueDate) - new Date(b.dueDate);
                    break;
                case 'priority':
                    const priorities = { low: 1, medium: 2, high: 3 };
                    comparison = priorities[a.priority] - priorities[b.priority];
                    break;
            }
            return direction === 'asc' ? comparison : -comparison;
        });
    }

    getLocalDateString(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
            .toISOString()
            .split('T')[0];
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        const currentMonthElement = document.getElementById('current-month');
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        currentMonthElement.textContent = new Date(year, month).toLocaleString('default', { 
            month: 'long', 
            year: 'numeric' 
        });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        // Get today's date string in local timezone
        const todayStr = this.getLocalDateString(new Date());

        let calendarHTML = `
            <div class="weekdays">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    .map(day => `<div class="weekday">${day}</div>`).join('')}
            </div>
            <div class="days">
        `;

        // Empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            calendarHTML += '<div class="day empty"></div>';
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateStr = this.getLocalDateString(currentDate);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.selectedDate;
            
            const tasksForDay = this.tasks.filter(task => task.dueDate === dateStr);
            const hasActiveTasks = tasksForDay.some(task => !task.completed);
            const hasCompletedTasks = tasksForDay.some(task => task.completed);

            calendarHTML += `
                <div class="day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                     data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${hasActiveTasks ? '<span class="task-indicator active"></span>' : ''}
                    ${hasCompletedTasks ? '<span class="task-indicator completed"></span>' : ''}
                </div>
            `;
        }

        calendarHTML += '</div>';
        calendar.innerHTML = calendarHTML;

        // Add click event listeners to days
        calendar.querySelectorAll('.day:not(.empty)').forEach(dayElement => {
            dayElement.addEventListener('click', () => {
                const clickedDate = dayElement.dataset.date;
                this.selectedDate = this.selectedDate === clickedDate ? null : clickedDate;
                this.renderCalendar();
                this.renderTasks();
            });
        });
    }

    updateStats() {
        // Get today's date string in local timezone
        const today = this.getLocalDateString(new Date());
        
        const activeCount = this.tasks.filter(task => !task.completed).length;
        const completedToday = this.tasks.filter(task => 
            task.completed && 
            task.history.some(h => 
                h.action === 'completed' && 
                this.getLocalDateString(new Date(h.timestamp)) === today
            )
        ).length;
        const dueToday = this.tasks.filter(task => 
            !task.completed && task.dueDate === today
        ).length;

        document.getElementById('active-tasks-count').querySelector('.stat-value').textContent = activeCount;
        document.getElementById('completed-today').querySelector('.stat-value').textContent = completedToday;
        document.getElementById('due-today').querySelector('.stat-value').textContent = dueToday;

        // Add click handlers for statistics
        document.getElementById('active-tasks-count').onclick = () => this.filterByStatus('active');
        document.getElementById('completed-today').onclick = () => this.filterByStatus('completed-today');
        document.getElementById('due-today').onclick = () => this.filterByStatus('due-today');
    }

    renderClientStats() {
        const statistics = document.getElementById('statistics');
        const clientStats = this.clients.map(client => {
            const clientTasks = this.tasks.filter(task => task.client === client);
            return {
                client,
                total: clientTasks.length,
                completed: clientTasks.filter(task => task.completed).length,
                active: clientTasks.filter(task => !task.completed).length
            };
        });

        statistics.innerHTML = `
            <div class="client-stats">
                ${clientStats.map(stat => `
                    <div class="client-stat-item">
                        <h4>${stat.client}</h4>
                        <div class="stat-details">
                            <span>Total: ${stat.total}</span>
                            <span>Active: ${stat.active}</span>
                            <span>Completed: ${stat.completed}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${stat.total ? (stat.completed / stat.total * 100) : 0}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    initializeChart() {
        const ctx = document.getElementById('completion-chart').getContext('2d');
        this.completionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
        this.updateChart();
    }

    updateChart() {
        const last7Days = Array.from({length: 7}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        const completionData = last7Days.map(date => {
            return this.tasks.filter(task => {
                const completedAction = task.history.find(h => h.action === 'completed');
                return completedAction && new Date(completedAction.timestamp).toISOString().split('T')[0] === date;
            }).length;
        });

        this.completionChart.data.labels = last7Days.map(date => 
            new Date(date).toLocaleDateString('default', { month: 'short', day: 'numeric' })
        );
        this.completionChart.data.datasets[0].data = completionData;
        this.completionChart.update();
    }

    addClient(name) {
        if (!this.clients.includes(name)) {
            this.clients.push(name);
            this.saveClients();
            this.renderClients();
            this.updateClientSelect();
        }
    }

    renderClients() {
        const clientsList = document.getElementById('clients-list');
        clientsList.innerHTML = this.clients.map(client => {
            const clientId = `client-tasks-${client.replace(/\s+/g, '-')}`;
            return `
                <div class="client-item">
                    <div class="client-header">
                        <span class="client-name">${client}</span>
                        <div class="client-actions">
                            <button class="view-tasks-btn" data-client="${client}">
                                <i class="fas fa-tasks"></i>
                            </button>
                            <button class="edit-client-btn" data-client="${client}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-client-btn" data-client="${client}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div id="${clientId}" class="client-tasks-view">
                        <div class="task-view-header">
                            <span class="task-view-title">Tasks for ${client}</span>
                            <div class="task-view-actions">
                                <button class="refresh-tasks-btn" title="Refresh Tasks">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                                <button class="collapse-tasks-btn" title="Collapse">
                                    <i class="fas fa-chevron-up"></i>
                                </button>
                            </div>
                        </div>
                        <div class="client-calendar-container"></div>
                        <ul class="task-tree"></ul>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        clientsList.querySelectorAll('.view-tasks-btn').forEach(btn => {
            const client = btn.dataset.client;
            const clientId = `client-tasks-${client.replace(/\s+/g, '-')}`;
            btn.addEventListener('click', () => this.toggleClientTasks(clientId, client));
        });

        clientsList.querySelectorAll('.edit-client-btn').forEach(btn => {
            btn.addEventListener('click', () => this.editClient(btn.dataset.client));
        });

        clientsList.querySelectorAll('.delete-client-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteClient(btn.dataset.client));
        });

        // Setup task view action listeners
        clientsList.querySelectorAll('.refresh-tasks-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clientView = e.target.closest('.client-tasks-view');
                const client = clientView.id.replace('client-tasks-', '').replace(/-/g, ' ');
                this.updateClientTaskView(clientView, client);
            });
        });

        clientsList.querySelectorAll('.collapse-tasks-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clientView = e.target.closest('.client-tasks-view');
                this.toggleClientTasks(clientView.id);
            });
        });
    }

    toggleClientTasks(clientId, client) {
        const clientView = document.getElementById(clientId);
        const isActive = clientView.classList.contains('active');
        
        // Close all other open views first
        document.querySelectorAll('.client-tasks-view.active').forEach(view => {
            if (view.id !== clientId) {
                view.classList.remove('active');
            }
        });

        if (!isActive) {
            clientView.classList.add('active');
            this.updateClientTaskView(clientView, client);
        } else {
            clientView.classList.remove('active');
        }
    }

    updateClientTaskView(clientView, client) {
        const taskTree = clientView.querySelector('.task-tree');
        const calendarContainer = clientView.querySelector('.client-calendar-container');
        
        // Update task tree
        const newTaskTree = this.renderClientTaskTree(client);
        taskTree.innerHTML = newTaskTree.innerHTML;
        
        // Update calendar
        this.renderClientCalendar(client, calendarContainer);
        
        // Setup task listeners
        this.setupClientTaskListeners(clientView, client);
    }

    renderClientTaskTree(client) {
        // Filter only active (non-completed) tasks for the client
        const clientTasks = this.tasks.filter(task => task.client === client && !task.completed);
        const taskTree = document.createElement('ul');
        taskTree.className = 'task-tree';

        clientTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = 'task-tree-item';
            taskItem.innerHTML = `
                <div class="task-tree-content">
                    <div class="task-header">
                        <input type="checkbox" ${task.completed ? 'checked' : ''}>
                        <span class="task-text">${task.text}</span>
                    </div>
                    <div class="task-info">
                        <span class="task-date">${task.dueDate}</span>
                        <span class="task-priority">${task.priority}</span>
                        ${task.url ? `<a href="${task.url}" target="_blank" class="task-url">${task.url}</a>` : ''}
                    </div>
                    ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
                    ${task.subtasks && task.subtasks.length > 0 ? `
                        <ul class="subtask-tree">
                            ${task.subtasks.map(subtask => `
                                <li class="subtask-tree-item ${subtask.completed ? 'completed' : ''}">
                                    <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
                                    <span class="subtask-text">${subtask.text}</span>
                                    ${subtask.url ? `<a href="${subtask.url}" target="_blank" class="subtask-url">${subtask.url}</a>` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;

            taskTree.appendChild(taskItem);
        });

        return taskTree;
    }

    renderClientCalendar(client, container) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const clientTasks = this.tasks.filter(task => task.client === client);
        const todayStr = this.getLocalDateString(new Date());

        let calendarHTML = `
            <div class="client-calendar-mini">
                <div class="calendar-header">
                    ${new Date(year, month).toLocaleString('default', { month: 'long' })}
                </div>
                <div class="weekdays">
                    ${['S', 'M', 'T', 'W', 'T', 'F', 'S']
                        .map(day => `<div class="weekday">${day}</div>`).join('')}
                </div>
                <div class="days">
        `;

        // Empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            calendarHTML += '<div class="day empty"></div>';
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateStr = this.getLocalDateString(currentDate);
            const isToday = dateStr === todayStr;
            
            const tasksForDay = clientTasks.filter(task => task.dueDate === dateStr);
            const hasActiveTasks = tasksForDay.some(task => !task.completed);
            const hasCompletedTasks = tasksForDay.some(task => task.completed);

            calendarHTML += `
                <div class="day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    ${day}
                    ${hasActiveTasks ? '<span class="task-indicator active"></span>' : ''}
                    ${hasCompletedTasks ? '<span class="task-indicator completed"></span>' : ''}
                </div>
            `;
        }

        calendarHTML += '</div></div>';
        container.innerHTML = calendarHTML;

        // Add click events to days with tasks
        container.querySelectorAll('.day').forEach(day => {
            const date = day.dataset.date;
            const tasksForDay = clientTasks.filter(task => task.dueDate === date);
            if (tasksForDay.length > 0) {
                day.style.cursor = 'pointer';
                day.addEventListener('click', () => {
                    this.selectedDate = date;
                    this.filterTasksByClient(client);
                    this.renderCalendar();
                });
            }
        });
    }

    setupClientTaskListeners(clientView, client) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeView = document.querySelector('.client-tasks-view.active');
                if (activeView) {
                    activeView.classList.remove('active');
                    document.querySelector('.main-content').classList.remove('panel-open');
                }
            }
        });

        // Close button click handler
        document.querySelectorAll('.task-tree-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const clientView = btn.closest('.client-tasks-view');
                if (clientView) {
                    clientView.classList.remove('active');
                    document.querySelector('.main-content').classList.remove('panel-open');
                }
            });
        });

        // ... rest of the existing client task listeners ...
    }

    updateClientSelect() {
        const select = document.getElementById('client');
        select.innerHTML = `
            <option value="">Select Client</option>
            ${this.clients.map(client => `
                <option value="${client}">${client}</option>
            `).join('')}
        `;
    }

    filterTasksByClient(client) {
        document.getElementById('search').value = client;
        this.filterTasks();
    }

    filterByStatus(status) {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => btn.classList.remove('active'));
        
        switch (status) {
            case 'active':
                document.querySelector('[data-filter="active"]').classList.add('active');
                this.selectedDate = null;
                break;
            case 'completed-today':
                document.querySelector('[data-filter="completed"]').classList.add('active');
                this.selectedDate = this.getLocalDateString(new Date());
                break;
            case 'due-today':
                document.querySelector('[data-filter="all"]').classList.add('active');
                this.selectedDate = this.getLocalDateString(new Date());
                break;
        }
        
        this.renderTasks();
        this.renderCalendar();
    }

    editClient(oldName) {
        const newName = prompt('Enter new client name:', oldName);
        if (newName && newName !== oldName) {
            const index = this.clients.indexOf(oldName);
            this.clients[index] = newName;
            this.tasks.forEach(task => {
                if (task.client === oldName) {
                    task.client = newName;
                }
            });
            this.saveClients();
            this.saveTasks();
            this.renderClients();
            this.updateClientSelect();
            this.renderTasks();
        }
    }

    deleteClient(client) {
        if (confirm(`Are you sure you want to delete client "${client}"? This will remove the client from all associated tasks.`)) {
            this.clients = this.clients.filter(c => c !== client);
            this.tasks.forEach(task => {
                if (task.client === client) {
                    task.client = '';
                }
            });
            this.saveClients();
            this.saveTasks();
            this.renderClients();
            this.updateClientSelect();
            this.renderTasks();
        }
    }

    saveTasks() {
        try {
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    saveClients() {
        try {
            localStorage.setItem('clients', JSON.stringify(this.clients));
        } catch (error) {
            console.error('Error saving clients:', error);
        }
    }

    addTask() {
        const text = document.getElementById('new-task')?.value.trim();
        if (!text) return;

        const dueDate = document.getElementById('due-date')?.value || this.getLocalDateString(new Date());
        const client = document.getElementById('client')?.value;
        
        const task = new Task(
            text,
            dueDate,
            document.getElementById('task-url')?.value,
            client,
            document.getElementById('priority')?.value,
            document.getElementById('task-notes')?.value
        );

        this.tasks.push(task);
        this.saveTasks();
        
        // Add new client if it's not in the list
        if (client && !this.clients.includes(client)) {
            this.clients.push(client);
            this.saveClients();
        }
        
        // Clear inputs
        document.getElementById('new-task').value = '';
        document.getElementById('due-date').value = '';
        document.getElementById('task-url').value = '';
        document.getElementById('task-notes').value = '';
        
        // Update all views
        this.renderTasks();
        this.renderCalendar();
        this.updateStats();
        this.updateChart();
        this.renderClients();
        this.renderClientStats();
    }

    // Add export to Excel functionality
    exportToExcel() {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(this.tasks.map(task => task.toExcel()));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');
        XLSX.writeFile(workbook, 'tasks_export.xlsx');
    }

    // Add import from Excel functionality
    importFromExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(worksheet);
                
                data.forEach(row => {
                    const task = new Task(row['Text'], row['Due Date']);
                    task.id = row['Task ID'];
                    task.url = row['URL'];
                    task.client = row['Client'];
                    task.priority = row['Priority'];
                    task.notes = row['Notes'];
                    task.completed = row['Status'] === 'Completed';
                    task.createdAt = row['Created At'];
                    
                    // Handle subtasks
                    if (row['Subtasks']) {
                        row['Subtasks'].split(';').forEach(subtaskText => {
                            task.addSubtask(subtaskText.trim());
                        });
                    }
                    
                    this.tasks.push(task);
                });
                
                this.saveTasks();
                this.renderTasks();
                this.renderCalendar();
                this.updateStats();
                this.updateChart();
                this.renderClients();
            } catch (error) {
                console.error('Error importing Excel file:', error);
                alert('Error importing Excel file. Please check the file format.');
            }
        };
        reader.readAsBinaryString(file);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
}); 