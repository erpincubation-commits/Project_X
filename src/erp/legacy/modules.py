"""Business modules for the local desktop pilot.

Finance and stock are intentionally separate from purchase approvals. They use
append-only transaction rows and are not connected to purchase requests yet.
"""
import json
import secrets
import sqlite3
import time
from datetime import date
from .core import Problem, canonical, digest

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
 code TEXT PRIMARY KEY, name TEXT NOT NULL, account_type TEXT NOT NULL
 CHECK(account_type IN ('Asset','Liability','Equity','Income','Expense')), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS journal_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE, entry_date TEXT NOT NULL,
 narration TEXT NOT NULL, created_by TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS journal_lines (
 id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
 account_code TEXT NOT NULL REFERENCES accounts(code), debit_minor INTEGER NOT NULL DEFAULT 0 CHECK(debit_minor >= 0),
 credit_minor INTEGER NOT NULL DEFAULT 0 CHECK(credit_minor >= 0),
 CHECK((debit_minor=0) != (credit_minor=0)));
CREATE TABLE IF NOT EXISTS items (
 code TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS warehouses (code TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS stock_moves (
 id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL REFERENCES items(code),
 warehouse_code TEXT NOT NULL REFERENCES warehouses(code), quantity_milli INTEGER NOT NULL CHECK(quantity_milli != 0),
 movement_date TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS module_commands (
 username TEXT NOT NULL, command_key TEXT NOT NULL, payload_hash TEXT NOT NULL, response TEXT NOT NULL,
 PRIMARY KEY(username, command_key));
"""

class BusinessModules:
    def __init__(self, store):
        self.store = store
        with self.store.connection() as db:
            db.executescript(SCHEMA)

    def _user(self, db, token, csrf, write=False):
        user = self.store.authenticate(db, token)
        if write and user["role"] != "requester":
            raise Problem(403, "Select Requester to create test financial or stock transactions")
        if write and csrf != user["csrf"]:
            raise Problem(403, "Invalid local session")
        return user

    def _replay(self, db, user, key, payload):
        if not isinstance(key, str) or len(key) < 16:
            raise Problem(400, "A transaction identifier is required")
        payload_hash = digest(canonical(payload))
        old = db.execute("SELECT payload_hash,response FROM module_commands WHERE username=? AND command_key=?", (user["username"], key)).fetchone()
        if old:
            if old["payload_hash"] != payload_hash:
                raise Problem(409, "This transaction identifier was already used for different content")
            return payload_hash, json.loads(old["response"])
        return payload_hash, None

    def _remember(self, db, user, key, payload_hash, result):
        db.execute("INSERT INTO module_commands VALUES(?,?,?,?)", (user["username"],key,payload_hash,canonical(result)))

    def seed(self):
        accounts=[
            ("1000","Bank", "Asset"),("1100","Accounts Receivable","Asset"),("1200","Inventory","Asset"),
            ("2000","Accounts Payable","Liability"),("3000","Opening Equity","Equity"),
            ("4000","Sales Revenue","Income"),("5000","Office Expense","Expense")]
        items=[("CHAIR-01","Ergonomic office chair","Nos"),("CABLE-01","Network cable - 5m","Nos"),("PAPER-A4","A4 copier paper","Ream")]
        warehouses=[("MAIN","Main warehouse"),("STORE","Retail store")]
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            db.executemany("INSERT OR IGNORE INTO accounts(code,name,account_type) VALUES(?,?,?)",accounts)
            db.executemany("INSERT OR IGNORE INTO items(code,name,unit) VALUES(?,?,?)",items)
            db.executemany("INSERT OR IGNORE INTO warehouses(code,name) VALUES(?,?)",warehouses)

    def seed_demo_stock(self):
        """Synthetic opening stock for the passwordless testing workspace only."""
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0]: return
            now=time.time()
            db.executemany("INSERT INTO stock_moves(item_code,warehouse_code,quantity_milli,movement_date,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)",[
                ("CHAIR-01","MAIN",18000,"2026-11-01","Test opening quantity","test.seed",now),
                ("CABLE-01","MAIN",42000,"2026-11-01","Test opening quantity","test.seed",now),
                ("PAPER-A4","STORE",64000,"2026-11-01","Test opening quantity","test.seed",now)])

    def accounts(self, token):
        with self.store.connection() as db:
            self._user(db,token,"",False)
            return [dict(row) for row in db.execute("SELECT code,name,account_type FROM accounts WHERE active=1 ORDER BY code")]

    def trial_balance(self, token):
        with self.store.connection() as db:
            self._user(db,token,"",False)
            rows=[dict(row) for row in db.execute("""SELECT a.code,a.name,a.account_type,
                COALESCE(SUM(l.debit_minor),0) debit_minor,COALESCE(SUM(l.credit_minor),0) credit_minor
                FROM accounts a LEFT JOIN journal_lines l ON l.account_code=a.code
                WHERE a.active=1 GROUP BY a.code,a.name,a.account_type ORDER BY a.code""")]
            for row in rows:
                net=row["debit_minor"]-row["credit_minor"]
                row["balance_debit_minor"]=max(net,0);row["balance_credit_minor"]=max(-net,0)
            return rows

    def ledger(self, token, limit=100):
        with self.store.connection() as db:
            self._user(db,token,"",False)
            return [dict(row) for row in db.execute("""SELECT e.reference,e.entry_date,e.narration,l.account_code,a.name,
                l.debit_minor,l.credit_minor,e.created_by FROM journal_entries e JOIN journal_lines l ON l.entry_id=e.id
                JOIN accounts a ON a.code=l.account_code ORDER BY e.id DESC,l.id LIMIT ?""",(limit,))]

    def post_journal(self, token, csrf, key, entry_date, narration, lines):
        payload={"entry_date":entry_date,"narration":narration,"lines":lines}
        if not isinstance(entry_date,str) or not __import__("re").fullmatch(r"\d{4}-\d{2}-\d{2}",entry_date): raise Problem(400,"Use date format YYYY-MM-DD")
        if not isinstance(narration,str) or not 1<=len(narration.strip())<=160: raise Problem(400,"Narration must be 1-160 characters")
        if not isinstance(lines,list) or len(lines)<2: raise Problem(400,"A journal needs at least two lines")
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE"); user=self._user(db,token,csrf,True); payload_hash,replay=self._replay(db,user,key,payload)
            if replay:return replay
            total_debit=total_credit=0; clean=[]
            valid={row[0] for row in db.execute("SELECT code FROM accounts WHERE active=1")}
            for line in lines:
                if not isinstance(line,dict):raise Problem(400,"Invalid journal line")
                code,debit,credit=line.get("account_code"),line.get("debit_minor",0),line.get("credit_minor",0)
                if code not in valid or type(debit) is not int or type(credit) is not int or debit<0 or credit<0 or (debit==0)==(credit==0):raise Problem(400,"Each line needs a valid account and one positive debit or credit")
                total_debit+=debit;total_credit+=credit;clean.append((code,debit,credit))
            if total_debit!=total_credit:raise Problem(400,"Journal debits and credits must balance exactly")
            reference="JV-"+str(db.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0]+1).zfill(5)
            entry_id=db.execute("INSERT INTO journal_entries(reference,entry_date,narration,created_by,created_at) VALUES(?,?,?,?,?)",(reference,entry_date,narration.strip(),user["username"],time.time())).lastrowid
            db.executemany("INSERT INTO journal_lines(entry_id,account_code,debit_minor,credit_minor) VALUES(?,?,?,?)",[(entry_id,*line) for line in clean])
            result={"reference":reference,"entry_date":entry_date,"narration":narration.strip(),"debit_minor":total_debit,"credit_minor":total_credit,"line_count":len(clean)}
            self.store.audit(db,user["username"],"finance.journal_posted",result);self._remember(db,user,key,payload_hash,result);return result

    def stock_balance(self, token):
        with self.store.connection() as db:
            self._user(db,token,"",False)
            return [dict(row) for row in db.execute("""SELECT i.code,i.name,i.unit,w.code warehouse_code,w.name warehouse,
                COALESCE(SUM(m.quantity_milli),0) quantity_milli FROM items i CROSS JOIN warehouses w
                LEFT JOIN stock_moves m ON m.item_code=i.code AND m.warehouse_code=w.code WHERE i.active=1 AND w.active=1
                GROUP BY i.code,w.code HAVING quantity_milli != 0 ORDER BY i.code,w.code""")]

    def masters(self, token):
        with self.store.connection() as db:
            self._user(db,token,"",False)
            return {"items":[dict(r) for r in db.execute("SELECT code,name,unit FROM items WHERE active=1 ORDER BY code")],"warehouses":[dict(r) for r in db.execute("SELECT code,name FROM warehouses WHERE active=1 ORDER BY code")]}

    def adjust_stock(self, token, csrf, key, item_code, warehouse_code, quantity_milli, movement_date, note):
        payload={"item_code":item_code,"warehouse_code":warehouse_code,"quantity_milli":quantity_milli,"movement_date":movement_date,"note":note}
        if type(quantity_milli) is not int or quantity_milli==0:raise Problem(400,"Quantity must not be zero")
        if not isinstance(movement_date,str) or not __import__("re").fullmatch(r"\d{4}-\d{2}-\d{2}",movement_date):raise Problem(400,"Use date format YYYY-MM-DD")
        if not isinstance(note,str) or not 1<=len(note.strip())<=160:raise Problem(400,"Note must be 1-160 characters")
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE");user=self._user(db,token,csrf,True);payload_hash,replay=self._replay(db,user,key,payload)
            if replay:return replay
            item=db.execute("SELECT name FROM items WHERE code=? AND active=1",(item_code,)).fetchone(); warehouse=db.execute("SELECT name FROM warehouses WHERE code=? AND active=1",(warehouse_code,)).fetchone()
            if not item or not warehouse:raise Problem(400,"Choose an active item and warehouse")
            current=db.execute("SELECT COALESCE(SUM(quantity_milli),0) FROM stock_moves WHERE item_code=? AND warehouse_code=?",(item_code,warehouse_code)).fetchone()[0]
            if current+quantity_milli<0:raise Problem(400,"This movement would make local stock negative")
            move_id=db.execute("INSERT INTO stock_moves(item_code,warehouse_code,quantity_milli,movement_date,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)",(item_code,warehouse_code,quantity_milli,movement_date,note.strip(),user["username"],time.time())).lastrowid
            result={"id":move_id,"item_code":item_code,"warehouse_code":warehouse_code,"quantity_milli":quantity_milli,"movement_date":movement_date,"note":note.strip(),"balance_milli":current+quantity_milli}
            self.store.audit(db,user["username"],"inventory.stock_adjusted",result);self._remember(db,user,key,payload_hash,result);return result

    def transfer_stock(self, token, csrf, key, item_code, source, destination, quantity_milli, movement_date, note):
        """Move stock as two atomic ledger entries, retaining one audited command."""
        payload={"item_code":item_code,"source":source,"destination":destination,"quantity_milli":quantity_milli,"movement_date":movement_date,"note":note}
        if type(quantity_milli) is not int or quantity_milli <= 0: raise Problem(400,"Transfer quantity must be positive")
        if not isinstance(source,str) or not isinstance(destination,str) or source == destination: raise Problem(400,"Choose two different warehouses")
        try:
            if not isinstance(movement_date,str) or date.fromisoformat(movement_date).isoformat() != movement_date: raise ValueError()
        except ValueError: raise Problem(400,"Use a valid date in YYYY-MM-DD format")
        if not isinstance(note,str) or not 1 <= len(note.strip()) <= 160: raise Problem(400,"Note must be 1-160 characters")
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            user=self._user(db,token,csrf,True)
            payload_hash,replay=self._replay(db,user,key,payload)
            if replay: return replay
            if not db.execute("SELECT 1 FROM items WHERE code=? AND active=1",(item_code,)).fetchone(): raise Problem(400,"Choose an active item")
            for warehouse in (source,destination):
                if not db.execute("SELECT 1 FROM warehouses WHERE code=? AND active=1",(warehouse,)).fetchone(): raise Problem(400,"Choose active warehouses")
            current=db.execute("SELECT COALESCE(SUM(quantity_milli),0) FROM stock_moves WHERE item_code=? AND warehouse_code=?",(item_code,source)).fetchone()[0]
            if current < quantity_milli: raise Problem(400,"Insufficient stock in the source warehouse")
            now=time.time()
            ids=[]
            for warehouse,quantity in ((source,-quantity_milli),(destination,quantity_milli)):
                ids.append(db.execute("INSERT INTO stock_moves(item_code,warehouse_code,quantity_milli,movement_date,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)",(item_code,warehouse,quantity,movement_date,note.strip(),user["username"],now)).lastrowid)
            result={"item_code":item_code,"source":source,"destination":destination,"quantity_milli":quantity_milli,"movement_date":movement_date,"note":note.strip(),"movement_ids":ids}
            self.store.audit(db,user["username"],"inventory.stock_transferred",result)
            self._remember(db,user,key,payload_hash,result)
            return result
