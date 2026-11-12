create index if not exists likes_recent_by_book on likes (created_at desc, book_id);
