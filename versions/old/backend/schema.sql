DROP TABLE IF EXISTS history;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS timesheets;
DROP TABLE IF EXISTS compliance_records;
DROP TABLE IF EXISTS pms_tasks;
DROP TABLE IF EXISTS pms_milestones;
DROP TABLE IF EXISTS pms_sprints;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee'
);

CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    joining_date TEXT NOT NULL,
    mobile TEXT,
    address TEXT,
    salary REAL DEFAULT 0.00,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE compliance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    compliance_name TEXT NOT NULL,
    is_compliant TEXT NOT NULL,
    date_checked TEXT NOT NULL,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE pms_sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sprint_number INTEGER UNIQUE NOT NULL,
    sprint_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'Upcoming'
);

CREATE TABLE pms_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_name TEXT NOT NULL,
    target_date TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending'
);

CREATE TABLE pms_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sprint_id INTEGER NOT NULL,
    assigned_employee_id INTEGER,
    task_name TEXT NOT NULL,
    phase TEXT NOT NULL,
    status TEXT DEFAULT 'Backlog',
    FOREIGN KEY(sprint_id) REFERENCES pms_sprints(id),
    FOREIGN KEY(assigned_employee_id) REFERENCES employees(id)
);

CREATE TABLE timesheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    hours_worked REAL NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    change_date TEXT NOT NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);