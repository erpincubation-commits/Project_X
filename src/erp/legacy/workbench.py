"""Native ERP workbench: passwordless testing build with an explicit capability map."""
import argparse
import csv
import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import ttk, filedialog, messagebox
from .desktop import Desktop, default_database, money
from .testing_workspace import TestingStore
from .core import Problem
from .catalog import MODULES, features
from .modules import BusinessModules

BG="#f3f5f9"
NAV="#162237"
INK="#202d43"
MUTED="#738096"
BLUE="#3267e3"

def csv_value(value):
    text=str(value)
    return "'"+text if text.lstrip().startswith(("=","+","-","@")) or text.startswith(("\t","\r","\n")) else text

class Workbench(Desktop):
    def __init__(self,root,store):
        self.root,self.store=root,store
        self.token=self.user=None
        self.modules=BusinessModules(store)
        self.modules.seed()
        self.modules.seed_demo_stock()
        self.rows={}
        self.page="Overview"
        self.nav_buttons={}
        root.title("ERP Incubation | Business workspace - TESTING")
        root.geometry("1320x850")
        root.minsize(1080,720)
        root.configure(bg=BG)
        self.style=ttk.Style(root)
        self.style.theme_use("clam")
        for name,settings in {
            "TFrame":{"background":BG},
            "Card.TFrame":{"background":"white"},
            "TLabel":{"background":BG,"foreground":INK,"font":("Segoe UI",10)},
            "Muted.TLabel":{"foreground":MUTED},
            "Title.TLabel":{"font":("Segoe UI",24,"bold")},
            "TButton":{"font":("Segoe UI",10),"padding":(14,9),"background":"white","foreground":INK,"borderwidth":1},
            "Primary.TButton":{"background":BLUE,"foreground":"white","borderwidth":0},
            "TEntry":{"padding":9,"fieldbackground":"white","bordercolor":"#dce2ec"},
            "TCombobox":{"padding":8,"fieldbackground":"white","arrowsize":14},
            "Treeview":{"background":"white","fieldbackground":"white","foreground":INK,"rowheight":43,"font":("Segoe UI",10),"borderwidth":0},
            "Treeview.Heading":{"background":"#edf1f8","foreground":"#63718a","font":("Segoe UI",9,"bold"),"padding":(12,12),"relief":"flat"}
        }.items(): self.style.configure(name,**settings)
        self.style.map("Primary.TButton",background=[("active","#2554c1")])
        self.style.map("Treeview",background=[("selected","#e5edff")],foreground=[("selected","#184398")])
        self.sidebar=tk.Frame(root,bg=NAV,width=218)
        self.sidebar.pack(side="left",fill="y")
        self.sidebar.pack_propagate(False)
        tk.Label(self.sidebar,text="incubation",font=("Segoe UI",23,"bold"),bg=NAV,fg="white").pack(anchor="w",padx=23,pady=(25,0))
        tk.Label(self.sidebar,text="BUSINESS WORKSPACE",font=("Segoe UI",8),bg=NAV,fg="#8798b4").pack(anchor="w",padx=25,pady=(0,26))
        badge=tk.Frame(self.sidebar,bg="#22324b",padx=14,pady=12)
        badge.pack(fill="x",padx=17,pady=(0,24))
        tk.Label(badge,text="Demo company",font=("Segoe UI",11,"bold"),bg="#22324b",fg="white").pack(anchor="w")
        tk.Label(badge,text="Local workspace  /  INR",font=("Segoe UI",9),bg="#22324b",fg="#a8bad2").pack(anchor="w",pady=(4,0))
        tk.Label(self.sidebar,text="WORKSPACE",bg=NAV,fg="#8192ad",font=("Segoe UI",8,"bold")).pack(anchor="w",padx=25,pady=(0,8))
        for number,name in enumerate(("Overview","Purchase requests","Finance","Sales & CRM","Inventory","Reports","Administration","Feature map"),1):
            button=tk.Button(self.sidebar,text=f"{number:02}   {name}",font=("Segoe UI",10),anchor="w",bg=NAV,fg="#b9c6d9",activebackground="#2b4265",activeforeground="white",relief="flat",borderwidth=0,padx=16,pady=12,cursor="hand2",command=lambda n=name:self.safe(lambda:self.navigate(n)))
            button.pack(fill="x",padx=12,pady=2)
            self.nav_buttons[name]=button
        tk.Label(self.sidebar,text="DESKTOP EDITION  0.3\nLocal data. No browser.",bg=NAV,fg="#7e91ad",font=("Segoe UI",9),justify="left").pack(side="bottom",anchor="w",padx=25,pady=25)
        self.shell=tk.Frame(root,bg=BG)
        self.shell.pack(side="left",fill="both",expand=True)
        top=tk.Frame(self.shell,bg="white",height=74,padx=28)
        top.pack(fill="x"); top.pack_propagate(False)
        self.breadcrumb=tk.StringVar(value="WORKSPACE / OVERVIEW")
        tk.Label(top,textvariable=self.breadcrumb,bg="white",fg=MUTED,font=("Segoe UI",9,"bold")).pack(side="left")
        tk.Label(top,text="TEST MODE  ·  NO PASSWORD",bg="#fff2d7",fg="#966415",font=("Segoe UI",9,"bold"),padx=10,pady=7).pack(side="right",padx=(14,0))
        self.role=ttk.Combobox(top,values=("Requester","Approver","Auditor"),state="readonly",width=14)
        self.role.pack(side="right")
        tk.Label(top,text="Test as  ",bg="white",fg=MUTED,font=("Segoe UI",9)).pack(side="right")
        self.role.bind("<<ComboboxSelected>>",lambda e:self.safe(lambda:self.switch_role(self.role.get().lower())))
        self.body=ttk.Frame(self.shell,padding=(28,22))
        self.body.pack(fill="both",expand=True)
        self.status=tk.StringVar(value="Test workspace only. Use sample data.")
        ttk.Label(self.shell,textvariable=self.status,style="Muted.TLabel",padding=(28,10)).pack(fill="x")
        root.protocol("WM_DELETE_WINDOW",self.close)
        root.bind("<F5>",lambda e:self.safe(lambda:self.navigate(self.page)))
        root.bind("<Control-n>",lambda e:self.new_request() if self.user and self.user["role"]=="requester" else None)
        self.switch_role("requester")

    def switch_role(self,role):
        if self.user:
            try:self.store.logout(self.token,self.user["csrf"])
            except Problem as error:
                if error.status!=401:raise
        for widget in self.root.winfo_children():
            if isinstance(widget,tk.Toplevel): widget.destroy()
        self.token,self.user=self.store.enter_role(role)
        self.role.set(role.title())
        self.navigate(self.page)

    def show_login(self):
        self.clear()
        self.heading("Choose a test role", "No password is required in this isolated test workspace.")
        for role in ("requester","approver","auditor"):
            ttk.Button(self.body,text="Continue as "+role,command=lambda r=role:self.safe(lambda:self.switch_role(r))).pack(anchor="w",pady=8)

    def navigate(self,page):
        self.page=page
        self.clear()
        self.breadcrumb.set("WORKSPACE / "+page.upper())
        for name,button in self.nav_buttons.items():
            button.configure(bg="#2b4265" if page==name else NAV,fg="white" if page==name else "#b9c6d9")
        if page=="Overview": self.overview()
        elif page=="Purchase requests": self.show_workspace()
        elif page=="Finance": self.finance_page()
        elif page=="Inventory": self.inventory_page()
        elif page=="Feature map": self.feature_map()
        else: self.module_page(page)
        self.status.set("TEST WORKSPACE  |  Synthetic examples and your test entries  |  F5 Refresh  |  Ctrl+N New request")

    def card(self,parent,padding=18):
        return tk.Frame(parent,bg="white",highlightbackground="#e0e6ef",highlightthickness=1,padx=padding,pady=padding)

    def metrics(self,rows):
        grid=ttk.Frame(self.body)
        grid.pack(fill="x",pady=(0,22))
        values=[("TOTAL REQUESTS",len(rows),"Visible to your role",BLUE),("AWAITING APPROVAL",sum(r["status"]=="submitted" for r in rows),"Ready for a decision","#b27b1d"),("APPROVED",sum(r["status"]=="approved" for r in rows),"Independent review complete","#219577"),("DRAFTS",sum(r["status"]=="draft" for r in rows),"Not yet submitted",MUTED)]
        for i,(label,value,detail,color) in enumerate(values):
            grid.columnconfigure(i,weight=1,uniform="metric")
            card=self.card(grid)
            card.grid(row=0,column=i,sticky="ew",padx=(0,12) if i<3 else 0)
            tk.Label(card,text=label,bg="white",fg=MUTED,font=("Segoe UI",8,"bold")).pack(anchor="w")
            tk.Label(card,text=str(value),bg="white",fg=color,font=("Segoe UI",30,"bold")).pack(anchor="w",pady=5)
            tk.Label(card,text=detail,bg="white",fg=MUTED,font=("Segoe UI",8)).pack(anchor="w")

    def overview(self):
        self.heading("Business overview", "A clear view of your purchase activity. All figures below come from this local test workspace.")
        rows=self.store.snapshot(self.token)["requests"]
        self.metrics(rows)
        bar=ttk.Frame(self.body); bar.pack(fill="x",pady=(0,15))
        ttk.Label(bar,text="Recent purchase requests",font=("Segoe UI",14,"bold")).pack(side="left")
        ttk.Button(bar,text="Open purchase register  →",command=lambda:self.navigate("Purchase requests")).pack(side="right")
        self.table=self.make_table(self.body,("reference","request","supplier","amount","status"),(100,260,200,150,130))
        for row in rows[:8]:
            self.table.insert("","end",values=(f'PR-{row["id"]:05}',row["title"],row["supplier"],self.format_amount(row),row["status"].title()))
        bottom=self.card(self.body,14); bottom.pack(fill="x",pady=(18,0))
        tk.Label(bottom,text="YOUR ERP ROADMAP",bg="white",fg=BLUE,font=("Segoe UI",9,"bold")).pack(anchor="w")
        all_features=features(); live=sum(f["status"]=="Available" for f in all_features)
        tk.Label(bottom,text=f"{len(MODULES)} business areas mapped  •  {live} available capabilities  •  Review planned modules in Feature map",bg="white",fg=MUTED,font=("Segoe UI",10)).pack(anchor="w",pady=(6,0))

    @staticmethod
    def format_amount(row): return row["currency"]+" "+f'{row["amount_minor"]//100:,}.{row["amount_minor"]%100:02d}'

    def show_workspace(self):
        self.page="Purchase requests"
        self.clear()
        self.heading("Purchase requests", "Capture purchase intent, route it for review and track every decision.")
        toolbar=ttk.Frame(self.body); toolbar.pack(fill="x",pady=(0,15))
        self.search=tk.StringVar()
        search=ttk.Entry(toolbar,textvariable=self.search,width=28); search.pack(side="left",padx=(0,10))
        self.search.trace_add("write",lambda *args:self.safe(self.refresh))
        self.filter=ttk.Combobox(toolbar,values=("all","draft","submitted","approved","rejected"),state="readonly",width=15)
        self.filter.set("all"); self.filter.pack(side="left")
        self.filter.bind("<<ComboboxSelected>>",lambda e:self.safe(self.refresh))
        ttk.Button(toolbar,text="Export CSV",command=lambda:self.safe(self.export_requests)).pack(side="right",padx=(8,0))
        if self.user["role"]=="requester":
            ttk.Button(toolbar,text="+ New request",style="Primary.TButton",command=self.new_request).pack(side="right")
        actions=ttk.Frame(self.body); actions.pack(fill="x",pady=(0,14))
        self.summary=tk.StringVar()
        ttk.Label(actions,textvariable=self.summary,style="Muted.TLabel").pack(side="left")
        if self.user["role"]=="requester":
            ttk.Button(actions,text="Submit selected",command=lambda:self.safe(lambda:self.transition("submit"))).pack(side="right")
        if self.user["role"]=="approver":
            for action in ("approve","reject"):
                ttk.Button(actions,text=action.title()+" selected",command=lambda a=action:self.safe(lambda:self.transition(a))).pack(side="right",padx=4)
        self.table=self.make_table(self.body,("id","request","supplier","amount","status","owner","revision"),(95,230,170,140,100,115,70))
        self.table.tag_configure("approved",foreground="#16836a")
        self.table.tag_configure("submitted",foreground="#9e6a12")
        self.table.tag_configure("rejected",foreground="#b25459")
        self.refresh()

    def refresh(self):
        if self.page!="Purchase requests":
            self.navigate(self.page); return
        snapshot=self.store.snapshot(self.token)
        self.rows={str(r["id"]):r for r in snapshot["requests"]}
        self.visible_rows=[]
        query=self.search.get().strip().lower()
        for row in self.rows.values():
            match=" ".join((f'PR-{row["id"]:05}',row["title"],row["supplier"],row["owner"])).lower()
            if query not in match or self.filter.get() not in ("all",row["status"]): continue
            self.visible_rows.append(row)
        for iid in self.table.get_children(): self.table.delete(iid)
        for row in self.visible_rows:
            self.table.insert("","end",iid=str(row["id"]),values=(f'PR-{row["id"]:05}',row["title"],row["supplier"],self.format_amount(row),row["status"].title(),row["owner"],row["version"]),tags=(row["status"],))
        self.summary.set(f"{len(self.visible_rows)} of {len(self.rows)} requests  |  Search by reference, request or supplier")

    def export_requests(self):
        self.refresh()  # Recheck permission/session before export.
        path=filedialog.asksaveasfilename(parent=self.root,title="Export purchase register",defaultextension=".csv",initialfile="purchase-register.csv",filetypes=[("CSV","*.csv")])
        if not path:return
        with open(path,"w",newline="",encoding="utf-8-sig") as file:
            writer=csv.writer(file); writer.writerow(["Reference","Request","Supplier","Currency","Amount minor units","Status","Owner","Revision"])
            for r in self.visible_rows:writer.writerow([csv_value(v) for v in (f'PR-{r["id"]:05}',r["title"],r["supplier"],r["currency"],r["amount_minor"],r["status"],r["owner"],r["version"])])
        self.status.set("Exported "+str(len(self.visible_rows))+" requests.")

    @staticmethod
    def format_minor(value):
        return "INR "+f'{value//100:,}.{value%100:02d}'

    @staticmethod
    def format_quantity(value):
        return f"{value//1000:,}.{value%1000:03d}"

    def finance_page(self):
        self.heading("Finance", "Post balanced test journals and review the trial balance. Purchase approvals do not create accounting entries yet.")
        controls=ttk.Frame(self.body); controls.pack(fill="x",pady=(0,16))
        if self.user["role"]=="requester":
            ttk.Button(controls,text="+ New journal",style="Primary.TButton",command=self.new_journal).pack(side="left")
        ttk.Button(controls,text="Trial balance",command=lambda:self.safe(self.show_trial_balance)).pack(side="right")
        self.finance_summary=tk.StringVar(); ttk.Label(self.body,textvariable=self.finance_summary,style="Muted.TLabel").pack(anchor="w",pady=(0,10))
        self.ledger_table=self.make_table(self.body,("reference","date","narration","account","debit","credit","posted by"),(105,100,250,220,120,120,120))
        self.refresh_finance()

    def refresh_finance(self):
        rows=self.modules.ledger(self.token)
        for iid in self.ledger_table.get_children(): self.ledger_table.delete(iid)
        total=sum(r["debit_minor"] for r in rows)
        for r in rows:
            self.ledger_table.insert("","end",values=(r["reference"],r["entry_date"],r["narration"],r["account_code"]+" · "+r["name"],self.format_minor(r["debit_minor"]) if r["debit_minor"] else "",self.format_minor(r["credit_minor"]) if r["credit_minor"] else "",r["created_by"]))
        self.finance_summary.set(f"{len(rows)//2} journals  |  Posted debits: {self.format_minor(total)}  |  View trial balance before relying on financial data")

    def new_journal(self):
        accounts=self.modules.accounts(self.token)
        labels=[a["code"]+" · "+a["name"] for a in accounts]; codes={label:label.split(" · ")[0] for label in labels}
        dialog=tk.Toplevel(self.root); dialog.title("Post journal voucher"); dialog.geometry("600x530"); dialog.transient(self.root); dialog.grab_set()
        panel=ttk.Frame(dialog,padding=26); panel.pack(fill="both",expand=True)
        ttk.Label(panel,text="New journal voucher",style="Title.TLabel").pack(anchor="w")
        ttk.Label(panel,text="A voucher posts only when debit equals credit. Reversal and edit workflows are not implemented.",wraplength=530,style="Muted.TLabel").pack(anchor="w",pady=(6,14))
        voucher_date=self.field(panel,"Voucher date (YYYY-MM-DD)",date.today().isoformat())
        narration=self.field(panel,"Narration")
        grid=ttk.Frame(panel); grid.pack(fill="x",pady=(10,0)); grid.columnconfigure(0,weight=1); grid.columnconfigure(1,weight=1)
        ttk.Label(grid,text="Debit account").grid(row=0,column=0,sticky="w"); ttk.Label(grid,text="Credit account").grid(row=0,column=1,sticky="w")
        debit=ttk.Combobox(grid,values=labels,state="readonly"); debit.grid(row=1,column=0,sticky="ew",padx=(0,8)); debit.set(labels[0])
        credit=ttk.Combobox(grid,values=labels,state="readonly"); credit.grid(row=1,column=1,sticky="ew"); credit.set(labels[4])
        amount=self.field(panel,"Amount (INR)")
        def post():
            value=money(amount.get())
            if debit.get()==credit.get(): raise Problem(400,"Debit and credit accounts must be different")
            self.modules.post_journal(self.token,self.user["csrf"],secrets.token_hex(16),voucher_date.get(),narration.get(),[{"account_code":codes[debit.get()],"debit_minor":value,"credit_minor":0},{"account_code":codes[credit.get()],"debit_minor":0,"credit_minor":value}])
            dialog.destroy(); self.refresh_finance(); self.status.set("Balanced journal posted.")
        ttk.Button(panel,text="Post balanced journal",style="Primary.TButton",command=lambda:self.safe(post)).pack(anchor="e",pady=22)
        narration.focus_set()

    def show_trial_balance(self):
        rows=self.modules.trial_balance(self.token)
        dialog=tk.Toplevel(self.root); dialog.title("Trial balance"); dialog.geometry("800x540"); dialog.transient(self.root)
        panel=ttk.Frame(dialog,padding=20); panel.pack(fill="both",expand=True)
        ttk.Label(panel,text="Trial balance",style="Title.TLabel").pack(anchor="w")
        ttk.Label(panel,text="Balances are calculated from posted local journal entries only.",style="Muted.TLabel").pack(anchor="w",pady=(5,14))
        table=self.make_table(panel,("code","account","type","debit","credit"),(90,260,120,140,140))
        debit=credit=0
        for r in rows:
            debit+=r["balance_debit_minor"]; credit+=r["balance_credit_minor"]
            table.insert("","end",values=(r["code"],r["name"],r["account_type"],self.format_minor(r["balance_debit_minor"]) if r["balance_debit_minor"] else "",self.format_minor(r["balance_credit_minor"]) if r["balance_credit_minor"] else ""))
        ttk.Label(panel,text=f"Total debits: {self.format_minor(debit)}     Total credits: {self.format_minor(credit)}",style="Muted.TLabel").pack(anchor="e",pady=13)

    def inventory_page(self):
        self.heading("Inventory", "Manage test stock movements against a local item and warehouse register. No valuation, serial tracking or purchase integration yet.")
        controls=ttk.Frame(self.body); controls.pack(fill="x",pady=(0,16))
        if self.user["role"]=="requester": ttk.Button(controls,text="+ Stock adjustment",style="Primary.TButton",command=self.new_stock_adjustment).pack(side="left")
        if self.user["role"]=="requester": ttk.Button(controls,text="Transfer stock",command=self.new_stock_transfer).pack(side="left",padx=8)
        self.stock_summary=tk.StringVar(); ttk.Label(self.body,textvariable=self.stock_summary,style="Muted.TLabel").pack(anchor="w",pady=(0,10))
        self.stock_table=self.make_table(self.body,("item","description","warehouse","unit","on hand"),(140,280,180,100,160))
        self.refresh_inventory()

    def refresh_inventory(self):
        rows=self.modules.stock_balance(self.token)
        for iid in self.stock_table.get_children(): self.stock_table.delete(iid)
        for r in rows: self.stock_table.insert("","end",values=(r["code"],r["name"],r["warehouse"],r["unit"],self.format_quantity(r["quantity_milli"])))
        self.stock_summary.set(f"{len(rows)} item / warehouse balances  |  Quantities are maintained to three decimal places")

    def new_stock_adjustment(self):
        masters=self.modules.masters(self.token)
        item_labels=[r["code"]+" · "+r["name"] for r in masters["items"]]; item_codes={x:x.split(" · ")[0] for x in item_labels}
        wh_labels=[r["code"]+" · "+r["name"] for r in masters["warehouses"]]; wh_codes={x:x.split(" · ")[0] for x in wh_labels}
        dialog=tk.Toplevel(self.root); dialog.title("Stock adjustment"); dialog.geometry("560x500"); dialog.transient(self.root); dialog.grab_set()
        panel=ttk.Frame(dialog,padding=26); panel.pack(fill="both",expand=True)
        ttk.Label(panel,text="Stock adjustment",style="Title.TLabel").pack(anchor="w")
        ttk.Label(panel,text="Use a positive quantity for receipt or a negative quantity for issue. Negative stock is blocked.",wraplength=490,style="Muted.TLabel").pack(anchor="w",pady=(6,14))
        ttk.Label(panel,text="Item").pack(anchor="w"); item=ttk.Combobox(panel,values=item_labels,state="readonly"); item.set(item_labels[0]); item.pack(fill="x",pady=(3,8))
        ttk.Label(panel,text="Warehouse").pack(anchor="w"); warehouse=ttk.Combobox(panel,values=wh_labels,state="readonly"); warehouse.set(wh_labels[0]); warehouse.pack(fill="x",pady=(3,8))
        quantity=self.field(panel,"Quantity (e.g. 12.5 or -2)")
        movement_date=self.field(panel,"Movement date (YYYY-MM-DD)",date.today().isoformat())
        note=self.field(panel,"Reason / note")
        def parse_qty(text):
            if not __import__("re").fullmatch(r"-?\d{1,10}(\.\d{1,3})?",text.strip()): raise Problem(400,"Use a non-zero quantity with up to three decimal places")
            negative=text.strip().startswith("-"); whole,_,fraction=text.strip().lstrip("-").partition("."); value=int(whole)*1000+int(fraction.ljust(3,"0"))
            if value==0: raise Problem(400,"Quantity must not be zero")
            return -value if negative else value
        def post():
            self.modules.adjust_stock(self.token,self.user["csrf"],secrets.token_hex(16),item_codes[item.get()],wh_codes[warehouse.get()],parse_qty(quantity.get()),movement_date.get(),note.get())
            dialog.destroy(); self.refresh_inventory(); self.status.set("Stock movement recorded.")
        ttk.Button(panel,text="Record adjustment",style="Primary.TButton",command=lambda:self.safe(post)).pack(anchor="e",pady=18)

    def new_stock_transfer(self):
        masters=self.modules.masters(self.token)
        items={r["code"]+" · "+r["name"]:r["code"] for r in masters["items"]}
        warehouses={r["code"]+" · "+r["name"]:r["code"] for r in masters["warehouses"]}
        if not items or len(warehouses)<2: raise Problem(400,"A transfer needs an item and two active warehouses")
        dialog=tk.Toplevel(self.root); dialog.title("Transfer stock"); dialog.geometry("560x590"); dialog.transient(self.root); dialog.grab_set()
        panel=ttk.Frame(dialog,padding=26); panel.pack(fill="both",expand=True)
        ttk.Label(panel,text="Transfer stock",style="Title.TLabel").pack(anchor="w")
        ttk.Label(panel,text="Moves test stock between warehouses. The source cannot go negative.",wraplength=490,style="Muted.TLabel").pack(anchor="w",pady=(6,14))
        def choice(label,values,initial):
            ttk.Label(panel,text=label).pack(anchor="w")
            widget=ttk.Combobox(panel,values=list(values),state="readonly"); widget.current(initial); widget.pack(fill="x",pady=(3,8)); return widget
        item=choice("Item",items,0); source=choice("From warehouse",warehouses,0); destination=choice("To warehouse",warehouses,1)
        quantity=self.field(panel,"Quantity (up to three decimal places)")
        movement_date=self.field(panel,"Movement date (YYYY-MM-DD)",date.today().isoformat())
        note=self.field(panel,"Reason / note")
        key=secrets.token_hex(16)
        def post():
            value=quantity.get().strip()
            if not __import__("re").fullmatch(r"\d{1,10}(\.\d{1,3})?",value): raise Problem(400,"Use a positive quantity with up to three decimal places")
            whole,_,fraction=value.partition(".")
            self.modules.transfer_stock(self.token,self.user["csrf"],key,items[item.get()],warehouses[source.get()],warehouses[destination.get()],int(whole)*1000+int(fraction.ljust(3,"0")),movement_date.get(),note.get())
            dialog.destroy(); self.refresh_inventory(); self.status.set("Stock transfer recorded.")
        ttk.Button(panel,text="Record transfer",style="Primary.TButton",command=lambda:self.safe(post)).pack(anchor="e",pady=18)

    def feature_map(self):
        self.heading("Commercial feature map", "A scope map of the intended ERP. Available means implemented here; Planned means it cannot transact yet.")
        bar=ttk.Frame(self.body);bar.pack(fill="x",pady=(0,16))
        self.module_filter=ttk.Combobox(bar,values=["All modules"]+[m[0] for m in MODULES],state="readonly",width=24)
        self.module_filter.set("All modules");self.module_filter.pack(side="left",padx=(0,10))
        self.capability_filter=ttk.Combobox(bar,values=("All statuses","Available","Partial","Planned"),state="readonly",width=18)
        self.capability_filter.set("All statuses");self.capability_filter.pack(side="left")
        ttk.Button(bar,text="Export feature map",command=lambda:self.safe(self.export_catalog)).pack(side="right")
        self.catalog_table=self.make_table(self.body,("module","feature","status","priority"),(160,450,120,85))
        self.detail=tk.StringVar(value="Select a capability to see scope and acceptance criteria. Double-click to open its module.")
        ttk.Label(self.body,textvariable=self.detail,wraplength=850,style="Muted.TLabel").pack(anchor="w",pady=(16,0))
        def populate(*args):
            for iid in self.catalog_table.get_children():self.catalog_table.delete(iid)
            self.catalog_rows={}
            for i,f in enumerate(features()):
                if self.module_filter.get() not in ("All modules",f["module"]) or self.capability_filter.get() not in ("All statuses",f["status"]):continue
                self.catalog_rows[str(i)]=f
                self.catalog_table.insert("","end",iid=str(i),values=(f["module"],f["feature"],f["status"],f["priority"]))
        def selected(*args):
            selection=self.catalog_table.selection()
            if selection:
                f=self.catalog_rows[selection[0]]
                self.detail.set(f["scope"]+"\nAcceptance: "+f["acceptance"]+"\nConnectivity: "+f["connectivity"])
        def open_selected(*args):
            selection=self.catalog_table.selection()
            if selection:self.navigate(self.catalog_rows[selection[0]]["module"])
        self.module_filter.bind("<<ComboboxSelected>>",populate);self.capability_filter.bind("<<ComboboxSelected>>",populate)
        self.catalog_table.bind("<<TreeviewSelect>>",selected);self.catalog_table.bind("<Double-1>",open_selected)
        populate()

    def module_page(self,module):
        summary=next((m[1] for m in MODULES if m[0]==module),"Business capabilities")
        self.heading(module,summary)
        items=[f for f in features() if f["module"]==module]
        available=sum(f["status"]=="Available" for f in items)
        banner=self.card(self.body,16);banner.pack(fill="x",pady=(0,20))
        tk.Label(banner,text="PARTIALLY IMPLEMENTED" if available else "PLANNED MODULE",font=("Segoe UI",9,"bold"),fg=BLUE if available else "#a07428",bg="white").pack(anchor="w")
        tk.Label(banner,text=f"{available} available / {len(items)} mapped capabilities. Planned entries are requirements, not working transactions.",fg=MUTED,bg="white",font=("Segoe UI",10)).pack(anchor="w",pady=(7,0))
        controls=ttk.Frame(self.body);controls.pack(fill="x",pady=(0,16))
        if module in ("Purchasing","Reports"):
            ttk.Button(controls,text="Open purchase register",style="Primary.TButton",command=lambda:self.navigate("Purchase requests")).pack(side="left")
        if module=="Administration" and self.user["role"]=="auditor":
            ttk.Button(controls,text="Audit history",command=lambda:self.safe(self.show_audit)).pack(side="left")
        if module in ("Administration","Deployment") and self.user["role"]=="auditor":
            ttk.Button(controls,text="Backup database",command=lambda:self.safe(self.backup)).pack(side="left",padx=8)
        ttk.Button(controls,text="View full feature map",command=lambda:self.navigate("Feature map")).pack(side="right")
        tree=self.make_table(self.body,("capability","status","scope"),(250,100,530))
        for f in items:tree.insert("","end",values=(f["feature"],f["status"],f["scope"] if f["status"]!="Planned" else f["acceptance"]))

    def export_catalog(self):
        path=filedialog.asksaveasfilename(parent=self.root,title="Export capability map",defaultextension=".csv",initialfile="commercial-feature-map.csv",filetypes=[("CSV","*.csv")])
        if path:
            with open(path,"w",newline="",encoding="utf-8-sig") as file:
                writer=csv.DictWriter(file,fieldnames=list(features()[0]));writer.writeheader();writer.writerows(features())
            self.status.set("Commercial capability map exported.")

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test-db",type=Path,default=default_database().with_name("testing-v03.db"))
    parser.add_argument("--empty",action="store_true",help="Do not add synthetic example requests")
    args=parser.parse_args()
    root=tk.Tk()
    try:
        store=TestingStore(args.test_db)
        if not args.empty:store.seed_examples()
        Workbench(root,store)
    except Exception as error:
        messagebox.showerror("Cannot open test workspace",str(error),parent=root);root.destroy();return
    root.mainloop()

if __name__=="__main__":main()
