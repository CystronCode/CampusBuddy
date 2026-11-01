import re
import docx
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl

def convert_docx_to_md(docx_path, md_path):
    doc = docx.Document(docx_path)
    md_lines = []

    for child in doc.element.body:
        if isinstance(child, CT_P):
            p = docx.text.paragraph.Paragraph(child, doc)
            text = p.text.strip()
            if not text:
                continue

            # Heading detection
            if text == "Campus Intelligence: Production MVP":
                md_lines.append(f"# {text}\n")
            elif text == "End-to-End Systems Engineering & Implementation Build Guide":
                md_lines.append(f"## {text}\n")
            elif text.startswith("PHASE "):
                md_lines.append(f"\n---\n\n# {text}\n")
            elif re.match(r"^\d\.\d\s+", text):
                md_lines.append(f"\n## {text}\n")
            elif p.runs and p.runs[0].bold and (p.runs[0].font.size and p.runs[0].font.size.pt >= 11):
                md_lines.append(f"\n### {text}\n")
            else:
                md_lines.append(f"{text}\n")

        elif isinstance(child, CT_Tbl):
            tbl = docx.table.Table(child, doc)
            rows = len(tbl.rows)
            cols = len(tbl.columns)

            if rows == 1 and cols == 1:
                cell_text = tbl.cell(0, 0).text.strip()
                # Check if it's a code block
                if cell_text.startswith("# Syntax:"):
                    lines = cell_text.splitlines()
                    syntax_line = lines[0]
                    lang = syntax_line.replace("# Syntax:", "").strip()
                    code_content = "\n".join(lines[1:]).strip()
                    md_lines.append(f"```{lang}\n{code_content}\n```\n")
                # Check if it's a callout box
                elif cell_text.startswith("[INFO]") or cell_text.startswith("[WARNING]"):
                    lines = cell_text.splitlines()
                    title_line = lines[0]
                    body_lines = lines[1:]
                    alert_type = "NOTE" if "[INFO]" in title_line else "WARNING"
                    clean_title = re.sub(r"^\[.*?\]\s*", "", title_line)
                    md_lines.append(f"> [!{alert_type}]\n> **{clean_title}**\n>")
                    for bl in body_lines:
                        md_lines.append(f"> {bl}")
                    md_lines.append("")
                else:
                    md_lines.append(f"> {cell_text}\n")
            else:
                # Regular or checklist table
                headers = [tbl.cell(0, c).text.strip().replace("\n", " ") for c in range(cols)]
                md_lines.append("| " + " | ".join(headers) + " |")
                md_lines.append("| " + " | ".join(["---"] * cols) + " |")

                for r in range(1, rows):
                    row_vals = []
                    for c in range(cols):
                        val = tbl.cell(r, c).text.strip().replace("\n", "<br/>").replace("|", "\\|")
                        row_vals.append(val)
                    md_lines.append("| " + " | ".join(row_vals) + " |")
                md_lines.append("")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    print(f"Successfully converted {docx_path} to {md_path}")

if __name__ == "__main__":
    convert_docx_to_md(
        r"d:\CampusOS\Campus_Intelligence_Production_Build_Guide.docx",
        r"d:\CampusOS\Campus_Intelligence_Production_Build_Guide.md"
    )
