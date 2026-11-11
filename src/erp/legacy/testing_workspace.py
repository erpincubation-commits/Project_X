"""Explicitly marked, isolated passwordless TEST database; never converts existing user data."""
import secrets
import time
from .core import Store, Problem, digest

class TestingStore(Store):
    def __init__(self,path):
        super().__init__(path)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            marked=db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_workspace_marker'").fetchone()
            if not marked:
                if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] or db.execute("SELECT COUNT(*) FROM requests").fetchone()[0]:
                    raise Problem(403,"Passwordless testing cannot open an existing protected workspace. Use a separate empty test database.")
                db.execute("CREATE TABLE test_workspace_marker (kind TEXT NOT NULL CHECK(kind='test-only'))")
                db.execute("INSERT INTO test_workspace_marker VALUES('test-only')")
            elif db.execute("SELECT COUNT(*) FROM test_workspace_marker WHERE kind='test-only'").fetchone()[0]!=1:
                raise Problem(403,"Invalid test workspace marker")
        if self.needs_setup():
            self.setup_accounts([{"username":name,"role":role,"password":secrets.token_urlsafe(32)} for name,role in (("test.buyer","requester"),("test.manager","approver"),("test.auditor","auditor"))])

    def enter_role(self,role):
        name={"requester":"test.buyer","approver":"test.manager","auditor":"test.auditor"}.get(role)
        if not name: raise Problem(400,"Unknown test role")
        token,csrf=secrets.token_urlsafe(32),secrets.token_urlsafe(32)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT role FROM users WHERE username=?",(name,)).fetchone()
            if not row or row[0]!=role: raise Problem(403,"Test account is missing or changed")
            db.execute("DELETE FROM sessions WHERE expires<?",(time.time(),))
            db.execute("INSERT INTO sessions VALUES(?,?,?,?)",(digest(token),name,csrf,time.time()+28800))
            self.audit(db,name,"testing.role_entered",{"mode":"passwordless-test-only"})
        return token,{"username":name,"role":role,"csrf":csrf}

    def seed_examples(self):
        with self.connection() as db:
            if db.execute("SELECT COUNT(*) FROM requests").fetchone()[0]: return
        buyer,user=self.enter_role("requester")
        manager,approver=self.enter_role("approver")
        examples=[("Demo / Office workstations","Sample Tech Supplies",24500000,"submitted"),("Demo / Warehouse shelving","Sample Storage Co",8600000,"approved"),("Demo / Safety equipment","Sample Industrial",4250000,"draft"),("Demo / Packing material","Sample Packaging",1850000,"submitted"),("Demo / Network equipment","Sample Networks",9600000,"rejected")]
        try:
            for title,supplier,amount,status in examples:
                row=self.command(buyer,user["csrf"],secrets.token_hex(16),{"action":"create","title":title,"supplier":supplier,"amount_minor":amount,"currency":"INR"})
                if status!="draft": row=self.command(buyer,user["csrf"],secrets.token_hex(16),{"action":"submit","id":row["id"],"version":row["version"]})
                if status in ("approved","rejected"): self.command(manager,approver["csrf"],secrets.token_hex(16),{"action":"approve" if status=="approved" else "reject","id":row["id"],"version":row["version"]})
        finally:
            self.logout(buyer,user["csrf"]); self.logout(manager,approver["csrf"])
