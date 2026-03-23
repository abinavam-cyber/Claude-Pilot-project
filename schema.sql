-- =============================================================
--  Expense Tracker Database
--  Source: Google Sheet (18Ein8ZziNlcmzhPlcslkAqcOrgiXrw8vECuM4DHG6yQ)
--  Sections: Accounts | US Expenses | Gobi
-- =============================================================

CREATE DATABASE IF NOT EXISTS expense_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

-- -------------------------------------------------------------
-- 1. ACCOUNTS
--    Tracks financial institutions and their balances.
--    Bold columns: Accounts | Amount
-- -------------------------------------------------------------
CREATE TABLE accounts (
  id          INT            NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)   NOT NULL COMMENT 'Institution name (e.g. Wells, JP, Fidelity)',
  balance     DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  currency    CHAR(3)        NOT NULL DEFAULT 'USD',
  notes       TEXT                    DEFAULT NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_name (name)
) ENGINE=InnoDB COMMENT='Financial accounts / asset balances';

-- -------------------------------------------------------------
-- 2. EXPENSE SECTIONS
--    Top-level groupings that mirror the sheet's bold headers.
--    Rows: US Expenses, Gobi
-- -------------------------------------------------------------
CREATE TABLE expense_sections (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL COMMENT 'e.g. US, Gobi',
  description VARCHAR(255)           DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_section_name (name)
) ENGINE=InnoDB COMMENT='High-level expense groupings (mirrors sheet sections)';

-- -------------------------------------------------------------
-- 3. EXPENSE CATEGORIES
--    Named line items within each section.
--    Bold column: US expenses / Gobi  (the label column)
-- -------------------------------------------------------------
CREATE TABLE expense_categories (
  id          INT           NOT NULL AUTO_INCREMENT,
  section_id  INT           NOT NULL,
  name        VARCHAR(150)  NOT NULL COMMENT 'e.g. Health Insurance, Renovation, Car',
  frequency   ENUM(
                'monthly',
                'annual',
                'one-time',
                'weekly'
              )             NOT NULL DEFAULT 'monthly',
  notes       TEXT                   DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_section (section_id, name),
  CONSTRAINT fk_cat_section
    FOREIGN KEY (section_id) REFERENCES expense_sections (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Individual expense line items per section';

-- -------------------------------------------------------------
-- 4. EXPENSES
--    Actual amounts per category.
--    Bold column: Amount
-- -------------------------------------------------------------
CREATE TABLE expenses (
  id              INT            NOT NULL AUTO_INCREMENT,
  category_id     INT            NOT NULL,
  amount          DECIMAL(15, 2) NOT NULL,
  currency        CHAR(3)        NOT NULL DEFAULT 'USD',
  expense_date    DATE           NOT NULL DEFAULT (CURRENT_DATE),
  notes           TEXT                    DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expense_category (category_id),
  KEY idx_expense_date     (expense_date),
  CONSTRAINT fk_expense_category
    FOREIGN KEY (category_id) REFERENCES expense_categories (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Expense entries with amounts (mirrors Amount column)';

-- =============================================================
--  SEED DATA  (values pulled directly from the Google Sheet)
-- =============================================================

-- -- Accounts (Accounts | Amount)
INSERT INTO accounts (name, balance) VALUES
  ('Wells',       900000.00),
  ('JP',         1160000.00),
  ('America 1st', 187000.00),
  ('Fidelity',    285000.00);

-- Sections
INSERT INTO expense_sections (name, description) VALUES
  ('US',   'Recurring monthly expenses in the United States'),
  ('Gobi', 'Location-specific expenses for Gobi');

-- US Expense Categories  (US expenses | Amount)
INSERT INTO expense_categories (section_id, name, frequency) VALUES
  (1, 'Health Insurance',      'monthly'),
  (1, 'Cellphone',             'monthly'),
  (1, 'Auto Insurance',        'monthly'),
  (1, 'Maintain 1 residence',  'monthly'),
  (1, 'Living expense',        'monthly');

-- Gobi Expense Categories  (Gobi | Amount)
INSERT INTO expense_categories (section_id, name, frequency) VALUES
  (2, 'Renovation',            'one-time'),
  (2, 'Car',                   'one-time'),
  (2, 'Moving Expenses',       'one-time'),
  (2, 'Living in Gobi expense','monthly');

-- US Expenses amounts
INSERT INTO expenses (category_id, amount) VALUES
  (1, 3000.00),   -- Health Insurance
  (2,  150.00),   -- Cellphone
  (3,  250.00),   -- Auto Insurance
  (4, 2100.00),   -- Maintain 1 residence
  (5,  750.00);   -- Living expense

-- Gobi Expenses amounts
INSERT INTO expenses (category_id, amount) VALUES
  (6, 27777.78),  -- Renovation
  (7, 27777.78),  -- Car
  (8, 40000.00),  -- Moving Expenses
  (9,  2000.00);  -- Living in Gobi expense

-- =============================================================
--  USEFUL VIEWS
-- =============================================================

-- Account total
CREATE OR REPLACE VIEW v_total_assets AS
SELECT
  SUM(balance)    AS total_assets,
  COUNT(*)        AS account_count
FROM accounts;

-- Monthly US expenses with annual projection
CREATE OR REPLACE VIEW v_us_expenses_summary AS
SELECT
  ec.name                         AS category,
  e.amount                        AS monthly_amount,
  e.amount * 12                   AS annual_amount
FROM expenses e
JOIN expense_categories ec ON ec.id = e.category_id
JOIN expense_sections   es ON es.id = ec.section_id
WHERE es.name = 'US';

-- All expenses by section
CREATE OR REPLACE VIEW v_expenses_by_section AS
SELECT
  es.name                         AS section,
  ec.name                         AS category,
  ec.frequency,
  e.amount,
  e.expense_date
FROM expenses e
JOIN expense_categories ec ON ec.id = e.category_id
JOIN expense_sections   es ON es.id = ec.section_id
ORDER BY es.name, ec.name;
