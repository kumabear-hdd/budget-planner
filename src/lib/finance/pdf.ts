/**
 * PDF export for income & expense data.
 *
 * Generates an A4 report client-side (jsPDF + autoTable) so it works fully
 * offline — same rule as the rest of the app: nothing leaves the device.
 * Layout: branded header, summary block, then a paged transaction table with
 * per-kind colors, rupiah right-aligned, zebra rows and page footers.
 *
 * jsPDF's built-in fonts are WinAnsi: the UI's typographic minus (U+2212) and
 * en dash (U+2013) have no glyph there, so every string passes through
 * `pdfText` which folds them to ASCII.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { categoryName } from "@/lib/finance/defaults";
import { formatIdr } from "@/lib/finance/format";
import type { Category, CurrencyStyle, Transaction } from "@/lib/finance/types";

/** Brand palette — matches src/styles.css tokens. */
const GREEN = [27, 107, 69] as const;
const GREEN_SOFT = [227, 242, 234] as const;
const CREAM = [244, 240, 230] as const;
const INK = [28, 25, 21] as const;
const MUTED = [86, 78, 70] as const;
const EXPENSE = [154, 63, 28] as const;

const PAGE_MARGIN = 14;

function pdfText(value: string): string {
  return value
    .replace(/−/g, "-") // typographic minus
    .replace(/[–—]/g, "-") // en/em dash
    .replace(/·/g, "-");
}

function pdfIdr(amount: number, style: CurrencyStyle): string {
  // formatIdr uses U+2212 for negatives — swap for the ASCII hyphen.
  return pdfText(formatIdr(amount, style));
}

const KIND_LABEL: Record<Transaction["kind"], string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Tabungan",
};

const KIND_COLOR: Record<Transaction["kind"], readonly [number, number, number]> = {
  income: GREEN,
  expense: EXPENSE,
  transfer: MUTED,
};

export interface TransactionsPdfInput {
  /** Transactions to list — already filtered/sorted for the report. */
  transactions: Transaction[];
  categories: Category[];
  currencyStyle: CurrencyStyle;
  /** e.g. "1 Okt 2026 - 31 Okt 2026" or "Semua waktu". */
  periodText: string;
  /** Subtitle line, e.g. active filters. */
  subtitle?: string;
  /** Download filename, e.g. "budget-planner-laporan.pdf". */
  filename: string;
}

export function exportTransactionsPdf(input: TransactionsPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  // ----- Header band -----
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Budget Planner", PAGE_MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(pdfText("Laporan Pemasukan & Pengeluaran"), PAGE_MARGIN, 22);

  // ----- Meta lines -----
  doc.setTextColor(...INK);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(pdfText(`Periode: ${input.periodText}`), PAGE_MARGIN, 38);
  const printedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  doc.text(pdfText(`Dicetak: ${printedAt}`), PAGE_MARGIN, 43);
  if (input.subtitle) {
    doc.setTextColor(...MUTED);
    doc.text(pdfText(input.subtitle), PAGE_MARGIN, 48);
  }

  // ----- Summary block -----
  let income = 0;
  let expense = 0;
  let savings = 0;
  for (const tx of input.transactions) {
    if (tx.kind === "income") income += tx.amount;
    else if (tx.kind === "expense") expense += tx.amount;
    else savings += tx.amount;
  }
  const net = income - expense;

  const summaryY = input.subtitle ? 54 : 49;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(220, 212, 196);
  doc.roundedRect(PAGE_MARGIN, summaryY, contentWidth, 22, 2.5, 2.5, "FD");

  const cellW = contentWidth / 4;
  const summary: Array<{ label: string; value: string; color: readonly [number, number, number] }> = [
    { label: "Total pemasukan", value: pdfIdr(income, input.currencyStyle), color: GREEN },
    { label: "Total pengeluaran", value: pdfIdr(expense, input.currencyStyle), color: EXPENSE },
    { label: "Total tabungan", value: pdfIdr(savings, input.currencyStyle), color: MUTED },
    { label: "Arus kas bersih", value: pdfIdr(net, input.currencyStyle), color: net < 0 ? EXPENSE : GREEN },
  ];
  summary.forEach((item, index) => {
    const x = PAGE_MARGIN + cellW * index + 4;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(pdfText(item.label), x, summaryY + 8);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...item.color);
    doc.text(item.value, x, summaryY + 16);
    if (index > 0) {
      doc.setDrawColor(220, 212, 196);
      doc.line(PAGE_MARGIN + cellW * index, summaryY + 4, PAGE_MARGIN + cellW * index, summaryY + 18);
    }
  });

  // ----- Transaction table -----
  const bodyStart = summaryY + 30;
  if (input.transactions.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text("Tidak ada transaksi pada periode ini.", PAGE_MARGIN, bodyStart + 6);
  } else {
    autoTable(doc, {
      startY: bodyStart,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
      head: [["Tanggal", "Jenis", "Nama", "Kategori", "Catatan", "Jumlah (Rp)"]],
      body: input.transactions.map((tx) => [
        pdfText(tx.date),
        KIND_LABEL[tx.kind],
        pdfText(tx.name),
        pdfText(categoryName(input.categories, tx.categoryId)),
        pdfText(tx.notes || "-"),
        { content: pdfIdr(tx.amount, input.currencyStyle), styles: { halign: "right" } },
      ]),
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: [...INK],
        lineColor: [227, 218, 203],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [...GREEN],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [...GREEN_SOFT] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 20 },
        2: { cellWidth: 44 },
        3: { cellWidth: 28 },
        4: { cellWidth: 34 },
        5: { cellWidth: 34, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // Color the "Jenis" cell to match the row kind.
        if (data.section === "body" && data.column.index === 1) {
          const tx = input.transactions[data.row.index];
          if (tx) data.cell.styles.textColor = [...KIND_COLOR[tx.kind]];
        }
      },
    });
  }

  // ----- Footers -----
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 212, 196);
    doc.line(PAGE_MARGIN, doc.internal.pageSize.getHeight() - 12, pageWidth - PAGE_MARGIN, doc.internal.pageSize.getHeight() - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("Budget Planner - data tersimpan di perangkat Anda", PAGE_MARGIN, doc.internal.pageSize.getHeight() - 7);
    doc.text(pdfText(`Halaman ${page} dari ${totalPages}`), pageWidth - PAGE_MARGIN, doc.internal.pageSize.getHeight() - 7, {
      align: "right",
    });
  }

  doc.save(input.filename);
}
