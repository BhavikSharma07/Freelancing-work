CREATE DATABASE IF NOT EXISTS freelance_flow;

USE freelance_flow;

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    startDate DATE,
    endDate DATE,
    amount DECIMAL(10, 2),
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    paymentStatus ENUM('Paid', 'Unpaid', 'Partial') DEFAULT 'Unpaid',
    paidAmount DECIMAL(10, 2) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
