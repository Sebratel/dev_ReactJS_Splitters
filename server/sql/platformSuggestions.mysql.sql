CREATE TABLE IF NOT EXISTS platform_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  sector VARCHAR(120) NOT NULL,
  category VARCHAR(120) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  author_uid VARCHAR(128) NOT NULL,
  author_email VARCHAR(191) NOT NULL,
  author_name VARCHAR(191) NOT NULL,
  author_photo_url VARCHAR(1024) NULL,
  likes_count INT NOT NULL DEFAULT 0,
  dislikes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform_suggestions_status (status),
  INDEX idx_platform_suggestions_sector (sector),
  INDEX idx_platform_suggestions_score_created (score, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE platform_suggestions
  ADD COLUMN IF NOT EXISTS author_photo_url VARCHAR(1024) NULL,
  ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS platform_suggestion_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  suggestion_id BIGINT UNSIGNED NOT NULL,
  user_uid VARCHAR(128) NOT NULL,
  user_email VARCHAR(191) NOT NULL,
  user_name VARCHAR(191) NOT NULL,
  user_photo_url VARCHAR(1024) NULL,
  vote_type VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_suggestion_votes_suggestion_user (suggestion_id, user_uid),
  INDEX idx_platform_suggestion_votes_suggestion (suggestion_id),
  CONSTRAINT fk_platform_suggestion_votes_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES platform_suggestions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE platform_suggestion_votes
  ADD COLUMN IF NOT EXISTS user_photo_url VARCHAR(1024) NULL;

CREATE TABLE IF NOT EXISTS platform_suggestion_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  suggestion_id BIGINT UNSIGNED NOT NULL,
  author_uid VARCHAR(128) NOT NULL,
  author_email VARCHAR(191) NOT NULL,
  author_name VARCHAR(191) NOT NULL,
  author_photo_url VARCHAR(1024) NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform_suggestion_comments_suggestion_created (suggestion_id, created_at),
  CONSTRAINT fk_platform_suggestion_comments_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES platform_suggestions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS platform_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  sector VARCHAR(120) NOT NULL,
  category VARCHAR(120) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  author_uid VARCHAR(128) NOT NULL,
  author_email VARCHAR(191) NOT NULL,
  author_name VARCHAR(191) NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  dislikes_count INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform_suggestions_status (status),
  INDEX idx_platform_suggestions_sector (sector),
  INDEX idx_platform_suggestions_score_created (score, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_suggestion_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  suggestion_id BIGINT UNSIGNED NOT NULL,
  user_uid VARCHAR(128) NOT NULL,
  user_email VARCHAR(191) NOT NULL,
  user_name VARCHAR(191) NOT NULL,
  vote_type VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_suggestion_votes_suggestion_user (suggestion_id, user_uid),
  INDEX idx_platform_suggestion_votes_suggestion (suggestion_id),
  CONSTRAINT fk_platform_suggestion_votes_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES platform_suggestions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
