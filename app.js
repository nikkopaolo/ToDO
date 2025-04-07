// Task class to manage individual tasks
class Task {
    constructor(text, dueDate = null, url = null) {
        this.id = Date.now().toString();
        this.text = text;
        this.completed = false;
        this.dueDate = dueDate;
        this.url = url;
        this.createdAt = new Date();
    }
}

// TaskManager class to handle all task operations
class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.setupEventListeners();
        this.renderTasks();
        this.updateStats();
    }

    setupEventListeners() {
        // Add task
        document.getElementById('add-task').addEventListener('click', () => this.addTask());
        document.getElementById('new-task').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Search
        document.getElementById('search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.renderTasks();
        });

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('.filter-btn.active').classList.remove('active');
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderTasks();
            });
        });

        // Clear completed
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.tasks = this.tasks.filter(task => !task.completed);
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
        });

        // Theme toggle
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
    }

    addTask() {
        const taskInput = document.getElementById('new-task');
        const dueDateInput = document.getElementById('due-date');
        const urlInput = document.getElementById('task-url');
        
        const text = taskInput.value.trim();
        if (!text) return;

        const task = new Task(
            text,
            dueDateInput.value ? new Date(dueDateInput.value) : null,
            urlInput.value || null
        );

        this.tasks.unshift(task);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();

        // Clear inputs
        taskInput.value = '';
        dueDateInput.value = '';
        urlInput.value = '';
        taskInput.focus();
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
    }

    editTask(id, newText) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.text = newText;
            this.saveTasks();
            this.renderTasks();
        }
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    getFilteredTasks() {
        return this.tasks.filter(task => {
            const matchesSearch = task.text.toLowerCase().includes(this.searchTerm);
            const matchesFilter = this.currentFilter === 'all' ||
                (this.currentFilter === 'active' && !task.completed) ||
                (this.currentFilter === 'completed' && task.completed);
            return matchesSearch && matchesFilter;
        });
    }

    renderTasks() {
        const tasksList = document.getElementById('tasks-list');
        tasksList.innerHTML = '';

        const filteredTasks = this.getFilteredTasks();

        filteredTasks.forEach(task => {
            const taskElement = document.createElement('li');
            taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
            taskElement.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-content">
                    <span class="task-text">${this.escapeHtml(task.text)}</span>
                    ${task.dueDate ? `<span class="task-due-date">Due: ${new Date(task.dueDate).toLocaleString()}</span>` : ''}
                    ${task.url ? `<a href="${this.escapeHtml(task.url)}" class="task-url" target="_blank">${this.escapeHtml(task.url)}</a>` : ''}
                </div>
                <div class="task-actions">
                    <button class="edit-btn" title="Edit task"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" title="Delete task"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Add event listeners
            const checkbox = taskElement.querySelector('.task-checkbox');
            checkbox.addEventListener('change', () => this.toggleTask(task.id));

            const editBtn = taskElement.querySelector('.edit-btn');
            editBtn.addEventListener('click', () => this.startEditing(taskElement, task));

            const deleteBtn = taskElement.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

            tasksList.appendChild(taskElement);
        });
    }

    startEditing(taskElement, task) {
        const taskText = taskElement.querySelector('.task-text');
        const currentText = taskText.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        
        taskText.replaceWith(input);
        input.focus();
        
        const finishEditing = () => {
            const newText = input.value.trim();
            if (newText) {
                this.editTask(task.id, newText);
            }
        };
        
        input.addEventListener('blur', finishEditing);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                finishEditing();
            }
        });
    }

    updateStats() {
        const activeTasks = this.tasks.filter(task => !task.completed).length;
        document.getElementById('tasks-count').textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} remaining`;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the app
const taskManager = new TaskManager(); 