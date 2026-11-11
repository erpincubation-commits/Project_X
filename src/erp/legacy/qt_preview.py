"""Read-only Qt capability browser; the Tk workbench remains the working ERP."""
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QApplication, QComboBox, QHeaderView, QLabel, QMainWindow, QTableWidget,
    QTableWidgetItem, QVBoxLayout, QWidget,
)

from .catalog import MODULES, features


class Preview(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ERP Desktop — Qt preview")
        self.resize(1000, 650)
        container = QWidget()
        layout = QVBoxLayout(container)
        title = QLabel("ERP capability browser — read-only preview")
        title.setStyleSheet("font-size: 20px; font-weight: bold;")
        layout.addWidget(title)
        note = QLabel("This preview does not open your database or perform transactions. Available features refer to the existing Tk workbench.")
        note.setWordWrap(True)
        layout.addWidget(note)
        self.selector = QComboBox()
        self.selector.addItem("All modules")
        self.selector.addItems([module[0] for module in MODULES])
        layout.addWidget(self.selector)
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Module", "Capability", "Status", "Scope"])
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(self.table)
        self.setCentralWidget(container)
        self.selector.currentTextChanged.connect(self.refresh)
        self.refresh()

    def refresh(self, *_):
        selected = self.selector.currentText()
        rows = [row for row in features() if selected == "All modules" or row["module"] == selected]
        self.table.setRowCount(len(rows))
        for index, row in enumerate(rows):
            for column, key in enumerate(("module", "feature", "status", "scope")):
                item = QTableWidgetItem(row[key])
                item.setToolTip(row[key])
                self.table.setItem(index, column, item)


def main():
    app = QApplication(sys.argv)
    window = Preview()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
