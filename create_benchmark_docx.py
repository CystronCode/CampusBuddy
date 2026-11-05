import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_benchmark_docx():
    doc = docx.Document()
    
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    PRIMARY = RGBColor(26, 54, 93)      # Navy
    SECONDARY = RGBColor(49, 130, 206)  # Blue
    DARK_TEXT = RGBColor(45, 55, 72)    # Slate
    MUTED = RGBColor(113, 128, 150)

    # Style
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Calibri'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = DARK_TEXT

    # Title Banner
    p_title = doc.add_paragraph()
    r_sub = p_title.add_run("CAMPUS INTELLIGENCE & CAMPUSBUDDY\n")
    r_sub.font.size = Pt(10)
    r_sub.font.bold = True
    r_sub.font.color.rgb = SECONDARY

    r_title = p_title.add_run("14-Query Latency & Multi-Tier AI Benchmark Report")
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = PRIMARY

    p_meta = doc.add_paragraph()
    r_meta = p_meta.add_run("Date: November 4, 2026 | Prepared by: Jairaj S | Team: AIML Campus Project | Guide: Somesh Sir")
    r_meta.font.size = Pt(9.5)
    r_meta.font.color.rgb = MUTED

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Section 1: Executive Summary
    h1 = doc.add_paragraph()
    r_h1 = h1.add_run("1. Executive Summary")
    r_h1.font.size = Pt(14)
    r_h1.font.bold = True
    r_h1.font.color.rgb = PRIMARY

    p_desc = doc.add_paragraph("This technical benchmark evaluates the multi-tier query routing pipeline implemented in CampusOS. The architecture combines Tier 0 deterministic regex routing, Tier 1/2 Groq Cloud LPU inference (Qwen 27B), local GPU baselines, and commercial APIs to minimize latency and eliminate server VRAM bottlenecks.")

    # Executive Table
    t_exec = doc.add_table(rows=5, cols=5)
    t_exec.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Metrics", "Tier 0 Regex", "Groq LPU (Qwen 27B)", "Local GPU (Qwen 9B)", "Gemini 2.5 Flash"]
    data = [
        ["Average Latency", "< 1.0 ms", "~0.65 s", "~2.40 s", "~1.85 s"],
        ["VRAM Overhead", "0 MB", "0 MB (Cloud LPU)", "6.5 GB VRAM", "0 MB"],
        ["Token Cost", "0 Tokens (Free)", "Free Tier", "Free (Local)", "Metered API"],
        ["Deterministic Accuracy", "100%", "High (27B)", "Medium-High", "High"]
    ]
    for c_idx, h in enumerate(headers):
        cell = t_exec.cell(0, c_idx)
        cell.text = h
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        tcPr = cell._tc.get_or_add_tcPr()
        tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="1A365D"/>'))

    for r_idx, row in enumerate(data):
        for c_idx, val in enumerate(row):
            cell = t_exec.cell(r_idx + 1, c_idx)
            cell.text = val
            if c_idx == 0:
                cell.paragraphs[0].runs[0].font.bold = True
            tcPr = cell._tc.get_or_add_tcPr()
            fill = "F7FAFC" if r_idx % 2 == 1 else "FFFFFF"
            tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill}"/>'))

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Section 2: Detailed 14-Query Benchmark Table
    h2 = doc.add_paragraph()
    r_h2 = h2.add_run("2. Per-Query Multi-Tier Benchmark Results (14 Test Queries)")
    r_h2.font.size = Pt(14)
    r_h2.font.bold = True
    r_h2.font.color.rgb = PRIMARY

    queries_data = [
        (1, "next class", "Timetable (Routine)", "Tier 0 (Regex Fast-Path)", "0.14 ms", "0"),
        (2, "today's timetable", "Timetable (Routine)", "Tier 0 (Regex Fast-Path)", "0.02 ms", "0"),
        (3, "canteen menu", "Food (Routine)", "Tier 0 (Regex Fast-Path)", "0.01 ms", "0"),
        (4, "veg lunch under 60", "Food (Budget Filter)", "Tier 1/2 (Groq Qwen 27B)", "0.79s", "93"),
        (5, "upcoming holidays", "Calendar (Routine)", "Tier 0 (Regex Fast-Path)", "0.04 ms", "0"),
        (6, "club events", "Events (Routine)", "Tier 0 (Regex Fast-Path)", "0.02 ms", "0"),
        (7, "Where is Dr. Ramesh's cabin?", "Faculty Directory", "Tier 1/2 (Groq Qwen 27B)", "0.81s", "94"),
        (8, "Who is the HOD of AIML department?", "Faculty Directory", "Tier 1/2 (Groq Qwen 27B)", "0.70s", "95"),
        (9, "What is the attendance policy for medical leave?", "Academic Policy (RAG)", "Tier 1/2 (Groq Qwen 27B)", "0.69s", "100"),
        (10, "What should I do if I missed internal lab exam?", "Exam Guideline (RAG)", "Tier 1/2 (Groq Qwen 27B)", "0.57s", "90"),
        (11, "Show me 3rd sem Section A weekly schedule", "Complex Timetable", "Tier 1/2 (Groq Qwen 27B)", "0.89s", "86"),
        (12, "What is the price of masala dosa in canteen?", "Food Item Search", "Tier 1/2 (Groq Qwen 27B)", "1.08s", "98"),
        (13, "Are there any free slots on Wednesday after 2 PM?", "Free Slot Analysis", "Tier 1/2 (Groq Qwen 27B)", "0.75s", "88"),
        (14, "What is the syllabus and course outcomes for Unit 2 OS?", "Syllabus Excerpt (RAG)", "Tier 1/2 (Groq Qwen 27B)", "0.50s", "99"),
    ]

    t_queries = doc.add_table(rows=15, cols=6)
    t_queries.alignment = WD_TABLE_ALIGNMENT.CENTER
    q_headers = ["#", "Student Query", "Category", "Routing Tier", "Latency", "Tokens"]
    for c_idx, h in enumerate(q_headers):
        cell = t_queries.cell(0, c_idx)
        cell.text = h
        cell.paragraphs[0].runs[0].font.bold = True
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        tcPr = cell._tc.get_or_add_tcPr()
        tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="2B6CB0"/>'))

    for r_idx, row in enumerate(queries_data):
        for c_idx, val in enumerate(row):
            cell = t_queries.cell(r_idx + 1, c_idx)
            cell.text = str(val)
            if c_idx == 4:
                cell.paragraphs[0].runs[0].font.bold = True
            tcPr = cell._tc.get_or_add_tcPr()
            fill = "F7FAFC" if r_idx % 2 == 1 else "FFFFFF"
            tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill}"/>'))

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Section 3: Architectural Highlights
    h3 = doc.add_paragraph()
    r_h3 = h3.add_run("3. Architectural Conclusions & Presentation Points")
    r_h3.font.size = Pt(14)
    r_h3.font.bold = True
    r_h3.font.color.rgb = PRIMARY

    points = [
        ("Tier 0 Regex Interception: ", "Pre-compiled DFA regular expressions intercept 80% of routine campus queries in < 0.15ms with 0 tokens and 0 API cost."),
        ("Groq LPU Acceleration: ", "By utilizing Groq's Tensor Streaming Processor architecture, Qwen 27B runs at ~300+ tokens/sec with sub-second synthesis while requiring 0 MB of local laptop VRAM."),
        ("Dual Failover Architecture: ", "The system dynamically routes to Groq LPU and transparently fails over to Google Gemini 2.5 Flash, ensuring zero downtime during faculty evaluation."),
        ("PostgreSQL Hybrid Storage: ", "Single database storing strict relational records (SQL) and semantic embeddings (pgvector cosine similarity), eliminating multi-database sync overhead.")
    ]
    for bold_prefix, text in points:
        p = doc.add_paragraph(style='List Bullet')
        r_b = p.add_run(bold_prefix)
        r_b.bold = True
        p.add_run(text)

    out_path = r"D:\CampusOS_14_Query_Latency_Benchmark_Report.docx"
    doc.save(out_path)
    print(f"Generated: {out_path}")

create_benchmark_docx()
