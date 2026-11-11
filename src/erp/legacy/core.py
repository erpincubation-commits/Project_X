"""Local ERP domain and SQLite persistence. No network dependencies."""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from contextlib import closing, contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ROLES = {"requester", "approver", "auditor"}
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
 username TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('requester','approver','auditor')));
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username),
 csrf TEXT NOT NULL, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, supplier TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor > 0), currency TEXT NOT NULL,
 owner TEXT NOT NULL REFERENCES users(username), status TEXT NOT NULL
 CHECK(status IN ('draft','submitted','approved','rejected')),
 version INTEGER NOT NULL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS commands (
 username TEXT NOT NULL, command_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
 response TEXT NOT NULL, PRIMARY KEY(username, command_key));
CREATE TABLE IF NOT EXISTS audit (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL,
 previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (
 username TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until REAL NOT NULL);
PRAGMA user_version=1;
"""

class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message
        super().__init__(message)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()

class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise RuntimeError("Unsupported database schema; use a compatible release")
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(SCHEMA)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA synchronous=FULL")
        try:
            with db:
                yield db
        finally:
            db.close()

    def audit(self, db, actor, action, data):
        event = canonical({"at": time.time(), "actor": actor, "action": action, "data": data})
        row = db.execute("SELECT event_hash FROM audit ORDER BY seq DESC LIMIT 1").fetchone()
        previous = row[0] if row else "0" * 64
        db.execute("INSERT INTO audit(event,previous_hash,event_hash) VALUES(?,?,?)",
                   (event, previous, digest(previous + event)))

    def add_user(self, username, password, role):
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{3,64}", username) or role not in ROLES:
            raise Problem(400, "Use a 3–64 character username and a valid role")
        if len(password) < 14 or len(password) > 256:
            raise Problem(400, "Password must be 14–256 characters")
        salt = secrets.token_hex(16)
        hashed = password_hash(password, salt)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                db.execute("INSERT INTO users VALUES(?,?,?,?)", (username, salt, hashed, role))
            except sqlite3.IntegrityError:
                raise Problem(409, "Username already exists")
            self.audit(db, "local-operator", "user.created", {"username": username, "role": role})

    def needs_setup(self):
        with self.connection() as db:
            return db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0

    def setup_accounts(self, accounts):
        if not isinstance(accounts, list) or len(accounts) != 3:
            raise Problem(400, "Create one requester, one approver and one auditor")
        prepared, names, roles = [], set(), set()
        for account in accounts:
            if not isinstance(account, dict):
                raise Problem(400, "Invalid account")
            username, password, role = account.get("username"), account.get("password"), account.get("role")
            if not isinstance(username, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{3,64}", username):
                raise Problem(400, "Usernames must contain 3–64 letters, numbers, dots, underscores or hyphens")
            if not isinstance(password, str) or not 14 <= len(password) <= 256:
                raise Problem(400, "Every password must contain 14–256 characters")
            if role not in ROLES or role in roles or username in names:
                raise Problem(400, "Use three unique usernames, one for each role")
            names.add(username)
            roles.add(role)
            salt = secrets.token_hex(16)
            prepared.append((username, salt, password_hash(password, salt), role))
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
                raise Problem(409, "Setup is already complete")
            db.executemany("INSERT INTO users VALUES(?,?,?,?)", prepared)
            for username, _, _, role in prepared:
                self.audit(db, "local-setup", "user.created", {"username":username, "role":role})

    def login(self, username, password):
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 64 or len(password) > 256:
            raise Problem(400, "Invalid credentials format")
        failed = False
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            attempt = db.execute("SELECT * FROM login_attempts WHERE username=?", (username,)).fetchone()
            if attempt and attempt["locked_until"] > time.time():
                raise Problem(429, "Too many attempts; try again in 15 minutes")
            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            candidate = password_hash(password, user["salt"] if user else "00" * 16)
            if not user or not hmac.compare_digest(candidate, user["password_hash"]):
                failures = (attempt["failures"] if attempt and attempt["locked_until"] == 0 else 0) + 1
                db.execute("INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)",
                           (username, failures, time.time() + 900 if failures >= 5 else 0))
                self.audit(db, username, "login.failed", {})
                failed = True
            else:
                db.execute("DELETE FROM login_attempts WHERE username=?", (username,))
                db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
                token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (digest(token), username, csrf, time.time() + 28800))
                self.audit(db, username, "login.succeeded", {})
        if failed:
            raise Problem(401, "Invalid username or password")
        return token, {"username": username, "role": user["role"], "csrf": csrf}

    def authenticate(self, db, token):
        row = db.execute("SELECT u.username,u.role,s.csrf FROM sessions s JOIN users u ON u.username=s.username WHERE token_hash=? AND expires>?",
                         (digest(token), time.time())).fetchone()
        if not row:
            raise Problem(401, "Please sign in")
        return dict(row)

    def snapshot(self, token):
        with self.connection() as db:
            db.execute("BEGIN")
            user = self.authenticate(db, token)
            if user["role"] == "requester":
                rows = db.execute("SELECT * FROM requests WHERE owner=? ORDER BY id DESC", (user["username"],))
            else:
                rows = db.execute("SELECT * FROM requests ORDER BY id DESC")
            return {"user": user, "requests": [dict(row) for row in rows]}

    def events(self, token):
        with self.connection() as db:
            db.execute("BEGIN")
            user = self.authenticate(db, token)
            if user["role"] != "auditor":
                raise Problem(403, "Auditor role required")
            rows = [dict(row) for row in db.execute("SELECT * FROM audit ORDER BY seq")]
            previous, valid = "0" * 64, True
            for row in rows:
                valid &= row["previous_hash"] == previous and row["event_hash"] == digest(previous + row["event"])
                previous = row["event_hash"]
            return {"events": rows, "chain_valid": bool(valid), "head": previous}

    def logout(self, token, csrf):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            user = self.authenticate(db, token)
            if not hmac.compare_digest(user["csrf"], csrf):
                raise Problem(403, "Invalid CSRF token")
            db.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token),))
            self.audit(db, user["username"], "logout", {})

    def command(self, token, csrf, key, command):
        if not re.fullmatch(r"[a-zA-Z0-9_-]{16,100}", key):
            raise Problem(400, "A unique Idempotency-Key of 16–100 characters is required")
        if not isinstance(command, dict):
            raise Problem(400, "Expected a JSON object")
        payload_hash = digest(canonical(command))
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            user = self.authenticate(db, token)
            if not hmac.compare_digest(user["csrf"], csrf):
                raise Problem(403, "Invalid CSRF token")
            prior = db.execute("SELECT * FROM commands WHERE username=? AND command_key=?", (user["username"], key)).fetchone()
            if prior:
                if prior["payload_hash"] != payload_hash:
                    raise Problem(409, "Idempotency key was already used for different content")
                return json.loads(prior["response"])
            action = command.get("action")
            if action == "create":
                if user["role"] != "requester":
                    raise Problem(403, "Requester role required")
                title, supplier = command.get("title"), command.get("supplier")
                amount, currency = command.get("amount_minor"), command.get("currency")
                if not all(isinstance(x, str) and 1 <= len(x.strip()) <= 160 for x in (title, supplier)):
                    raise Problem(400, "Title and supplier must be 1–160 characters")
                if type(amount) is not int or not 0 < amount <= 100000000000:
                    raise Problem(400, "Amount must be a positive integer in minor currency units")
                if currency not in ("INR", "USD", "EUR", "GBP"):
                    raise Problem(400, "Unsupported currency")
                cursor = db.execute("INSERT INTO requests(title,supplier,amount_minor,currency,owner,status,version,created) VALUES(?,?,?,?,?,'draft',1,?)",
                                    (title.strip(), supplier.strip(), amount, currency, user["username"], time.time()))
                request_id = cursor.lastrowid
            elif action in ("submit", "approve", "reject"):
                request_id = command.get("id")
                if type(request_id) is not int or type(command.get("version")) is not int:
                    raise Problem(400, "Integer id and version are required")
                row = db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
                if not row:
                    raise Problem(404, "Request not found")
                if action == "submit":
                    if user["role"] != "requester" or row["owner"] != user["username"]:
                        raise Problem(403, "Only the owner may submit")
                    before, after = "draft", "submitted"
                else:
                    if user["role"] != "approver" or row["owner"] == user["username"]:
                        raise Problem(403, "A separate approver is required")
                    before, after = "submitted", "approved" if action == "approve" else "rejected"
                if row["version"] != command["version"] or row["status"] != before:
                    raise Problem(409, "Request changed or transition is invalid; refresh and review")
                db.execute("UPDATE requests SET status=?,version=version+1 WHERE id=?", (after, request_id))
            else:
                raise Problem(400, "Unknown action")
            result = dict(db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone())
            self.audit(db, user["username"], "request." + action, result)
            db.execute("INSERT INTO commands VALUES(?,?,?,?)", (user["username"], key, payload_hash, canonical(result)))
            return result

    def backup(self, destination):
        destination = Path(destination)
        if destination.exists():
            raise Problem(409, "Backup destination already exists")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Backup integrity check failed")

