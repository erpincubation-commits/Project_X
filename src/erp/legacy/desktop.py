"""Native ERP procurement desktop pilot."""
import argparse
import json
import os
import re
import secrets
import sqlite3
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from .core import Store, Problem

def money(text):
    if not re.fullmatch(r"\d{1,10}(\.\d{1,2})?", text.strip()):
        raise Problem(400, "Enter a positive amount with at most two decimal places.")
    whole, _, fraction = text.strip().partition(".")
    value = int(whole) * 100 + int(fraction.ljust(2, "0"))
    if not 0 < value <= 100000000000:
        raise Problem(400, "Amount must be between 0.01 and 1,000,000,000.00.")
    return value

def default_database():
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local" / "share"))
    return base / "ERPIncubation" / "desktop.db"

class Desktop:
    def __init__(self, root, store):
        self.root, self.store = root, store
        self.token = self.user = None
        self.rows = {}
        root.title("ERP Incubation | Desktop")
        root.geometry("1120x760")
        root.minsize(860, 650)
        root.configure(background="#eef2ed")
        style = ttk.Style(root)
        style.theme_use("clam")
        style.configure("TFrame", background="#eef2ed")
        style.configure("TLabel", background="#eef2ed", foreground="#213c34", font=("Segoe UI", 10))
        style.configure("Title.TLabel", font=("Segoe UI", 24, "bold"))
        style.configure("Muted.TLabel", foreground="#61786e")
        style.configure("TButton", font=("Segoe UI", 10), padding=(12, 8))
        style.configure("TEntry", padding=7)
        style.configure("Treeview", font=("Segoe UI", 10), rowheight=34)
        style.configure("Treeview.Heading", font=("Segoe UI", 10, "bold"), padding=8)
        header = tk.Frame(root, background="#183f33", padx=24, pady=18)
        header.pack(fill="x")
        tk.Label(header, text="ERP INCUBATION", bg="#183f33", fg="#f1f7ed", font=("Segoe UI", 17, "bold")).pack(side="left")
        tk.Label(header, text="DESKTOP  /  LOCAL DATABASE", bg="#183f33", fg="#b9d9c3", font=("Segoe UI", 10)).pack(side="right")
        self.body = ttk.Frame(root, padding=24)
        self.body.pack(fill="both", expand=True)
        self.status = tk.StringVar(value="Local desktop pilot | No browser or server required")
        ttk.Label(root, textvariable=self.status, padding=(24,10), style="Muted.TLabel").pack(fill="x")
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.bind("<F5>", lambda e:self.safe(self.refresh) if self.user else None)
        root.bind("<Control-n>", lambda e:self.new_request() if self.user and self.user["role"]=="requester" else None)
        root.bind("<Control-l>", lambda e:self.sign_out() if self.user else None)
        self.show_setup() if store.needs_setup() else self.show_login()

    def safe(self, fn):
        try:
            return fn()
        except Problem as error:
            messagebox.showerror("ERP Incubation", error.message, parent=self.root)
            if error.status == 401 and self.user:
                self.token = self.user = None
                self.show_login()
        except (sqlite3.Error, OSError) as error:
            messagebox.showerror("Local data error", "The operation could not complete.\n" + str(error), parent=self.root)

    def clear(self):
        for widget in self.body.winfo_children():
            widget.destroy()

    def heading(self, title, description):
        ttk.Label(self.body, text=title, style="Title.TLabel").pack(anchor="w", pady=(0,8))
        ttk.Label(self.body, text=description, wraplength=950, style="Muted.TLabel").pack(anchor="w", pady=(0,20))

    def field(self, parent, label, value="", password=False):
        ttk.Label(parent, text=label).pack(anchor="w", pady=(8,3))
        entry = ttk.Entry(parent, show="*" if password else "", width=34)
        entry.insert(0,value)
        entry.pack(fill="x", pady=(0,5))
        return entry

    def show_setup(self):
        self.clear()
        self.heading("Create your local workspace", "Set up three role accounts for this procurement pilot. Passwords need at least 14 characters. No data leaves this computer.")
        self.setup_fields = {}
        columns = ttk.Frame(self.body)
        columns.pack(fill="x")
        for index,(role,name) in enumerate((("requester","buyer"),("approver","manager"),("auditor","audit"))):
            panel = ttk.LabelFrame(columns,text=role.title(),padding=16)
            panel.grid(row=0,column=index,sticky="nsew",padx=5)
            columns.columnconfigure(index,weight=1)
            self.setup_fields[role] = (self.field(panel,"Username",name), self.field(panel,"Password",password=True), self.field(panel,"Confirm password",password=True))
        ttk.Label(self.body,text="These are separate roles. A requester cannot approve their own purchase request.",style="Muted.TLabel").pack(anchor="w",pady=20)
        ttk.Button(self.body,text="Create workspace",command=lambda:self.safe(self.complete_setup)).pack(anchor="e")
        ttk.Label(self.body,text="Data file: " + self.store.path,wraplength=950,style="Muted.TLabel").pack(anchor="w",pady=24)

    def complete_setup(self):
        accounts=[]
        for role,(username,password,confirmation) in self.setup_fields.items():
            if password.get()!=confirmation.get():
                raise Problem(400,role.title()+" passwords do not match.")
            accounts.append({"role":role,"username":username.get().strip(),"password":password.get()})
        self.store.setup_accounts(accounts)
        self.show_login()
        self.status.set("Workspace created. Sign in as the requester to begin.")

    def show_login(self):
        self.clear()
        self.heading("Welcome back", "Sign in to your local procurement workspace.")
        panel=ttk.Frame(self.body,width=420)
        panel.pack(anchor="w")
        self.username=self.field(panel,"Username")
        self.password=self.field(panel,"Password",password=True)
        self.password.bind("<Return>",lambda e:self.safe(self.login))
        ttk.Button(panel,text="Sign in",command=lambda:self.safe(self.login)).pack(anchor="w",pady=16)
        ttk.Label(self.body,text="Development pilot: purchase requests and approvals. Accounting, stock ledgers and ERPNext integration are not included.",wraplength=850,style="Muted.TLabel").pack(anchor="w",pady=30)
        self.username.focus_set()

    def login(self):
        self.token,self.user=self.store.login(self.username.get().strip(),self.password.get())
        self.show_workspace()

    def show_workspace(self):
        self.clear()
        self.heading("Purchase requests", self.user["username"] + "  /  " + self.user["role"].title() + "    |    F5 Refresh    Ctrl+N New request    Ctrl+L Sign out")
        toolbar=ttk.Frame(self.body)
        toolbar.pack(fill="x",pady=(0,14))
        if self.user["role"]=="requester":
            ttk.Button(toolbar,text="+ New request",command=self.new_request).pack(side="left",padx=(0,8))
            ttk.Button(toolbar,text="Submit selected",command=lambda:self.safe(lambda:self.transition("submit"))).pack(side="left")
        if self.user["role"]=="approver":
            for action in ("approve","reject"):
                ttk.Button(toolbar,text=action.title()+" selected",command=lambda a=action:self.safe(lambda:self.transition(a))).pack(side="left",padx=(0,8))
        if self.user["role"]=="auditor":
            ttk.Button(toolbar,text="Audit history",command=lambda:self.safe(self.show_audit)).pack(side="left",padx=(0,8))
            ttk.Button(toolbar,text="Backup database",command=lambda:self.safe(self.backup)).pack(side="left")
        ttk.Button(toolbar,text="Sign out",command=self.sign_out).pack(side="right")
        ttk.Button(toolbar,text="Refresh",command=lambda:self.safe(self.refresh)).pack(side="right",padx=8)
        self.filter=ttk.Combobox(self.body,values=("all","draft","submitted","approved","rejected"),state="readonly",width=22)
        self.filter.set("all")
        self.filter.pack(anchor="w",pady=(0,12))
        self.filter.bind("<<ComboboxSelected>>",lambda e:self.safe(self.refresh))
        self.summary=tk.StringVar()
        ttk.Label(self.body,textvariable=self.summary).pack(anchor="w",pady=(0,12))
        self.table=self.make_table(self.body,("id","title","supplier","owner","amount","status","revision"),(85,230,170,110,150,110,75))
        self.refresh()

    def make_table(self,parent,columns,widths):
        holder=ttk.Frame(parent)
        holder.pack(fill="both",expand=True)
        holder.rowconfigure(0,weight=1)
        holder.columnconfigure(0,weight=1)
        tree=ttk.Treeview(holder,columns=columns,show="headings",selectmode="browse")
        for col,width in zip(columns,widths):
            tree.heading(col,text=col.replace("_"," ").title())
            tree.column(col,width=width,minwidth=60)
        tree.grid(row=0,column=0,sticky="nsew")
        scroll=ttk.Scrollbar(holder,orient="vertical",command=tree.yview)
        scroll.grid(row=0,column=1,sticky="ns")
        horizontal=ttk.Scrollbar(holder,orient="horizontal",command=tree.xview)
        horizontal.grid(row=1,column=0,sticky="ew")
        tree.configure(yscrollcommand=scroll.set,xscrollcommand=horizontal.set)
        return tree

    def refresh(self):
        snapshot=self.store.snapshot(self.token)
        self.user=snapshot["user"]
        rows=snapshot["requests"]
        self.rows={str(row["id"]):row for row in rows}
        for iid in self.table.get_children(): self.table.delete(iid)
        for row in rows:
            if self.filter.get() not in ("all",row["status"]): continue
            amount=row["currency"]+" "+f'{row["amount_minor"]//100:,}.{row["amount_minor"]%100:02d}'
            self.table.insert("","end",iid=str(row["id"]),values=(f'PR-{row["id"]:05}',row["title"],row["supplier"],row["owner"],amount,row["status"],row["version"]))
        self.summary.set(f'{len(rows)} requests  |  {sum(r["status"]=="submitted" for r in rows)} awaiting approval  |  {sum(r["status"]=="approved" for r in rows)} approved')
        self.status.set("Local data saved in " + self.store.path)

    def new_request(self):
        dialog=tk.Toplevel(self.root)
        dialog.title("New purchase request")
        dialog.transient(self.root)
        dialog.geometry("490x470")
        dialog.grab_set()
        panel=ttk.Frame(dialog,padding=24)
        panel.pack(fill="both",expand=True)
        title=self.field(panel,"What do you need?")
        supplier=self.field(panel,"Proposed supplier")
        amount=self.field(panel,"Estimated amount (e.g. 1250.50)")
        ttk.Label(panel,text="Currency").pack(anchor="w",pady=(8,3))
        currency=ttk.Combobox(panel,values=("INR","USD","EUR","GBP"),state="readonly")
        currency.set("INR")
        currency.pack(fill="x")
        key=secrets.token_hex(16)
        def save():
            command={"action":"create","title":title.get(),"supplier":supplier.get(),"amount_minor":money(amount.get()),"currency":currency.get()}
            self.store.command(self.token,self.user["csrf"],key,command)
            dialog.destroy()
            self.refresh()
            self.status.set("Draft created. Select it and choose Submit selected.")
        ttk.Button(panel,text="Save draft",command=lambda:self.safe(save)).pack(anchor="e",pady=22)
        title.focus_set()

    def transition(self,action):
        selected=self.table.selection()
        if not selected:
            raise Problem(400,"Select a purchase request first.")
        row=self.rows[selected[0]]
        if not messagebox.askyesno(action.title()+" request", f'{action.title()} PR-{row["id"]:05}: {row["title"]}?', parent=self.root): return
        self.store.command(self.token,self.user["csrf"],secrets.token_hex(16),{"action":action,"id":row["id"],"version":row["version"]})
        self.refresh()
        self.status.set("Request " + {"submit":"submitted","approve":"approved","reject":"rejected"}[action] + ".")

    def show_audit(self):
        result=self.store.events(self.token)
        dialog=tk.Toplevel(self.root)
        dialog.title("Audit history")
        dialog.geometry("900x520")
        panel=ttk.Frame(dialog,padding=20)
        panel.pack(fill="both",expand=True)
        ttk.Label(panel,text="Retained audit chain verified" if result["chain_valid"] else "WARNING: audit chain verification failed",style="Title.TLabel").pack(anchor="w",pady=(0,12))
        ttk.Label(panel,text="Hash linkage detects edits to retained entries; it does not prevent a database administrator rewriting the chain.",wraplength=820).pack(anchor="w",pady=(0,16))
        tree=self.make_table(panel,("id","time","actor","action"),(60,190,170,270))
        for row in reversed(result["events"]):
            event=json.loads(row["event"])
            tree.insert("","end",values=(row["seq"],datetime.fromtimestamp(event["at"]).strftime("%Y-%m-%d %H:%M:%S"),event["actor"],event["action"]))

    def backup(self):
        self.store.events(self.token)  # Recheck auditor permission/session before filesystem operation.
        destination=filedialog.asksaveasfilename(parent=self.root,title="Save a new backup",defaultextension=".db",initialfile="erp-backup-"+datetime.now().strftime("%Y%m%d-%H%M%S")+".db",filetypes=[("SQLite database","*.db")])
        if destination:
            self.store.backup(destination)
            self.status.set("Backup saved and integrity checked: " + destination)

    def sign_out(self):
        def perform():
            try: self.store.logout(self.token,self.user["csrf"])
            except Problem as error:
                if error.status != 401: raise
            for child in self.root.winfo_children():
                if isinstance(child,tk.Toplevel): child.destroy()
            self.token=self.user=None
            self.rows={}
            self.show_login()
            self.status.set("Signed out.")
        self.safe(perform)

    def close(self):
        if self.user:
            try: self.store.logout(self.token,self.user["csrf"])
            except (Problem,sqlite3.Error): pass
        self.root.destroy()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db",type=Path,default=default_database())
    args=parser.parse_args()
    root=tk.Tk()
    try:
        Desktop(root,Store(args.db))
    except Exception as error:
        messagebox.showerror("Cannot open ERP Incubation",str(error),parent=root)
        root.destroy()
        return
    root.mainloop()

if __name__=="__main__": main()
